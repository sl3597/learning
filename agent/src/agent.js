// Chat agent: Claude + knowledge-base tools, streaming manual loop.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { KB_ROOT, NOTES_DIR, MODEL, CHAT_EFFORT, USE_FALLBACKS, MAX_TOOL_ROUNDS, MAX_DOC_CHARS, localDate } from "./config.js";
import { safeResolve, normalizeRel } from "./kb.js";
import { chatSystemPrompt } from "./prompts.js";

let _client = null;
export function client() {
  // 空字符串也会抢占 SDK 的凭据优先级，导致 `ant auth login` 的登录档案被忽略。
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"]) if (process.env[k] === "") delete process.env[k];
  _client ??= new Anthropic();
  return _client;
}

// ---------- tool definitions (JSON schema, strict + eager streaming) ----------

export const TOOLS = [
  {
    name: "search_knowledge_base",
    description: "在知识库中做全文检索（支持中英文），返回最相关的文档段落。回答知识问题前必须先调用。",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "检索词，可以是自然语言问题或关键词" },
        k: { type: "integer", description: "返回条数，默认 8", minimum: 1, maximum: 30 },
        topic: { type: "string", description: "可选，限定 topic（如 linux、vla、forcevla、wam）" },
      },
      required: ["query", "k", "topic"],
      additionalProperties: false,
    },
  },
  {
    name: "read_document",
    description: "读取一篇知识库文档的完整内容（含 frontmatter）。path 是知识库根目录下的相对路径。",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "例如 LinuxCommand/03-filesystem-navigation.md" } },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "list_documents",
    description: "列出知识库文档（路径、标题、类型、主题、难度、状态）。prefix 可限定文件夹。",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { prefix: { type: "string", description: "文件夹前缀，如 Knowledge/VLA 或 Knowledge/Papers；空字符串表示全部" } },
      required: ["prefix"],
      additionalProperties: false,
    },
  },
  {
    name: "save_note",
    description: "把一份符合 STANDARD.md 的 Markdown 写入知识库。path 必须以 .md 结尾且在知识库内。默认不覆盖已有文件。",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对路径，如 notes/2026-10-17-ssh-keys.md" },
        content: { type: "string", description: "文件全文，第一行必须是 --- 开头的 frontmatter" },
        overwrite: { type: "boolean", description: "是否允许覆盖已有文件" },
      },
      required: ["path", "content", "overwrite"],
      additionalProperties: false,
    },
  },
  {
    name: "log_qa",
    description: "把一条问答摘要追加到 notes/qa-log.md，用于沉淀学习记录。",
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        answer_summary: { type: "string", description: "一两句话的结论" },
        related_paths: { type: "array", items: { type: "string" }, description: "相关文档相对路径" },
      },
      required: ["question", "answer_summary", "related_paths"],
      additionalProperties: false,
    },
  },
];

// ---------- tool execution ----------

function isString(v) {
  return typeof v === "string";
}

/** Validate tool input shape (eager streaming means the server no longer validates). */
function validateInput(name, input) {
  if (!input || typeof input !== "object") return false;
  switch (name) {
    case "search_knowledge_base":
      return isString(input.query) && Number.isInteger(input.k) && isString(input.topic);
    case "read_document":
      return isString(input.path);
    case "list_documents":
      return isString(input.prefix);
    case "save_note":
      return isString(input.path) && isString(input.content) && typeof input.overwrite === "boolean";
    case "log_qa":
      return isString(input.question) && isString(input.answer_summary) && Array.isArray(input.related_paths) && input.related_paths.every(isString);
    default:
      return false;
  }
}

export function executeTool(kb, name, input) {
  switch (name) {
    case "search_knowledge_base": {
      const hits = kb.search(input.query, input.k || 8, input.topic ? { topic: input.topic } : {});
      if (!hits.length) return "没有检索到相关内容。";
      return hits.map((h, i) => `[${i + 1}] ${h.relPath} ## ${h.heading}（${h.title}，score ${h.score}）\n${h.snippet}`).join("\n\n");
    }
    case "read_document": {
      const abs = safeResolve(input.path);
      if (!abs.endsWith(".md") || !fs.existsSync(abs)) return `文件不存在：${input.path}`;
      const text = fs.readFileSync(abs, "utf8");
      const body = text.length > MAX_DOC_CHARS ? text.slice(0, MAX_DOC_CHARS) + `\n\n…（已截断，全文 ${text.length} 字符）` : text;
      const papers = kb.relatedPapers(input.path);
      return papers.length ? `${body}\n\n---\n[反向关联] 以下论文笔记在 related 中引用了本文：\n${papers.map((p) => `- ${p.relPath}（${p.title}）`).join("\n")}` : body;
    }
    case "list_documents": {
      const rows = kb.list(input.prefix);
      if (!rows.length) return "没有文档。";
      return rows.map((r) => `${r.path} | ${r.title} | ${r.type ?? "-"} | ${r.topic ?? "-"} | ${r.level ?? "-"} | ${r.status ?? "-"}`).join("\n");
    }
    case "save_note": {
      const rel = normalizeRel(input.path);
      if (!rel.endsWith(".md")) throw new Error("只能写入 .md 文件");
      if (rel === "STANDARD.md" || rel.startsWith("templates/")) throw new Error("标准与模板文件禁止由 Agent 修改");
      if (!input.content.startsWith("---")) throw new Error("内容必须以 frontmatter（---）开头");
      const abs = safeResolve(rel);
      if (fs.existsSync(abs) && !input.overwrite) throw new Error(`文件已存在：${rel}（如需覆盖请设置 overwrite=true）`);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, input.content, "utf8");
      kb.reindex();
      return `已写入 ${rel}（${input.content.length} 字符），索引已更新。`;
    }
    case "log_qa": {
      const abs = safeResolve(`${NOTES_DIR}/qa-log.md`);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const today = localDate();
      if (!fs.existsSync(abs)) {
        fs.writeFileSync(
          abs,
          `---\ntitle: 问答沉淀日志\ntype: reference\ntopic: meta\nlevel: all\ntags: [问答, 日志, 沉淀]\nstatus: draft\ncreated: ${today}\nupdated: ${today}\n---\n\n# 问答沉淀日志\n\n> 由 Agent 自动追加。每条记录：日期、问题、结论、相关文档。\n\n`,
          "utf8",
        );
      }
      const links = input.related_paths.map((p) => `[${p}](../${normalizeRel(p)})`).join("、") || "无";
      fs.appendFileSync(abs, `## ${today} · ${input.question.trim()}\n\n- 结论：${input.answer_summary.trim()}\n- 相关文档：${links}\n\n`, "utf8");
      let text = fs.readFileSync(abs, "utf8");
      text = text.replace(/^updated: .*$/m, `updated: ${today}`);
      fs.writeFileSync(abs, text, "utf8");
      kb.reindex();
      return "已记录到 notes/qa-log.md";
    }
    default:
      throw new Error(`未知工具：${name}`);
  }
}

// ---------- chat loop ----------

/**
 * Run one assistant turn over `history` ([{role, content}] of plain text) with tools.
 * `emit(event)` receives {type:"text", text} | {type:"tool_call", name, input} |
 * {type:"tool_result", name, preview} | {type:"status", text}. Returns the final assistant text.
 */
export async function chat(kb, history, emit = () => {}) {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const system = [{ type: "text", text: chatSystemPrompt(), cache_control: { type: "ephemeral" } }];
  const params = {
    model: MODEL,
    max_tokens: 32000,
    system,
    tools: TOOLS,
    output_config: { effort: CHAT_EFFORT },
    messages,
  };
  if (USE_FALLBACKS) {
    params.betas = ["server-side-fallback-2026-06-01"];
    params.fallbacks = [{ model: "claude-opus-4-8" }];
  }

  let finalText = "";
  let jsonRetries = 0;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const stream = USE_FALLBACKS ? client().beta.messages.stream(params) : client().messages.stream(params);
    let turnText = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        turnText += event.delta.text;
        emit({ type: "text", text: event.delta.text });
      }
    }
    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (err instanceof Anthropic.APIError || jsonRetries++ >= 2) throw err;
      emit({ type: "status", text: "工具参数解析失败，重试一次…" });
      continue;
    }
    finalText += turnText;

    if (message.stop_reason === "refusal") {
      emit({ type: "status", text: "模型拒绝了这个请求。" });
      break;
    }
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    const toolUses = message.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length || message.stop_reason === "end_turn") break;
    if (message.stop_reason === "max_tokens") throw new Error("工具参数被截断（max_tokens），请重试。");

    messages.push({ role: "assistant", content: message.content });
    const results = [];
    for (const tu of toolUses) {
      emit({ type: "tool_call", name: tu.name, input: summarizeInput(tu.input) });
      if (!validateInput(tu.name, tu.input)) {
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: JSON.stringify({ INVALID_JSON: JSON.stringify(tu.input) }) });
        continue;
      }
      try {
        const out = executeTool(kb, tu.name, tu.input);
        emit({ type: "tool_result", name: tu.name, preview: String(out).slice(0, 160) });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
      } catch (err) {
        emit({ type: "tool_result", name: tu.name, preview: `错误：${err.message}` });
        results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `错误：${err.message}` });
      }
    }
    messages.push({ role: "user", content: results });
    if (turnText) {
      finalText += "\n\n";
      emit({ type: "text", text: "\n\n" });
    }
  }
  return finalText;
}

function summarizeInput(input) {
  if (!input || typeof input !== "object") return "";
  const copy = {};
  for (const [k, v] of Object.entries(input)) copy[k] = typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "…" : v;
  return copy;
}

export { KB_ROOT };

// Backend that drives the official Claude Code CLI in headless mode (`claude -p`), so chat and paper import
// run on the Claude subscription (Pro / Max) the user logged into with `claude`, not on API billing.
// The CLI does the tool loop itself (Read / Grep / Bash / Write ...); we only restrict which tools and paths
// it may touch and translate its stream-json output into the same events the API backend emits.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { KB_ROOT, CC_MODEL, CHAT_EFFORT, PAPER_EFFORT, PAPERS_DIR, localDate } from "./config.js";
import { normalizeRel, safeResolve } from "./kb.js";
import { resolveTopic, toPdfUrl } from "./paper.js";
import { syncIndexes } from "./papers.js";

const CLAUDE_BIN = process.env.KB_CLAUDE_BIN ?? "claude";

/** {installed, loggedIn, authMethod} from `claude auth status`; never throws. */
export function claudeCodeStatus() {
  const r = spawnSync(CLAUDE_BIN, ["auth", "status"], { encoding: "utf8", env: subscriptionEnv(), timeout: 15_000 });
  if (r.error) return { installed: false, loggedIn: false, authMethod: null };
  try {
    const s = JSON.parse(r.stdout);
    return { installed: true, loggedIn: Boolean(s.loggedIn), authMethod: s.authMethod ?? null };
  } catch {
    return { installed: true, loggedIn: false, authMethod: null };
  }
}

/** API credentials in the environment would make Claude Code bill the API instead of the subscription. */
function subscriptionEnv() {
  const env = { ...process.env };
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"]) delete env[k];
  return env;
}

/**
 * CLI arguments for one headless run. `allow` are permission rules; everything else is denied (dontAsk).
 * Path-scoped writes must be Edit(...) rules: Claude Code checks Write against Edit rules and ignores Write(path).
 */
export function buildArgs({ tools, allow, deny = [], system, effort }) {
  return [
    "-p",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--no-session-persistence",
    "--model", CC_MODEL,
    "--effort", effort,
    "--permission-mode", "dontAsk",
    "--permission-prompts", "none",
    "--tools", tools.join(","),
    "--allowedTools", ...allow,
    "--disallowedTools", "Read(./agent/.env)", "Read(**/.env)", ...deny,
    "--append-system-prompt", system,
  ];
}

/** Translate one stream-json line into backend events (same shapes as agent.js emits). */
export function parseStreamLine(line) {
  let e;
  try {
    e = JSON.parse(line);
  } catch {
    return [];
  }
  if (e.type === "stream_event" && !e.parent_tool_use_id) {
    const d = e.event?.delta;
    return d?.type === "text_delta" ? [{ type: "text", text: d.text }] : [];
  }
  if (e.type === "assistant" && !e.parent_tool_use_id) {
    return (e.message?.content ?? []).filter((b) => b.type === "tool_use").map((b) => ({ type: "tool_call", name: b.name, input: b.input }));
  }
  if (e.type === "user") {
    return (e.message?.content ?? [])
      .filter((b) => b.type === "tool_result")
      .map((b) => {
        const text = Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : String(b.content ?? "");
        return { type: "tool_result", name: "", preview: (b.is_error ? "错误：" : "") + text.slice(0, 160) };
      });
  }
  if (e.type === "result") return [{ type: "result", isError: Boolean(e.is_error), text: e.result ?? "", subtype: e.subtype }];
  return [];
}

/** Run `claude -p` with the prompt on stdin; resolves with the final text. */
function runClaude({ prompt, signal, emit = () => {}, ...opts }) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, buildArgs(opts), { cwd: KB_ROOT, env: subscriptionEnv(), signal });
    let buf = "";
    let stderr = "";
    let result = null;
    let streamed = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        for (const ev of parseStreamLine(line)) {
          if (ev.type === "result") result = ev;
          else {
            if (ev.type === "text") streamed += ev.text;
            emit(ev);
          }
        }
      }
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => reject(err.code === "ENOENT" ? new Error("找不到 claude 命令：请先安装 Claude Code 并用 Max 账号登录（claude 然后 /login）") : err));
    child.on("close", (code) => {
      if (result && !result.isError) return resolve(streamed || result.text);
      const why = result?.text || stderr.trim().split("\n").slice(-3).join(" ") || `claude 退出码 ${code}`;
      reject(new Error(`Claude Code 运行失败：${why}`));
    });
    child.stdin.end(prompt);
  });
}

// ---------- chat ----------

const CHAT_SYSTEM = `你是「Learning 知识库」的学习助教，运行在知识库根目录。知识库内容在 Knowledge/ 下，编写规范是 STANDARD.md。
- 回答知识问题前先检索：Bash 运行 \`node agent/src/cli.js search <关键词>\`（BM25，中英文都行），再用 Read 读相关文档。不要凭记忆回答知识库已有的内容。
- 面向初学者：先一句话给结论，再解释；术语第一次出现用大白话解释。用简体中文、Markdown，代码块标语言，命令不加 $。
- 每条来自知识库的结论附链接 [标题](Knowledge/xxx.md)，路径是知识库根目录相对路径（网页会渲染成内部链接）。知识库没有的内容说明"知识库里没有"，再用自己的知识回答并标注"（知识库外）"。
- 论文在 Knowledge/Papers/<领域>/，精读专题如 Knowledge/VLA/ForceVLA/；论文 frontmatter 的 related 指向它关联的知识章节。
- 涉及危险命令或机械臂运动时先给出 ⚠️ 安全提醒。
- 用户要求"记笔记 / 保存"时，先 Read STANDARD.md，再把符合规范（含完整 frontmatter）的文件写到 notes/ 下；不要改 notes/ 以外的文件。`;

/** Same contract as agent.js chat(): history [{role, content}] ending with a user turn; returns final text. */
export async function chat(kb, history, emit = () => {}, { signal } = {}) {
  const last = history.at(-1).content;
  const earlier = history.slice(0, -1).map((m) => `【${m.role === "user" ? "用户" : "助教"}】\n${m.content}`).join("\n\n");
  const prompt = earlier ? `以下是本次对话之前的内容，供你理解上下文：\n\n${earlier}\n\n---\n当前问题：\n${last}` : last;
  return runClaude({
    prompt,
    signal,
    emit,
    effort: CHAT_EFFORT,
    system: CHAT_SYSTEM,
    tools: ["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
    allow: ["Read", "Grep", "Glob", "Bash(node agent/src/cli.js search *)", "Edit(./notes/**)"],
  });
}

// ---------- paper import ----------

function listMd(absDir) {
  try {
    return new Set(fs.readdirSync(absDir).filter((f) => /^\d{2}-.*\.md$/.test(f)));
  } catch {
    return new Set();
  }
}

/** Same contract as paper.js ingestPaper(): returns {relPath, title, chars, problems}. */
export async function ingestPaper(kb, opts) {
  const targetDir = normalizeRel(opts.targetDir || `${PAPERS_DIR}/VLA`);
  const topic = resolveTopic(targetDir, opts.topic);
  const absDir = safeResolve(targetDir);
  const before = listMd(absDir);

  let source;
  let tmpPdf = null;
  if (opts.url) source = `arXiv / 网页链接：${opts.url}（PDF 链接：${toPdfUrl(opts.url)}）`;
  else {
    tmpPdf = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kb-paper-")), "paper.pdf");
    if (opts.base64) fs.writeFileSync(tmpPdf, Buffer.from(opts.base64, "base64"));
    else if (opts.path) fs.copyFileSync(path.resolve(opts.path), tmpPdf);
    else throw new Error("需要 url、path 或 base64 之一");
    source = `本地 PDF：${tmpPdf}（用 Read 的 pages 参数分段读）`;
  }

  const prompt = `请按 .claude/skills/import-paper/SKILL.md 的流程，把这篇论文整理成论文笔记。
- 论文来源：${source}
- 目标文件夹：${targetDir}/（只新建一个笔记文件，topic: ${topic}，created/updated: ${localDate()}）
- 做完后运行 ./start.sh papers 和 ./start.sh ci --fast，修到全绿。
- 不要提交 git，不要修改目标文件夹和 ${PAPERS_DIR}/ 以外的文件。
最后一句话告诉我新文件的路径。`;

  const write = [...new Set([targetDir, PAPERS_DIR])].map((d) => `Edit(./${d}/**)`);
  try {
    await runClaude({
      prompt,
      signal: opts.signal,
      emit: (ev) => {
        if (ev.type === "text") opts.onText?.(ev.text);
        else if (ev.type === "tool_call") opts.onText?.(`\n[${ev.name}] ${JSON.stringify(ev.input).slice(0, 120)}\n`);
      },
      effort: PAPER_EFFORT,
      system: "你在 Learning 知识库根目录工作，负责把论文导入论文库。严格遵守 STANDARD.md，数字只能来自论文原文，不确定的写 > ❓ 待解决：。",
      tools: ["Read", "Grep", "Glob", "Bash", "Write", "Edit", "WebFetch"],
      allow: ["Read", "Grep", "Glob", "WebFetch", "Bash(node agent/src/cli.js *)", "Bash(./start.sh papers)", "Bash(./start.sh ci --fast)", ...write],
    });
  } finally {
    if (tmpPdf) fs.rmSync(path.dirname(tmpPdf), { recursive: true, force: true });
  }

  const created = [...listMd(absDir)].filter((f) => !before.has(f)).sort();
  if (!created.length) throw new Error("Claude Code 结束了，但目标文件夹里没有新的论文笔记");
  kb.reindex();
  syncIndexes(kb, { write: true });
  kb.reindex();
  const relPath = `${targetDir}/${created.at(-1)}`;
  const doc = kb.getDoc(relPath);
  const problems = kb.check().filter((p) => p.file === relPath).map((p) => p.problem);
  return { relPath, title: doc?.title ?? relPath, chars: doc?.size ?? 0, problems };
}

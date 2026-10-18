// Paper ingestion: PDF (local path / URL / base64) -> paper note markdown that follows STANDARD.md.
import fs from "node:fs";
import path from "node:path";
import { KB_ROOT, MODEL, PAPER_EFFORT, USE_FALLBACKS, PAPERS_DIR, PAPER_DOMAINS, localDate } from "./config.js";
import { client } from "./agent.js";
import { safeResolve, normalizeRel, parseFrontmatter } from "./kb.js";
import { paperSystemPrompt } from "./prompts.js";
import { syncIndexes } from "./papers.js";

const MAX_PDF_BYTES = 30 * 1024 * 1024;

/** Turn an arXiv abs/html URL into its PDF URL. Other URLs are returned unchanged. */
export function toPdfUrl(url) {
  const m = url.match(/arxiv\.org\/(?:abs|html|pdf)\/(\d{4}\.\d{4,5})(v\d+)?/i);
  if (m) return `https://arxiv.org/pdf/${m[1]}${m[2] ?? ""}`;
  return url;
}

async function loadPdf(source) {
  if (source.base64) return Buffer.from(source.base64, "base64");
  if (source.url) {
    const res = await fetch(toPdfUrl(source.url), { headers: { "user-agent": "learning-kb-agent/0.1" } });
    if (!res.ok) throw new Error(`下载失败 ${res.status}: ${source.url}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (source.path) {
    const p = path.resolve(source.path);
    if (!fs.existsSync(p)) throw new Error(`文件不存在：${p}`);
    return fs.readFileSync(p);
  }
  throw new Error("需要 url、path 或 base64 之一");
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9㐀-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "paper";
}

/** Topic for a target folder: forced inside Knowledge/Papers/<Domain>, otherwise the caller's choice. */
export function resolveTopic(targetDir, topic) {
  const dir = normalizeRel(targetDir);
  if (dir.startsWith(PAPERS_DIR + "/")) {
    const conf = PAPER_DOMAINS[dir.split("/")[2]];
    if (!conf) throw new Error(`未登记的论文领域：${dir}（可选：${Object.keys(PAPER_DOMAINS).map((d) => `${PAPERS_DIR}/${d}`).join("、")}）`);
    return conf.topic;
  }
  return topic || "paper";
}

/**
 * Generate a paper note.
 * opts: {url|path|base64, targetDir (relative, default Knowledge/Papers/VLA), topic (auto inside the paper library), slug?, onText?}
 * Returns {relPath, title, chars, usage, problems}.
 */
export async function ingestPaper(kb, opts) {
  const pdf = await loadPdf(opts);
  if (pdf.length > MAX_PDF_BYTES) throw new Error(`PDF 超过 ${MAX_PDF_BYTES / 1024 / 1024}MB，请先压缩`);
  if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("下载/读取到的内容不是 PDF（arXiv 可能返回了网页），请改用直接的 PDF 链接");

  const today = localDate();
  const targetDir = normalizeRel(opts.targetDir || `${PAPERS_DIR}/VLA`);
  const topic = resolveTopic(targetDir, opts.topic);
  const docList = kb
    .list("Knowledge")
    .filter((d) => d.type !== "index" && d.type !== "paper-note")
    .map((d) => `- ${d.path}（${d.title}）`)
    .join("\n");

  const userText = `请为这篇论文生成论文笔记文件。
- topic: ${topic}
- 日期（created/updated）: ${today}
- 目标文件夹: ${targetDir}/（正文"与知识库的关联"里的相对链接要从这个文件夹出发，例如 ${path.posix.relative(targetDir, "Knowledge/VLA/Basic/04-vla-concept.md")}）
- frontmatter 的 related 写知识库根目录相对路径（例如 Knowledge/VLA/Basic/04-vla-concept.md），只能从下面列表里选 2~6 篇与本论文最相关的章节
- 已有知识章节列表（用于关联）：
${docList || "（暂无）"}

直接输出文件全文。`;

  const params = {
    model: MODEL,
    max_tokens: 64000,
    system: [{ type: "text", text: paperSystemPrompt(), cache_control: { type: "ephemeral" } }],
    output_config: { effort: PAPER_EFFORT },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: userText },
        ],
      },
    ],
  };
  if (USE_FALLBACKS) {
    params.betas = ["server-side-fallback-2026-06-01"];
    params.fallbacks = [{ model: "claude-opus-4-8" }];
  }

  const stream = USE_FALLBACKS ? client().beta.messages.stream(params) : client().messages.stream(params);
  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      opts.onText?.(event.delta.text);
    }
  }
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("模型拒绝处理这篇论文");
  if (message.stop_reason === "max_tokens") throw new Error("输出被截断，请提高 max_tokens 后重试");

  // Strip an accidental ```markdown fence.
  text = text.trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, "$1").trim() + "\n";
  if (!text.startsWith("---")) throw new Error("生成结果缺少 frontmatter，未保存");
  const { meta } = parseFrontmatter(text);
  const title = meta.title || "paper";
  const slug = opts.slug ? slugify(opts.slug) : slugify(title);

  // Next chapter number inside the target folder.
  const absDir = safeResolve(targetDir);
  fs.mkdirSync(absDir, { recursive: true });
  const existing = fs.readdirSync(absDir).filter((f) => /^\d{2}-.*\.md$/.test(f));
  const next = existing.length ? Math.max(...existing.map((f) => Number(f.slice(0, 2)))) + 1 : 1;
  const fileName = `${String(next).padStart(2, "0")}-${slug}.md`;
  const abs = path.join(absDir, fileName);
  fs.writeFileSync(abs, text, "utf8");
  kb.reindex();
  const relPath = path.relative(KB_ROOT, abs).split(path.sep).join("/");
  // 新论文要出现在论文库目录与反向索引里；生成稿的问题交给人工复核，不阻断保存。
  syncIndexes(kb, { write: true, today });
  kb.reindex();
  const problems = kb.check().filter((p) => p.file === relPath).map((p) => p.problem);
  return { relPath, title, chars: text.length, usage: message.usage, problems };
}

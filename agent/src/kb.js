// Knowledge-base indexer: walks the Learning folder, parses frontmatter,
// splits every markdown file into H2 sections and builds a BM25 index (search-core.js) that
// works for both Chinese (character bigrams) and English (words).
import fs from "node:fs";
import path from "node:path";
import { KB_ROOT, EXCLUDED_DIRS, EXCLUDED_FILES, PAPERS_DIR, PAPER_DOMAINS } from "./config.js";
import { SearchIndex } from "./search-core.js";

export { tokenize } from "./search-core.js";

// ---------- frontmatter ----------

/** Minimal YAML-subset parser: `key: value`, `key: [a, b]`, block lists. */
export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, "");
  const meta = {};
  let currentKey = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(stripQuotes(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, valueRaw] = kv;
    currentKey = key;
    const value = valueRaw.replace(/\s+#.*$/, "").trim();
    if (value === "") {
      meta[key] = [];
    } else if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter(Boolean);
    } else {
      meta[key] = stripQuotes(value);
    }
  }
  return { meta, body };
}

function stripQuotes(s) {
  return s.replace(/^["']|["']$/g, "");
}

// ---------- index ----------

export class KnowledgeBase {
  constructor(root = KB_ROOT) {
    this.root = root;
    this.docs = new Map(); // relPath -> {relPath, meta, title, body, sections:[{heading, text, start}]}
    this.chunks = []; // {relPath, title, heading, text, topic, type} — one per H2 section
    this.index = new SearchIndex([]);
    this.backlinks = new Map(); // knowledge relPath -> [paper-note relPath] (from paper frontmatter `related`)
    this.indexedAt = null;
  }

  /** Rebuild the whole index from disk. Cheap for a few hundred files. */
  reindex() {
    this.docs.clear();
    this.chunks = [];
    this.backlinks.clear();
    for (const file of walk(this.root)) {
      const relPath = path.relative(this.root, file).split(path.sep).join("/");
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const { meta, body } = parseFrontmatter(text);
      const title = meta.title ?? (body.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(relPath, ".md"));
      const sections = splitSections(body);
      this.docs.set(relPath, { relPath, meta, title, body, sections, size: text.length });
      for (const s of sections) this.chunks.push({ relPath, title, heading: s.heading, text: s.text, topic: meta.topic ?? null, type: meta.type ?? null });
    }
    for (const d of this.docs.values()) {
      if (!isPaperNote(d)) continue;
      for (const target of relatedOf(d)) {
        if (!this.backlinks.has(target)) this.backlinks.set(target, []);
        this.backlinks.get(target).push(d.relPath);
      }
    }
    this.index = new SearchIndex(this.chunks);
    this.indexedAt = new Date();
    return this.stats();
  }

  stats() {
    const byTopic = {};
    const byStatus = {};
    for (const d of this.docs.values()) {
      byTopic[d.meta.topic ?? "untagged"] = (byTopic[d.meta.topic ?? "untagged"] ?? 0) + 1;
      byStatus[d.meta.status ?? "unknown"] = (byStatus[d.meta.status ?? "unknown"] ?? 0) + 1;
    }
    return { documents: this.docs.size, chunks: this.chunks.length, byTopic, byStatus, indexedAt: this.indexedAt };
  }

  /** BM25 search over sections. Returns [{relPath, title, heading, score, snippet}]. */
  search(query, k = 8, filter = {}) {
    return this.index.search(query, k, filter);
  }

  getDoc(relPath) {
    return this.docs.get(normalizeRel(relPath)) ?? null;
  }

  /** What the reader page needs for one document (served by /api/doc and written by the static build). */
  docPayload(relPath) {
    const doc = this.getDoc(relPath);
    if (!doc) return null;
    const brief = (d) => ({ path: d.relPath, title: d.title, year: d.meta.year ?? null, status: d.meta.status ?? null });
    const related = doc.meta.type === "paper-note" ? relatedOf(doc).map((p) => this.docs.get(p)).filter(Boolean).map(brief) : [];
    return { path: doc.relPath, title: doc.title, meta: doc.meta, body: doc.body, related, relatedPapers: this.relatedPapers(doc.relPath).map(brief) };
  }

  /** Paper notes whose `related` points at relPath (the "相关论文" backlinks). */
  relatedPapers(relPath) {
    return (this.backlinks.get(normalizeRel(relPath)) ?? []).map((p) => this.docs.get(p)).filter(Boolean);
  }

  /** Nested folder tree used by the web sidebar. */
  tree() {
    const root = { name: path.basename(this.root), path: "", dirs: {}, files: [] };
    for (const d of [...this.docs.values()].sort((a, b2) => a.relPath.localeCompare(b2.relPath))) {
      const parts = d.relPath.split("/");
      let node = root;
      for (const part of parts.slice(0, -1)) {
        node.dirs[part] ??= { name: part, path: node.path ? `${node.path}/${part}` : part, dirs: {}, files: [] };
        node = node.dirs[part];
      }
      node.files.push({
        path: d.relPath,
        name: parts.at(-1),
        title: d.title,
        type: d.meta.type ?? null,
        level: d.meta.level ?? null,
        status: d.meta.status ?? null,
        chapter: d.meta.chapter != null ? Number(d.meta.chapter) : null,
        estimated_time: d.meta.estimated_time ?? null,
        topic: d.meta.topic ?? null,
        tags: Array.isArray(d.meta.tags) ? d.meta.tags : [],
        year: d.meta.year ?? null,
        summary: summaryOf(d.body) ?? summaryOf(d.sections.find((x) => x.heading === "一句话总结")?.text.replace(/^/, "> ") ?? ""),
      });
    }
    const toArray = (n) => ({ ...n, dirs: Object.values(n.dirs).map(toArray) });
    return toArray(root);
  }

  /** Flat listing for the agent's list_documents tool. */
  list(prefix = "") {
    const p = normalizeRel(prefix);
    return [...this.docs.values()]
      .filter((d) => !p || d.relPath.startsWith(p))
      .map((d) => ({
        path: d.relPath,
        title: d.title,
        type: d.meta.type ?? null,
        topic: d.meta.topic ?? null,
        level: d.meta.level ?? null,
        status: d.meta.status ?? null,
        tags: d.meta.tags ?? [],
        related: d.meta.type === "paper-note" ? relatedOf(d) : undefined,
      }));
  }

  /** Validate every document against STANDARD.md and return problems. */
  check() {
    const required = {
      tutorial: ["学习目标", "前置知识", "核心概念", "详细讲解", "动手练习", "常见错误与排查", "小结", "自测题", "参考资料"],
      "paper-note": ["论文信息", "一句话总结", "背景与动机", "方法", "实验", "优点与不足", "与知识库的关联", "复现清单", "我的问题与想法"],
      hardware: ["设备概览", "关键参数", "安全须知", "系统组成", "安装与启动流程", "基本操作", "编程接口", "常见故障与排查", "维护与关机", "参考资料"],
    };
    const problems = [];
    for (const d of this.docs.values()) {
      const where = d.relPath;
      if (where.startsWith("templates/")) continue; // 模板允许占位内容
      const m = d.meta;
      const prose = d.body.replace(/^\s*```[\s\S]*?^\s*```\s*$/gm, "").replace(/`[^`\n]*`/g, ""); // 去掉代码块与行内代码后再查标题和链接
      for (const f of ["title", "type", "topic", "level", "tags", "status", "created", "updated"]) {
        if (m[f] == null || (Array.isArray(m[f]) && !m[f].length)) problems.push({ file: where, problem: `frontmatter 缺少 ${f}` });
      }
      if (!/^(\d{2}-[a-z0-9-]+|\d{2}-README|README)\.md$/.test(path.basename(where)) && !["STANDARD.md", "README.md"].includes(where) && !where.startsWith("templates/"))
        problems.push({ file: where, problem: "文件名不符合 NN-kebab-case.md" });
      const headings = new Set([...prose.matchAll(/^##\s+(.+?)\s*$/gm)].map((h) => h[1].trim()));
      for (const h of required[m.type] ?? []) if (!headings.has(h)) problems.push({ file: where, problem: `缺少固定段落 ## ${h}` });
      for (const link of prose.matchAll(/\]\(([^)\s#]+\.md)(#[^)]*)?\)/g)) {
        const target = link[1];
        if (/^https?:/.test(target)) continue;
        const abs = path.resolve(this.root, path.dirname(where), target);
        if (!fs.existsSync(abs)) problems.push({ file: where, problem: `链接目标不存在: ${target}` });
      }
      let inFence = false;
      d.body.split("\n").forEach((line, i) => {
        if (!/^\s*```/.test(line)) return;
        if (!inFence && /^\s*```\s*$/.test(line)) problems.push({ file: where, problem: `代码块未标语言（第 ${i + 1} 行）` });
        inFence = !inFence;
      });
      if (m.type === "paper-note") problems.push(...this.checkPaper(d).map((problem) => ({ file: where, problem })));
      if (where.startsWith(PAPERS_DIR + "/")) problems.push(...checkPapersLayout(d).map((problem) => ({ file: where, problem })));
    }
    for (const domain of Object.keys(PAPER_DOMAINS)) {
      const readme = `${PAPERS_DIR}/${domain}/00-README.md`;
      if (!this.docs.has(readme)) problems.push({ file: readme, problem: "论文库领域目录缺少 00-README.md" });
    }
    return problems;
  }

  /** STANDARD.md 第 11 节：论文必须通过 `related` 与知识章节双向关联。 */
  checkPaper(d) {
    const problems = [];
    const related = relatedOf(d);
    if (!related.length) problems.push("frontmatter 缺少 related（论文笔记必须关联至少一篇知识章节）");
    let knowledgeTargets = 0;
    for (const target of related) {
      const t = this.docs.get(target);
      if (!target.startsWith("Knowledge/")) problems.push(`related 必须是 Knowledge/ 下的路径: ${target}`);
      else if (!t) problems.push(`related 目标不存在: ${target}`);
      else if (t.relPath === d.relPath) problems.push("related 不能指向自己");
      else if (t.meta.type !== "paper-note" && !t.relPath.startsWith(PAPERS_DIR + "/")) knowledgeTargets++;
    }
    if (related.length && !knowledgeTargets) problems.push("related 至少要包含一篇知识章节（不能只关联论文或论文库目录）");
    const section = d.sections.find((s) => s.heading === "与知识库的关联");
    if (section && !/\]\([^)\s#]+\.md(#[^)]*)?\)/.test(section.text)) problems.push("## 与知识库的关联 里没有任何指向知识库文档的链接");
    if (d.meta.year != null && !/^\d{4}$/.test(String(d.meta.year))) problems.push(`year 必须是四位年份: ${d.meta.year}`);
    return problems;
  }
}

// ---------- helpers ----------

/** A real paper note: type paper-note inside Knowledge/ (templates and notes/ drafts don't count). */
export function isPaperNote(doc) {
  return doc.meta.type === "paper-note" && doc.relPath.startsWith("Knowledge/");
}

const CALLOUT_PREFIX = /^(💡|⚠️|🔍|🔗|❓|📌)/;

/** The one-line intro every chapter starts with (STANDARD 第 4 节的 "> 一句话说明"), as plain text for cards. */
export function summaryOf(body, max = 120) {
  for (const line of body.split("\n")) {
    if (/^#{1,6}\s/.test(line) || !line.trim()) continue;
    if (!line.startsWith(">")) return null; // 简介只认标题后的第一个引用块
    const text = line
      .replace(/^>\s*/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (!text || CALLOUT_PREFIX.test(text)) return null;
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }
  return null;
}

/** `related` frontmatter as a list of normalized KB-root paths. */
export function relatedOf(doc) {
  const r = doc.meta.related;
  return (Array.isArray(r) ? r : r ? [r] : []).map(normalizeRel).filter(Boolean);
}

/** Layout rules inside Knowledge/Papers/: <Domain>/00-README.md + <Domain>/NN-*.md paper notes. */
function checkPapersLayout(d) {
  const rest = d.relPath.slice(PAPERS_DIR.length + 1).split("/");
  if (rest.length === 1) return rest[0] === "00-README.md" ? [] : ["论文库根目录只放 00-README.md，论文请放进领域子目录"];
  if (rest.length > 2) return ["论文库只有一层领域子目录（Knowledge/Papers/<领域>/NN-xxx.md），精读专题请放到对应主题目录"];
  const [domain, file] = rest;
  const conf = PAPER_DOMAINS[domain];
  if (!conf) return [`未登记的论文领域目录 ${domain}（在 agent/src/config.js 的 PAPER_DOMAINS 与 STANDARD.md 第 11 节登记）`];
  if (file === "00-README.md") return d.meta.type === "index" ? [] : ["领域目录文件必须是 type: index"];
  const problems = [];
  if (d.meta.type !== "paper-note") problems.push("论文库里的文件必须是 type: paper-note");
  if (d.meta.topic !== conf.topic) problems.push(`${domain}/ 下论文的 topic 必须是 ${conf.topic}`);
  return problems;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDED_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".md") && !EXCLUDED_FILES.has(e.name)) {
      yield full;
    }
  }
}

/** Split a markdown body into sections at H2 headings (text before the first H2 is the "intro"). */
export function splitSections(body) {
  const lines = body.split("\n");
  const sections = [];
  let heading = "（开头）";
  let buf = [];
  let inFence = false;
  let start = 0;
  lines.forEach((line, i) => {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && /^##\s+/.test(line)) {
      if (buf.join("\n").trim()) sections.push({ heading, text: buf.join("\n").trim(), start });
      heading = line.replace(/^##\s+/, "").trim();
      buf = [];
      start = i;
    } else {
      buf.push(line);
    }
  });
  if (buf.join("\n").trim()) sections.push({ heading, text: buf.join("\n").trim(), start });
  return sections;
}

export function normalizeRel(p) {
  return String(p ?? "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");
}

/** Resolve a knowledge-base-relative path and make sure it stays inside the root and outside excluded dirs. */
export function safeResolve(relPath, root = KB_ROOT) {
  const rel = normalizeRel(relPath);
  const abs = path.resolve(root, rel);
  const relative = path.relative(root, abs);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error(`路径越界：${relPath}`);
  }
  const first = relative.split(path.sep)[0];
  if (EXCLUDED_DIRS.has(first)) throw new Error(`禁止访问目录：${first}`);
  return abs;
}

// Notes written from the web editor (POST /api/note): validate the target path, write the file,
// re-index, refresh the paper-library tables and report STANDARD problems — the "save" half of
// "save → rebuild". The static-site rebuild and live-reload broadcast live in server.js.
import fs from "node:fs";
import path from "node:path";
import { NOTES_DIR, PAPERS_DIR, PAPER_DOMAINS, localDate } from "./config.js";
import { safeResolve, normalizeRel, parseFrontmatter, FILE_NAME_RE, FRONTMATTER_FIELDS, SECTION_RULES } from "./kb.js";
import { syncIndexes } from "./papers.js";

export { FILE_NAME_RE };

/** What the editor needs to lint a draft before saving (mirrors kb.check()). */
export function editorRules() {
  return { fields: FRONTMATTER_FIELDS, sections: SECTION_RULES, fileName: FILE_NAME_RE.source, summaryMax: 60 };
}

/** Files the editor must never touch (the protocol and its templates; same rule as the agent's save_note). */
export function isProtected(rel) {
  return rel === "STANDARD.md" || rel.startsWith("templates/");
}

/** Folders a new note may be created in: every indexed knowledge folder, the paper domains and notes/. */
export function editableDirs(kb) {
  const dirs = new Set([NOTES_DIR, ...Object.keys(PAPER_DOMAINS).map((d) => `${PAPERS_DIR}/${d}`)]);
  for (const d of kb.docs.values()) {
    const dir = path.posix.dirname(d.relPath);
    if (dir !== "." && !dir.startsWith("templates")) dirs.add(dir);
  }
  return [...dirs].sort();
}

/**
 * Check a target path before writing. Throws with a message the UI can show.
 * New files: inside Knowledge/ or notes/, name NN-kebab-case.md. Existing files: any indexed doc except the protected ones.
 */
export function validateNotePath(kb, relPath, { overwrite = false } = {}) {
  const rel = normalizeRel(relPath);
  if (!rel || !rel.endsWith(".md")) throw new Error("只能保存 .md 文件");
  if (rel.includes("..")) throw new Error(`路径越界：${relPath}`);
  if (isProtected(rel)) throw new Error("STANDARD.md 与 templates/ 不能在网页里修改");
  const abs = safeResolve(rel, kb.root); // 越出知识库根目录、进入 agent/ 等排除目录都会抛错
  const exists = fs.existsSync(abs);
  if (exists && !overwrite) throw new Error(`文件已存在：${rel}（在编辑模式下打开它，或换一个文件名）`);
  if (exists && !kb.docs.has(rel)) throw new Error(`${rel} 不是知识库里的文档，不能覆盖`);
  if (!exists) {
    const top = rel.split("/")[0];
    if (!(top === "Knowledge" || top === NOTES_DIR) || !rel.includes("/")) throw new Error(`新文件只能放在 Knowledge/ 或 ${NOTES_DIR}/ 下`);
    if (!FILE_NAME_RE.test(path.posix.basename(rel))) throw new Error("文件名必须是 两位数字-小写英文短横线.md（例如 03-my-note.md）");
  }
  return { rel, abs, exists };
}

/**
 * Write a note and bring the index up to date. Returns what the UI needs:
 * {relPath, created, title, problems: [STANDARD problems of this file], indexes: [paper-library READMEs rewritten]}.
 */
export function saveNote(kb, { path: relPath, content, overwrite = false }) {
  if (typeof content !== "string" || !content.trim()) throw new Error("内容为空");
  if (!content.startsWith("---")) throw new Error("第一行必须是 --- 开头的 frontmatter（见 STANDARD.md 第 3 节）");
  const { rel, abs, exists } = validateNotePath(kb, relPath, { overwrite });
  const text = content.replace(/\r\n/g, "\n").replace(/\n*$/, "\n");
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, "utf8");
  kb.reindex();
  // 论文笔记的 related 变了，论文库目录表格要跟着变（和论文导入一样自动刷新）
  const indexes = syncIndexes(kb, { write: true }).filter((r) => r.status === "updated").map((r) => r.relPath);
  if (indexes.length) kb.reindex();
  const doc = kb.getDoc(rel);
  return {
    relPath: rel,
    created: !exists,
    title: doc?.title ?? parseFrontmatter(text).meta.title ?? rel,
    problems: kb.check().filter((p) => p.file === rel).map((p) => p.problem),
    indexes,
  };
}

/** Raw markdown (with frontmatter) of an indexed document, for the editor. */
export function readNote(kb, relPath) {
  const rel = normalizeRel(relPath);
  if (!kb.docs.has(rel)) throw new Error(`找不到文档：${rel}`);
  return { path: rel, content: fs.readFileSync(safeResolve(rel, kb.root), "utf8"), editable: !isProtected(rel) };
}

/** Starting points for a new note: the three STANDARD templates plus a free-form note, dates set to today. */
export function noteTemplates(kb, today = localDate()) {
  const read = (name) => {
    try {
      return fs.readFileSync(path.join(kb.root, "templates", name), "utf8");
    } catch {
      return null;
    }
  };
  const dated = (s) => s?.replace(/^(created|updated):\s*\S+/gm, `$1: ${today}`) ?? null;
  const free = `---
title: 笔记标题
type: reference
topic: vla
level: all
tags: [笔记]
status: draft
created: ${today}
updated: ${today}
---

# 笔记标题

> 一句话说明这篇笔记记录了什么。

## 要点

- 

## 详细记录

## 待解决

> ❓ 待解决：
`;
  return [
    { id: "note", label: "自由笔记（reference）", type: "reference", content: free },
    { id: "tutorial", label: "教程章节（tutorial）", type: "tutorial", content: dated(read("tutorial-template.md")) },
    { id: "paper-note", label: "论文笔记（paper-note）", type: "paper-note", content: dated(read("paper-note-template.md")) },
    { id: "hardware", label: "硬件文档（hardware）", type: "hardware", content: dated(read("hardware-template.md")) },
  ].filter((t) => t.content);
}


/**
 * 把一篇新章节登记到所在文件夹 00-README.md 的章节表（STANDARD 第 8/9 节）：按表头列名填一行，按 NN 顺序插入。
 * 返回 {status: added | exists | auto | no-readme | no-table | skip, readme, row?}；论文库目录是自动生成的，不手写。
 */
export function registerChapter(kb, relPath, { today = localDate() } = {}) {
  const rel = normalizeRel(relPath);
  const doc = kb.getDoc(rel);
  if (!doc) throw new Error(`找不到文档：${rel}`);
  const dir = path.posix.dirname(rel);
  const base = path.posix.basename(rel);
  const readme = `${dir}/00-README.md`;
  if (base === "00-README.md" || dir === ".") return { status: "skip", readme };
  if (rel.startsWith(PAPERS_DIR + "/")) return { status: "auto", readme };
  const abs = safeResolve(readme, kb.root);
  if (!fs.existsSync(abs)) return { status: "no-readme", readme };
  const lines = fs.readFileSync(abs, "utf8").split("\n");
  if (lines.some((l) => l.includes(`](${base})`) || l.includes("`" + base + "`"))) return { status: "exists", readme };
  const head = lines.findIndex((l, i) => /^\|/.test(l) && /文件|章节/.test(l) && /^\|\s*:?-+/.test(lines[i + 1] ?? ""));
  if (head < 0) return { status: "no-table", readme };
  const headers = lines[head].split("|").slice(1, -1).map((h) => h.trim());
  const nn = Number(base.match(/^(\d{2})-/)?.[1] ?? 99);
  const m = doc.meta;
  const cell = (h) => {
    if (/文件/.test(h)) return `[${base}](${base})`;
    if (/章节|标题|名称/.test(h)) return `${String(nn).padStart(2, "0")} ${doc.title}`;
    if (/类型/.test(h)) return m.type ?? "—";
    if (/难度/.test(h)) return m.level ?? "—";
    if (/时长/.test(h)) return m.estimated_time ?? "—";
    if (/状态/.test(h)) return m.status ?? "—";
    return "—";
  };
  const row = `| ${headers.map((h) => String(cell(h)).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
  // 表格的数据行是紧跟表头的连续 | 行；按章节号找插入位置，没有更大的就放最后
  let end = head + 1;
  while (end + 1 < lines.length && /^\|/.test(lines[end + 1])) end++;
  let at = end + 1;
  for (let i = head + 2; i <= end; i++) {
    const n = Number(lines[i].match(/\[(\d{2})-[^\]]*\]\(|^\|\s*`?(\d{2})\b/)?.slice(1).find(Boolean) ?? NaN);
    if (!Number.isNaN(n) && n > nn) {
      at = i;
      break;
    }
  }
  lines.splice(at, 0, row);
  fs.writeFileSync(abs, lines.join("\n").replace(/^updated: .*$/m, `updated: ${today}`), "utf8");
  kb.reindex();
  return { status: "added", readme, row };
}

// Paper library: keeps the AUTO-GENERATED tables in Knowledge/Papers/**/00-README.md in sync with the
// paper notes' `related` frontmatter, so papers -> knowledge and knowledge -> papers are both browsable.
import fs from "node:fs";
import path from "node:path";
import { PAPERS_DIR, PAPER_DOMAINS, localDate } from "./config.js";
import { isPaperNote, relatedOf, safeResolve } from "./kb.js";

export const AUTO_START = "<!-- AUTO-GENERATED:papers START · 由 ./start.sh papers 生成，请勿手改 -->";
export const AUTO_END = "<!-- AUTO-GENERATED:papers END -->";

/** Domain folder a paper note belongs to: its Papers/ sub-folder, or the domain whose topics include its topic. */
export function domainOf(doc) {
  if (doc.relPath.startsWith(PAPERS_DIR + "/")) return doc.relPath.split("/")[2];
  return Object.entries(PAPER_DOMAINS).find(([, c]) => c.topics.includes(doc.meta.topic))?.[0] ?? "Robotics";
}

/** All paper notes in the knowledge base, newest year first. */
export function listPapers(kb) {
  return [...kb.docs.values()]
    .filter(isPaperNote)
    .sort((a, b) => Number(b.meta.year ?? 0) - Number(a.meta.year ?? 0) || a.relPath.localeCompare(b.relPath));
}

const cell = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ") || "—";
const linkText = (s) => cell(s).replace(/[[\]]/g, "");
const rel = (fromFile, target) => path.posix.relative(path.posix.dirname(fromFile), target);
const link = (fromFile, doc) => `[${linkText(doc.title)}](${rel(fromFile, doc.relPath)})`;

function domainBlock(kb, domain, readme) {
  const rows = listPapers(kb).filter((d) => domainOf(d) === domain);
  if (!rows.length) return `_暂无论文。导入：\`./start.sh paper <arXiv链接> ${PAPERS_DIR}/${domain}\`_`;
  const lines = ["| 论文 | 年份 | 发表 | 难度 | 状态 | 关联知识 |", "|---|---|---|---|---|---|"];
  for (const d of rows) {
    const deepDive = d.relPath.startsWith(PAPERS_DIR + "/") ? "" : "（精读专题）";
    const related = relatedOf(d)
      .map((p) => kb.docs.get(p))
      .filter(Boolean)
      .map((t) => link(readme, t))
      .join("<br>");
    lines.push(`| ${link(readme, d)}${deepDive} | ${cell(d.meta.year)} | ${cell(d.meta.venue)} | ${cell(d.meta.level)} | ${cell(d.meta.status)} | ${related || "—"} |`);
  }
  return lines.join("\n");
}

function rootBlock(kb, readme) {
  const all = listPapers(kb);
  const out = ["### 各领域论文数", "", "| 领域 | 论文数 | 入口 |", "|---|---|---|"];
  for (const [domain, conf] of Object.entries(PAPER_DOMAINS)) {
    const n = all.filter((d) => domainOf(d) === domain).length;
    out.push(`| ${conf.label} | ${n} | [${domain}/00-README.md](${domain}/00-README.md) |`);
  }
  out.push("", "### 知识章节 → 相关论文（反向索引）", "");
  const targets = [...kb.backlinks.keys()].filter((p) => kb.docs.has(p)).sort();
  if (!targets.length) {
    out.push("_暂无。论文笔记 frontmatter 里的 `related` 会自动汇总到这里。_");
  } else {
    out.push("| 知识章节 | 相关论文 |", "|---|---|");
    for (const t of targets) out.push(`| ${link(readme, kb.docs.get(t))} | ${kb.relatedPapers(t).map((p) => link(readme, p)).join("<br>")} |`);
  }
  return out.join("\n");
}

/** Expected AUTO block per index file: {relPath: blockText}. */
export function renderIndexes(kb) {
  const out = { [`${PAPERS_DIR}/00-README.md`]: rootBlock(kb, `${PAPERS_DIR}/00-README.md`) };
  for (const domain of Object.keys(PAPER_DOMAINS)) {
    const readme = `${PAPERS_DIR}/${domain}/00-README.md`;
    out[readme] = domainBlock(kb, domain, readme);
  }
  return out;
}

/**
 * Compare (and with write=true, rewrite) the AUTO blocks. Returns [{relPath, status}] where status is
 * "ok" | "stale" | "updated" | "missing-file" | "missing-markers".
 */
export function syncIndexes(kb, { write = false, today = localDate() } = {}) {
  const results = [];
  for (const [relPath, block] of Object.entries(renderIndexes(kb))) {
    const abs = safeResolve(relPath, kb.root);
    if (!fs.existsSync(abs)) {
      results.push({ relPath, status: "missing-file" });
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const i = text.indexOf(AUTO_START);
    const j = text.indexOf(AUTO_END);
    if (i === -1 || j === -1 || j < i) {
      results.push({ relPath, status: "missing-markers" });
      continue;
    }
    const current = text.slice(i + AUTO_START.length, j).trim();
    if (current === block) {
      results.push({ relPath, status: "ok" });
      continue;
    }
    if (!write) {
      results.push({ relPath, status: "stale" });
      continue;
    }
    const next = (text.slice(0, i) + `${AUTO_START}\n${block}\n${AUTO_END}` + text.slice(j + AUTO_END.length)).replace(/^updated: .*$/m, `updated: ${today}`);
    fs.writeFileSync(abs, next, "utf8");
    results.push({ relPath, status: "updated" });
  }
  return results;
}

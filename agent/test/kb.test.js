import { test } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBase, parseFrontmatter, tokenize, safeResolve, splitSections } from "../src/kb.js";
import { makeKb, tutorial, paper } from "./fixture.js";

const problemsOf = (files) => {
  const kb = new KnowledgeBase(makeKb(files));
  kb.reindex();
  return kb.check();
};
const has = (problems, file, text) => problems.some((p) => p.file === file && p.problem.includes(text));

test("frontmatter: inline lists, block lists, comments, quotes", () => {
  const { meta, body } = parseFrontmatter(`---\ntitle: "标题"\ntags: [a, b]  # 注释\nrelated:\n  - Knowledge/x.md\n  - Knowledge/y.md\nyear: 2025\n---\n# 正文`);
  assert.equal(meta.title, "标题");
  assert.deepEqual(meta.tags, ["a", "b"]);
  assert.deepEqual(meta.related, ["Knowledge/x.md", "Knowledge/y.md"]);
  assert.equal(meta.year, "2025");
  assert.equal(body, "# 正文");
});

test("tokenize: English words + Chinese bigrams", () => {
  assert.deepEqual(tokenize("chmod 权限管理"), ["chmod", "权限", "限管", "管理"]);
});

test("splitSections ignores ## inside code fences", () => {
  const s = splitSections("intro\n## A\n```bash\n## not a heading\n```\n## B\nx");
  assert.deepEqual(s.map((x) => x.heading), ["（开头）", "A", "B"]);
});

test("safeResolve refuses to escape the root or enter agent/", (t) => {
  const root = makeKb();
  assert.throws(() => safeResolve("../etc/passwd", root), /越界/);
  assert.throws(() => safeResolve("agent/.env", root), /禁止/);
  assert.ok(safeResolve("Knowledge/VLA/01-basics.md", root).endsWith("01-basics.md"));
});

test("the baseline fixture is clean", () => {
  assert.deepEqual(problemsOf({}), []);
});

test("check(): frontmatter, headings, links, code fences, file names", () => {
  const broken = tutorial("坏章节").replace("updated: 2026-10-17\n", "").replace("## 小结", "## 总结") + "\n[x](nope.md)\n\n```\ncode\n```\n";
  const p = problemsOf({ "Knowledge/VLA/02-broken.md": broken, "Knowledge/VLA/Bad Name.md": tutorial("名字") });
  assert.ok(has(p, "Knowledge/VLA/02-broken.md", "缺少 updated"));
  assert.ok(has(p, "Knowledge/VLA/02-broken.md", "缺少固定段落 ## 小结"));
  assert.ok(has(p, "Knowledge/VLA/02-broken.md", "链接目标不存在: nope.md"));
  assert.ok(has(p, "Knowledge/VLA/02-broken.md", "代码块未标语言"));
  assert.ok(has(p, "Knowledge/VLA/Bad Name.md", "文件名不符合"));
});

test("paper notes must have valid related + a link in 与知识库的关联", () => {
  const f = "Knowledge/Papers/VLA/01-x.md";
  assert.ok(has(problemsOf({ [f]: paper("x", { related: null }) }), f, "缺少 related"));
  assert.ok(has(problemsOf({ [f]: paper("x", { related: ["Knowledge/VLA/99-missing.md"] }) }), f, "related 目标不存在"));
  assert.ok(has(problemsOf({ [f]: paper("x", { related: ["VLA/01-basics.md"] }) }), f, "必须是 Knowledge/ 下的路径"));
  assert.ok(has(problemsOf({ [f]: paper("x", { related: ["Knowledge/Papers/VLA/00-README.md"] }) }), f, "至少要包含一篇知识章节"));
  assert.ok(has(problemsOf({ [f]: paper("x", { link: "" }) }), f, "没有任何指向知识库文档的链接"));
  assert.ok(has(problemsOf({ [f]: paper("x", { year: "25" }) }), f, "四位年份"));
  assert.deepEqual(problemsOf({ [f]: paper("x") }), []);
});

test("paper library layout: domain folders, topic, type, README", () => {
  const p = problemsOf({
    "Knowledge/Papers/WAM/01-wrong-topic.md": paper("t", { topic: "vla" }),
    "Knowledge/Papers/NLP/01-unknown.md": paper("u"),
    "Knowledge/Papers/01-loose.md": paper("l"),
    "Knowledge/Papers/VLA/02-tutorial.md": tutorial("t"),
    "Knowledge/Papers/Robotics/00-README.md": null,
  });
  assert.ok(has(p, "Knowledge/Papers/WAM/01-wrong-topic.md", "topic 必须是 wam"));
  assert.ok(has(p, "Knowledge/Papers/NLP/01-unknown.md", "未登记的论文领域目录 NLP"));
  assert.ok(has(p, "Knowledge/Papers/01-loose.md", "只放 00-README.md"));
  assert.ok(has(p, "Knowledge/Papers/VLA/02-tutorial.md", "必须是 type: paper-note"));
  assert.ok(has(p, "Knowledge/Papers/Robotics/00-README.md", "缺少 00-README.md"));
});

test("backlinks: knowledge chapter -> papers that list it in related", () => {
  const kb = new KnowledgeBase(makeKb({ "Knowledge/Papers/VLA/01-x.md": paper("X 论文"), "templates/paper-note-template.md": paper("模板") }));
  kb.reindex();
  assert.deepEqual(kb.relatedPapers("Knowledge/VLA/01-basics.md").map((d) => d.title), ["X 论文"]);
});

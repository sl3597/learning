// Web note editor: POST /api/note writes a file, re-indexes, refreshes the paper tables and rebuilds the static site.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";
import { saveNote, validateNotePath, noteTemplates, editableDirs, readNote, registerChapter } from "../src/notes.js";
import { AUTO_START, AUTO_END } from "../src/papers.js";
import { makeKb, tutorial, paper } from "./fixture.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("saveNote: writes, re-indexes, reports STANDARD problems of that file only", () => {
  const root = makeKb();
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const r = saveNote(kb, { path: "Knowledge/VLA/02-new.md", content: tutorial("新章节") });
  assert.equal(r.created, true);
  assert.equal(r.title, "新章节");
  assert.deepEqual(r.problems, []);
  assert.ok(fs.existsSync(path.join(root, "Knowledge/VLA/02-new.md")));
  assert.ok(kb.docs.has("Knowledge/VLA/02-new.md"), "保存后立即进入索引");
  // 不合规的内容也允许保存（草稿），但要把该文件的问题报出来
  const bad = saveNote(kb, { path: "notes/01-draft.md", content: tutorial("草稿").replace("## 小结", "## 总结") });
  assert.ok(bad.problems.some((p) => p.includes("缺少固定段落 ## 小结")));
  assert.ok(readNote(kb, "notes/01-draft.md").content.startsWith("---"));
});

test("saveNote: refuses bad names, escapes, protected files and silent overwrites", () => {
  const root = makeKb({ "templates/tutorial-template.md": tutorial("模板"), "STANDARD.md": tutorial("标准") });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const content = tutorial("x");
  assert.throws(() => validateNotePath(kb, "Knowledge/VLA/Bad Name.md"), /文件名必须/);
  assert.throws(() => validateNotePath(kb, "Knowledge/VLA/02-x.txt"), /\.md/);
  assert.throws(() => validateNotePath(kb, "../outside/01-x.md"), /越界/);
  assert.throws(() => validateNotePath(kb, "agent/01-x.md"), /禁止访问|只能放在/);
  assert.throws(() => validateNotePath(kb, "01-root.md"), /只能放在/);
  assert.throws(() => validateNotePath(kb, "STANDARD.md", { overwrite: true }), /不能在网页里修改/);
  assert.throws(() => validateNotePath(kb, "templates/tutorial-template.md", { overwrite: true }), /不能在网页里修改/);
  assert.throws(() => saveNote(kb, { path: "Knowledge/VLA/01-basics.md", content }), /文件已存在/);
  assert.throws(() => saveNote(kb, { path: "Knowledge/VLA/02-x.md", content: "# 没有 frontmatter" }), /frontmatter/);
  // 显式 overwrite 才能改已有文档
  const r = saveNote(kb, { path: "Knowledge/VLA/01-basics.md", content: tutorial("基础（改）"), overwrite: true });
  assert.equal(r.created, false);
  assert.equal(kb.getDoc("Knowledge/VLA/01-basics.md").title, "基础（改）");
});

test("saveNote: a paper note refreshes the paper-library tables automatically", () => {
  const root = makeKb();
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const r = saveNote(kb, { path: "Knowledge/Papers/VLA/01-x.md", content: paper("X 论文") });
  assert.deepEqual(r.problems, []);
  assert.ok(r.indexes.includes("Knowledge/Papers/VLA/00-README.md") && r.indexes.includes("Knowledge/Papers/00-README.md"));
  const readme = fs.readFileSync(path.join(root, "Knowledge/Papers/VLA/00-README.md"), "utf8");
  assert.match(readme.slice(readme.indexOf(AUTO_START), readme.indexOf(AUTO_END)), /X 论文/);
  assert.deepEqual(kb.relatedPapers("Knowledge/VLA/01-basics.md").map((d) => d.title), ["X 论文"]);
});

test("templates and editable folders", () => {
  const root = makeKb({ "templates/tutorial-template.md": tutorial("模板").replace(/created: .*/, "created: 2026-01-01") });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const t = noteTemplates(kb, "2026-10-19");
  assert.ok(t.length >= 2 && t.every((x) => x.content.startsWith("---")));
  assert.match(t.find((x) => x.id === "tutorial").content, /created: 2026-10-19/);
  assert.match(t[0].content, /updated: 2026-10-19/);
  const dirs = editableDirs(kb);
  assert.ok(dirs.includes("notes") && dirs.includes("Knowledge/VLA") && dirs.includes("Knowledge/Papers/WAM") && !dirs.includes("templates"));
});

// ---- end to end: real server on a fixture KB, static site rebuilt into a temp dir, change pushed over SSE ----
let server;
let serverPort = 0;
after(() => server?.kill());
test("POST /api/note saves, rebuilds the static site and notifies /api/events subscribers", async () => {
  const root = makeKb();
  const dist = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kb-dist-")), "site");
  server = spawn(process.execPath, [path.join(AGENT, "src/server.js")], { env: { ...process.env, PORT: "0", KB_ROOT: root, KB_DIST: dist, ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const base = await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`服务 10 秒内未启动：\n${out}`)), 10_000);
    server.stdout.on("data", (d) => { out += d; const m = out.match(/http:\/\/localhost:(\d+)/); if (m) { clearTimeout(timer); serverPort = Number(m[1]); resolve(`http://localhost:${m[1]}`); } });
    server.on("exit", (code) => reject(new Error(`服务提前退出 ${code}：\n${out}`)));
  });
  // 先订阅事件，再保存
  const events = [];
  const es = await fetch(base + "/api/events");
  assert.match(es.headers.get("content-type"), /text\/event-stream/);
  const reader = es.body.getReader();
  const dec = new TextDecoder();
  const pump = (async () => { let buf = ""; while (true) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf("\n\n")) >= 0) { const line = buf.slice(0, i).split("\n").find((l) => l.startsWith("data: ")); buf = buf.slice(i + 2); if (line) events.push(JSON.parse(line.slice(6))); } } })().catch(() => {});

  const tpl = await (await fetch(base + "/api/templates")).json();
  assert.ok(tpl.some((t) => t.id === "note"));
  const res = await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "Knowledge/VLA/02-web.md", content: tutorial("网页写的章节") }) });
  const j = await res.json();
  assert.equal(res.status, 200, JSON.stringify(j));
  assert.equal(j.relPath, "Knowledge/VLA/02-web.md");
  assert.deepEqual(j.problems, []);
  assert.equal(j.stats.documents, 7);
  assert.equal(j.build?.ok, true, JSON.stringify(j.build));
  // 静态站已经包含新文档；目录接口也看得到
  assert.ok(fs.existsSync(path.join(dist, "data/doc/Knowledge/VLA/02-web.md.json")));
  assert.ok(fs.existsSync(path.join(dist, "index.html")));
  const tree = await (await fetch(base + "/api/tree")).json();
  assert.ok(JSON.stringify(tree).includes("02-web.md"));
  const raw = await (await fetch(base + "/api/raw?path=Knowledge/VLA/02-web.md")).json();
  assert.ok(raw.content.startsWith("---") && raw.editable);
  // 拒绝越界与覆盖
  assert.equal((await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "../x/01-a.md", content: tutorial("x") }) })).status, 400);
  assert.equal((await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "Knowledge/VLA/02-web.md", content: tutorial("x") }) })).status, 400);
  // SSE：保存与构建事件都推到了页面
  for (let i = 0; i < 50 && !events.some((e) => e.type === "built"); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(events.some((e) => e.type === "hello"));
  assert.ok(events.some((e) => e.type === "kb-changed" && e.reason === "save" && e.file === "Knowledge/VLA/02-web.md"), JSON.stringify(events));
  assert.ok(events.some((e) => e.type === "built" && e.ok), JSON.stringify(events));
  reader.cancel().catch(() => {});
  await pump;
});

// ---- 登记到目录表格 ----
test("registerChapter: fills the row from the table header and inserts it in NN order", () => {
  const readme = `---\ntitle: VLA\ntype: index\ntopic: vla\nlevel: all\ntags: [a]\nstatus: draft\ncreated: 2026-10-17\nupdated: 2026-10-17\n---\n\n# VLA\n\n## 章节表格\n\n| 章节 | 文件 | 类型 | 难度 | 预计时长 | 状态 |\n|---|---|---|---|---|---|\n| 00 目录 | \`00-README.md\` | index | all | 10min | draft |\n| 01 基础 | [01-basics.md](01-basics.md) | tutorial | beginner | 30min | draft |\n| 03 进阶 | [03-adv.md](03-adv.md) | tutorial | advanced | 30min | draft |\n\n## 关联\n`;
  const root = makeKb({ "Knowledge/VLA/00-README.md": readme, "Knowledge/VLA/03-adv.md": tutorial("进阶"), "Knowledge/VLA/02-mid.md": tutorial("中级").replace("level: beginner", "level: intermediate") + "" });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const r = registerChapter(kb, "Knowledge/VLA/02-mid.md", { today: "2026-10-19" });
  assert.equal(r.status, "added");
  assert.equal(r.row, "| 02 中级 | [02-mid.md](02-mid.md) | tutorial | intermediate | — | draft |");
  const text = fs.readFileSync(path.join(root, "Knowledge/VLA/00-README.md"), "utf8");
  const rows = text.split("\n").filter((l) => /^\| 0\d /.test(l)).map((l) => l.slice(0, 5));
  assert.deepEqual(rows, ["| 00 ", "| 01 ", "| 02 ", "| 03 "], "按章节号插在 01 和 03 之间");
  assert.match(text, /^updated: 2026-10-19$/m);
  assert.equal(registerChapter(kb, "Knowledge/VLA/02-mid.md").status, "exists");
  assert.equal(registerChapter(kb, "Knowledge/VLA/00-README.md").status, "skip");
  assert.equal(registerChapter(kb, "Knowledge/Papers/VLA/00-README.md").status, "skip");
  fs.writeFileSync(path.join(root, "Knowledge/Papers/VLA/01-x.md"), paper("X"));
  kb.reindex();
  assert.equal(registerChapter(kb, "Knowledge/Papers/VLA/01-x.md").status, "auto", "论文库目录自动生成，不手写");
  fs.mkdirSync(path.join(root, "notes"), { recursive: true });
  fs.writeFileSync(path.join(root, "notes/01-n.md"), tutorial("笔记"));
  kb.reindex();
  assert.equal(registerChapter(kb, "notes/01-n.md").status, "no-readme");
  assert.deepEqual(kb.check(), []);
});

test("POST /api/note with register:true adds the README row; cross-site and non-JSON POSTs are refused", async () => {
  // 复用上面那个服务（同一进程里按顺序跑，server 变量仍指向它）
  const base = server && (await (async () => { const r = await fetch(`http://localhost:${serverPort}/api/health`); return r.ok ? `http://localhost:${serverPort}` : null; })());
  assert.ok(base, "需要前一个测试起的服务");
  const rules = await (await fetch(base + "/api/rules")).json();
  assert.ok(rules.sections.tutorial.includes("小结") && rules.fields.includes("updated"));
  const readmeBefore = (await (await fetch(base + "/api/raw?path=Knowledge/VLA/00-README.md")).json()).content;
  assert.doesNotMatch(readmeBefore, /03-reg\.md/);
  // 这个 fixture 的 VLA/00-README 没有章节表 → no-table；先给它加一张表
  const withTable = readmeBefore.trimEnd() + "\n\n## 章节表格\n\n| 章节 | 文件 | 难度 | 状态 |\n|---|---|---|---|\n| 01 基础 | [01-basics.md](01-basics.md) | beginner | draft |\n";
  let res = await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "Knowledge/VLA/00-README.md", content: withTable, overwrite: true }) });
  assert.equal(res.status, 200);
  res = await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "Knowledge/VLA/03-reg.md", content: tutorial("登记测试"), register: true }) });
  const j = await res.json();
  assert.equal(res.status, 200, JSON.stringify(j));
  assert.equal(j.registered?.status, "added", JSON.stringify(j.registered));
  assert.equal(j.registered.row, "| 03 登记测试 | [03-reg.md](03-reg.md) | beginner | draft |");
  const readmeAfter = (await (await fetch(base + "/api/raw?path=Knowledge/VLA/00-README.md")).json()).content;
  assert.match(readmeAfter, /\| 03 登记测试 \| \[03-reg\.md\]\(03-reg\.md\) \| beginner \| draft \|/);
  assert.equal((await (await fetch(base + "/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "Knowledge/VLA/03-reg.md" }) })).json()).status, "exists");
  // CSRF 防护：text/plain 绕过预检的请求、带外来 Origin 的请求都拒绝；无 body 的 reindex 仍可直接调用
  assert.equal((await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ path: "Knowledge/VLA/04-evil.md", content: tutorial("x") }) })).status, 415);
  assert.equal((await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: JSON.stringify({ path: "Knowledge/VLA/04-evil.md", content: tutorial("x") }) })).status, 403);
  assert.equal((await fetch(base + "/api/note", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" }, body: JSON.stringify({ path: "Knowledge/VLA/04-evil.md", content: tutorial("x") }) })).status, 403);
  assert.equal((await fetch(base + "/api/reindex", { method: "POST" })).status, 200);
  assert.equal((await fetch(base + "/api/raw?path=Knowledge/VLA/04-evil.md")).status, 404);
});

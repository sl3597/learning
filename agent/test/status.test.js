// POST /api/status (change a document's frontmatter status from the reader) and /api/search parameter validation,
// against a real server on a fixture knowledge base.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";
import { setStatus } from "../src/notes.js";
import { localDate } from "../src/config.js";
import { AUTO_START, AUTO_END } from "../src/papers.js";
import { makeKb, tutorial, paper } from "./fixture.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const today = localDate();

test("setStatus: rewrites only the status/updated lines, body byte-for-byte unchanged", () => {
  const original = tutorial("基础").replace("status: draft", "status: draft   # 待复核");
  const root = makeKb({ "Knowledge/VLA/01-basics.md": original, "STANDARD.md": tutorial("标准"), "templates/tutorial-template.md": tutorial("模板") });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const r = setStatus(kb, { path: "Knowledge/VLA/01-basics.md", status: "reviewed", today: "2026-10-24" });
  assert.deepEqual({ ...r, indexes: undefined }, { path: "Knowledge/VLA/01-basics.md", status: "reviewed", updated: "2026-10-24", changed: true, indexes: undefined });
  assert.ok(Array.isArray(r.indexes)); // fixture 的论文库目录 AUTO 块一开始是空的，第一次同步会把它们填上
  const after1 = fs.readFileSync(path.join(root, "Knowledge/VLA/01-basics.md"), "utf8");
  assert.equal(after1, original.replace("status: draft   # 待复核", "status: reviewed").replace("updated: 2026-10-17", "updated: 2026-10-24"));
  assert.equal(after1.slice(after1.indexOf("\n---")), original.slice(original.indexOf("\n---")), "正文一个字节都不动");
  assert.equal(kb.getDoc("Knowledge/VLA/01-basics.md").meta.status, "reviewed", "立即重新索引");
  // 同样的状态再设一次：不写文件
  assert.equal(setStatus(kb, { path: "Knowledge/VLA/01-basics.md", status: "reviewed" }).changed, false);
  assert.equal(fs.readFileSync(path.join(root, "Knowledge/VLA/01-basics.md"), "utf8"), after1);
  // 非法状态 / 路径 400，不存在 404，受保护的文件 400
  assert.throws(() => setStatus(kb, { path: "Knowledge/VLA/01-basics.md", status: "done" }), (e) => e.status === 400 && /draft \| reviewed \| stable/.test(e.message));
  assert.throws(() => setStatus(kb, { path: "../x.md", status: "stable" }), (e) => e.status === 400);
  assert.throws(() => setStatus(kb, { path: "Knowledge/VLA/99-nope.md", status: "stable" }), (e) => e.status === 404);
  assert.throws(() => setStatus(kb, { path: "STANDARD.md", status: "stable" }), (e) => e.status === 400);
  assert.throws(() => setStatus(kb, { path: "templates/tutorial-template.md", status: "stable" }), (e) => e.status === 400);
  assert.throws(() => setStatus(kb, { status: "stable" }), (e) => e.status === 400);
});

test("setStatus on a paper note refreshes the paper-library tables", () => {
  const root = makeKb({ "Knowledge/Papers/VLA/01-x.md": paper("X 论文") });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  const r = setStatus(kb, { path: "Knowledge/Papers/VLA/01-x.md", status: "stable" });
  assert.ok(r.indexes.includes("Knowledge/Papers/VLA/00-README.md"), JSON.stringify(r));
  const readme = fs.readFileSync(path.join(root, "Knowledge/Papers/VLA/00-README.md"), "utf8");
  assert.match(readme.slice(readme.indexOf(AUTO_START), readme.indexOf(AUTO_END)), /\| \[X 论文\]\(01-x\.md\) \|.*\| stable \|/);
  assert.deepEqual(kb.check(), []);
});

// ---- end to end ----
let server;
after(() => server?.kill());

test("POST /api/status over HTTP: rebuilds the static site, notifies subscribers, validates input", async () => {
  const root = makeKb({ "Knowledge/Papers/VLA/01-x.md": paper("X 论文"), "STANDARD.md": tutorial("标准") });
  const dist = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kb-dist-")), "site");
  server = spawn(process.execPath, [path.join(AGENT, "src/server.js")], { env: { ...process.env, PORT: "0", KB_ROOT: root, KB_DIST: dist, ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const base = await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`服务 10 秒内未启动：\n${out}`)), 10_000);
    server.stdout.on("data", (d) => { out += d; const m = out.match(/http:\/\/localhost:(\d+)/); if (m) { clearTimeout(timer); resolve(`http://localhost:${m[1]}`); } });
    server.on("exit", (code) => reject(new Error(`服务提前退出 ${code}：\n${out}`)));
  });
  const events = [];
  const es = await fetch(base + "/api/events");
  const reader = es.body.getReader();
  const dec = new TextDecoder();
  const pump = (async () => { let buf = ""; while (true) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf("\n\n")) >= 0) { const line = buf.slice(0, i).split("\n").find((l) => l.startsWith("data: ")); buf = buf.slice(i + 2); if (line) events.push(JSON.parse(line.slice(6))); } } })().catch(() => {});
  const post = (body, headers = {}) => fetch(base + "/api/status", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  const rules = await (await fetch(base + "/api/rules")).json();
  assert.deepEqual(rules.statuses, ["draft", "reviewed", "stable"]);

  let res = await post({ path: "Knowledge/VLA/01-basics.md", status: "reviewed" });
  let j = await res.json();
  assert.equal(res.status, 200, JSON.stringify(j));
  assert.equal(j.ok, true);
  assert.equal(j.path, "Knowledge/VLA/01-basics.md");
  assert.equal(j.status, "reviewed");
  assert.equal(j.updated, today);
  assert.equal(j.build?.ok, true, JSON.stringify(j.build));
  const raw = await (await fetch(base + "/api/raw?path=Knowledge/VLA/01-basics.md")).json();
  assert.match(raw.content, /^status: reviewed$/m);
  assert.match(raw.content, new RegExp(`^updated: ${today}$`, "m"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dist, "data/doc/Knowledge/VLA/01-basics.md.json"), "utf8")).meta.status, "reviewed", "静态站已重建");
  const tree = await (await fetch(base + "/api/tree")).json();
  assert.ok(JSON.stringify(tree).includes('"status":"reviewed"'));

  // 论文笔记：论文库目录表跟着刷新
  res = await post({ path: "Knowledge/Papers/VLA/01-x.md", status: "stable" });
  j = await res.json();
  assert.equal(res.status, 200, JSON.stringify(j));
  assert.ok(j.indexes.includes("Knowledge/Papers/VLA/00-README.md"));
  assert.match((await (await fetch(base + "/api/raw?path=Knowledge/Papers/VLA/00-README.md")).json()).content, /\| \[X 论文\]\(01-x\.md\) \|.*\| stable \|/);

  // 同样的状态再设：不重建
  j = await (await post({ path: "Knowledge/VLA/01-basics.md", status: "reviewed" })).json();
  assert.equal(j.changed, false);
  assert.equal(j.build, null);

  // 校验
  assert.equal((await post({ path: "Knowledge/VLA/01-basics.md", status: "final" })).status, 400);
  assert.equal((await post({ path: "Knowledge/VLA/01-basics.md" })).status, 400);
  assert.equal((await post({ path: "Knowledge/VLA/99-missing.md", status: "stable" })).status, 404);
  assert.equal((await post({ path: "../etc/passwd.md", status: "stable" })).status, 400);
  assert.equal((await post({ path: "STANDARD.md", status: "stable" })).status, 400);
  assert.equal((await post({ status: "stable" })).status, 400);
  // CSRF 防护与 /api/note 相同
  assert.equal((await fetch(base + "/api/status", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status, 415);
  assert.equal((await post({ path: "Knowledge/VLA/01-basics.md", status: "stable" }, { origin: "http://evil.example" })).status, 403);
  assert.equal((await post({ path: "Knowledge/VLA/01-basics.md", status: "stable" }, { "sec-fetch-site": "cross-site" })).status, 403);
  assert.match((await (await fetch(base + "/api/raw?path=Knowledge/VLA/01-basics.md")).json()).content, /^status: reviewed$/m, "被拒的请求没有改文件");

  for (let i = 0; i < 50 && !events.some((e) => e.type === "built"); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(events.some((e) => e.type === "kb-changed" && e.reason === "status" && e.file === "Knowledge/VLA/01-basics.md"), JSON.stringify(events));
  assert.ok(events.some((e) => e.type === "built" && e.ok), JSON.stringify(events));
  reader.cancel().catch(() => {});
  await pump;

  // ---- /api/search 参数校验（同一个服务）----
  const search = async (qs) => { const r = await fetch(base + "/api/search" + qs); return { status: r.status, body: await r.json() }; };
  let s = await search("?q=基础");
  assert.equal(s.status, 200);
  assert.ok(Array.isArray(s.body) && s.body.length > 0 && s.body[0].relPath === "Knowledge/VLA/01-basics.md");
  assert.equal((await search("?q=基础&k=1")).body.length, 1);
  assert.equal((await search("?q=基础&k=100")).status, 200);
  for (const qs of ["?q=", "?q=%20%20", "", "?q=基础&k=abc", "?q=基础&k=0", "?q=基础&k=101", "?q=基础&k=-1", "?q=基础&k=1.5", "?q=基础&k=NaN", "?q=基础&k="]) {
    s = await search(qs);
    assert.equal(s.status, 400, qs);
    assert.ok(typeof s.body.error === "string" && s.body.error, qs);
  }
});

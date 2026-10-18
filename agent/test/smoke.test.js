// Smoke tests against the real knowledge base: start the server, hit the API, render every document.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let server;
let base;

before(async () => {
  server = spawn(process.execPath, [path.join(AGENT, "src/server.js")], { env: { ...process.env, PORT: "0", ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  base = await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`服务 10 秒内未启动：\n${out}`)), 10_000);
    server.stdout.on("data", (d) => {
      out += d;
      const m = out.match(/http:\/\/localhost:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(`http://localhost:${m[1]}`);
      }
    });
    server.on("exit", (code) => reject(new Error(`服务提前退出 ${code}：\n${out}`)));
  });
});
after(() => server?.kill());

const get = async (p) => {
  const res = await fetch(base + p);
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
};

test("web + API respond without an API key", async () => {
  const health = JSON.parse((await get("/api/health")).body);
  assert.equal(health.ok, true);
  assert.ok(health.stats.documents > 40);
  assert.equal((await get("/api/check")).body, "[]");
  assert.match((await get("/")).body, /<html/i);
  const tree = JSON.parse((await get("/api/tree")).body);
  assert.ok(tree.dirs.some((d) => d.name === "Knowledge"));
});

test("doc API exposes paper <-> knowledge links both ways", async () => {
  const chapter = JSON.parse((await get("/api/doc?path=Knowledge/VLA/Basic/10-force-and-tactile-sensing.md")).body);
  assert.ok(chapter.relatedPapers.some((p) => p.path === "Knowledge/VLA/ForceVLA/01-paper-overview.md"));
  const paper = JSON.parse((await get("/api/doc?path=Knowledge/VLA/ForceVLA/01-paper-overview.md")).body);
  assert.ok(paper.related.some((d) => d.path === "Knowledge/VLA/Basic/10-force-and-tactile-sensing.md"));
  const dirs = JSON.parse((await get("/api/dirs")).body);
  assert.ok(dirs.includes("Knowledge/Papers/VLA") && dirs.includes("Knowledge/Papers/WAM"));
});

test("vendored browser libs are served locally (no CDN)", async () => {
  for (const p of ["/vendor/marked/marked.min.js", "/vendor/hljs/highlight.min.js", "/vendor/katex/katex.min.js", "/vendor/mermaid/mermaid.min.js"]) {
    assert.equal((await get(p)).status, 200, p);
  }
});

test("file access stays inside the knowledge base", async () => {
  assert.notEqual((await get("/kb/agent/.env")).status, 200);
  // %2f 只在 /kb/ 处理器里解码，能真正走到 safeResolve；%2e%2e 会被 URL 解析提前规范化，落到首页回退
  assert.equal((await get("/kb/..%2f..%2fetc%2fpasswd")).status, 403);
  assert.doesNotMatch((await get("/kb/%2e%2e/%2e%2e/etc/passwd")).body, /root:/);
  assert.equal((await get("/api/doc?path=../../etc/passwd")).status, 404);
});

test("marked stays on 12.x (web/app.js uses positional renderer args)", () => {
  const require = createRequire(path.join(AGENT, "package.json"));
  const { version } = require("marked/package.json");
  assert.equal(version.split(".")[0], "12", "升级 marked 前先把 web/app.js 的 renderer 改成对象参数");
  const app = fs.readFileSync(path.join(AGENT, "web/app.js"), "utf8");
  assert.doesNotMatch(app, /renderer\.\w+\s*=\s*\(\s*\{/, "renderer 不能用 13+ 的对象参数写法");
});

test("every document renders with marked without throwing or printing undefined", async () => {
  const require = createRequire(path.join(AGENT, "package.json"));
  const { marked } = require("marked");
  const kb = new KnowledgeBase();
  kb.reindex();
  for (const d of kb.docs.values()) {
    const html = marked.parse(d.body);
    assert.doesNotMatch(html, />undefined</, d.relPath);
  }
});

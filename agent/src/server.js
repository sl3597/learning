// HTTP server: static web UI + JSON/SSE API. No framework, Node >= 20.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KB_ROOT, PORT, DIST_DIR, AUTO_BUILD } from "./config.js";
import { KnowledgeBase, safeResolve } from "./kb.js";
import { backend } from "./backend.js";
import { saveNote, readNote, noteTemplates, editableDirs, registerChapter, editorRules, setStatus } from "./notes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, "..", "web");
const NODE_MODULES = path.join(here, "..", "node_modules");
const kb = new KnowledgeBase();
console.log(`索引知识库 ${KB_ROOT} …`);
console.log(kb.reindex());

// ---- 保存即重建：索引 → 通知打开的页面（SSE）→ 后台重新生成静态站 ----
const clients = new Set(); // /api/events 的订阅者
function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(line);
}

let building = null; // 正在跑的构建
let queued = null; // 构建期间又有改动：排一次，等当前这次结束再跑（合并多次请求）
let lastBuild = null;
/** 用子进程跑 scripts/build-static.js（复制 vendor 要一两秒，不堵住请求）；返回"包含本次改动"的那次构建结果。 */
function buildSite(reason) {
  if (!AUTO_BUILD) return Promise.resolve(null);
  if (!building) {
    building = new Promise((resolve) => {
      const t0 = Date.now();
      const child = spawn(process.execPath, [path.join(here, "..", "scripts", "build-static.js"), DIST_DIR], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("exit", (code) => {
        lastBuild = { ok: code === 0, out: DIST_DIR, ms: Date.now() - t0, reason, at: new Date().toISOString(), message: out.trim().split("\n").slice(-2).join(" ") };
        console.log(`${lastBuild.ok ? "🏗️" : "❌"} 静态站${lastBuild.ok ? "已重建" : "构建失败"}（${reason}，${lastBuild.ms}ms）${lastBuild.ok ? "" : "：" + lastBuild.message}`);
        broadcast({ type: "built", ...lastBuild });
        resolve(lastBuild);
      });
    }).finally(() => {
      building = null;
    });
    return building;
  }
  if (!queued) queued = building.then(() => {
    queued = null;
    return buildSite(reason);
  });
  return queued;
}

/** 重建索引并通知页面；写文件的那一方（网页保存、文件监听）都走这里。 */
function rebuild(reason, file) {
  const stats = kb.reindex();
  console.log(`🔄 重新索引（${reason}${file ? "：" + file : ""}）：${stats.documents} 篇文档`);
  broadcast({ type: "kb-changed", reason, file: file ?? null, stats });
  return buildSite(reason);
}

// 磁盘上的 .md 变了（编辑器、git checkout…）也重建；网页保存会自己调 rebuild，所以保存后的一小段时间里忽略监听。
let timer = null;
let ignoreWatchUntil = 0;
try {
  fs.watch(KB_ROOT, { recursive: true }, (_, file) => {
    if (!file || !file.endsWith(".md") || /^(agent|dist|node_modules|\.git)([\\/]|$)/.test(file)) return;
    if (Date.now() < ignoreWatchUntil) return;
    clearTimeout(timer);
    timer = setTimeout(() => rebuild("watch", file), 500);
  });
} catch (e) {
  console.warn("文件监听不可用，修改后请手动调用 POST /api/reindex：", e.message);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".map": "application/json" };

function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readBody(req, limit = 40 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error("请求体过大");
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/**
 * 本机服务监听的是 localhost，但浏览器里任何网页都能向它发请求（CSRF）。写接口只接受同源页面发来的 JSON：
 * 带 Origin 的请求必须与 Host 一致；content-type 必须是 application/json（text/plain 可以绕过预检，所以不认）。
 */
function sameOriginJson(req, res) {
  const host = req.headers.host ?? "";
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
    json(res, 403, { error: `拒绝来自 ${origin} 的跨站请求` });
    return false;
  }
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") {
    json(res, 403, { error: "拒绝跨站请求" });
    return false;
  }
  // /api/reindex 没有请求体，允许 curl -X POST 直接调用
  if (req.url !== "/api/reindex" && !/^application\/json/i.test(req.headers["content-type"] ?? "")) {
    json(res, 415, { error: "content-type 必须是 application/json" });
    return false;
  }
  return true;
}

function sse(res) {
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
  return (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // ---- API ----
    if (req.method === "POST" && url.pathname.startsWith("/api/") && !sameOriginJson(req, res)) return;
    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true, model: backend.model, backend: backend.name, root: KB_ROOT, stats: kb.stats(), autoBuild: AUTO_BUILD, dist: DIST_DIR, lastBuild });
    }
    if (url.pathname === "/api/backend") {
      // 单独的接口：claude-code 后端要跑一次 `claude auth status`，不放进频繁调用的 health 里
      return json(res, 200, { name: backend.name, model: backend.model, ...backend.status() });
    }
    if (url.pathname === "/api/tree") return json(res, 200, kb.tree());
    if (url.pathname === "/api/stats") return json(res, 200, kb.stats());
    if (url.pathname === "/api/check") return json(res, 200, kb.check());
    if (url.pathname === "/api/reindex" && req.method === "POST") return json(res, 200, kb.reindex());
    if (url.pathname === "/api/events") {
      // 页面订阅知识库变化（保存 / 文件监听 / 静态站重建），据此刷新目录与当前文档
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
      res.write(`data: ${JSON.stringify({ type: "hello", stats: kb.stats(), autoBuild: AUTO_BUILD })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
      req.on("close", () => {
        clearInterval(ping);
        clients.delete(res);
      });
      return;
    }
    if (url.pathname === "/api/templates") return json(res, 200, noteTemplates(kb));
    if (url.pathname === "/api/rules") return json(res, 200, editorRules());
    if (url.pathname === "/api/raw") {
      try {
        return json(res, 200, readNote(kb, url.searchParams.get("path") ?? ""));
      } catch (err) {
        return json(res, 404, { error: err.message });
      }
    }
    if (url.pathname === "/api/note" && req.method === "POST") {
      // 网页编辑器保存：写文件 → 重建索引 + 论文库目录 → 通知页面 → 重新生成静态站，全部做完再应答
      const body = await readBody(req, 4 * 1024 * 1024);
      let saved;
      let registered = null;
      try {
        saved = saveNote(kb, { path: body.path, content: body.content, overwrite: body.overwrite === true });
        // register: true → 新章节顺手登记到所在文件夹的 00-README 章节表（论文库目录是自动生成的，会返回 auto）
        if (body.register === true && saved.created) registered = registerChapter(kb, saved.relPath);
      } catch (err) {
        if (!saved) return json(res, 400, { error: err.message });
        registered = { status: "error", error: err.message };
      }
      ignoreWatchUntil = Date.now() + 1500;
      const build = await rebuild("save", saved.relPath);
      return json(res, 200, { ok: true, ...saved, registered, stats: kb.stats(), build });
    }
    if (url.pathname === "/api/register" && req.method === "POST") {
      // 手动登记（编辑器里"登记到目录"按钮）
      const body = await readBody(req, 64 * 1024);
      let r;
      try {
        r = registerChapter(kb, body.path);
      } catch (err) {
        return json(res, 400, { error: err.message });
      }
      if (r.status !== "added") return json(res, 200, { ok: true, ...r, build: null });
      ignoreWatchUntil = Date.now() + 1500;
      const build = await rebuild("register", r.readme);
      return json(res, 200, { ok: true, ...r, build });
    }
    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") ?? "").trim();
      if (!q) return json(res, 400, { error: "缺少查询词 q" });
      const kRaw = url.searchParams.get("k");
      const k = kRaw === null ? 20 : Number(kRaw);
      if (kRaw !== null && (!/^\d+$/.test(kRaw.trim()) || k < 1 || k > 100)) return json(res, 400, { error: "k 必须是 1–100 的整数" });
      const topic = url.searchParams.get("topic") ?? "";
      return json(res, 200, kb.search(q, k, topic ? { topic } : {}));
    }
    if (url.pathname === "/api/status" && req.method === "POST") {
      // 文档页右栏改状态（draft → reviewed → stable）：只改 frontmatter 的 status/updated 两行，其余流程与 /api/note 相同
      const body = await readBody(req, 64 * 1024);
      let r;
      try {
        r = setStatus(kb, { path: body.path, status: body.status });
      } catch (err) {
        return json(res, err.status ?? 400, { error: err.message });
      }
      if (!r.changed) return json(res, 200, { ok: true, ...r, build: null });
      ignoreWatchUntil = Date.now() + 1500;
      const build = await rebuild("status", r.path);
      return json(res, 200, { ok: true, ...r, build });
    }
    if (url.pathname === "/api/doc") {
      const p = url.searchParams.get("path") ?? "";
      const payload = kb.docPayload(p);
      return payload ? json(res, 200, payload) : json(res, 404, { error: "not found" });
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await readBody(req, 2 * 1024 * 1024);
      const history = Array.isArray(body.messages) ? body.messages.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()) : [];
      if (!history.length || history.at(-1).role !== "user") return json(res, 400, { error: "messages 必须以 user 消息结尾" });
      const send = sse(res);
      const abort = new AbortController();
      res.on("close", () => abort.abort()); // 浏览器断开就结束后台的 claude 进程
      try {
        const text = await backend.chat(kb, history, send, { signal: abort.signal });
        send({ type: "done", text });
      } catch (err) {
        send({ type: "error", message: err.message });
      }
      return res.end();
    }
    if (url.pathname === "/api/paper" && req.method === "POST") {
      const body = await readBody(req);
      const send = sse(res);
      const abort = new AbortController();
      res.on("close", () => abort.abort());
      try {
        const result = await backend.ingestPaper(kb, { ...body, signal: abort.signal, onText: (t) => send({ type: "text", text: t }) });
        send({ type: "done", ...result });
      } catch (err) {
        send({ type: "error", message: err.message });
      }
      return res.end();
    }
    if (url.pathname === "/api/dirs") return json(res, 200, editableDirs(kb)); // 论文导入与笔记编辑器可写入的文件夹

    // ---- knowledge-base assets (images referenced by markdown) ----
    if (url.pathname.startsWith("/kb/")) {
      const rel = decodeURIComponent(url.pathname.slice(4));
      let abs;
      try {
        abs = safeResolve(rel);
      } catch {
        return json(res, 403, { error: "forbidden" });
      }
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream" });
      return fs.createReadStream(abs).pipe(res);
    }

    // ---- vendored browser libraries (served from node_modules, no CDN needed) ----
    if (url.pathname.startsWith("/vendor/")) {
      const VENDOR = { marked: "marked", hljs: "@highlightjs/cdn-assets", katex: "katex/dist", mermaid: "mermaid/dist" };
      const [, , lib, ...rest] = url.pathname.split("/");
      const base = VENDOR[lib];
      if (!base || !rest.length) return json(res, 404, { error: "unknown vendor lib" });
      const baseDir = path.join(NODE_MODULES, base);
      const abs = path.resolve(baseDir, decodeURIComponent(rest.join("/")));
      if (!abs.startsWith(baseDir + path.sep) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream", "cache-control": "public, max-age=86400" });
      return fs.createReadStream(abs).pipe(res);
    }

    // ---- static web UI ----
    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const abs = path.join(WEB_DIR, path.normalize(file));
    if (!abs.startsWith(WEB_DIR) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      // SPA fallback so deep links like /#/LinuxCommand/01.md still load.
      res.writeHead(200, { "content-type": MIME[".html"] });
      return fs.createReadStream(path.join(WEB_DIR, "index.html")).pipe(res);
    }
    res.writeHead(200, { "content-type": MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream" });
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, () => {
  // PORT=0 时系统分配端口，打印实际端口（CI 冒烟测试依赖这一行）。
  console.log(`\n知识库 Web：http://localhost:${server.address().port}\n后端：${backend.name}（${backend.model}）\n`);
});

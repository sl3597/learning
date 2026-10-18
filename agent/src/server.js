// HTTP server: static web UI + JSON/SSE API. No framework, Node >= 20.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KB_ROOT, PORT, PAPERS_DIR, PAPER_DOMAINS } from "./config.js";
import { KnowledgeBase, safeResolve } from "./kb.js";
import { backend } from "./backend.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.join(here, "..", "web");
const NODE_MODULES = path.join(here, "..", "node_modules");
const kb = new KnowledgeBase();
console.log(`索引知识库 ${KB_ROOT} …`);
console.log(kb.reindex());

// Re-index when markdown files change (debounced).
let timer = null;
try {
  fs.watch(KB_ROOT, { recursive: true }, (_, file) => {
    if (!file || !file.endsWith(".md") || file.startsWith("agent")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      kb.reindex();
      console.log(`重新索引：${file}`);
    }, 500);
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

function sse(res) {
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache", connection: "keep-alive", "x-accel-buffering": "no" });
  return (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // ---- API ----
    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true, model: backend.model, backend: backend.name, root: KB_ROOT, stats: kb.stats() });
    }
    if (url.pathname === "/api/backend") {
      // 单独的接口：claude-code 后端要跑一次 `claude auth status`，不放进频繁调用的 health 里
      return json(res, 200, { name: backend.name, model: backend.model, ...backend.status() });
    }
    if (url.pathname === "/api/tree") return json(res, 200, kb.tree());
    if (url.pathname === "/api/stats") return json(res, 200, kb.stats());
    if (url.pathname === "/api/check") return json(res, 200, kb.check());
    if (url.pathname === "/api/reindex" && req.method === "POST") return json(res, 200, kb.reindex());
    if (url.pathname === "/api/search") {
      const q = url.searchParams.get("q") ?? "";
      const k = Number(url.searchParams.get("k") ?? 10);
      const topic = url.searchParams.get("topic") ?? "";
      return json(res, 200, kb.search(q, k, topic ? { topic } : {}));
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
    if (url.pathname === "/api/dirs") {
      // Folders the paper importer can write into.
      const dirs = new Set(["notes", ...Object.keys(PAPER_DOMAINS).map((d) => `${PAPERS_DIR}/${d}`)]);
      for (const d of kb.docs.values()) dirs.add(path.posix.dirname(d.relPath));
      dirs.delete(".");
      return json(res, 200, [...dirs].sort());
    }

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

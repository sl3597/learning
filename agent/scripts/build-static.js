#!/usr/bin/env node
// Static build for GitHub Pages: the same reader UI, with /api/* replaced by pre-rendered JSON and in-browser search.
//   node scripts/build-static.js [outDir]   (default: <repo>/dist)
// Chat and paper import need a backend and are not part of the static site; the UI links to the local service instead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(AGENT, "..");
const WEB = path.join(AGENT, "web");
const NODE_MODULES = path.join(AGENT, "node_modules");

/** Browser libraries, same layout as server.js /vendor/<lib>/... */
const VENDOR = {
  marked: ["marked", ["marked.min.js"]],
  hljs: ["@highlightjs/cdn-assets", ["highlight.min.js", "styles/github.min.css", "styles/github-dark.min.css"]],
  katex: ["katex/dist", ["katex.min.css", "katex.min.js", "contrib/auto-render.min.js", "fonts"]],
  mermaid: ["mermaid/dist", ["mermaid.min.js"]],
};

const write = (out, rel, content) => {
  const abs = path.join(out, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const copy = (src, out, rel) => {
  fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
  fs.cpSync(src, path.join(out, rel), { recursive: true });
};

export function buildStatic(out = path.join(ROOT, "dist"), kb = new KnowledgeBase(ROOT)) {
  kb.reindex();
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 页面：同一份 index.html，只多一个开关告诉 app.js 走静态数据
  const html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  if (!html.includes('<script src="app.js"></script>')) throw new Error("index.html 里找不到 app.js 的 script 标签");
  write(out, "index.html", html.replace('<script src="app.js"></script>', '<script>window.KB_STATIC = true;</script>\n  <script src="app.js"></script>'));
  for (const f of ["app.js", "style.css"]) copy(path.join(WEB, f), out, f);
  copy(path.join(AGENT, "src", "search-core.js"), out, "search-core.js");
  write(out, ".nojekyll", ""); // 让 GitHub Pages 原样提供文件

  for (const [lib, [base, files]] of Object.entries(VENDOR)) {
    for (const f of files) copy(path.join(NODE_MODULES, base, f), out, `vendor/${lib}/${f}`);
  }

  // 数据：与 /api/tree、/api/stats、/api/doc、/api/search 一一对应
  write(out, "data/tree.json", JSON.stringify(kb.tree()));
  write(out, "data/stats.json", JSON.stringify(kb.stats()));
  for (const relPath of kb.docs.keys()) write(out, `data/doc/${relPath}.json`, JSON.stringify(kb.docPayload(relPath)));
  write(out, "data/search.json", JSON.stringify(kb.chunks));

  // 知识库里的图片等附件（Markdown 里的相对路径在页面上解析为 kb/<路径>）
  let assets = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (!e.name.endsWith(".md")) {
        copy(path.join(ROOT, rel), out, `kb/${rel}`);
        assets++;
      }
    }
  };
  walk("Knowledge");

  return { out, documents: kb.docs.size, chunks: kb.chunks.length, assets };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildStatic(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(`✅ 静态站已生成：${r.out}（${r.documents} 篇文档，${r.chunks} 个段落，${r.assets} 个附件）`);
}

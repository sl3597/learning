// The GitHub Pages build must show the same data and search ranking as the local server.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KnowledgeBase } from "../src/kb.js";
import { SearchIndex, compactText, tokenize } from "../src/search-core.js";
import { buildStatic } from "../scripts/build-static.js";

test("static build: per-doc JSON equals /api/doc, browser search equals /api/search", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "kb-static-test-"));
  try {
    const kb = new KnowledgeBase();
    buildStatic(out, kb);
    const read = (rel) => JSON.parse(fs.readFileSync(path.join(out, rel), "utf8"));
    for (const p of ["Knowledge/VLA/Basic/10-force-and-tactile-sensing.md", "Knowledge/Papers/00-README.md", "README.md"]) {
      assert.deepEqual(read(`data/doc/${p}.json`), JSON.parse(JSON.stringify(kb.docPayload(p))), p);
    }
    // 静态索引是压缩形式：排序与分数必须和服务端完全一致；片段来自去掉标点/Markdown 符号的文本，只要求非空
    const packed = read("data/search.json");
    assert.equal(packed.v, 2);
    assert.equal(packed.docs.reduce((n, d) => n + d.sections.length, 0), kb.chunks.length);
    const browser = new SearchIndex(packed);
    const strip = (hits) => hits.map(({ snippet, ...h }) => h);
    for (const q of ["chmod 权限", "world model Dreamer", "force_mode 恒力", "相关论文", "flow matching", "VLA 是什么"]) {
      const hits = browser.search(q, 10);
      assert.deepEqual(strip(hits), strip(kb.search(q, 10)), q);
      assert.ok(hits.every((h) => h.snippet.trim()), q);
    }
    // 压缩后的正文分词结果与原文逐一相同（这是"搜索质量不变"的依据）
    for (const c of kb.chunks) assert.deepEqual(tokenize(compactText(c.text)), tokenize(c.text), `${c.relPath} ## ${c.heading}`);
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /window\.KB_STATIC = true/);
    assert.doesNotMatch(html, /(src|href)="\//, "子路径部署不能用绝对路径");
    assert.ok(fs.existsSync(path.join(out, "vendor/katex/fonts")));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

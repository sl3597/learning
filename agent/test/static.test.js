// The GitHub Pages build must show the same data and search ranking as the local server.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KnowledgeBase } from "../src/kb.js";
import { SearchIndex } from "../src/search-core.js";
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
    const browser = new SearchIndex(read("data/search.json"));
    for (const q of ["chmod 权限", "world model Dreamer", "force_mode 恒力", "相关论文"]) assert.deepEqual(browser.search(q, 10), kb.search(q, 10), q);
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.match(html, /window\.KB_STATIC = true/);
    assert.doesNotMatch(html, /(src|href)="\//, "子路径部署不能用绝对路径");
    assert.ok(fs.existsSync(path.join(out, "vendor/katex/fonts")));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

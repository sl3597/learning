import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { KnowledgeBase } from "../src/kb.js";
import { syncIndexes, domainOf } from "../src/papers.js";
import { makeKb, paper, index } from "./fixture.js";

const statusOf = (results) => Object.fromEntries(results.map((r) => [r.relPath, r.status]));

test("syncIndexes: detects stale tables, rewrites them, then reports ok", () => {
  const root = makeKb({ "Knowledge/Papers/VLA/01-x.md": paper("X 论文", { year: "2024" }) });
  const kb = new KnowledgeBase(root);
  kb.reindex();
  assert.equal(statusOf(syncIndexes(kb))["Knowledge/Papers/VLA/00-README.md"], "stale");
  assert.equal(statusOf(syncIndexes(kb, { write: true, today: "2026-12-01" }))["Knowledge/Papers/VLA/00-README.md"], "updated");
  kb.reindex();
  assert.ok(syncIndexes(kb).every((r) => r.status === "ok"));

  const vla = fs.readFileSync(path.join(root, "Knowledge/Papers/VLA/00-README.md"), "utf8");
  assert.match(vla, /\[X 论文\]\(01-x\.md\) \| 2024 \|/);
  assert.match(vla, /\[基础\]\(\.\.\/\.\.\/VLA\/01-basics\.md\)/);
  assert.match(vla, /^updated: 2026-12-01$/m);
  const rootIdx = fs.readFileSync(path.join(root, "Knowledge/Papers/00-README.md"), "utf8");
  assert.match(rootIdx, /\| \[基础\]\(\.\.\/VLA\/01-basics\.md\) \| \[X 论文\]\(VLA\/01-x\.md\) \|/);
  assert.equal(kb.check().length, 0, JSON.stringify(kb.check()));
});

test("syncIndexes: missing markers are reported, never silently fixed", () => {
  const kb = new KnowledgeBase(makeKb({ "Knowledge/Papers/WAM/00-README.md": index("WAM 论文", "wam", false) }));
  kb.reindex();
  assert.equal(statusOf(syncIndexes(kb, { write: true }))["Knowledge/Papers/WAM/00-README.md"], "missing-markers");
});

test("domainOf: Papers sub-folder wins, otherwise mapped from topic", () => {
  assert.equal(domainOf({ relPath: "Knowledge/Papers/WAM/01-a.md", meta: { topic: "vla" } }), "WAM");
  assert.equal(domainOf({ relPath: "Knowledge/VLA/ForceVLA/01-paper-overview.md", meta: { topic: "forcevla" } }), "VLA");
  assert.equal(domainOf({ relPath: "Knowledge/X/01-a.md", meta: { topic: "something" } }), "Robotics");
});

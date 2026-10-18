// Tests for the CI / release tooling itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lintMessage } from "../scripts/commit-msg.js";
import { parseCommits, nextVersion, renderChangelog } from "../scripts/release.js";
import { toPdfUrl, resolveTopic } from "../src/paper.js";

test("commit messages follow Conventional Commits", () => {
  for (const ok of ["content(linux): 新增 tmux 章节", "paper(vla): 导入 OpenVLA", "feat(agent)!: 改用新索引", "fix: 修复", "Merge branch 'paper/openvla'"]) assert.equal(lintMessage(ok + "\n"), null, ok);
  for (const bad of ["update", "Content: 大写", "feat:没有空格", "content(linux): x\n正文紧贴首行"]) assert.ok(lintMessage(bad), bad);
});

const log = (...subjects) => subjects.map((s, i) => `${String(i).repeat(40)}\x1f${s}\x1f\x1e`).join("");

test("release: version bump follows commit types", () => {
  assert.equal(nextVersion("0.1.0", parseCommits(log("fix: a", "docs: b"))), "0.1.1");
  assert.equal(nextVersion("0.1.0", parseCommits(log("fix: a", "paper(vla): b"))), "0.2.0");
  assert.equal(nextVersion("1.2.3", parseCommits(log("feat(web)!: a"))), "2.0.0");
  assert.equal(nextVersion("0.4.1", parseCommits(log("feat!: a"))), "0.5.0");
  assert.equal(nextVersion("0.1.0", [], "major"), "1.0.0");
});

test("release: changelog groups commits and skips release commits", () => {
  const commits = parseCommits(log("paper(vla): 导入 OpenVLA", "content(linux): 新增 tmux", "chore(release): v0.1.0", "ci: 加钩子"));
  assert.equal(commits.length, 3);
  const md = renderChangelog("0.2.0", "2026-10-18", commits, "快照");
  assert.match(md, /## v0\.2\.0 · 2026-10-18/);
  assert.match(md, /### 📄 论文库\n\n- \*\*vla\*\*：导入 OpenVLA/);
  assert.match(md, /### 📚 知识内容/);
  assert.match(md, /### 🔧 工程/);
});

test("paper import: arXiv URLs become PDF URLs; library folders force the topic", () => {
  assert.equal(toPdfUrl("https://arxiv.org/abs/2505.22159v3"), "https://arxiv.org/pdf/2505.22159v3");
  assert.equal(toPdfUrl("https://arxiv.org/html/2406.09246"), "https://arxiv.org/pdf/2406.09246");
  assert.equal(resolveTopic("Knowledge/Papers/WAM", "vla"), "wam");
  assert.equal(resolveTopic("Knowledge/VLA/ForceVLA", "forcevla"), "forcevla");
  assert.equal(resolveTopic("notes", ""), "paper");
  assert.throws(() => resolveTopic("Knowledge/Papers/NLP", ""), /未登记/);
});

test("credentialSource follows the SDK order: key > token > ant login profile", async () => {
  const { credentialSource } = await import("../src/config.js");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const saved = { ...process.env };
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "ant-cfg-"));
  try {
    for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"]) delete process.env[k];
    process.env.ANTHROPIC_CONFIG_DIR = cfg;
    assert.equal(credentialSource(), null);
    fs.mkdirSync(path.join(cfg, "credentials"));
    fs.writeFileSync(path.join(cfg, "credentials", "default.json"), "{}");
    assert.equal(credentialSource(), "profile");
    process.env.ANTHROPIC_AUTH_TOKEN = "t";
    assert.equal(credentialSource(), "auth-token");
    process.env.ANTHROPIC_API_KEY = "k";
    assert.equal(credentialSource(), "api-key");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

#!/usr/bin/env node
// Local CI pipeline. Every stage is offline and needs no API key.
//   node scripts/ci.js          全部阶段（pre-push / 发布前）
//   node scripts/ci.js --fast   跳过测试，约 1 秒（pre-commit）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";
import { syncIndexes } from "../src/papers.js";
import { buildStatic } from "./build-static.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(AGENT, "..");
const FAST = process.argv.includes("--fast");

/** Files the repo would ship: git's view when available, otherwise a walk that skips ignored stuff. */
function repoFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\0").filter(Boolean);
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.name === "node_modules" || e.name === ".git" || e.name === ".env") continue;
        if (e.isDirectory()) walk(rel);
        else files.push(rel);
      }
    };
    walk("");
    return files;
  }
}

const TEXT_EXT = new Set([".md", ".js", ".json", ".html", ".css", ".sh", ".yml", ".yaml", ".txt", ".example", ""]);
const textFiles = () => repoFiles().filter((f) => TEXT_EXT.has(path.extname(f)) && fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).isFile());
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---------- stages: each returns a list of problems (strings) ----------

function syntax() {
  const dirs = ["agent/src", "agent/scripts", "agent/test", "agent/web"];
  const files = dirs.flatMap((d) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".js")).map((f) => `${d}/${f}`) : []));
  const problems = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ["--check", path.join(ROOT, f)], { encoding: "utf8" });
    if (r.status !== 0) problems.push(`${f}: ${r.stderr.trim().split("\n").slice(0, 4).join(" ")}`);
  }
  for (const f of ["start.sh", ...fs.readdirSync(path.join(ROOT, ".githooks")).map((h) => `.githooks/${h}`)]) {
    const r = spawnSync("sh", ["-n", path.join(ROOT, f)], { encoding: "utf8" });
    if (r.status !== 0) problems.push(`${f}: ${r.stderr.trim()}`);
  }
  return problems;
}

const SECRET_PATTERNS = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "Anthropic API Key"],
  [/AKIA[0-9A-Z]{16}/, "AWS Access Key"],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\s*\n[A-Za-z0-9+/=]{40,}/, "私钥"],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, "GitHub Token"],
];

function secrets() {
  const problems = [];
  for (const f of textFiles()) {
    const text = read(f);
    for (const [re, what] of SECRET_PATTERNS) {
      const m = text.match(re);
      if (m) problems.push(`${f}:${text.slice(0, m.index).split("\n").length}: 疑似 ${what}（${m[0].slice(0, 10)}…）。密钥只能放在 agent/.env`);
    }
  }
  return problems;
}

// 历史上踩过的坑：废弃的 Siemens/ 路径前缀；WAM 被误写成 Barrett 机械臂（见 CLAUDE.md）。
// 描述这些规则的元文档（CLAUDE.md、CONTRIBUTING.md、本脚本）不扫描。
const META_DOCS = new Set(["CLAUDE.md", "CONTRIBUTING.md", "CHANGELOG.md"]);
const GUARDS = [
  [/Siemens\//, "废弃路径前缀 Siemens/，内容统一在 Knowledge/ 下", (f) => !META_DOCS.has(f) && !f.startsWith("agent/scripts/")],
  [/Barrett/i, "WAM 指世界模型（World Model），不是 Barrett 机械臂", (f) => f.startsWith("Knowledge/") || f.startsWith("templates/")],
];

function guards() {
  const problems = [];
  for (const f of textFiles()) {
    const text = read(f);
    for (const [re, why, applies] of GUARDS) {
      if (!applies(f)) continue;
      const m = text.match(re);
      if (m) problems.push(`${f}:${text.slice(0, m.index).split("\n").length}: ${why}`);
    }
  }
  return problems;
}

let kb;
function standard() {
  kb ??= new KnowledgeBase(ROOT);
  kb.reindex();
  return kb.check().map((p) => `${p.file}: ${p.problem}`);
}

function paperIndexes() {
  kb ??= new KnowledgeBase(ROOT);
  return syncIndexes(kb, { write: false })
    .filter((r) => r.status !== "ok")
    .map((r) => `${r.relPath}: ${r.status}${r.status === "stale" ? "（运行 ./start.sh papers 重新生成）" : ""}`);
}

function tests() {
  const dir = path.join(AGENT, "test");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.js")).map((f) => path.join(dir, f));
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=dot", ...files], { cwd: AGENT, encoding: "utf8", env: { ...process.env, ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "" } });
  if (r.status === 0) return [];
  return [(r.stdout + r.stderr).trim().split("\n").slice(-40).join("\n")];
}

// 与 GitHub Pages 发布用的是同一个构建；构建到临时目录，确认页面和每篇文档的数据都生成了。
function staticSite() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "kb-static-"));
  try {
    const r = buildStatic(out);
    const missing = ["index.html", "app.js", "search-core.js", "data/tree.json", "data/search.json", "vendor/marked/marked.min.js"].filter((f) => !fs.existsSync(path.join(out, f)));
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const problems = missing.map((f) => `缺少 ${f}`);
    if (!html.includes("window.KB_STATIC = true")) problems.push("index.html 没有注入 KB_STATIC");
    if (/(src|href)="\//.test(html)) problems.push("index.html 里有以 / 开头的绝对路径，GitHub Pages 子路径下会 404");
    if (r.documents !== fs.readdirSync(path.join(out, "data/doc"), { recursive: true }).filter((f) => String(f).endsWith(".json")).length) problems.push("文档 JSON 数量与索引不一致");
    return problems;
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

const STAGES = [
  ["语法检查", syntax, true],
  ["密钥扫描", secrets, true],
  ["术语与路径守卫", guards, true],
  ["规范检查（STANDARD.md）", standard, true],
  ["论文库索引是否最新", paperIndexes, true],
  ["单元 + 冒烟测试", tests, false],
  ["静态站构建（GitHub Pages）", staticSite, false],
];

// ---------- run ----------

if (!fs.existsSync(path.join(AGENT, "node_modules"))) {
  console.error("❌ 缺少 agent/node_modules，先运行 ./start.sh setup 或 cd agent && npm install");
  process.exit(1);
}

let failed = 0;
console.log(`CI ${FAST ? "（快速模式：跳过测试）" : "（完整）"}`);
for (const [name, fn, inFast] of STAGES) {
  if (FAST && !inFast) {
    console.log(`  ○ ${name}  跳过`);
    continue;
  }
  const t0 = Date.now();
  let problems;
  try {
    problems = fn();
  } catch (err) {
    problems = [`阶段异常：${err.stack ?? err.message}`];
  }
  const ms = `${Date.now() - t0}ms`;
  if (!problems.length) {
    console.log(`  ✓ ${name}  ${ms}`);
    continue;
  }
  failed++;
  console.log(`  ✗ ${name}  ${ms}`);
  for (const p of problems.slice(0, 50)) console.log(`      ${p.replace(/\n/g, "\n      ")}`);
  if (problems.length > 50) console.log(`      …共 ${problems.length} 条`);
}
console.log(failed ? `\n❌ ${failed} 个阶段失败` : "\n✅ CI 通过");
process.exitCode = failed ? 1 : 0;

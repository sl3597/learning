#!/usr/bin/env node
// Local release: full CI -> next semver from Conventional Commits -> CHANGELOG.md -> version bump -> commit + tag.
//   node scripts/release.js [auto|patch|minor|major] [--dry-run]
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KnowledgeBase } from "../src/kb.js";
import { localDate } from "../src/config.js";
import { listPapers } from "../src/papers.js";
import { HEADER } from "./commit-msg.js";

const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(AGENT, "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const level = args.find((a) => !a.startsWith("--")) ?? "auto";

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
const die = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const SECTIONS = [
  ["breaking", "💥 破坏性变更"],
  ["feat", "✨ 新功能"],
  ["content", "📚 知识内容"],
  ["paper", "📄 论文库"],
  ["fix", "🐛 修复"],
  ["docs", "📝 文档"],
  ["refactor", "♻️ 重构与性能"],
  ["other", "🔧 工程"],
];

/** Parse `git log` into conventional-commit entries. */
export function parseCommits(log) {
  return log
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, subject, body = ""] = r.split("\x1f");
      const m = subject.match(HEADER);
      const type = m?.[1] ?? "other";
      const breaking = Boolean(m?.[3]) || /^BREAKING CHANGE:/m.test(body);
      const desc = m ? subject.slice(subject.indexOf(": ") + 2) : subject;
      return { hash: hash.slice(0, 7), type, scope: m?.[2]?.slice(1, -1) ?? "", desc, breaking };
    })
    .filter((c) => !/^chore\(release\)/.test(`${c.type}(${c.scope})`));
}

export function nextVersion(current, commits, wanted = "auto") {
  let [major, minor, patch] = current.split(".").map(Number);
  let bump = wanted;
  if (bump === "auto") bump = commits.some((c) => c.breaking) ? (major === 0 ? "minor" : "major") : commits.some((c) => ["feat", "content", "paper"].includes(c.type)) ? "minor" : "patch";
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`未知的版本级别：${wanted}（auto | patch | minor | major）`);
}

export function renderChangelog(version, date, commits, snapshot) {
  const group = (c) => (c.breaking ? "breaking" : ["feat", "content", "paper", "fix", "docs"].includes(c.type) ? c.type : ["refactor", "perf"].includes(c.type) ? "refactor" : "other");
  const out = [`## v${version} · ${date}`, ""];
  for (const [key, title] of SECTIONS) {
    const items = commits.filter((c) => group(c) === key);
    if (!items.length) continue;
    out.push(`### ${title}`, "", ...items.map((c) => `- ${c.scope ? `**${c.scope}**：` : ""}${c.desc}（${c.hash}）`), "");
  }
  out.push(`> 知识库快照：${snapshot}`, "");
  return out.join("\n");
}

function main() {
  try {
    git("rev-parse", "--git-dir");
  } catch {
    die("不是 git 仓库，先运行 ./start.sh setup");
  }
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (!DRY && branch !== "main") die(`只能在 main 分支发布（当前 ${branch}）。先把分支合并到 main。`);
  if (!DRY && git("status", "--porcelain")) die("工作区有未提交的改动，先提交或暂存");

  let lastTag = "";
  try {
    lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  } catch {}
  const range = lastTag ? [`${lastTag}..HEAD`] : [];
  const commits = parseCommits(git("log", "--no-merges", ...range, "--pretty=format:%H%x1f%s%x1f%b%x1e"));
  if (!commits.length) die(`自 ${lastTag || "仓库创建"} 以来没有新提交，无需发布`);

  console.log("== 运行完整 CI ==");
  const ci = spawnSync(process.execPath, [path.join(AGENT, "scripts", "ci.js")], { stdio: "inherit" });
  if (ci.status !== 0) die("CI 未通过，停止发布");

  const pkgPath = path.join(AGENT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const version = nextVersion(pkg.version, commits, level);
  const today = localDate();

  const kb = new KnowledgeBase(ROOT);
  const stats = kb.reindex();
  const status = Object.entries(stats.byStatus).map(([k, v]) => `${k} ${v}`).join(" / ");
  const snapshot = `${stats.documents} 篇文档，其中论文笔记 ${listPapers(kb).length} 篇；状态 ${status}`;
  const section = renderChangelog(version, today, commits, snapshot);

  console.log(`\n== v${pkg.version} → v${version}（${commits.length} 个提交，自 ${lastTag || "仓库创建"}）==\n`);
  console.log(section);
  if (DRY) return console.log("（--dry-run：未修改任何文件）");

  const clPath = path.join(ROOT, "CHANGELOG.md");
  const header = "# 更新日志\n\n> 由 `./start.sh release` 根据 Conventional Commits 自动生成，请勿手改已发布的条目。\n\n";
  const old = fs.existsSync(clPath) ? fs.readFileSync(clPath, "utf8").replace(header, "") : "";
  fs.writeFileSync(clPath, header + section + "\n" + old.trimStart(), "utf8");

  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  const lockPath = path.join(AGENT, "package-lock.json");
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
  }

  git("add", "CHANGELOG.md", "agent/package.json", "agent/package-lock.json");
  git("commit", "-m", `chore(release): v${version}`);
  git("tag", "-a", `v${version}`, "-m", `v${version}\n\n${section}`);
  console.log(`✅ 已发布 v${version}：提交 + 标签已创建。查看：git show v${version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

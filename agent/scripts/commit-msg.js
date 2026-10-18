#!/usr/bin/env node
// commit-msg hook: enforce Conventional Commits so release.js can build the changelog.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TYPES = {
  feat: "新功能（agent / web）",
  fix: "修复",
  content: "知识内容（新增或改写章节）",
  paper: "论文库（新增或复核论文笔记）",
  docs: "说明文档（README / CONTRIBUTING / STANDARD）",
  refactor: "重构",
  perf: "性能",
  test: "测试",
  ci: "CI / 钩子 / 发布脚本",
  chore: "杂项（依赖、发布提交等）",
  revert: "回滚",
};

export const HEADER = new RegExp(`^(${Object.keys(TYPES).join("|")})(\\([a-z0-9/._-]+\\))?(!)?: \\S.{0,99}$`);

/** Returns null when the message is acceptable, otherwise an error string. */
export function lintMessage(raw) {
  const lines = raw.split("\n").filter((l) => !l.startsWith("#"));
  const header = (lines[0] ?? "").trim();
  if (/^(Merge|Revert|fixup!|squash!|amend!) /.test(header)) return null;
  if (!header) return "提交信息为空";
  if (!HEADER.test(header)) return `提交信息首行不符合规范：「${header}」`;
  if (lines[1] && lines[1].trim()) return "首行与正文之间要空一行";
  return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const err = lintMessage(fs.readFileSync(process.argv[2], "utf8"));
  if (err) {
    console.error(`❌ ${err}\n\n格式：<type>(<scope>可选)!可选: <说明>\n例如：\n  content(linux): 新增第 19 章 tmux\n  paper(vla): 导入 OpenVLA 论文笔记\n  fix(web): 修复代码块渲染成 undefined\n\n可用 type：`);
    for (const [t, d] of Object.entries(TYPES)) console.error(`  ${t.padEnd(9)} ${d}`);
    console.error("\n破坏性变更在 type 后加 !（例如 feat(agent)!: …）或在正文写 BREAKING CHANGE:");
    process.exit(1);
  }
}

// Builds a throw-away knowledge base on disk for tests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AUTO_START, AUTO_END } from "../src/papers.js";

const fm = (fields) => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`).join("\n")}\n---\n`;
const base = { level: "beginner", tags: ["a", "b", "c"], status: "draft", created: "2026-10-17", updated: "2026-10-17" };

export const TUTORIAL_HEADINGS = ["学习目标", "前置知识", "核心概念", "详细讲解", "动手练习", "常见错误与排查", "小结", "自测题", "参考资料"];
export const PAPER_HEADINGS = ["论文信息", "一句话总结", "背景与动机", "方法", "实验", "优点与不足", "与知识库的关联", "复现清单", "我的问题与想法"];

export function tutorial(title, extra = "") {
  return fm({ title, type: "tutorial", topic: "vla", ...base }) + `\n# ${title}\n\n` + TUTORIAL_HEADINGS.map((h) => `## ${h}\n\n内容\n`).join("\n") + extra;
}

export function paper(title, { topic = "vla", related = ["Knowledge/VLA/01-basics.md"], link = "../../VLA/01-basics.md", year = "2025" } = {}) {
  const meta = { title, type: "paper-note", topic, ...base, year };
  if (related) meta.related = related;
  return fm(meta) + `\n# ${title}\n\n` + PAPER_HEADINGS.map((h) => `## ${h}\n\n${h === "与知识库的关联" && link ? `- [基础](${link})` : "内容"}\n`).join("\n");
}

export function index(title, topic, auto = true) {
  return fm({ title, type: "index", topic, ...base }) + `\n# ${title}\n\n${auto ? `${AUTO_START}\n${AUTO_END}\n` : ""}`;
}

/** Create a minimal valid KB; `files` overrides/adds {relPath: content}. Returns the root path. */
export function makeKb(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kb-test-"));
  const all = {
    "Knowledge/VLA/00-README.md": index("VLA", "vla", false),
    "Knowledge/VLA/01-basics.md": tutorial("基础"),
    "Knowledge/Papers/00-README.md": index("论文库", "paper"),
    "Knowledge/Papers/VLA/00-README.md": index("VLA 论文", "vla"),
    "Knowledge/Papers/WAM/00-README.md": index("WAM 论文", "wam"),
    "Knowledge/Papers/Robotics/00-README.md": index("Robotics 论文", "robotics"),
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    if (text == null) continue;
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text, "utf8");
  }
  return root;
}

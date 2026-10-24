// Ranking rules of search-core.js: title / file-name hits win and land on the intro section; the packed
// static index ranks exactly like the full one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBase } from "../src/kb.js";
import { SearchIndex, tokenize, compactText, packChunks, unpackChunks, fileWords, INTRO_HEADING } from "../src/search-core.js";
import { makeKb, tutorial, TUTORIAL_HEADINGS } from "./fixture.js";

/** A tutorial whose intro and one named section carry extra text. */
const chapter = (title, { intro = "", sections = {} } = {}) => {
  let md = tutorial(title).replace(`# ${title}\n\n`, `# ${title}\n\n> ${intro}\n\n`);
  for (const [h, text] of Object.entries(sections)) md = md.replace(`## ${h}\n\n内容\n`, `## ${h}\n\n${text}\n`);
  return md;
};

const kbWith = (files) => {
  const kb = new KnowledgeBase(makeKb(files));
  kb.reindex();
  return kb;
};

test("fileWords: NN- prefix and .md stripped, dashes become spaces", () => {
  assert.equal(fileWords("Knowledge/VLA/Pi/02-pi0-architecture-and-flow-matching.md"), "pi0 architecture and flow matching");
  assert.equal(fileWords("Knowledge/VLA/00-README.md"), "README");
});

test("a file-name / title hit outranks sections that merely repeat the words, and lands on the intro", () => {
  const kb = kbWith({
    // 标题是中文，英文词只在文件名里；正文提到一次
    "Knowledge/VLA/02-flow-matching.md": chapter("流匹配动作专家", { intro: "本章讲 flow matching 怎么生成动作。", sections: { 学习目标: "理解 flow matching 的采样过程。" } }),
    // 另一篇在很短的"学习目标"里把同一个词重复三遍（纯 BM25 会把它排第一）
    "Knowledge/VLA/03-other.md": chapter("其他模型", { sections: { 学习目标: "flow matching、flow matching、flow matching。", 小结: "flow matching 回顾。" } }),
  });
  const hits = kb.search("flow matching", 10);
  assert.equal(hits[0].relPath, "Knowledge/VLA/02-flow-matching.md");
  assert.equal(hits[0].heading, INTRO_HEADING, "文档级命中落在开头段");
  const own = hits.filter((h) => h.relPath === "Knowledge/VLA/02-flow-matching.md").map((h) => h.heading);
  assert.deepEqual(own, [INTRO_HEADING, "学习目标"], "开头段排在学习目标前；没提到查询词的段落不靠文件名蹭分");
  assert.ok(hits.some((h) => h.relPath === "Knowledge/VLA/03-other.md"), "正文命中的其他文档仍在结果里");
});

test("title hit on a Chinese title: intro first, then the sections of that document", () => {
  const kb = kbWith({
    "Knowledge/VLA/02-what-is-vla.md": chapter("VLA 是什么：定义与数据流", { intro: "VLA 是什么？它把视觉、语言和动作放进一个模型，本章先讲定义，再讲数据流。", sections: { 学习目标: "说出 VLA 是什么。" } }),
    "Knowledge/VLA/03-models.md": chapter("代表性模型", { sections: { 前置知识: "先知道 VLA 是什么。" } }),
  });
  const hits = kb.search("VLA 是什么", 10);
  assert.equal(hits[0].relPath, "Knowledge/VLA/02-what-is-vla.md");
  assert.equal(hits[0].heading, INTRO_HEADING);
  assert.equal(hits[1].relPath, "Knowledge/VLA/02-what-is-vla.md");
});

test("a long query that only grazes a title does not get hijacked by it", () => {
  const kb = kbWith({
    "Knowledge/VLA/02-arm-overview.md": chapter("协作机械臂总览", { intro: "机械臂的型号与参数。" }),
    "Knowledge/VLA/03-force.md": chapter("力控模式", { intro: "怎么让机械臂恒力下压：用 force_mode 设定目标力，机械臂沿法线保持恒力下压。" }),
  });
  assert.equal(kb.search("怎么让机械臂恒力下压", 5)[0].relPath, "Knowledge/VLA/03-force.md");
});

test("topic / type filters still apply", () => {
  const kb = kbWith({ "Knowledge/VLA/02-flow-matching.md": chapter("流匹配", { intro: "flow matching" }) });
  assert.equal(kb.search("flow matching", 5, { topic: "wam" }).length, 0);
  assert.ok(kb.search("flow matching", 5, { type: "tutorial" }).length > 0);
});

test("compactText keeps exactly the same tokens with fewer bytes, and keeps letters of every script", () => {
  const samples = [
    "# 标题\n\n> 💡 要点：**VLA**（Vision-Language-Action）把视觉、语言、动作放进一个模型。\n\n| a | b |\n|---|---|\n| `chmod 755` | x |\n",
    "π0 用 flow-matching；a→b, c+d, e.f...g, ...abc, x-y, İstanbul, café, cafe\u0301, ０１２ ½ x², 中，文。中-文 K",
    "> 💡 要点：中💡文 🔗 关联 𝒙 ️ 豈 龥 鿿 㐀",
    "```bash\nforce_mode(task_frame, [0,0,1,0,0,0], [0,0,-10,0,0,0], 2, limits)\n```",
    "",
    "！！！",
  ];
  for (const s of samples) {
    const c = compactText(s);
    assert.deepEqual(tokenize(c), tokenize(s), JSON.stringify(s));
    assert.ok(Buffer.byteLength(c) <= Buffer.byteLength(s));
  }
  assert.equal(compactText("  a,,b  "), "a b");
  // 非 ASCII 的字母 / 数字（π、é、全角数字）原样保留，只折叠标点、符号与空白
  assert.equal(compactText("π0：VLM 骨干 + 流匹配动作专家"), "π0 VLM 骨干 + 流匹配动作专家");
  assert.equal(compactText("café → ０１２；x²"), "café ０１２ x²");
  assert.equal(compactText("> ⚠️ 注意：**力/力矩**（F/T）"), "注意 力 力矩 F T", "孤立的变体选择符随被丢掉的基字符一起丢");
  assert.equal(compactText("cafe\u0301, 💡️x"), "cafe\u0301 💡️x", "跟在保留字符后面的组合标记保留");
});

test("packed index: same ranking and scores as the full chunks", () => {
  const kb = kbWith({
    "Knowledge/VLA/02-flow-matching.md": chapter("流匹配动作专家", { intro: "本章讲 flow matching。", sections: { 核心概念: "flow matching 从噪声走到动作。" } }),
    "Knowledge/VLA/03-other.md": chapter("其他模型", { sections: { 小结: "flow matching 回顾；chmod 权限。" } }),
  });
  const packed = JSON.parse(JSON.stringify(packChunks(kb.chunks)));
  assert.equal(packed.v, 2);
  assert.deepEqual(
    unpackChunks(packed).map((c) => [c.relPath, c.heading]),
    kb.chunks.map((c) => [c.relPath, c.heading]),
    "段落顺序不变"
  );
  const browser = new SearchIndex(packed);
  const strip = (hits) => hits.map(({ snippet, ...h }) => h);
  for (const q of ["flow matching", "chmod 权限", "基础", "小结"]) assert.deepEqual(strip(browser.search(q, 10)), strip(kb.search(q, 10)), q);
  // 每篇文档的元数据只存一次
  assert.ok(packed.docs.every((d) => typeof d.title === "string" && Array.isArray(d.sections)));
  assert.equal(packed.docs.find((d) => d.relPath === "Knowledge/VLA/02-flow-matching.md").sections.length, TUTORIAL_HEADINGS.length + 1);
});

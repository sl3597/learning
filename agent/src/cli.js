#!/usr/bin/env node
// Command-line entry: index / search / ask / paper / papers / check.
import { KnowledgeBase } from "./kb.js";
import { backend } from "./backend.js";
import { syncIndexes } from "./papers.js";
import { PAPERS_DIR } from "./config.js";

const [cmd, ...args] = process.argv.slice(2);
const kb = new KnowledgeBase();
kb.reindex();

switch (cmd) {
  case "index": {
    console.log(JSON.stringify(kb.stats(), null, 2));
    break;
  }
  case "search": {
    const q = args.join(" ");
    for (const h of kb.search(q, 10)) console.log(`${h.score}\t${h.relPath} ## ${h.heading}\n\t${h.snippet}\n`);
    break;
  }
  case "ask": {
    const q = args.join(" ");
    if (!q) {
      console.error("用法: npm run ask -- 你的问题");
      process.exit(1);
    }
    await backend.chat(kb, [{ role: "user", content: q }], (e) => {
      if (e.type === "text") process.stdout.write(e.text);
      else if (e.type === "tool_call") process.stderr.write(`\n[工具] ${e.name} ${JSON.stringify(e.input)}\n`);
      else if (e.type === "status") process.stderr.write(`\n[状态] ${e.text}\n`);
    });
    process.stdout.write("\n");
    break;
  }
  case "paper": {
    const [source, targetDir = `${PAPERS_DIR}/VLA`, topic = ""] = args;
    if (!source) {
      console.error(`用法: npm run paper -- <arXiv链接|PDF链接|本地PDF路径> [目标文件夹，默认 ${PAPERS_DIR}/VLA] [topic，论文库内自动推断]`);
      process.exit(1);
    }
    const src = /^https?:/.test(source) ? { url: source } : { path: source };
    const r = await backend.ingestPaper(kb, { ...src, targetDir, topic, onText: (t) => process.stdout.write(t) });
    console.log(`\n\n已保存：${r.relPath}`);
    for (const p of r.problems) console.log(`⚠️  ${p}`);
    if (r.problems.length) console.log("以上问题请人工修正后再提交（./start.sh check）。");
    break;
  }
  case "papers": {
    // 默认重写论文库目录里的 AUTO-GENERATED 表格；--check 只检查是否过期（CI 用）。
    const checkOnly = args.includes("--check");
    const results = syncIndexes(kb, { write: !checkOnly });
    const bad = results.filter((r) => r.status !== "ok" && r.status !== "updated");
    for (const r of results) console.log(`${r.status.padEnd(15)} ${r.relPath}`);
    if (bad.length) {
      console.log(checkOnly ? "\n论文库索引已过期或缺失，运行 ./start.sh papers 重新生成后再提交。" : "\n有文件缺失或缺少 AUTO-GENERATED 标记，请先修复。");
      process.exitCode = 1;
    }
    break;
  }
  case "check": {
    const problems = kb.check();
    if (!problems.length) console.log("全部文档符合 STANDARD.md ✅");
    for (const p of problems) console.log(`${p.file}: ${p.problem}`);
    process.exitCode = problems.length ? 1 : 0;
    break;
  }
  default:
    console.log("用法: node src/cli.js <index|search|ask|paper|papers [--check]|check> ...");
}

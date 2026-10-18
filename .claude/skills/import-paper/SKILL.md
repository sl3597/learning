---
name: import-paper
description: 把一篇论文（arXiv 链接或本地 PDF）整理成符合 STANDARD.md 的论文笔记，写入 Knowledge/Papers/<VLA|WAM|Robotics>/ 并通过 related 关联知识章节。用户说"导入论文 / 精读这篇 / 加到论文库 / 从待读清单导入"时使用。直接用当前 Claude Code 会话完成，不需要 agent/ 的 API Key。
---

# 导入论文到论文库

这是 `./start.sh paper` 的 Claude Code 版本：由当前会话读论文、写笔记，结果与 `agent/src/paper.js` 生成的一致，必须通过同一套检查。

## 1. 确定目标

- 领域目录：`Knowledge/Papers/VLA`（topic `vla`）、`Knowledge/Papers/WAM`（topic `wam`）、`Knowledge/Papers/Robotics`（topic `robotics`）。用户没说且从论文看不出来时问一句。
- 如果用户要的是多章精读（像 `Knowledge/VLA/ForceVLA/`），不要用这个技能的单文件流程，先和用户确认目录规划。

## 2. 读论文

- arXiv：先 WebFetch `https://arxiv.org/abs/<ID>` 拿标题、作者、日期；正文优先 WebFetch `https://arxiv.org/html/<ID>`（HTML 版），没有 HTML 版再请用户提供本地 PDF。
- 本地 PDF：用 Read 的 `pages` 参数分段读，超过 20 页分多次。
- 所有数字（指标、超参数、数据量）只能来自论文原文；读不到或有歧义的写 `> ❓ 待解决：`。

## 3. 读规范

依次读：`STANDARD.md` 第 3、5、11 节，`templates/paper-note-template.md`，目标领域的 `00-README.md`（看待读清单）。

## 4. 选 related

```bash
cd agent && node src/cli.js search <论文的 2~3 个关键概念>
```

从结果里挑 2~6 篇**非论文**的知识章节，写成知识库根目录相对路径（`Knowledge/VLA/Basic/07-action-representation.md`）。`## 与知识库的关联` 里用相对本文件的链接（从 `Knowledge/Papers/<领域>/` 出发是 `../../VLA/Basic/...`）列出同样的章节，每条一句话说明关联点。

## 5. 写文件

- 文件名：目标目录里最大的 `NN-` 编号 + 1，加英文短横线 slug，如 `03-openvla.md`。
- frontmatter：`type: paper-note`、领域 topic、`status: draft`、`created/updated` 为今天、`sources` 含 arXiv 链接、`related`、能确定时填 `year` / `venue`。
- 正文按 STANDARD 第 5 节 9 个固定 H2，一句话总结 ≤ 60 字，方法部分逐模块写"输入 → 处理 → 输出 → 为什么这样设计"并附 Mermaid 图，面向零基础读者解释术语。

## 6. 收尾

```bash
./start.sh papers        # 刷新论文库目录表格和反向索引
./start.sh ci --fast     # 必须全绿
```

- 如果这篇论文在领域 `00-README.md` 的"待读清单"里，删掉那一行。
- 向用户报告：文件路径、related 选了哪些、有哪些 ❓ 待核实项。提醒人工复核后把 `status` 改成 `reviewed`。
- 不要自动提交；用户要求提交时用 `paper(<领域小写>): 导入 <论文简称> 论文笔记`。

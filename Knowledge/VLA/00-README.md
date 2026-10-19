---
title: VLA 总目录（基础 + 论文专题）
type: index
topic: vla
chapter: 0
level: all
tags: [VLA, 视觉语言动作, 目录, 论文]
status: draft
created: 2026-10-17
updated: 2026-10-19
---

# VLA 总目录

> **VLA（Vision-Language-Action，视觉-语言-动作模型）**：看图像、听指令、直接输出机器人动作的模型。本目录分两部分：先打基础，再精读论文。

## 结构

```mermaid
flowchart LR
  B[Basic<br/>11 章基础教程] --> PI[Pi<br/>π 系列专题 6 章]
  PI --> F[ForceVLA<br/>7 章论文专题]
  B --> F
  PI --> P[Papers/VLA<br/>论文库]
  F --> P
```

| 子目录 | 内容 | 入口 |
|---|---|---|
| Basic | 从机器人学习概述、深度学习/Transformer 最小知识，到 VLA 概念、代表模型、数据、训练、评估、力感知，附术语表 | [Basic/00-README.md](Basic/00-README.md) |
| Pi | Physical Intelligence 的 π 系列专题：π0（流匹配动作专家）→ π0-FAST（动作 token 化）→ π0.5（协同训练 + 知识隔离）→ π*0.6（RECAP 强化学习），加 openpi 实战 | [Pi/00-README.md](Pi/00-README.md) |
| ForceVLA | 论文《ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation》精读：背景、方法、数据集、实验、复现、批判 | [ForceVLA/00-README.md](ForceVLA/00-README.md) |

## 建议顺序

1. Basic 01~04：建立概念。
2. Basic 05~09：知道有哪些模型、数据从哪来、怎么训练和评估。
3. Pi 01~06：把当前最主流的 π 系列基座模型一代代读懂，并用 openpi 跑起来。
4. Basic 10：力感知——为什么只靠视觉不够。
5. ForceVLA 01~07：精读在 π0 上加力觉的论文并规划复现。

## 新增论文笔记

- **泛读**（一篇一个文件）：导入到论文库 [Papers/VLA](../Papers/VLA/00-README.md)，命令 `./start.sh paper <arXiv 链接> Knowledge/Papers/VLA`，或在 Web 里点"导入论文"。笔记会自动关联本目录的章节，并出现在每个相关章节底部的"📄 相关论文"里。
- **精读**（拆成多章）：像 ForceVLA 一样建一个论文专题文件夹，内部按 `NN-xxx.md` 编号，`01-paper-overview.md` 用论文笔记模板（同样要填 `related`）。
- **模型家族**（多篇论文）：像 [Pi](Pi/00-README.md) 一样建专题文件夹写教程，每篇论文的笔记仍放进论文库，并在 `related` 里关联专题章节。

## 关联

- 世界模型：[../WAM/00-README.md](../WAM/00-README.md) —— 在 VLA 之上加入"预测未来"的能力
- 论文库：[../Papers/VLA/00-README.md](../Papers/VLA/00-README.md) —— 与 VLA 相关的论文笔记，自动关联到本目录各章节
- 基础工具：[../LinuxCommand/00-README.md](../LinuxCommand/00-README.md)

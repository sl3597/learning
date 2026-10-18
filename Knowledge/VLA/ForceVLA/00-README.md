---
title: ForceVLA 论文专题目录
type: index
topic: forcevla
chapter: 0
level: all
tags: [ForceVLA, VLA, 力感知, MoE, 接触丰富操作, 论文专题]
prerequisites: []
estimated_time: 10min
sources:
  - https://arxiv.org/abs/2505.22159
  - https://sites.google.com/view/forcevla2025
  - https://github.com/ft-robotic/ForceVLA
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# ForceVLA 论文专题目录

> 本专题围绕一篇论文展开：**ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation**（arXiv 2505.22159，NeurIPS 2025）。它回答一个问题：当机器人要做"插插头、擦白板、削黄瓜"这种必须**用力感知**的任务时，怎样把六轴力/力矩信号真正融进 VLA（视觉-语言-动作）模型里。

## 1. 主题简介

学完本专题你能够：

- 用自己的话讲清楚 ForceVLA 解决了什么问题、核心模块 **FVLMoE** 长什么样、为什么要"晚期融合"。
- 读懂论文里的每一张结果表，知道哪些数字可信、哪些有歧义。
- 根据公开代码（基于 π0 / openpi）复现训练流程，并知道换到其他机械臂时要改什么。
- 列出这篇论文留下的开放问题，作为自己下一步实验的起点。

## 2. 学习路线

```mermaid
flowchart LR
    A[01 论文总览<br/>paper-note] --> B[02 背景与动机<br/>beginner 30min]
    B --> C[03 方法详解<br/>intermediate 60min]
    C --> D[04 数据集 ForceVLA-Data<br/>beginner 30min]
    D --> E[05 实验与结果<br/>intermediate 45min]
    E --> F[06 复现指南<br/>advanced 90min]
    F --> G[07 批判与开放问题<br/>intermediate 30min]
```

建议顺序：先读 01 建立全貌（15 分钟），再按 02 → 07 逐章深入。零基础读者在 02 之前先完成 [VLA 基础](../Basic/00-README.md) 的前几章。

## 3. 章节表格

| 章节 | 文件 | 类型 | 难度 | 预计时长 | 状态 |
|---|---|---|---|---|---|
| 00 目录 | `00-README.md` | index | all | 10min | draft |
| 01 论文总览（规范论文笔记） | [01-paper-overview.md](01-paper-overview.md) | paper-note | intermediate | 20min | draft |
| 02 背景与动机 | [02-background-and-motivation.md](02-background-and-motivation.md) | tutorial | beginner | 30min | draft |
| 03 方法详解：π0 + FVLMoE | [03-method.md](03-method.md) | tutorial | intermediate | 60min | draft |
| 04 数据集 ForceVLA-Data | [04-dataset-forcevla-data.md](04-dataset-forcevla-data.md) | tutorial | beginner | 30min | draft |
| 05 实验与结果 | [05-experiments-and-results.md](05-experiments-and-results.md) | tutorial | intermediate | 45min | draft |
| 06 复现指南 | [06-reproduction-guide.md](06-reproduction-guide.md) | tutorial | advanced | 90min | draft |
| 07 批判与开放问题 | [07-critique-and-open-questions.md](07-critique-and-open-questions.md) | tutorial | intermediate | 30min | draft |

## 4. 与其他主题的关系

- **前置**：[VLA 基础](../Basic/00-README.md)，尤其是 [代表性模型（π0 等）](../Basic/05-representative-models.md) 和 [力与触觉感知](../Basic/10-force-and-tactile-sensing.md)。
- **延伸方向**：论文用的是 Flexiv Rizon 机械臂，换平台时的力信号对齐见 [VLA 基础：力觉与触觉感知](../Basic/10-force-and-tactile-sensing.md)；把力信息进一步用于"预测接触后果"，见 [WAM 世界模型](../../WAM/00-README.md)。
- **工具链**：训练脚本需要 Linux 命令行基础，见 [LinuxCommand](../../LinuxCommand/00-README.md)。

> 🔗 关联：本专题的 `> ❓ 待解决：` 问题汇总在 [07 章](07-critique-and-open-questions.md)，Agent 系统会据此生成追问与实验建议。

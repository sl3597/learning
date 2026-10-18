---
title: 论文库 · VLA 视觉-语言-动作模型
type: index
topic: vla
chapter: 0
level: all
tags: [论文库, VLA, 论文笔记, 动作表示, 力感知]
status: draft
created: 2026-10-17
updated: 2026-10-18
---

# 论文库 · VLA 视觉-语言-动作模型

> 与 [VLA 基础](../../VLA/Basic/00-README.md) 和 [ForceVLA 论文专题](../../VLA/ForceVLA/00-README.md) 配套的论文笔记。每篇都通过 `related` 关联到具体章节。

## 主题简介

读完这里的论文，你能把 [05 代表性模型](../../VLA/Basic/05-representative-models.md) 里时间线上的每个名字，对应到它真正的模型结构、训练数据和实验结论。

## 学习路线

1. 先读 [04 VLA 是什么](../../VLA/Basic/04-vla-concept.md) 和 [05 代表性模型](../../VLA/Basic/05-representative-models.md)。
2. 按下面"待读清单"的时间顺序读：离散 token 动作（RT-2、OpenVLA）→ 扩散/流匹配动作头（Octo、π0）→ 力感知（ForceVLA）。

## 章节表格

<!-- AUTO-GENERATED:papers START · 由 ./start.sh papers 生成，请勿手改 -->
| 论文 | 年份 | 发表 | 难度 | 状态 | 关联知识 |
|---|---|---|---|---|---|
| [ForceVLA 论文总览（规范论文笔记）](../../VLA/ForceVLA/01-paper-overview.md)（精读专题） | 2025 | NeurIPS 2025 | intermediate | draft | [VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md)<br>[力觉与触觉感知：为什么只靠眼睛不够](../../VLA/Basic/10-force-and-tactile-sensing.md)<br>[Transformer 与多模态模型](../../VLA/Basic/03-transformers-and-multimodal.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md)<br>[世界模型 × VLA：融合范式](../../WAM/05-world-models-meet-vla.md) |
| [OpenVLA：开源的视觉-语言-动作模型](01-openvla.md) | 2024 | — | intermediate | draft | [VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md)<br>[动作表示：从模型输出到电机转动](../../VLA/Basic/07-action-representation.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md)<br>[Transformer 与多模态模型](../../VLA/Basic/03-transformers-and-multimodal.md)<br>[数据集与数据采集](../../VLA/Basic/06-datasets-and-data-collection.md) |
<!-- AUTO-GENERATED:papers END -->

### 待读清单（手写，导入后从这里删掉）

> 🔗 关联：导入、复核和发布的完整步骤见 [如何添加一篇论文](../00-README.md#如何添加一篇论文)。

| 论文 | arXiv | 关联章节 | 导入命令 |
|---|---|---|---|
| RT-2 | [2307.15818](https://arxiv.org/abs/2307.15818) | [05 代表性模型](../../VLA/Basic/05-representative-models.md) | `./start.sh paper https://arxiv.org/abs/2307.15818 Knowledge/Papers/VLA` |
| Octo | [2405.12213](https://arxiv.org/abs/2405.12213) | [07 动作表示](../../VLA/Basic/07-action-representation.md) | `./start.sh paper https://arxiv.org/abs/2405.12213 Knowledge/Papers/VLA` |
| π0 | [2410.24164](https://arxiv.org/abs/2410.24164) | [05 代表性模型](../../VLA/Basic/05-representative-models.md) | `./start.sh paper https://arxiv.org/abs/2410.24164 Knowledge/Papers/VLA` |

## 与其他主题的关系

- 基础：[VLA 基础](../../VLA/Basic/00-README.md)；精读示例：[ForceVLA 论文专题](../../VLA/ForceVLA/00-README.md)。
- 与世界模型结合的论文放在 [WAM](../WAM/00-README.md)，并在 `related` 里同时关联 VLA 章节。

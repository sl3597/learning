---
title: 论文库 · VLA 视觉-语言-动作模型
type: index
topic: vla
chapter: 0
level: all
tags: [论文库, VLA, 论文笔记, 动作表示, 力感知]
status: draft
created: 2026-10-17
updated: 2026-10-19
---

# 论文库 · VLA 视觉-语言-动作模型

> 与 [VLA 基础](../../VLA/Basic/00-README.md) 和 [ForceVLA 论文专题](../../VLA/ForceVLA/00-README.md) 配套的论文笔记。每篇都通过 `related` 关联到具体章节。

## 主题简介

读完这里的论文，你能把 [05 代表性模型](../../VLA/Basic/05-representative-models.md) 里时间线上的每个名字，对应到它真正的模型结构、训练数据和实验结论。

## 学习路线

1. 先读 [04 VLA 是什么](../../VLA/Basic/04-vla-concept.md) 和 [05 代表性模型](../../VLA/Basic/05-representative-models.md)。
2. 按时间顺序读：离散 token 动作（RT-2、OpenVLA）→ 扩散/流匹配动作头（Octo、π0）→ 动作 token 化与开放世界泛化（FAST、π0.5、知识隔离）→ 强化学习（π*0.6）→ 力感知（ForceVLA）。π 系列五篇配套 [π 系列专题](../../VLA/Pi/00-README.md) 的教程读。

## 章节表格

<!-- AUTO-GENERATED:papers START · 由 ./start.sh papers 生成，请勿手改 -->
| 论文 | 年份 | 发表 | 难度 | 状态 | 关联知识 |
|---|---|---|---|---|---|
| [FAST：面向 VLA 的高效动作 token 化](03-fast.md) | 2025 | — | intermediate | draft | [FAST：把高频动作压缩成 token（π0-FAST）](../../VLA/Pi/03-fast-action-tokenization.md)<br>[π 系列家族综述：一代解决一个问题](../../VLA/Pi/01-pi-series-overview.md)<br>[动作表示：从模型输出到电机转动](../../VLA/Basic/07-action-representation.md)<br>[评估与部署：从成功率到真机运行](../../VLA/Basic/09-evaluation-and-deployment.md)<br>[VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md) |
| [π0.5：面向开放世界泛化的视觉-语言-动作模型](04-pi05.md) | 2025 | — | intermediate | draft | [π0.5：异构数据协同训练、分层推理与知识隔离](../../VLA/Pi/04-pi05-open-world-and-knowledge-insulation.md)<br>[π 系列家族综述：一代解决一个问题](../../VLA/Pi/01-pi-series-overview.md)<br>[数据集与数据采集](../../VLA/Basic/06-datasets-and-data-collection.md)<br>[评估与部署：从成功率到真机运行](../../VLA/Basic/09-evaluation-and-deployment.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md) |
| [知识隔离：让 VLA 训练快、推理快、泛化好](05-knowledge-insulation.md) | 2025 | — | advanced | draft | [π0.5：异构数据协同训练、分层推理与知识隔离](../../VLA/Pi/04-pi05-open-world-and-knowledge-insulation.md)<br>[π0：VLM 骨干 + 流匹配动作专家](../../VLA/Pi/02-pi0-architecture-and-flow-matching.md)<br>[Transformer 与多模态模型](../../VLA/Basic/03-transformers-and-multimodal.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md) |
| [π*0.6：从经验中学习的 VLA（RECAP）](06-pi06.md) | 2025 | — | advanced | draft | [π*0.6：用 RECAP 从自身经验中学习](../../VLA/Pi/05-pi06-learning-from-experience.md)<br>[π 系列家族综述：一代解决一个问题](../../VLA/Pi/01-pi-series-overview.md)<br>[什么是机器人学习](../../VLA/Basic/01-what-is-robot-learning.md)<br>[评估与部署：从成功率到真机运行](../../VLA/Basic/09-evaluation-and-deployment.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md) |
| [ForceVLA 论文总览（规范论文笔记）](../../VLA/ForceVLA/01-paper-overview.md)（精读专题） | 2025 | NeurIPS 2025 | intermediate | draft | [VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md)<br>[力觉与触觉感知：为什么只靠眼睛不够](../../VLA/Basic/10-force-and-tactile-sensing.md)<br>[Transformer 与多模态模型](../../VLA/Basic/03-transformers-and-multimodal.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md)<br>[世界模型 × VLA：融合范式](../../WAM/05-world-models-meet-vla.md) |
| [OpenVLA：开源的视觉-语言-动作模型](01-openvla.md) | 2024 | — | intermediate | draft | [VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md)<br>[动作表示：从模型输出到电机转动](../../VLA/Basic/07-action-representation.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md)<br>[Transformer 与多模态模型](../../VLA/Basic/03-transformers-and-multimodal.md)<br>[数据集与数据采集](../../VLA/Basic/06-datasets-and-data-collection.md) |
| [π0：面向通用机器人控制的视觉-语言-动作流模型](02-pi0.md) | 2024 | RSS 2025 | intermediate | draft | [π0：VLM 骨干 + 流匹配动作专家](../../VLA/Pi/02-pi0-architecture-and-flow-matching.md)<br>[π 系列家族综述：一代解决一个问题](../../VLA/Pi/01-pi-series-overview.md)<br>[VLA 是什么：视觉-语言-动作模型的定义与数据流](../../VLA/Basic/04-vla-concept.md)<br>[代表性 VLA 模型纵览](../../VLA/Basic/05-representative-models.md)<br>[动作表示：从模型输出到电机转动](../../VLA/Basic/07-action-representation.md)<br>[训练与微调：在自己的机器人上跑通 VLA](../../VLA/Basic/08-training-and-finetuning.md) |
<!-- AUTO-GENERATED:papers END -->

### 待读清单（手写，导入后从这里删掉）

> 🔗 关联：导入、复核和发布的完整步骤见 [如何添加一篇论文](../00-README.md#如何添加一篇论文)。

| 论文 | arXiv | 关联章节 | 导入命令 |
|---|---|---|---|
| RT-2 | [2307.15818](https://arxiv.org/abs/2307.15818) | [05 代表性模型](../../VLA/Basic/05-representative-models.md) | `./start.sh paper https://arxiv.org/abs/2307.15818 Knowledge/Papers/VLA` |
| Octo | [2405.12213](https://arxiv.org/abs/2405.12213) | [07 动作表示](../../VLA/Basic/07-action-representation.md) | `./start.sh paper https://arxiv.org/abs/2405.12213 Knowledge/Papers/VLA` |

## 与其他主题的关系

- 基础：[VLA 基础](../../VLA/Basic/00-README.md)；精读示例：[ForceVLA 论文专题](../../VLA/ForceVLA/00-README.md)。
- 与世界模型结合的论文放在 [WAM](../WAM/00-README.md)，并在 `related` 里同时关联 VLA 章节。

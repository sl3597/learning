---
title: 代表性 VLA 模型纵览
type: tutorial
topic: vla
chapter: 5
level: intermediate
tags: [RT-1, RT-2, Octo, OpenVLA, π0, π0.5, GR00T N1, 模型对比]
prerequisites: [04-vla-concept]
estimated_time: 60min
sources:
  - https://arxiv.org/abs/2212.06817
  - https://arxiv.org/abs/2307.15818
  - https://arxiv.org/abs/2405.12213
  - https://arxiv.org/abs/2406.09246
  - https://arxiv.org/abs/2410.24164
  - https://arxiv.org/abs/2504.16054
  - https://arxiv.org/abs/2503.14734
status: draft
created: 2026-10-17
updated: 2026-10-19
---

# 代表性 VLA 模型纵览

> 这一章像看家谱：按时间顺序认识 2022~2025 年最重要的 VLA 模型，知道每一个解决了什么问题、留下了什么没解决。读论文时遇到这些名字就不会陌生。

## 学习目标

- 能按时间线说出 RT-1 → RT-2 → Octo → OpenVLA → π0 → π0.5 / GR00T N1 的演进脉络
- 能从对比表中快速查到每个模型的骨干、动作表示、参数量和开源情况
- 能判断在自己的项目里应该从哪个模型入手

## 前置知识

- 需要先读：[04 VLA 是什么](04-vla-concept.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **骨干（backbone）** | 模型的主体，通常是预训练的 VLM | 房子的承重结构 |
| **动作表示** | 动作是离散 token 还是连续向量，以及由什么模块输出 | 水龙头是档位旋钮还是无级调节 |
| **开源** | 权重 + 代码 + （理想情况）数据都公开 | 菜谱连食材清单一起给你 |
| **跨本体（cross-embodiment）** | 一个模型在多种机器人上训练和使用 | 一个驾照能开多种车 |

## 详细讲解

### 5.1 对比总表

| 模型 | 年份 | 机构 | 骨干 | 动作表示 | 参数量 | 开源 | 链接 |
|---|---|---|---|---|---|---|---|
| RT-1 | 2022.12 | Google | EfficientNet-B3 + TokenLearner + Transformer（从头训练） | 离散 token（256 bin） | 35M | 代码 + 部分数据 | [arXiv](https://arxiv.org/abs/2212.06817) |
| RT-2 | 2023.07 | Google DeepMind | PaLI-X 55B / PaLM-E 12B | 离散 token，自回归 | 12B / 55B | 否 | [arXiv](https://arxiv.org/abs/2307.15818) |
| Octo | 2024.05 | UC Berkeley 等 | 自研 Transformer（从头训练） | 扩散头，连续 | 27M / 93M | 权重 + 代码 + 数据 | [arXiv](https://arxiv.org/abs/2405.12213) |
| OpenVLA | 2024.06 | Stanford / Berkeley 等 | Prismatic-7B（DINOv2 + SigLIP + Llama 2 7B） | 离散 token，自回归 | 7B | 权重 + 代码 | [arXiv](https://arxiv.org/abs/2406.09246) |
| π0 | 2024.10 | Physical Intelligence | PaliGemma 3B + 动作专家 | flow matching，连续，50 步 chunk | 约 3.3B | 2025 年开源权重（openpi） | [arXiv](https://arxiv.org/abs/2410.24164) |
| GR00T N1 | 2025.03 | NVIDIA | Eagle-2 VLM + 扩散 Transformer | 扩散，连续 | 2.2B | 权重 + 代码 | [arXiv](https://arxiv.org/abs/2503.14734) |
| π0.5 | 2025.04 | Physical Intelligence | π0 架构 + 异构数据协同训练 | 离散 token（高层）+ flow matching（低层） | 约 3B | openpi 中有权重 | [arXiv](https://arxiv.org/abs/2504.16054) |

> ❓ 待解决：Octo 预训练数据量（通常引用为 Open X-Embodiment 中约 80 万条轨迹）和 π0 动作专家的精确参数量（社区复现 open-pi-zero 给出约 0.3B）未从原文逐字核对，使用时请以论文为准。

### 5.2 RT-1：规模是第一生产力

Google 用 13 台移动机械臂、17 个月采集了 13 万条示范、700 多个任务。RT-1 本身是一个只有 35M 参数的小模型，但第一次证明：**在真实世界大规模数据上训练的 Transformer 策略，能在 700 个任务上达到 97% 成功率，并对新物体和新场景有一定泛化**。

它的输入是 6 帧历史图像 + 指令，输出 11 维离散动作（手臂 7 维 + 底盘 3 维 + 模式切换 1 维）。

**留下的问题**：没有语义理解，指令里出现训练时没见过的物体名就不行。

### 5.3 RT-2：把动作写成文字

RT-2 的核心主张只有一句：**VLA = VLM + 把动作当文本**。他们拿 PaLI-X（55B）和 PaLM-E（12B）这两个 VLM，在互联网图文数据和 RT-1 机器人数据上一起微调，让模型输出形如 `1 128 91 241 5 101 127` 的数字串作为动作。

结果令人惊讶：机器人能理解"把香蕉放到数字 3 上""把可乐罐移到泰勒·斯威夫特的照片旁"这类训练数据里完全没有的指令，因为这些知识来自 VLM 的互联网预训练。

**留下的问题**：模型不开源、太大（55B）、推理慢（约 1~3 Hz）。

### 5.4 Octo：第一个全开源的通用策略

Octo 把 Open X-Embodiment 数据集中约 80 万条轨迹用来训练一个 93M 参数的 Transformer，并首次在通用策略里使用**扩散动作头**。它支持语言或目标图像两种任务指定方式，权重、代码、训练流程全开源，并且设计了方便的微调接口（新的相机、新的动作空间都能接）。

**留下的问题**：没有 VLM 骨干，语言理解弱；模型小，泛化有限。

### 5.5 OpenVLA：开源版 RT-2

OpenVLA 用 Prismatic-7B（DINOv2 + SigLIP 双视觉编码器 + Llama 2 7B）在 Open X-Embodiment 的 97 万条轨迹上微调，动作表示和 RT-2 一样是离散 token。在 29 个任务上比 RT-2-X（55B）高 16.5 个百分点，而参数只有其七分之一。

它的重要意义是**可复现**：提供完整权重、训练代码、LoRA 微调脚本，一张 A100 就能微调。这让它成为 2024~2025 年学术界最常用的 VLA 基线。

**留下的问题**：自回归 + 单帧输入，推理约 3~5 Hz；动作量化损失精度；在精细操作上不够稳。

### 5.6 π0：流匹配带来的平滑与高频

Physical Intelligence 的 π0 用 PaliGemma（3B）做骨干，另加一个"动作专家"，用 **flow matching** 直接生成 50 步连续动作，控制频率可达 50 Hz。它在约 1 万小时的自有数据 + 开源数据上预训练，覆盖 7~8 种机器人平台，能完成叠衣服、装箱、擦桌子等长时程灵巧任务。

π0 的设计直接影响了后来几乎所有模型，也是 ForceVLA 的基座。2025 年 Physical Intelligence 开源了 `openpi` 代码库和权重。

**留下的问题**：开放世界泛化仍不足（换一个没见过的家就会下降）。

### 5.7 π0.5 与 GR00T N1：往更通用的方向走

- **π0.5**（2025.04）：用"异构数据协同训练"——把多种机器人的数据、网页图文数据、高层子任务标注混在一起训练，并采用"先用离散 token 预测高层子任务，再用 flow matching 生成低层动作"的分层推理。目标是在**从未见过的家庭**里完成整理任务。
- **GR00T N1**（2025.03）：NVIDIA 面向人形机器人的开源基座模型。"双系统"设计：System 2 是 Eagle-2 VLM 负责理解，System 1 是扩散 Transformer 负责高频动作。总参数 2.2B，训练数据混合真机、仿真和合成视频。

> 💡 要点：趋势很清楚——**骨干用现成 VLM、动作用连续生成头、数据越杂越好**。

> 🔗 关联：π0、π0-FAST、π0.5 以及之后的 π*0.6 在 [π 系列模型专题](../Pi/00-README.md) 里各有一章拆解，含 openpi 实战。

### 5.8 该从哪个入手

| 目标 | 建议 |
|---|---|
| 理解原理、快速跑通 | OpenVLA：代码清晰、社区大、显存要求相对低 |
| 追求效果、做真机实验 | π0 / openpi：动作平滑、高频，ForceVLA 等后续工作都基于它 |
| 人形机器人 | GR00T N1 |
| 算力很少（单张消费卡） | Octo 93M，或 OpenVLA + LoRA + 量化 |

## 动手练习

1. 打开 OpenVLA 和 π0 的 GitHub 仓库，分别找到"微调"（fine-tune）的文档入口，记下各自要求的最低显存。

<details><summary>参考做法</summary>

- OpenVLA（`openvla/openvla`）：README 中 LoRA 微调示例标注 1 张 A100 80GB，batch size 可调小到 24GB 卡。
- openpi（`Physical-Intelligence/openpi`）：README 的 Fine-tuning 部分给出 LoRA 约 22.5 GB、全量微调约 70 GB 以上。
具体数字会随版本变化，以仓库当前说明为准。
</details>

2. 把 5.1 的表按"范式 A / 范式 B"重新分组。

<details><summary>参考做法</summary>

范式 A（离散 token 自回归）：RT-1、RT-2、OpenVLA、π0.5 的高层部分。
范式 B（扩散 / flow matching）：Octo、π0、GR00T N1、π0.5 的低层部分。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 以为参数越大越好 | 忽略了数据和架构 | OpenVLA 7B 打败了 RT-2-X 55B；π0 3B 比 OpenVLA 更灵巧 |
| 把 RT-2-X 和 RT-2 混为一谈 | RT-2-X 是在 Open X-Embodiment 上训练的 RT-2 变体 | 读 Open X-Embodiment 论文时注意区分 |
| 直接拿预训练权重上真机 | 预训练只覆盖了特定机器人和相机布局 | 几乎总是需要在自己的机器人上微调（08 章） |
| 以为 GR00T 只能用于人形 | 训练数据里也有单臂数据 | 微调后可用于机械臂，但其设计重点是人形 |

## 小结

- RT-1 证明规模有效；RT-2 证明 VLM 能直接输出动作；Octo / OpenVLA 把这些做成开源。
- π0 用 flow matching 动作专家把控制频率推到 50 Hz，成为新一代基座。
- π0.5、GR00T N1 继续在数据异构性和分层决策上推进。
- 入门选 OpenVLA，真机实验选 π0 系。

## 自测题

1. OpenVLA 在参数量只有 RT-2-X 七分之一的情况下为什么能超过它？

<details><summary>答案</summary>更好的视觉编码器组合（DINOv2 + SigLIP 提供空间细节 + 语义）、更大更干净的机器人数据（97 万条）、以及整体微调而非冻结骨干。参数量不是唯一决定因素。</details>

2. π0 和 Octo 都用了"连续动作头"，最大的不同是什么？

<details><summary>答案</summary>Octo 的骨干是从头训练的小 Transformer，没有语言预训练；π0 的骨干是互联网预训练的 PaliGemma VLM，继承了语义理解能力。另外 π0 用 flow matching，Octo 用标准扩散。</details>

3. 如果你的任务需要机器人理解"把看起来最旧的那本书拿出来"，应该选哪类模型？为什么？

<details><summary>答案</summary>需要有 VLM 骨干的模型（RT-2、OpenVLA、π0 系），因为"看起来最旧"是需要常识和视觉语义的判断，从头训练的 Octo 很难理解。</details>

## 参考资料

- [Open X-Embodiment 项目页](https://robotics-transformer-x.github.io/) —— RT-1-X / RT-2-X 和数据集总览
- [OpenVLA 项目页](https://openvla.github.io/) 与 [代码（GitHub）](https://github.com/openvla/openvla)
- [openpi 代码库（GitHub）](https://github.com/Physical-Intelligence/openpi) —— π0 / π0.5 开源实现
- [Physical Intelligence 博客：π0](https://www.pi.website/blog/pi0) —— 官方通俗介绍
- [GR00T N1 论文（arXiv）](https://arxiv.org/abs/2503.14734) 与 [Isaac-GR00T 代码（GitHub）](https://github.com/NVIDIA/Isaac-GR00T)
- [Octo 项目页](https://octo-models.github.io/)

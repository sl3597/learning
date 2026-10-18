---
title: 视频生成式世界模型
type: tutorial
topic: wam
chapter: 3
level: intermediate
tags: [视频生成, Genie, Cosmos, UniPi, VidMan, 扩散模型, 自回归, 合成数据]
prerequisites: [01-what-is-a-world-model]
estimated_time: 50min
sources:
  - https://arxiv.org/abs/2402.15391
  - https://arxiv.org/abs/2501.03575
  - https://arxiv.org/abs/2302.00111
  - https://arxiv.org/abs/2411.09153
  - https://bdtechtalks.com/2025/08/07/deepmind-genie-3/
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 视频生成式世界模型

> 既然 AI 已经能生成以假乱真的视频，那就让它"按动作生成下一帧"——这条路线的世界模型直接在像素上工作，能看、能交互、也能当数据工厂。

## 学习目标
- 能解释"动作条件视频生成"为什么等于世界模型。
- 能说出 Genie 1/2/3 与 Cosmos 各自的定位和关键特征。
- 能解释 UniPi / VidMan 如何把"视频"变成"策略"。
- 能对比扩散与自回归两条生成路线。
- 能列出像素级世界模型的三大代价。

## 前置知识
- 需要先读：[什么是世界模型](01-what-is-a-world-model.md)
- 建议先读：[Transformer 与多模态](../VLA/Basic/03-transformers-and-multimodal.md)（token、嵌入）

## 核心概念
| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **视频 tokenizer** | 把视频压成离散 token 序列 | 把电影压成一串编号 |
| **动作条件（action-conditioned）** | 生成下一帧时把动作当作输入 | "往左走"后画面随之左移 |
| **隐动作（latent action）** | 从无标签视频中自动学出的"动作编号" | 不告诉你按了什么键，模型自己猜 |
| **扩散模型（diffusion）** | 从噪声一步步去噪生成图像/视频 | 从雾里慢慢看清 |
| **自回归（autoregressive）** | 一个 token 接一个 token 地生成 | 一个字一个字写 |
| **逆动力学模型（IDM）** | 看两帧，反推中间执行了什么动作 | 看前后照片猜你做了什么 |
| **世界基础模型（WFM）** | 预训练好、可微调成各种世界模型的通用大模型 | 世界模型界的"基座模型" |

## 详细讲解
### 3.1 为什么视频生成可以当世界模型

把世界模型的定义 $o_{t+1}=f(o_t,a_t)$ 里的 $o$ 换成视频帧，就是"动作条件视频生成"。好处是：

- 互联网上视频无穷多，可以学到丰富的物理常识和视觉外观；
- 生成的是人能看懂的画面，方便检查和交互；
- 同一个模型稍作改造就能做数据生成、评估、规划。

### 3.2 Genie 系列：可交互环境生成

| 版本 | 时间 | 特征 |
|---|---|---|
| Genie 1 | 2024-02 | 11B 参数；三部件：时空视频 tokenizer、自回归动力学模型、**隐动作模型**；完全不用动作标签，从无标签互联网视频学出可控的"动作"；可由文本、图片、草图生成可玩的 2D 世界 |
| Genie 2 | 2024-12 | 从单张图生成可操控的 3D 世界（DeepMind 博客发布） |
| Genie 3 | 2025-08 | 实时交互，720p、24 fps，一致性可维持数分钟；支持"可提示的世界事件"（如中途改天气、加角色）；仅限小范围研究预览 |

> ❓ 待解决：Genie 3 的记忆/一致性时长，不同报道给出"约一分钟"到"数分钟"两种说法，官方博客未能成功抓取，以官方为准。Genie 2 的具体参数与指标未查到论文，此处仅记录发布形式。

Genie 的关键洞见是**隐动作**：即便视频没有标注"按了哪个键"，模型也能学出一个小的离散动作空间来解释帧间变化。这个思想后来被 DreamGen 的 LAPA 等工作沿用（第 5 章）。

### 3.3 Cosmos：物理 AI 的世界基础模型平台

NVIDIA 2025 年 1 月发布 **Cosmos World Foundation Model Platform**，核心主张是"物理 AI 必须先在数字世界里训练"，因此需要策略的数字孪生和世界的数字孪生。平台包含：视频数据管线、视频 tokenizer、预训练的扩散式与自回归式世界基础模型、以及后训练（post-training）示例；模型以开放权重和宽松许可证发布（GitHub：nvidia-cosmos）。

对机器人学习者的意义：你不必从零训练视频世界模型，可以拿 Cosmos 做**合成数据**或**微调成自己机器人的世界模型**。

### 3.4 UniPi 与 VidMan：视频即策略

- **UniPi（2023，NeurIPS 2023）**："把决策问题变成文本条件视频生成"。给一句任务描述，先生成一段"机器人完成任务"的视频作为计划，再用逆动力学模型从视频帧里抽出动作去执行。文本让它能组合泛化到新目标，统一的图像空间让不同机器人共享训练。
- **VidMan（2024，NeurIPS 2024）**：两阶段。先在 Open X-Embodiment 上预训练视频扩散模型学未来视觉轨迹（学动力学），再用逐层自注意力适配器把它变成逆动力学模型直接预测动作，参数共享。CALVIN 上比 GR-1 基线相对提升约 11.7%，OXE 小规模数据上精度提升超 9%。

```text
UniPi:  文本 ──► 视频生成器 ──► 未来帧序列 ──► IDM ──► 动作序列 ──► 执行
VidMan: 视频扩散预训练(学动力学) ──► 加适配器 ──► 直接输出动作（推理时不必生成完整视频）
```

### 3.5 扩散 vs 自回归

| | 扩散（Cosmos-Diffusion、WAN、UniPi） | 自回归（Genie、Cosmos-AR、WorldVLA） |
|---|---|---|
| 生成方式 | 整段/整帧并行去噪 | 逐 token 顺序生成 |
| 画质 | 通常更好 | 受 tokenizer 限制 |
| 与 LLM/VLA 融合 | 需要额外桥接 | 天然同一套 token 词表 |
| 延迟 | 多步去噪，慢 | 长序列也慢，但可流式 |

### 3.6 代价

1. **算力**：像素级生成极贵。V-JEPA 2 论文报告用 Cosmos 做规划时，每个动作要 4 分钟（第 4 章）。
2. **幻觉**：画面好看不等于物理正确——物体穿模、凭空消失很常见（第 7 章讲怎么评估）。
3. **与动作对齐难**：生成的视频再反推动作，中间会丢信息；这正是第 5 章"统一模型"想解决的。

> ⚠️ 注意：生成视频里的"成功"不代表真机成功。所有用视频世界模型做数据增强的工作，最终都要回到真机成功率来验证。

## 动手练习
1. 判断：一个"文本→视频"模型（如普通的文生视频产品）是不是世界模型？如何改造成世界模型？
<details><summary>参考做法</summary>

不是（无动作条件）。改造：在条件输入里加入动作（或隐动作）token，并在有动作标签的机器人数据上微调，使下一帧依赖动作。
</details>

2. 画出 UniPi 的流水线，并指出"信息可能丢失"的位置。
<details><summary>参考做法</summary>

文本 → 视频计划 → IDM → 动作。丢失位置：IDM 从两帧反推动作时，遮挡、相机抖动、速度信息不足都会导致动作不准；视频本身也可能物理不一致。
</details>

3. 上 Cosmos 的 GitHub 页面，找出它提供的模型类型（扩散 / 自回归）和许可证名称。
<details><summary>参考做法</summary>

仓库 nvidia-cosmos 下有 Predict（预测）、Transfer 等系列，含扩散与自回归两类；许可证为 NVIDIA 开放模型许可证（以仓库页面为准）。
</details>

## 常见错误与排查
| 现象 | 原因 | 解决 |
|---|---|---|
| 用生成视频的"好看程度"评价世界模型 | 混淆视觉质量与物理正确 | 看第 7 章的物理对齐指标与下游成功率 |
| 以为 Genie 能直接控制真机 | Genie 的动作是隐动作，不对应真实电机指令 | 需要 IDM 或额外对齐 |
| 微调 Cosmos 显存爆炸 | 视频模型参数与激活巨大 | 用 LoRA、降分辨率、减帧数，或改用隐空间方法 |
| 生成视频里机器人"瞬移" | 时间一致性不足 | 增加历史帧条件、用动作条件、检查数据帧率 |

## 小结
- 动作条件视频生成 = 像素级世界模型。
- Genie 用隐动作从无标签视频学可交互世界；Cosmos 提供可微调的世界基础模型。
- UniPi/VidMan 把视频生成变成策略：生成未来 → 反推动作。
- 扩散画质好、自回归易与 VLA 融合；像素路线的代价是算力、幻觉与动作对齐。

## 自测题
1. Genie 1 的三个部件是什么？
<details><summary>答案</summary>时空视频 tokenizer、自回归动力学模型、隐动作模型。</details>

2. Cosmos 平台的核心主张是什么？
<details><summary>答案</summary>物理 AI 需要先在数字世界训练，因此需要可微调的世界基础模型（含数据管线、tokenizer、预训练模型与后训练示例）。</details>

3. UniPi 怎样从视频得到动作？
<details><summary>答案</summary>用逆动力学模型（IDM）从生成的连续帧中反推动作。</details>

4. 说出像素级世界模型的三个代价。
<details><summary>答案</summary>算力大、容易幻觉（物理不正确）、与动作对齐困难。</details>

## 参考资料
- [Genie: Generative Interactive Environments（2024）](https://arxiv.org/abs/2402.15391) —— 隐动作模型的出处
- [Cosmos World Foundation Model Platform for Physical AI（2025）](https://arxiv.org/abs/2501.03575) —— 世界基础模型平台
- [Learning Universal Policies via Text-Guided Video Generation（UniPi，2023）](https://arxiv.org/abs/2302.00111) —— 视频即策略
- [VidMan（2024）](https://arxiv.org/abs/2411.09153) —— 视频扩散预训练 → 动作
- [The promise and limitations of DeepMind's Genie 3（2025）](https://bdtechtalks.com/2025/08/07/deepmind-genie-3/) —— Genie 3 的能力与限制评述

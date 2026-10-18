---
title: 隐状态动力学与 Dreamer
type: tutorial
topic: wam
chapter: 2
level: intermediate
tags: [Dreamer, RSSM, PlaNet, 隐状态, 基于模型的强化学习, 想象训练]
prerequisites: [01-what-is-a-world-model]
estimated_time: 60min
sources:
  - https://arxiv.org/abs/1811.04551
  - https://arxiv.org/abs/1912.01603
  - https://arxiv.org/abs/2010.02193
  - https://arxiv.org/abs/2301.04104
  - https://danijar.com/project/dreamerv3/
  - https://github.com/danijar/dreamerv3
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 隐状态动力学与 Dreamer

> 与其在像素上预测未来（又贵又难），不如先把画面压成几百个数字，在这些数字上预测。Dreamer 系列把这条路走到了"150 多个任务一套参数通吃"。

## 学习目标
- 能画出隐状态世界模型的四个部件：编码器、转移模型、解码器、奖励头。
- 能解释 RSSM 里"确定性 + 随机"两条隐状态的分工。
- 能说清"在想象中训练策略"的流程。
- 能列出 Dreamer v1→v3 各自解决了什么问题。
- 掌握基于模型的强化学习（MBRL）的最小必要知识。

## 前置知识
- 需要先读：[什么是世界模型](01-what-is-a-world-model.md)
- 建议了解：[深度学习最小必要知识](../VLA/Basic/02-deep-learning-essentials.md) 中的"损失与梯度下降"

## 核心概念
| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **强化学习（RL）** | 通过试错和奖励学会做决定 | 训练小狗：做对给零食 |
| **基于模型的 RL（MBRL）** | 先学一个环境模型，再用模型帮忙学策略 | 先画地图再找路 |
| **编码器 / 解码器** | 把图像压成隐状态 / 把隐状态还原成图像 | 压缩 / 解压 |
| **转移模型** | 预测隐状态在动作下如何变化 | 物理规律 |
| **RSSM** | Recurrent State-Space Model，Dreamer 用的转移模型结构 | 带记忆的物理规律 |
| **想象（imagination）** | 只用模型连续预测，生成"假经验" | 闭眼演练 |
| **Actor / Critic** | 策略网络 / 价值网络 | 决策者 / 评估员 |

## 详细讲解
### 2.1 四个部件

```text
图像 o_t ──► 编码器 ──► 隐状态 z_t ──┬──► 解码器 ──► 重建图像 ô_t   （训练用，保证 z 里有信息）
                                      ├──► 奖励头  ──► 预测奖励 r̂_t
                                      └──► 转移模型 f(z_t, a_t) ──► ẑ_{t+1}
```

- **编码器**：图像 → 隐状态 $z_t$（几百维向量）。
- **转移模型**：$(z_t, a_t) \rightarrow z_{t+1}$，这是"世界模型"的核心。
- **解码器**：$z_t \rightarrow$ 图像，用重建损失逼编码器把有用信息压进 $z$。
- **奖励头**：$z_t \rightarrow$ 奖励，有了它才能在想象里评估"这步走得好不好"。

训练目标大致是"重建图像 + 预测奖励 + 让预测的下一隐状态接近真实编码出的下一隐状态"。

### 2.2 RSSM：确定性 + 随机两条线

PlaNet（2018）提出的 **RSSM** 把隐状态拆成两部分：

- **确定性部分 $h_t$**：用 GRU 这类循环网络，负责"记忆"（上一秒球往哪飞）。
- **随机部分 $s_t$**：从一个分布里采样，负责"不确定性"（球可能弹向左也可能弹向右）。

$$
h_t = \mathrm{GRU}(h_{t-1}, s_{t-1}, a_{t-1}),\qquad s_t \sim p(s_t \mid h_t)
$$

> 💡 要点：没有随机部分，模型会把所有不确定情况"平均"成一团模糊；没有确定性部分，模型记不住多步以前的事。两者缺一不可。

### 2.3 在想象中训练策略

Dreamer（2019）的流程：

1. 用真实交互数据训练世界模型（2.1 节）。
2. 从真实隐状态出发，用转移模型**想象**出长度 $H$（如 15 步）的轨迹，不碰真实环境。
3. 在想象轨迹上训练 **Actor**（输出动作）和 **Critic**（估计价值）。因为整条想象轨迹是可微的，梯度可以从未来的价值一路反传到动作。
4. 用新策略去真实环境收集少量数据，回到第 1 步。

效果：Dreamer 在 20 个视觉控制任务上，数据效率、计算时间和最终性能都超过了当时的方法。

### 2.4 Dreamer 三代演进

| 版本 | 年份 | 关键改动 | 代表结果 |
|---|---|---|---|
| PlaNet | 2018 | RSSM；在隐空间用 CEM 规划，不学策略 | 从像素学连续控制，用的回合数远少于无模型方法 |
| Dreamer v1 | 2019 | 用 Actor-Critic 代替规划，梯度穿过想象轨迹 | 20 个视觉控制任务全面领先 |
| Dreamer v2 | 2020（ICLR 2021） | 隐变量改为**离散**表示 | 第一个靠世界模型在 55 个 Atari 游戏达到人类水平；同算力下超过 IQN、Rainbow |
| Dreamer v3 | 2023（Nature 2025） | 归一化、平衡、变换等稳定技巧，一套超参通吃 | 150+ 任务单一配置；第一个无人类数据、无课程从零在 Minecraft 挖到钻石 |

> 🔍 深入：v2 为什么改离散？连续高斯隐变量容易"过平滑"，离散（每个维度从 32 类里选 1 个）更能表达"门开 / 门关"这种非此即彼的状态。v3 的核心贡献不是新结构，而是让**同一套超参数**在差异巨大的任务上都稳定——这对工程落地极其重要。

### 2.5 MBRL 最小知识

- 无模型 RL（PPO、SAC）：直接从交互学策略，简单但费数据。
- 基于模型 RL：多学一个模型，数据省、可规划，但**模型有误差**，想象太长会"越想越偏"（误差累积，第 6 章详谈）。
- Dreamer 用较短的想象长度 + 学习价值函数来缓解这个问题。

> ⚠️ 注意：Dreamer 系列主要在仿真游戏/控制任务上验证，真机机器人直接用 Dreamer 的工作（如 DayDreamer）存在，但不是本章重点，可作为延伸阅读。

## 动手练习
1. 画出 RSSM 一步转移的数据流，标出 $h_t$、$s_t$、$a_t$ 三个量。
<details><summary>参考做法</summary>

```text
(h_{t-1}, s_{t-1}, a_{t-1}) ──GRU──► h_t ──► 先验 p(s_t|h_t) ──采样──► s_t
                                          ▲
                           编码器(o_t) ───┘ 后验 q(s_t|h_t,o_t)（训练时用）
```
训练时让先验逼近后验（KL 项），推理/想象时只用先验。
</details>

2. 说明如果想象长度 $H$ 从 15 改成 500 会发生什么。
<details><summary>参考做法</summary>

模型误差逐步累积，几百步后想象的隐状态可能与任何真实状态都不对应，策略会学到"钻模型漏洞"的行为。所以 Dreamer 用短想象 + Critic 估计长期价值。
</details>

3. 阅读 DreamerV3 GitHub README，找出它声称"固定超参数"的原话，并写下一个它支持的环境名。
<details><summary>参考做法</summary>

README 描述它是 "a scalable and general reinforcement learning algorithm that masters a wide range of applications with fixed hyperparameters"；支持的环境包括 DMC（DeepMind Control）、Atari、Minecraft 等。
</details>

## 常见错误与排查
| 现象 | 原因 | 解决 |
|---|---|---|
| 以为解码器是为了"生成好看的视频" | 误解其作用 | 解码器只是训练时的约束，推理时可以不用 |
| 分不清"规划"和"学策略" | PlaNet 用规划，Dreamer 用策略 | 规划 = 每步在线搜索动作；策略 = 训练好的网络直接出动作 |
| 想象轨迹越长越好 | 忽视误差累积 | 控制想象长度，依赖 Critic |
| 直接把 Dreamer 用在真机 | 真机交互慢、噪声大 | 先在仿真验证，再看 DayDreamer 等真机工作 |

## 小结
- 隐状态世界模型 = 编码器 + 转移模型（RSSM）+ 解码器 + 奖励头。
- RSSM 用确定性 $h_t$ 记忆，用随机 $s_t$ 表达不确定性。
- Dreamer 在想象轨迹上训练 Actor-Critic，梯度穿过模型。
- v2 离散隐变量 → Atari 人类水平；v3 稳定技巧 → 150+ 任务一套参数、Minecraft 钻石。

## 自测题
1. RSSM 的两条隐状态各负责什么？
<details><summary>答案</summary>确定性 $h_t$ 负责记忆（历史信息），随机 $s_t$ 负责表达不确定性。</details>

2. Dreamer 相比 PlaNet 最大的改动是什么？
<details><summary>答案</summary>用在想象中训练的 Actor-Critic 取代了每步在线规划（CEM）。</details>

3. DreamerV3 被称为"通用"的依据是什么？
<details><summary>答案</summary>同一套配置/超参数在 150 多个不同领域任务上超过了各领域的专用方法。</details>

4. 为什么 MBRL 要担心"误差累积"？
<details><summary>答案</summary>每一步预测都有误差，多步连续预测时误差相乘放大，想象轨迹会偏离真实。</details>

## 参考资料
- [PlaNet：Learning Latent Dynamics for Planning from Pixels（2018）](https://arxiv.org/abs/1811.04551) —— RSSM 的出处
- [Dreamer：Dream to Control（2019）](https://arxiv.org/abs/1912.01603) —— 在想象中训练 Actor-Critic
- [DreamerV2：Mastering Atari with Discrete World Models（2020）](https://arxiv.org/abs/2010.02193) —— 离散隐变量
- [DreamerV3：Mastering Diverse Domains through World Models（2023，Nature 2025 版题为 Mastering diverse control tasks through world models）](https://arxiv.org/abs/2301.04104) —— 通用性
- [DreamerV3 项目页](https://danijar.com/project/dreamerv3/) 与 [代码](https://github.com/danijar/dreamerv3) —— 第 8 章要用

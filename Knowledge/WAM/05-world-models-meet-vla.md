---
title: 世界模型 × VLA：融合范式
type: tutorial
topic: wam
chapter: 5
level: intermediate
tags: [WorldVLA, UWM, UVA, FLARE, DreamGen, 统一模型, 神经轨迹, VLA]
prerequisites: [01-what-is-a-world-model, 03-video-generation-world-models, 04-jepa-and-latent-prediction]
estimated_time: 60min
sources:
  - https://arxiv.org/abs/2506.21539
  - https://arxiv.org/html/2506.21539v1
  - https://arxiv.org/abs/2504.02792
  - https://arxiv.org/abs/2503.00200
  - https://arxiv.org/abs/2505.15659
  - https://arxiv.org/abs/2505.12705
  - https://arxiv.org/html/2505.12705v2
  - https://arxiv.org/abs/2606.00113
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 世界模型 × VLA：融合范式

> 2025 年起，"预测未来"和"输出动作"开始被塞进同一个网络。本章把 WorldVLA、UWM、UVA、FLARE、DreamGen 放在一张表里看清楚：它们分别让世界模型当策略、当数据引擎、还是当辅助目标。

## 学习目标
- 能说出世界模型进入 VLA 的三种用法：作为策略、作为数据引擎、作为评估/模拟器。
- 能描述 WorldVLA（自回归统一）与 UWM/UVA（扩散统一）的结构差异。
- 能解释 FLARE 的"隐式世界建模"为什么改动最小。
- 能复述 DreamGen 的四步流水线和核心数字。
- 能提出一个"力条件世界模型"的设想并说明其与 ForceVLA 的关系。

## 前置知识
- 需要先读：[视频生成式世界模型](03-video-generation-world-models.md)、[JEPA 与表征预测](04-jepa-and-latent-prediction.md)
- 需要先读：[VLA 是什么](../VLA/Basic/04-vla-concept.md)、[动作表示](../VLA/Basic/07-action-representation.md)

## 核心概念
| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **统一模型（unified model）** | 一个网络同时做"出动作"和"预测未来帧" | 一个人既当司机又当导航 |
| **动作 token** | 把连续动作离散成词表里的编号 | 把方向盘角度编成 256 档 |
| **扩散时间步（timestep）** | 扩散模型里"当前去噪到了第几步"的标记 | 雾散到几成 |
| **神经轨迹（neural trajectory）** | 世界模型生成的"假视频 + 反推动作"数据 | AI 做的梦被当作练习题 |
| **逆动力学模型（IDM）** | 看前后帧推断动作 | 看结果猜过程 |
| **隐式世界建模** | 不显式生成未来，只要求内部特征能预测未来表征 | 心里有数但不说出来 |

## 详细讲解
### 5.1 三种用法总表

| 用法 | 做法 | 代表 | 代价 |
|---|---|---|---|
| **作为策略 / 策略的一部分** | 预测未来与输出动作共享网络，互相促进 | WorldVLA、UWM、UVA、FLARE、VidMan | 训练更复杂 |
| **作为数据引擎** | 生成新视频 → 反推动作 → 扩充训练集 | DreamGen | 生成数据可能物理错误 |
| **作为评估 / 模拟器** | 用世界模型预演候选动作并打分、或替代仿真器 | V-JEPA 2-AC 规划、Cosmos 评估 | 推理慢、幻觉 |

2026 年综述把第一类叫"集成的预测-动作模型"，把规划类叫"显式预测规划器"，并把数据生成、候选过滤、学习环境、结果验证等列为"基础设施角色"。

### 5.2 WorldVLA：自回归统一（阿里达摩院 / 湖畔实验室 / 浙大，2025-06）

- **骨干**：从 Chameleon（多模态自回归 LLM）初始化。
- **三个 tokenizer 共享一个词表**：图像 VQ-GAN（压缩比 16，码本 8192，256×256 图 → 256 token）；文本 BPE（词表 65536，内含 8192 图像 token 与 256 动作 token）；动作每维离散成 256 档，一个动作 = 7 token（3 位移 + 3 旋转 + 1 夹爪）。
- **两种任务交替训练**：动作模型（图像+文本 → 动作）与世界模型（图像+动作 → 下一帧图像）。
- **关键发现**：自回归逐个生成动作块时，前面动作的误差会传到后面，抓取成功率下降 10%~50%。解法是**动作注意力掩码**：当前动作只看图像和文本，不看之前生成的动作，从而可并行生成动作块，带来 4%~23% 提升。
- **结果**：LIBERO 平均成功率 WorldVLA（512×512）81.8%，256×256 为 79.1%，OpenVLA 为 76.5%；消融中加入世界模型任务后从 62.8% 升到 67.2%。

> ❓ 待解决：论文正文称 FVD 降低 10%，但表 4 中 10 帧为 250.0 vs 255.1、50 帧为 718.6 vs 674.1（约降 6%），数字不完全一致，需以最新版本为准。

### 5.3 UWM 与 UVA：扩散统一

- **UWM（Unified World Models，2025-04）**：把动作扩散和视频扩散放进同一个 Transformer，**两种模态各有独立的扩散时间步**。通过设置时间步，同一模型可切换为策略、前向动力学、逆动力学或视频生成器；还能用无动作标签视频训练（把动作时间步设为"全噪声"）。实验表明比标准模仿学习更泛化、更鲁棒。
- **UVA（Unified Video Action Model，2025-02）**：学一个联合的视频-动作隐表示，再用两个轻量扩散头分别解码视频与动作；推理时可以**跳过视频生成只出动作**，所以速度快；通过掩码训练同时支持策略、正/逆动力学、视频预测。

```text
WorldVLA（自回归）:  [图像token][文本token][动作token] ──► 同一 LLM ──► 下一帧token / 动作token
UWM（扩散）:        [图像潜变量, t_img][动作潜变量, t_act] ──► 同一 Transformer ──► 去噪两者
UVA（扩散）:        联合隐表示 ──► 视频扩散头 / 动作扩散头（推理可只走动作头）
```

### 5.4 FLARE：隐式世界建模（NVIDIA 等，2025-05）

FLARE（Future LAtent REpresentation alignment）不生成未来帧，只在 VLA 的扩散 Transformer 里**多加几个 token**，要求它们的特征与未来观测的隐表征对齐。改动极小，却在两个多任务模仿基准（单臂与人形桌面操作）上最高提升 26%，并能与无动作标签的人类第一视角视频共训，只用 1 条机器人演示就泛化到新几何物体。

> 💡 要点：FLARE 说明"世界模型"不一定是独立模块——让策略"心里有未来"（辅助预测目标）就已经有收益。

### 5.5 DreamGen：世界模型当数据引擎（NVIDIA GEAR，2025-05）

四步流水线：

1. **微调视频世界模型**：用遥操作数据 LoRA 微调（主力底座 WAN 2.1；基准对比含 Hunyuan、CogVideoX、Cosmos）。
2. **生成（rollout）**：从初始帧 + 语言指令生成任务视频。
3. **伪动作标注**：IDM（SigLIP-2 编码器 + 扩散 Transformer，流匹配训练）或隐动作模型 LAPA。
4. **用神经轨迹训练策略**。

核心数字（GR00T N1 策略，GR1 人形）：只用**一个环境里一个抓放任务**的遥操作数据，学会 **22 种新行为**；已见环境的新行为成功率 11.2% → 43.2%；完全未见环境 0.0% → 28.5%。真机：GR1 四任务 37% → 46.4%，Franka 三任务 23% → 37%，SO-100 两任务 21% → 45.5%。RoboCasa 仿真中神经轨迹扩到 333 倍演示量时成功率呈对数线性增长。还提出 **DreamGen Bench**（指令遵循 IF + 物理对齐 PA 两项指标）并发现它与下游成功率正相关。

### 5.6 对 ForceVLA 的启发：力条件世界模型

[ForceVLA](../VLA/ForceVLA/03-method.md) 把六维力/力矩作为输入改善接触丰富任务，但它仍是"只出动作"的模型。一个自然的延伸：

- **预测力**：世界模型输入（图像、力、动作），输出下一步的图像表征**和力/力矩**；这样"插头是否已经插到底"这种看不见的状态就能被预演。
- **用处**：规划时淘汰会产生过大接触力的动作；用生成的"力轨迹"扩充稀缺的接触数据。
- **难点**：2026 综述把"接触建模"列为头号开放挑战——视频世界模型学不到力。

> 🔗 关联：这正对应 [ForceVLA 批判与开放问题](../VLA/ForceVLA/07-critique-and-open-questions.md) 中的扩展实验方向。

## 动手练习
1. 把 WorldVLA、UWM、UVA、FLARE、DreamGen 填进 5.1 的三类用法表，并说明有无跨类的。
<details><summary>参考做法</summary>

策略类：WorldVLA、UWM、UVA、FLARE；数据引擎：DreamGen；评估/模拟器：UWM 可切换为前向动力学做评估，属于跨类。
</details>

2. 解释 WorldVLA 的动作注意力掩码为什么能"并行生成动作块"。
<details><summary>参考做法</summary>

当前动作 token 不依赖之前的动作 token，各动作之间无先后依赖，因此可以同时生成而不是逐个等待。
</details>

3. 设计一个最小的"力条件世界模型"实验：输入、输出、数据、评估指标各一句话。
<details><summary>参考做法</summary>

输入：当前图像表征 + 当前 6 维力 + 动作；输出：下一步图像表征 + 下一步 6 维力；数据：ForceVLA-Data（含力信号）；指标：力预测均方误差 + 用于规划后的插拔任务成功率。
</details>

## 常见错误与排查
| 现象 | 原因 | 解决 |
|---|---|---|
| 以为统一模型推理时必须生成视频 | 不了解 UVA/FLARE 的设计 | 推理可只走动作头或仅用辅助目标 |
| 用神经轨迹训练后真机变差 | 生成视频物理错误、IDM 动作不准 | 用 DreamGen Bench 式指标过滤，保留部分真实数据 |
| 自回归动作块误差累积 | 前后动作串行依赖 | 采用动作注意力掩码并行生成 |
| 认为力可以从视频世界模型"顺便"学到 | 视频里看不见力 | 需显式加入力传感输入与力预测头 |

## 小结
- 世界模型进入 VLA 的三种角色：策略成分、数据引擎、评估/模拟器。
- WorldVLA 用一个自回归 LLM 统一图像/文本/动作 token；UWM、UVA 用扩散统一视频与动作。
- FLARE 只加几个 token 做隐式未来对齐，最高 +26%。
- DreamGen 用视频世界模型造数据：一个任务 → 22 种新行为，未见环境 0% → 28.5%。
- 力条件世界模型是连接本主题与 ForceVLA 的开放方向。

## 自测题
1. WorldVLA 的一个动作由多少个 token 组成？分别是什么？
<details><summary>答案</summary>7 个：3 个相对位置、3 个相对角度、1 个夹爪状态，每维 256 档。</details>

2. UWM 靠什么机制让同一模型可切换为策略 / 动力学 / 视频生成器？
<details><summary>答案</summary>动作与视频各有独立的扩散时间步，通过设置不同时间步组合切换功能。</details>

3. DreamGen 第三步用什么给生成视频打上动作？
<details><summary>答案</summary>逆动力学模型（IDM）或隐动作模型 LAPA。</details>

4. FLARE 与 WorldVLA 在"是否生成未来帧"上的区别？
<details><summary>答案</summary>WorldVLA 显式生成未来图像 token；FLARE 不生成，只让内部特征与未来表征对齐。</details>

## 参考资料
- [WorldVLA: Towards Autoregressive Action World Model（2025）](https://arxiv.org/abs/2506.21539) —— 自回归统一
- [Unified World Models（UWM，2025）](https://arxiv.org/abs/2504.02792) —— 独立时间步的扩散统一
- [Unified Video Action Model（UVA，2025）](https://arxiv.org/abs/2503.00200) —— 解耦扩散头、快速推理
- [FLARE: Robot Learning with Implicit World Modeling（2025）](https://arxiv.org/abs/2505.15659) —— 隐式未来对齐
- [DreamGen（2025）](https://arxiv.org/abs/2505.12705) 与 [GR00T-Dreams 代码](https://github.com/NVIDIA/GR00T-Dreams) —— 神经轨迹数据引擎
- [World Models for Robotic Manipulation: A Survey（2026）](https://arxiv.org/abs/2606.00113) —— 角色分类与开放挑战

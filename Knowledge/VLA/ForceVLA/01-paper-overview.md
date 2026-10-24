---
title: ForceVLA 论文总览
type: paper-note
topic: forcevla
chapter: 1
level: intermediate
tags: [ForceVLA, FVLMoE, π0, 力感知, MoE, 接触丰富操作, NeurIPS2025]
prerequisites: [../Basic/05-representative-models]
estimated_time: 20min
sources:
  - https://arxiv.org/html/2505.22159v3
  - https://arxiv.org/abs/2505.22159
  - https://sites.google.com/view/forcevla2025
  - https://github.com/ft-robotic/ForceVLA
related:
  - Knowledge/VLA/Basic/04-vla-concept.md
  - Knowledge/VLA/Basic/05-representative-models.md
  - Knowledge/VLA/Basic/10-force-and-tactile-sensing.md
  - Knowledge/VLA/Basic/03-transformers-and-multimodal.md
  - Knowledge/VLA/Basic/08-training-and-finetuning.md
  - Knowledge/WAM/05-world-models-meet-vla.md
year: 2025
venue: NeurIPS 2025
status: draft
created: 2026-10-17
updated: 2026-10-24
---

# ForceVLA：用力感知混合专家增强 VLA 模型以完成接触丰富操作

## 论文信息

| 项目 | 内容 |
|---|---|
| 标题 | ForceVLA: Enhancing VLA Models with a Force-aware MoE for Contact-rich Manipulation |
| 作者 / 机构 | Jiawen Yu、Hairuo Liu、Jieji Ren、Panpan Cai、Cewu Lu（上海交通大学）；Qiaojun Yu（上海人工智能实验室）；Ce Hao（新加坡国立大学）；Haitong Ding（上海大学）；Guangyu Huang（西安交通大学）；Guofan Huang、Yan Song、Wenqiang Zhang（复旦大学）；部分作者兼属上海创智学院、Noematrix Intelligence |
| 发表 | NeurIPS 2025（arXiv 2505.22159，v3） |
| 链接 | [arXiv](https://arxiv.org/abs/2505.22159) · [项目页](https://sites.google.com/view/forcevla2025) · [代码 ft-robotic/ForceVLA（GitHub，Apache-2.0）](https://github.com/ft-robotic/ForceVLA) · 数据 HuggingFace `qiaojunyu/ForceVLA-real-data` |
| 关键词 | VLA、力/力矩感知、混合专家（MoE）、晚期融合、流匹配动作头、接触丰富操作 |

## 一句话总结

把六轴力当一等模态，在 π0 的 VLM 后用力感知 MoE 晚期融合，接触任务平均成功率 37.3%→60.5%。

## 背景与动机

- **之前的方法有什么问题？** 主流 VLA（RT-2、OpenVLA、π0 等）只吃图像和语言。遇到插头对孔、擦板、削皮这类任务，视觉常常被遮挡或分辨不出毫米级偏差，模型只能"盲目重复同一个动作"或"用力过猛"。
- **直接把力拼到状态里为什么不够？** 论文的基线 "π0-base w/ F" 就是把力矢量简单拼接到本体状态输入里，平均成功率只比不用力高 2.9 个百分点（37.3% → 40.2%），说明**融合位置和方式**比"有没有力"更关键。
- **为什么重要？** 工业装配、家务服务里绝大多数任务都要接触物体并控制力；没有力感知的 VLA 很难走出实验室。

## 方法

### 整体框架

```text
图像(第三人称 + 腕部) + 语言指令 ──► VLM 骨干 (PaliGemma / SigLIP) ──► E_VL
                                                                       │
六轴外力/力矩 f_t ∈ R^6 ──► 线性投影 φ_F ──► 力 token E_F ─────────────┤
                                                                       ▼
                                             FVLMoE: Transformer 块 → 稀疏 MoE(4 专家, top-1) → 2048→1024 投影
                                                                       │
                                             取末尾 H_action 个 token，逐元素加到 π0 的后缀特征（状态 + 带噪动作）
                                                                       ▼
                                             流匹配动作专家 ──► 动作块（目标 TCP 位姿 + 夹爪宽度）
```

### 关键模块

| 模块 | 输入 | 处理 | 输出 | 为什么这样设计 |
|---|---|---|---|---|
| 力编码 φ_F | 世界系下 TCP 估计外力 f_t ∈ R^6 | 一个线性层 | 1 个 2048 维力 token | 力是低维连续量，线性投影足够，且不破坏 VLM |
| FVLMoE | [E_VL ; E_F] 拼接序列 | 8 头 Transformer 编码块 → 残差稀疏 MoE（4 个 MLP 专家，学习式路由，top-k=1）→ 线性 2048→1024 | 与动作专家维度匹配的融合特征 | 不同接触阶段（对准 / 插入 / 滑动）需要不同"专家"；路由可按阶段切换 |
| 注入动作头 | FVLMoE 输出的末尾 H_action 个 token | 与 π0 后缀特征逐元素相加 | 条件化的流匹配去噪 | **晚期融合**：在 VLM 之后注入，保留预训练视觉-语言表示 |

训练：基于 π0 框架微调，每任务约 50 条专家演示；Adam（β1=0.9，β2=0.95），峰值学习率 2.5e-5 衰减到 2.5e-6，共 30k 步；bfloat16，梯度裁剪 1.0；多任务用 2 张 RTX 4090 约 12 小时，单任务 1 张卡 10k 步约 9 小时。

详见 [03 方法详解](03-method.md)。

## 实验

- **数据集 / 任务**：自建 ForceVLA-Data，5 个接触丰富任务（按压泵瓶、插插头、插 U 盘、擦白板、削黄瓜），244 条轨迹、约 14 万同步时间步；Flexiv Rizon 7 轴臂 + 大寰自适应夹爪，RealSense D435（第三人称）+ D415（腕部），Quest 3 VR 遥操作。详见 [04 数据集](04-dataset-forcevla-data.md)。
- **基线**：π0-base / π0-fast 各自"不用力（w/o F）"和"力拼接到状态（w/ F）"四种。

主要结果（单任务设置平均成功率，论文 §5.1）：

| 模型 | 平均成功率 |
|---|---|
| π0-fast w/ F | 14.2% |
| π0-fast w/o F | 31.0% |
| π0-base w/o F | 37.3% |
| π0-base w/ F | 40.2% |
| **ForceVLA** | **60.5%** |

论文宣称的 "+23.2%" 是 60.5 − 37.3 的**百分点差**。消融（表 3）：π0 基线 45% → VLM 前线性注入 55% → VLM 前 MoE 0% → VLM 后拼接 60% → ForceVLA 80%，说明**晚期融合 + 专家路由**都有贡献。泛化（表 2）：物体变化 80%、视觉遮挡 90%，平均 63.78%，高于所有基线。详见 [05 实验与结果](05-experiments-and-results.md)。

## 优点与不足

| 优点 | 不足 / 疑问 |
|---|---|
| 把力当一等模态，模块化、可插拔，几乎不改 VLM | 用的是**估计**外力（不是直接 F/T 传感器读数），精度有限（作者自认） |
| 消融系统地比较了注入位置，结论清晰 | 单任务逐任务数字只在图 5 中，文本不可读；消融基线 45% 与主表 37.3% 不一致，任务集未说明 |
| 公开代码（基于 openpi）和数据（HuggingFace） | 不稳定插座场景 20%，低于 π0-fast w/ F 的 30%，论文未讨论 |
| 路由分析显示专家按接触阶段分工 | 专家 0 吃掉近一半 token，MoE 是否真的"分工"仍存疑；未提负载均衡损失 |

## 与知识库的关联

- 用到的基础知识：[VLA 概念](../Basic/04-vla-concept.md)、[代表性模型 π0](../Basic/05-representative-models.md)、[力与触觉感知](../Basic/10-force-and-tactile-sensing.md)、[Transformer 与多模态](../Basic/03-transformers-and-multimodal.md)。
- 可延伸的主题：[力觉与触觉感知](../Basic/10-force-and-tactile-sensing.md)（换平台复现时的力信号对齐）、[世界模型 × VLA](../../WAM/05-world-models-meet-vla.md)（力条件世界模型）、[训练与微调](../Basic/08-training-and-finetuning.md)。

## 复现清单

- [ ] 环境：Ubuntu 22.04、Python 3.11、CUDA 12.8、按仓库顺序安装 lerobot / openpi / dlimp / openpi-client / flaxformer
- [ ] 数据：从 HuggingFace 下载 `qiaojunyu/ForceVLA-real-data`，设置 `HF_LEROBOT_HOME`
- [ ] 关键超参数：`forcevla_lora` 配置，batch 32，30k 步，lr 2.5e-5→2.5e-6，bf16，grad clip 1.0
- [ ] 硬件：LoRA 微调 ≥22.5 GB 显存，全量微调 ≥70 GB
- [ ] 预期指标：多任务设置平均 67.5%（表 5），单任务平均 60.5%

详见 [06 复现指南](06-reproduction-guide.md)。

## 我的问题与想法

- 力 token 只有 1 个且只用线性层，为什么不用时间窗口（最近 N 步力）？是否会丢掉接触瞬态信息？
- 路由 top-1 且无负载均衡，训练会不会塌缩到单专家？附录 C 的"专家 0 占近一半"是否就是塌缩的迹象？
- "估计外力"是通过关节力矩反推的吗？换到其他没有内置 F/T 传感器、同样靠关节力矩估计外力的机械臂是否天然适配？
- 若把力换成触觉图像（GelSight），FVLMoE 还能用吗？

> ❓ 待解决：以上问题在 [07 批判与开放问题](07-critique-and-open-questions.md) 中展开并供 Agent 追踪。

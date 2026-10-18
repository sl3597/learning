---
title: 动手路线图：从零到复现
type: tutorial
topic: wam
chapter: 8
level: advanced
tags: [复现, DreamerV3, V-JEPA 2, WorldVLA, LIBERO, 显存, 实验路线]
prerequisites: [02-latent-dynamics-and-dreamer, 04-jepa-and-latent-prediction, 05-world-models-meet-vla, 07-data-metrics-and-evaluation]
estimated_time: 90min+
sources:
  - https://github.com/danijar/dreamerv3
  - https://arxiv.org/abs/2506.09985
  - https://arxiv.org/html/2506.21539v1
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 动手路线图：从零到复现

> 三个台阶：先用 DreamerV3 在小仿真任务上体会"在想象中训练"，再用 V-JEPA 2 跑一次表征预测与规划，最后在 LIBERO 上微调 WorldVLA 把世界模型和 VLA 合在一起。每一步都给出仓库、硬件估算、预期产出和检查点。

## 学习目标
- 能独立搭好三个项目的运行环境并跑通官方示例。
- 能为每个实验写出"预期产出"和"通过标准"，不再盲跑。
- 能估算显存需求并据此选择分辨率、批大小、LoRA。
- 能把实验记录按知识库标准沉淀成笔记。

## 前置知识
- 需要先读：本主题第 2、4、5、7 章
- 需要先读：[训练与微调](../VLA/Basic/08-training-and-finetuning.md)、[SSH 与远程工作](../LinuxCommand/17-ssh-and-remote.md)、[软件包管理](../LinuxCommand/11-package-management.md)

## 核心概念
| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **DMC** | DeepMind Control Suite，一组连续控制仿真任务 | 机器人学的"体操馆" |
| **LIBERO** | VLA 常用的桌面操作仿真基准 | 标准化考试 |
| **检查点（checkpoint）** | 训练过程中保存的模型权重 | 游戏存档 |
| **LoRA** | 只训练少量附加参数的微调方法 | 不改原书，只贴便利贴 |
| **显存估算** | 参数 + 梯度 + 优化器状态 + 激活 | 装车前先算体积 |

## 详细讲解
### 8.1 总览

| 台阶 | 项目 | 目的 | 硬件（估算） | 时间 |
|---|---|---|---|---|
| ① | DreamerV3 + DMC | 体会隐状态世界模型与想象训练 | 1 块 ≥8 GB 显存 GPU（小模型也可 CPU 慢跑） | 半天搭环境 + 数小时训练 |
| ② | V-JEPA 2 推理与规划 | 体会表征预测与 CEM 规划 | ≥16 GB 显存（ViT-g 推理） | 半天 |
| ③ | WorldVLA + LIBERO | 把世界模型与 VLA 融合并评估 | ≥24 GB 显存（LoRA/小分辨率）；全量训练需多卡 | 1~3 天 |

> ⚠️ 注意：所有显存数字都是**估算**，以各仓库 README 为准；先用最小配置跑通，再放大。

### 8.2 台阶 ①：DreamerV3 跑 DMC

1. 环境：
   ```bash
   git clone https://github.com/danijar/dreamerv3
   cd dreamerv3
   # 按 README 安装依赖（JAX 版本需与 CUDA 匹配）
   ```
2. 选一个最小任务（如 DMC 的 cartpole 或 walker），用仓库提供的配置启动训练，把日志目录放在 `~/logdir/`。
3. **预期产出**：TensorBoard 中回报曲线上升；日志里能看到"想象"相关的损失项（模型损失、actor/critic 损失）。
4. **检查点**：
   - 能解释配置里的想象视野参数是什么（对应第 2 章 2.3 节）。
   - 把世界模型的重建视频导出来看一眼，对照第 7 章理解"重建≠规划质量"。
5. 常见坑：JAX 与 CUDA 版本不匹配；无显示的服务器需要无头渲染（`MUJOCO_GL=egl`）。

### 8.3 台阶 ②：V-JEPA 2 推理与规划

1. 从论文/官方仓库获取 V-JEPA 2 与 V-JEPA 2-AC 权重（以 Meta 发布页面为准）。
2. 先做**表征提取**：对一段 DROID 视频片段提取特征，验证相邻帧特征距离小、不同场景距离大。
3. 再做**动作条件预测**：给同一帧配两个不同动作，比较预测表征的差异（第 7 章的"动作响应检验"）。
4. 最后做**规划**：实现第 6 章的 CEM（800 样本、10 轮、视野 1），用一张目标图像让模型输出动作；没有真机就在仿真或离线视频上评估"预测到目标的距离是否下降"。
5. **预期产出**：一张"规划轮数 vs 目标距离"的曲线，单步规划耗时记录（论文为 16 秒/动作，你的硬件会不同）。

> ❓ 待解决：V-JEPA 2-AC 权重与规划示例代码的具体发布位置与许可证，需到 Meta 官方页面确认；本章不假设其细节。

### 8.4 台阶 ③：WorldVLA 在 LIBERO 上微调

1. 环境：安装 LIBERO 仿真与 WorldVLA 仓库（以论文页面给出的代码链接为准），准备 Chameleon 初始化权重。
2. 数据：LIBERO-Spatial/Object/Goal/Long；按论文做法去掉失败轨迹与空动作，90% 训练 / 10% 验证。
3. 配置（论文默认）：动作块 K=10（Long）或 5（其他）、历史图像 M=2、世界模型轮数 N=1、损失权重 α=0.04，分辨率先用 256×256。
4. **对照实验**（最有学习价值）：
   - A：只训动作模型；
   - B：动作 + 世界模型任务；
   - 论文消融中 A→B 平均成功率 62.8% → 67.2%，你的复现应看到同方向的提升。
5. **预期产出**：LIBERO 成功率表（四个子集 + 平均）、FVD（10 帧与 50 帧分别报告）、训练曲线。
6. 显存估算：Chameleon 级别模型全量微调需多卡；单卡 24 GB 建议 LoRA + 256×256 + 小批量 + 梯度累积。

### 8.5 把实验沉淀成笔记

每完成一个台阶，用 [论文笔记模板](../../templates/paper-note-template.md) 或教程模板在 `notes/` 下写一篇记录：环境版本、命令、关键数字、与论文的差异、踩坑。然后运行 `cd agent && npm run check` 保证符合标准。

```text
notes/
├── 2026-xx-xx-dreamerv3-dmc-walker.md
├── 2026-xx-xx-vjepa2-planning.md
└── 2026-xx-xx-worldvla-libero-ablation.md
```

## 动手练习
1. 为台阶 ① 写出"通过标准"的三条量化描述。
<details><summary>参考做法</summary>

① 训练 N 步后回报超过某阈值（以仓库给出的参考曲线为准）；② 重建视频在前 10 帧内可辨认场景；③ 能从日志中指出 actor/critic 损失随训练下降。
</details>

2. 估算：一个 7B 参数模型用 bf16 全量微调，Adam 优化器，需要多少显存（不含激活）？
<details><summary>参考做法</summary>

参数 2 字节 + 梯度 2 字节 + Adam 两个状态（常用 fp32，8 字节）≈ 12 字节/参数 → 7B × 12 ≈ 84 GB，不含激活。所以单卡必须用 LoRA。
</details>

3. 设计台阶 ③ 的第三组对照，验证"世界模型任务的收益不是因为多看了数据"。
<details><summary>参考做法</summary>

C：只训动作模型，但训练步数/数据遍数与 B 相同（补齐 B 中世界模型任务消耗的算力），若 B 仍优于 C，则收益来自世界模型目标本身。
</details>

## 常见错误与排查
| 现象 | 原因 | 解决 |
|---|---|---|
| JAX/PyTorch 找不到 GPU | CUDA 驱动与框架版本不匹配 | 按仓库指定版本安装，用 `nvidia-smi` 核对驱动 |
| 仿真报错无显示 | 服务器无图形界面 | 设置 `MUJOCO_GL=egl` 或 osmesa |
| 显存不足（OOM） | 分辨率/批量/序列过大 | 降 256×256、减批量、梯度累积、LoRA |
| 成功率远低于论文 | 数据过滤、动作归一化、评估次数不同 | 逐项对照论文设置；增加评估回合数 |
| 训练能跑但曲线不动 | 学习率或损失权重错误 | 先用论文默认值，只改一个变量 |

## 小结
- 三台阶：DreamerV3（隐状态）→ V-JEPA 2（表征预测与规划）→ WorldVLA（融合）。
- 每个实验先定"预期产出 + 通过标准"，再跑。
- 显存先估后跑，单卡优先 LoRA + 低分辨率。
- 实验结果按标准写进 `notes/`，让知识库随实验生长。

## 自测题
1. 为什么把 DreamerV3 放在第一台阶？
<details><summary>答案</summary>它模型小、仿真任务易跑、能直观体会隐状态世界模型与"在想象中训练"的全流程。</details>

2. 台阶 ③ 最有学习价值的对照是什么？
<details><summary>答案</summary>只训动作模型 vs 动作 + 世界模型任务，验证世界模型目标对动作成功率的提升（论文 62.8% → 67.2%）。</details>

3. 7B 模型为什么单卡全量微调不可行？
<details><summary>答案</summary>参数+梯度+优化器状态约 12 字节/参数，约 84 GB，超过单卡显存；需 LoRA 或多卡。</details>

## 参考资料
- [DreamerV3 代码](https://github.com/danijar/dreamerv3) —— 台阶 ①
- [V-JEPA 2 论文](https://arxiv.org/abs/2506.09985) —— 台阶 ②的方法与数字
- [WorldVLA 论文 HTML（含训练配置）](https://arxiv.org/html/2506.21539v1) —— 台阶 ③的超参数
- [GR00T-Dreams 代码](https://github.com/NVIDIA/GR00T-Dreams) —— 进阶：用世界模型生成数据

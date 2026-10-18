---
title: 复现指南：从安装 openpi 到迁移到自己的机械臂
type: tutorial
topic: forcevla
chapter: 6
level: advanced
tags: [复现, openpi, LeRobot, LoRA, CUDA, 训练脚本, 跨平台迁移]
prerequisites: [03-method, 04-dataset-forcevla-data, ../../../LinuxCommand/00-README]
estimated_time: 90min
sources:
  - https://github.com/ft-robotic/ForceVLA
  - https://arxiv.org/html/2505.22159v3
status: draft
created: 2026-10-17
updated: 2026-10-18
---

# 复现指南：从安装 openpi 到迁移到自己的机械臂

> 本章按公开仓库 `ft-robotic/ForceVLA` 的 README 整理出一条可执行的复现路线，并说明把它迁移到另一台机械臂（以 Franka 这类 7 轴力矩控制臂为例）时需要改哪些地方。凡是仓库没有公开或论文没写清的环节，都用 ❓ 标出。

## 学习目标

- 能在 Ubuntu 22.04 + NVIDIA GPU 的机器上装好 ForceVLA 训练环境。
- 能下载 ForceVLA-Data 并跑通归一化统计与 LoRA 微调。
- 能说出评估需要的真机条件，以及没有真机时的替代方案。
- 能列出迁移到另一台机械臂时必须修改的 4 个环节。

## 前置知识

- 需要先读：[03 方法详解](03-method.md)、[04 数据集](04-dataset-forcevla-data.md)
- 命令行基础：[LinuxCommand](../../LinuxCommand/00-README.md)（至少到环境变量与软件安装章节）
- 建议先读：[VLA 基础：训练与微调](../Basic/08-training-and-finetuning.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **openpi** | Physical Intelligence 开源的 π0 训练/推理框架（JAX） | π0 的"官方工具箱" |
| **LeRobot** | HuggingFace 的机器人数据集与策略库 | 机器人界的"数据集标准 + 模型库" |
| **LoRA** | 低秩适配：冻结大模型，只训练少量新增的小矩阵 | 不重装系统，只打补丁 |
| **归一化统计**（norm stats） | 数据集各维度的均值/方差，训练前先算好 | 考试前先统一量纲 |
| **conda 环境** | 独立的 Python 包环境，避免版本冲突 | 每个项目一个独立的工具箱 |

## 详细讲解

### 6.1 硬件与系统要求

| 用途 | 显存要求 | 示例 |
|---|---|---|
| 推理 | > 8 GB | RTX 4090 |
| LoRA 微调 | > 22.5 GB | RTX 4090（24 GB） |
| 全量微调 | > 70 GB | A100 80 GB / H100 |

系统：Ubuntu 22.04（仓库唯一测试过的系统）、Python 3.11、CUDA 12.8。论文作者用 8×RTX 4090 节点，实际多任务训练只用 2 张。

> ⚠️ 注意：macOS 和 Windows 没有被测试过；本知识库所在的 Mac 只能用来读代码和写笔记，训练需要 Linux GPU 服务器。

### 6.2 安装环境

```bash
# 1. 克隆（必须带子模块）
git clone --recurse-submodules https://github.com/ft-robotic/ForceVLA.git
cd ForceVLA

# 2. 创建环境
conda create -n forcevla python=3.11 -y
conda activate forcevla
python -m pip install --upgrade pip setuptools wheel
conda install -c nvidia cuda-toolkit=12.8

# 3. 按顺序安装各子模块（顺序不能乱）
cd lerobot/
conda install ffmpeg=7.1.1 -c conda-forge
pip install -e .
cd ..

cd openpi/
pip install -e .
cd ..

cd dlimp/
pip install -e .
cd ..

cd packages/openpi-client/
pip install -e .
cd ../..

cd flaxformer/
pip install -e .
cd ..
```

验证：

```bash
python -c "import openpi, lerobot; print('ok')"
nvidia-smi
```

> ❓ 待解决：仓库 README 中各子模块的相对路径（如 `openpi/` 是否在根目录）需以实际克隆后的目录结构为准，以上路径按 README 顺序整理。

### 6.3 准备数据

```bash
# 指定 LeRobot 数据缓存目录（换成你自己的路径）
export HF_LEROBOT_HOME=~/forcevla_data

# 下载数据集（需要 huggingface_hub）
pip install huggingface_hub
huggingface-cli download qiaojunyu/ForceVLA-real-data \
  --repo-type dataset --local-dir $HF_LEROBOT_HOME/qiaojunyu/ForceVLA-real-data
```

检查字段：

```bash
cat $HF_LEROBOT_HOME/qiaojunyu/ForceVLA-real-data/meta/info.json | head -60
```

重点核对：图像键名、状态维度、力的 6 个分量是否存在、动作维度。

### 6.4 训练

```bash
# 1. 计算归一化统计
python scripts/compute_norm_stats.py --config-name forcevla_lora

# 2. LoRA 微调
XLA_PYTHON_CLIENT_MEM_FRACTION=0.9 python scripts/train.py forcevla_lora \
  --exp-name=my_experiment --overwrite --batch_size 32 \
  --save_interval 2000 --keep_period 10000
```

参数说明：

| 参数 | 含义 |
|---|---|
| `forcevla_lora` | 配置名，定义模型结构（含 FVLMoE）、LoRA 设置、数据集 |
| `XLA_PYTHON_CLIENT_MEM_FRACTION=0.9` | 让 JAX 预留 90% 显存 |
| `--batch_size 32` | 批大小，显存不够可降到 16 |
| `--save_interval 2000` | 每 2000 步存一次检查点 |
| `--keep_period 10000` | 每 10000 步的检查点永久保留 |

论文配置对照：30k 步、lr 2.5e-5 → 2.5e-6、bf16、梯度裁剪 1.0。仓库 README 未写总步数，默认看配置文件。

> ⚠️ 注意：README 说明训练脚本**不支持多节点**；多卡只能单机数据并行。

> ❓ 待解决：仓库未提供预训练好的 ForceVLA 检查点，只能自己训；π0 基座权重需按 openpi 文档另外下载。

### 6.5 评估

论文所有评估都是**真机**试验（20/10/15 次），没有仿真环境。复现评估需要：

1. 同款或等价硬件：7 轴臂 + 能估计/测量 TCP 外力 + 腕部与第三人称相机。
2. 推理服务：openpi 提供 policy server / client 模式，机器人端通过 `openpi-client` 请求动作。
3. 与论文一致的成功判定标准（插入到底、擦干净等）。

没有真机时的替代方案：

- 只做**离线评估**：在验证集上比较动作预测误差（MSE）——能验证训练跑通，但不能证明成功率。
- 在仿真器（如 MuJoCo、Isaac）中搭建带力传感的插入任务——需要自己建数据，和论文不可直接比。

### 6.6 迁移到自己的机械臂要改什么

| 环节 | 论文平台（Flexiv Rizon） | 换平台（以 Franka 为例）需要做的 |
|---|---|---|
| 力的来源 | 机械臂内置关节力矩估计 TCP 外力 | 用关节力矩传感器估计外力，或加装腕部六维 F/T 传感器；见 [力觉与触觉感知](../Basic/10-force-and-tactile-sensing.md) |
| 坐标系 | 世界系 TCP 外力 | 把自己机械臂的力读数转换到世界系，并与论文定义对齐（符号、单位 N / N·m） |
| 动作空间 | 目标 TCP 位姿 + 夹爪宽度 | 需要笛卡尔位姿控制接口（如 Franka 的 libfranka / franky）+ 对应夹爪 |
| 控制频率 | 论文未说明 | 按机械臂控制回路（通常 500 Hz~1 kHz）做动作插值，策略推理频率一般 10~30 Hz |
| 数据采集 | Quest 3 VR 遥操作 | 可用拖动示教或 VR 映射；采集脚本需重写 |
| 相机 | D435 + D415 | 保持同款最省事，安装位置尽量一致 |

> 💡 要点：模型本身不需要改——FVLMoE 只认 6 维力和两路图像；要改的全部在**数据管线和机器人接口**。

## 动手练习

1. 在没有 GPU 的 Mac 上，只做"读代码"任务：克隆仓库，找到 FVLMoE 的实现文件，记录专家数、top-k、是否有负载均衡损失。
<details><summary>参考做法</summary>
`git clone --recurse-submodules ...` 后用 `grep -rn "MoE\|expert\|router" openpi/src` 定位；把结果回填到 [07 章](07-critique-and-open-questions.md) 的 ❓ 清单。
</details>

2. 写一个最小脚本，加载 ForceVLA-Data 的一条轨迹，画出 6 维力随时间的曲线，标出接触发生的时刻。
<details><summary>参考做法</summary>
用 `lerobot` 的 `LeRobotDataset` 读取，取 `force` 字段，`matplotlib` 画 6 条曲线；接触时刻通常是 Fz 绝对值突然上升的帧。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `ffmpeg` 版本冲突导致 lerobot 装不上 | 系统自带 ffmpeg 版本不符 | 按 README 用 conda 装 7.1.1 |
| 训练时 OOM | batch 太大或用了全量微调 | 降 batch 到 16，或确认用 `forcevla_lora` |
| JAX 找不到 GPU | CUDA 版本与 jaxlib 不匹配 | 确认 CUDA 12.8 与仓库固定的 jax 版本一致 |
| 归一化统计报错找不到数据 | `HF_LEROBOT_HOME` 未设或路径不对 | `echo $HF_LEROBOT_HOME` 并检查目录结构 |

> 🔗 关联：如果你的实验平台是 UR e-Series，力信号的读取、坐标系与频率对齐见 [UR 09 力传感与力控](../../UR/09-force-sensing-and-force-mode.md)，策略部署见 [UR 10](../../UR/10-vla-data-collection-and-deployment.md)。

## 小结

- 环境：Ubuntu 22.04 + Python 3.11 + CUDA 12.8，按 lerobot → openpi → dlimp → openpi-client → flaxformer 顺序安装。
- 数据：HuggingFace `qiaojunyu/ForceVLA-real-data`，LeRobot 格式，设 `HF_LEROBOT_HOME`。
- 训练：先算 norm stats，再 `train.py forcevla_lora`；LoRA 需 >22.5 GB 显存。
- 评估只能真机；没有检查点公开，需自训。
- 迁移到其他机械臂只改数据管线与机器人接口，模型不动。

## 自测题

1. 安装子模块的顺序是什么？
<details><summary>答案</summary>lerobot → openpi → dlimp → packages/openpi-client → flaxformer。</details>

2. LoRA 微调和全量微调分别需要多少显存？
<details><summary>答案</summary>LoRA > 22.5 GB；全量 > 70 GB。</details>

3. 迁移到其他机械臂时，力信号方面要注意什么？
<details><summary>答案</summary>力的来源（关节力矩估计或外置 F/T）、坐标系（转换到世界系 TCP）、单位与符号与论文定义一致。</details>

## 参考资料

- [ForceVLA 代码仓库 README](https://github.com/ft-robotic/ForceVLA) —— 安装与训练命令的原始来源
- [openpi（Physical Intelligence）](https://github.com/Physical-Intelligence/openpi) —— π0 基座权重与 policy server 用法
- [LeRobot](https://github.com/huggingface/lerobot) —— 数据集格式与加载 API
- [WAM 世界模型](../../WAM/00-README.md) —— 复现之后的延伸：用世界模型预测接触后果与生成数据

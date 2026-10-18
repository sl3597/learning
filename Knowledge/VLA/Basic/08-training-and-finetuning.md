---
title: 训练与微调：在自己的机器人上跑通 VLA
type: tutorial
topic: vla
chapter: 8
level: intermediate
tags: [预训练, 微调, LoRA, 显存, OpenVLA, openpi, 训练技巧]
prerequisites: [05-representative-models, 06-datasets-and-data-collection, 07-action-representation]
estimated_time: 90min
sources:
  - https://github.com/openvla/openvla
  - https://github.com/Physical-Intelligence/openpi
  - https://arxiv.org/abs/2106.09685
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 训练与微调：在自己的机器人上跑通 VLA

> 预训练的 VLA 几乎不能直接在你的机器人上用，必须微调。这一章讲清楚：微调在改什么、要多少显存、具体命令怎么敲、哪些坑最常踩。

## 学习目标

- 能解释预训练和微调的分工，以及为什么微调几乎是必须的
- 能说出全量微调和 LoRA 的区别，并估算各自的显存需求
- 能照着步骤跑通 OpenVLA 或 π0 的一次微调
- 能识别训练曲线上的常见异常

## 前置知识

- 需要先读：[05 代表性模型](05-representative-models.md)、[06 数据集](06-datasets-and-data-collection.md)、[07 动作表示](07-action-representation.md)
- 需要熟练使用 [Linux 命令](../../LinuxCommand/00-README.md)：ssh、tmux、conda、nvidia-smi

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **预训练** | 在海量通用数据上训练，学到"通用能力" | 大学通识教育 |
| **微调** | 在少量目标数据上继续训练，适配具体任务 / 机器人 | 入职培训 |
| **全量微调** | 更新模型的所有参数 | 把全部知识重新梳理 |
| **LoRA** | 冻结原参数，只训练插入的小矩阵 | 原书不动，贴便签 |
| **batch size** | 每一步用多少条样本算梯度 | 一次批改几份作业 |
| **epoch** | 把训练集完整过一遍 | 把题库刷一遍 |
| **梯度检查点** | 牺牲计算换显存 | 不存中间草稿，需要时重算 |

## 详细讲解

### 8.1 为什么必须微调

预训练的 VLA 见过很多机器人，但：

- 你的**相机位置、分辨率**和预训练数据不同
- 你的**机器人型号 / 动作约定**可能不在预训练集里（比如实验室自己的机械臂）
- 你的**任务和物体**可能没见过

微调用 50~300 条你自己采集的示范，让模型把通用能力"对齐"到你的设置。经验上，预训练权重 + 100 条数据，往往比从头训练 + 1000 条数据效果更好——这就是预训练的价值。

### 8.2 全量微调 vs LoRA

**LoRA（Low-Rank Adaptation）**的做法：对每个权重矩阵 $W \in \mathbb{R}^{d \times k}$，冻结它，另外训练两个小矩阵 $A \in \mathbb{R}^{d \times r}$、$B \in \mathbb{R}^{r \times k}$（$r$ 通常取 8~64），前向时用 $W + AB$。可训练参数从 $dk$ 降到 $r(d+k)$，通常只有原来的 1% 以下。

| | 全量微调 | LoRA |
|---|---|---|
| 可训练参数 | 100% | 约 0.5~2% |
| 7B 模型显存（bf16，batch 小） | 约 70~80 GB | 约 20~30 GB |
| 效果 | 略好（数据多时） | 数据少时相当甚至更好、不易过拟合 |
| 权重文件 | 整个模型 | 几十 MB 的 adapter |

> 💡 要点：OpenVLA 论文实测 LoRA（r=32）在他们的任务上效果与全量微调几乎一致，而只需一张 A100。**先用 LoRA，不够再考虑全量。**

### 8.3 显存估算速查

| 模型 | 推理 | LoRA 微调 | 全量微调 |
|---|---|---|---|
| OpenVLA 7B | 约 16 GB（bf16），8 GB（int4 量化） | 约 24~40 GB | 约 80 GB × 多卡 |
| π0 3B（openpi） | 约 8 GB | 约 22.5 GB | 约 70 GB+ |
| Octo 93M | < 2 GB | 约 6 GB | 约 10 GB |

数字随 batch size、图像分辨率、chunk 长度和版本变化，以仓库 README 为准。显存不够的三板斧：减 batch、开梯度检查点、用 LoRA。

### 8.4 实战：OpenVLA LoRA 微调

**步骤 1：环境**

```bash
conda create -n openvla python=3.10 -y
conda activate openvla
git clone https://github.com/openvla/openvla.git && cd openvla
pip install -e .
pip install packaging ninja && pip install "flash-attn==2.5.5" --no-build-isolation
```

**步骤 2：准备数据**

OpenVLA 读取 RLDS 格式。把你的 LeRobot 或自定义数据用仓库提供的转换脚本（`rlds_dataset_builder`）转成 RLDS，并在 `prismatic/vla/datasets/rlds/oxe/configs.py` 里注册动作空间、相机键名和归一化方式。

**步骤 3：启动训练**

```bash
torchrun --standalone --nnodes 1 --nproc-per-node 1 vla-scripts/finetune.py \
  --vla_path "openvla/openvla-7b" \
  --data_root_dir ~/datasets/rlds \
  --dataset_name my_robot_dataset \
  --run_root_dir ~/runs \
  --adapter_tmp_dir ~/runs/adapter_tmp \
  --lora_rank 32 \
  --batch_size 8 \
  --grad_accumulation_steps 2 \
  --learning_rate 5e-4 \
  --image_aug True \
  --wandb_project my_vla \
  --save_steps 2000
```

**步骤 4：看曲线**：关注 `action_accuracy`（token 预测准确率）和 `l1_loss`（反量化后的动作误差）。前者升到 95% 以上、后者稳定下降，通常意味着可以上真机试了。

### 8.5 实战：π0 微调（openpi）

```bash
git clone --recurse-submodules https://github.com/Physical-Intelligence/openpi.git
cd openpi && GIT_LFS_SKIP_SMUDGE=1 uv sync
```

openpi 直接读 LeRobot 格式。流程：

1. 在 `src/openpi/training/config.py` 里新增一个 `TrainConfig`，指定数据 repo_id、动作维度、相机键名，以及用 `pi0_base` 还是 `pi0_fast_base`。
2. 计算归一化统计量：

```bash
uv run scripts/compute_norm_stats.py --config-name my_robot_config
```

3. 启动训练（LoRA 配置约 22.5 GB 显存）：

```bash
XLA_PYTHON_CLIENT_MEM_FRACTION=0.9 uv run scripts/train.py my_robot_config \
  --exp-name=run1 --overwrite
```

4. 启动推理服务器，真机侧通过 WebSocket 连接（见 09 章）。

> ⚠️ 注意：openpi 基于 JAX，首次编译会很慢（几分钟）是正常现象。

### 8.6 训练技巧与常见坑

- **学习率**：LoRA 用 1e-4 ~ 5e-4；全量微调用 2e-5 ~ 5e-5。太大会让预训练知识"被冲掉"。
- **图像增强**：随机裁剪、颜色抖动能显著提升对光照和相机微小移动的鲁棒性，几乎总是开。
- **多久停**：数据少时 5~20 个 epoch；看验证 L1 不再下降就停，不要只看训练损失。
- **动作约定**：delta / 绝对、归一化方式必须与配置一致（07 章）。
- **相机键名**：数据里的相机名和配置里的要一一对应，错了会静默地用错相机。
- **tmux / nohup**：训练几小时，一定在 tmux 里跑，SSH 断了也不会停。

## 动手练习

1. 在 LeRobot 的公开小数据集上跑一次 openpi 的 `compute_norm_stats.py`，查看输出文件里有哪些键。

<details><summary>参考做法</summary>

按 8.5 配置一个指向 `lerobot/aloha_sim_insertion_human` 的 config，运行后在 `assets/<config>/<repo_id>/norm_stats.json` 看到 `state` 和 `actions` 的 mean / std / q01 / q99。
</details>

2. 用 `nvidia-smi` 观察训练时显存占用，分别把 batch size 设为 4、8、16，记录三组数字，画出关系。

<details><summary>参考做法</summary>

显存与 batch size 大致线性增长（激活值部分），截距是参数 + 优化器状态。这个截距就是你"至少要多少显存"的答案。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `CUDA out of memory` | 显存不足 | 减 batch size、开 gradient checkpointing、用 LoRA |
| 训练损失下降但真机完全不动 | 归一化 / 动作约定不一致 | 对照 07 章逐项核对 stats 和 delta/绝对 |
| `action_accuracy` 卡在 60% | 学习率太小或数据太少 | 调大学习率；增加数据；检查数据是否损坏 |
| 微调后"忘了"语言指令 | 学习率过大，灾难性遗忘 | 降低学习率；混入少量预训练数据 |
| flash-attn 安装失败 | CUDA / 编译器版本不匹配 | 用预编译 wheel 或暂时禁用 flash attention |
| JAX 报"找不到 GPU" | CUDA 版本与 jaxlib 不匹配 | 按 openpi README 安装指定版本 |

## 小结

- 预训练给通用能力，微调做对齐；几乎总是需要微调。
- LoRA 只训练 1% 参数，显存降到 1/3，效果接近全量；先用 LoRA。
- OpenVLA 走 RLDS + torchrun；openpi 走 LeRobot + JAX，都要先算归一化统计量。
- 最常见的失败不是训练本身，而是动作约定、归一化、相机键名不一致。

## 自测题

1. 一个 7B 模型，LoRA r=16，只对注意力的 Q、V 矩阵（各 4096×4096）加 adapter，32 层。可训练参数大约多少？

<details><summary>答案</summary>每个矩阵 $r(d+k) = 16 × (4096+4096) = 131,072$；每层 2 个矩阵，32 层：$131,072 × 2 × 32 ≈ 8.4M$，约为 7B 的 0.12%。</details>

2. 训练损失持续下降、验证 L1 开始回升，该怎么办？

<details><summary>答案</summary>这是过拟合信号。停止训练并使用验证最好的 checkpoint；或增加数据 / 图像增强 / 正则化。</details>

3. 为什么微调时学习率要比预训练小得多？

<details><summary>答案</summary>微调的目标是在保留预训练能力的前提下做小幅调整。学习率大会让参数剧烈变化，覆盖掉预训练学到的通用表示（灾难性遗忘）。</details>

## 参考资料

- [OpenVLA 代码与微调指南（GitHub）](https://github.com/openvla/openvla) —— README 的 Fine-Tuning 部分
- [openpi 代码与微调指南（GitHub）](https://github.com/Physical-Intelligence/openpi) —— `docs/` 目录有 LeRobot 数据转换和训练细节
- [LoRA 论文（arXiv）](https://arxiv.org/abs/2106.09685)
- [Hugging Face PEFT 库](https://github.com/huggingface/peft) —— LoRA 的通用实现
- [Weights & Biases 文档](https://docs.wandb.ai/) —— 训练曲线可视化

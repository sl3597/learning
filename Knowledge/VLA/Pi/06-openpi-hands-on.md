---
title: openpi 实战：跑推理、微调与部署 π0 / π0.5
type: tutorial
topic: vla
chapter: 6
level: intermediate
tags: [openpi, π0, π0.5, 微调, LeRobot, 推理服务, JAX, PyTorch, 部署]
prerequisites: [02-pi0-architecture-and-flow-matching]
estimated_time: 90min
sources:
  - https://github.com/Physical-Intelligence/openpi
  - https://arxiv.org/abs/2410.24164
  - https://arxiv.org/abs/2504.16054
status: draft
created: 2026-10-19
updated: 2026-10-19
---

# openpi 实战：跑推理、微调与部署 π0 / π0.5

> 前面几章讲的是论文，这一章讲"怎么把它跑起来"：用 Physical Intelligence 开源的 **openpi** 代码库下载权重、起一个策略服务、在自己的数据上微调，并知道换到自己的机器人时要改哪几处。所有命令来自 openpi 仓库 README，以仓库当前版本为准。

## 学习目标

- 能说出 openpi 提供哪些基座 / 微调权重，分别对应哪一代模型
- 能在一台 GPU 机器上完成安装、下载权重、用几行 Python 跑一次推理
- 能照着"转数据 → 算归一化统计 → 训练 → 起服务"四步在自己的数据集上微调
- 知道 JAX 版和 PyTorch 版的区别，以及常见报错怎么处理

## 前置知识

- 需要先读：[02 π0 架构与流匹配](02-pi0-architecture-and-flow-matching.md)（知道模型吃什么、吐什么）
- 建议先读：[VLA 基础 08 训练与微调](../Basic/08-training-and-finetuning.md)（8.5 节已有 π0 微调的概要）、[Linux 命令 17 SSH 与远程](../../LinuxCommand/17-ssh-and-remote.md)（训练通常在远程 GPU 机器上）

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **openpi** | PI 开源的 π0 / π0-FAST / π0.5 训练与推理代码库，附带在 1 万小时以上机器人数据上预训练的基座权重 | π 系列的"官方工具箱" |
| **基座权重（base checkpoint）** | 预训练完、还没针对具体机器人微调的权重，用来继续微调 | 通识教育毕业的新人 |
| **微调权重（fine-tuned checkpoint）** | 已经在某个平台（ALOHA、DROID、LIBERO）上微调好、可直接推理的权重 | 已上岗的熟练工 |
| **LeRobot 数据集** | HuggingFace 的机器人数据格式，openpi 训练只认它 | 统一的"原料包装规格" |
| **归一化统计（norm stats）** | 每一维状态 / 动作的分位数和标准差，训练前算一次，用来把数据缩放到合适范围 | 做菜前先称一遍食材 |
| **策略服务（policy server）** | 模型在一台 GPU 机器上监听端口，机器人通过 websocket 发观测、收动作块 | 点外卖：厨房和餐桌不在一起 |
| **uv** | 新一代 Python 包管理器，openpi 用它装依赖 | 更快的 pip + venv |

## 详细讲解

### 6.1 硬件要求与安装

openpi 只在 Ubuntu 22.04 上测试过，需要 NVIDIA GPU，显存要求如下（README 给出的单卡估计）：

| 模式 | 显存 | 示例 GPU |
|---|---|---|
| 推理 | > 8 GB | RTX 4090 |
| 微调（LoRA） | > 22.5 GB | RTX 4090 |
| 微调（全量） | > 70 GB | A100 80GB / H100 |

多卡可以在训练配置里设 `fsdp_devices` 做模型并行来降低单卡显存；训练脚本暂不支持多节点。

```bash
git clone --recurse-submodules git@github.com:Physical-Intelligence/openpi.git
cd openpi
# 已经克隆过的话补一下子模块：
git submodule update --init --recursive

# 用 uv 装依赖（GIT_LFS_SKIP_SMUDGE=1 是为了把 LeRobot 当依赖拉下来时不下载大文件）
GIT_LFS_SKIP_SMUDGE=1 uv sync
GIT_LFS_SKIP_SMUDGE=1 uv pip install -e .
```

> ⚠️ 注意：系统层面**不需要**预装 CUDA 库，uv 会一并安装；README 甚至建议遇到 CUDA 报错时先卸掉系统自带的 CUDA 库，避免版本冲突。装不上就改用仓库 `docs/docker.md` 的 Docker 方案。

### 6.2 有哪些权重

权重默认从 `gs://openpi-assets` 自动下载并缓存到 `~/.cache/openpi`，可用环境变量 `OPENPI_DATA_HOME` 改位置。

| 权重 | 代 | 用途 | 说明 |
|---|---|---|---|
| `pi0_base` | π0 | 微调 | 流匹配基座 |
| `pi0_fast_base` | π0-FAST | 微调 | 自回归基座 |
| `pi05_base` | π0.5 | 微调 | 用知识隔离训练的升级版基座；仓库目前只支持它的流匹配头 |
| `pi0_fast_droid` | π0-FAST | 推理 | 在 DROID 数据上微调，能在新场景零样本做简单桌面任务 |
| `pi0_droid` | π0 | 微调 | DROID 版 π0，推理更快但语言跟随稍弱 |
| `pi0_aloha_towel` / `pi0_aloha_tupperware` / `pi0_aloha_pen_uncap` | π0 | 推理 | ALOHA 平台上叠毛巾 / 拆保鲜盒 / 拔笔帽 |
| `pi05_libero` | π0.5 | 推理 | LIBERO 仿真基准，README 称达到当前最佳 |
| `pi05_droid` | π0.5 | 推理 / 微调 | DROID 版 π0.5，推理快、语言跟随好 |

> 💡 要点：README 自己也说 openpi 是"一个实验"——π0 是为 PI 自家机器人开发的，拿到 ALOHA、DROID 之外的平台上**不保证能用**。基座权重几乎总要在你的机器人上微调。

### 6.3 几行代码跑推理

```python
from openpi.training import config as _config
from openpi.policies import policy_config
from openpi.shared import download

config = _config.get_config("pi05_droid")
checkpoint_dir = download.maybe_download("gs://openpi-assets/checkpoints/pi05_droid")

policy = policy_config.create_trained_policy(config, checkpoint_dir)

example = {
    "observation/exterior_image_1_left": ...,   # 第三人称相机图像
    "observation/wrist_image_left": ...,        # 腕部相机图像
    # ... 其余观测键按 DROID 约定
    "prompt": "pick up the fork",
}
action_chunk = policy.infer(example)["actions"]   # 一个动作块（多步连续动作）
```

输出是一个动作块，对应 [02 章](02-pi0-architecture-and-flow-matching.md) 讲的 50 步连续动作；真机上通常执行一部分后再重新推理。没有机器人也能测：仓库的 `examples/simple_client` 会生成随机观测跑一次推理。

### 6.4 在自己的数据上微调（四步）

README 以 π0.5 + LIBERO 为例，你的数据照同样的流程走。

**第 1 步：把数据转成 LeRobot 格式**

```bash
uv run examples/libero/convert_libero_data_to_lerobot.py --data_dir /path/to/your/libero/data
```

改这个脚本就能转自己的数据：每条轨迹要有图像、本体状态、动作和语言指令。只想在 LIBERO 上微调可以跳过，配置里已经指向转好的数据集。

**第 2 步：写配置**

在 `src/openpi/training/config.py` 里仿照 LIBERO 的例子加三样东西：

| 要加的 | 作用 | 参考 |
|---|---|---|
| `XxxInputs` / `XxxOutputs` | 你的观测 / 动作键名 ↔ 模型输入输出的映射，训练和推理共用 | `src/openpi/policies/libero_policy.py` 里的 `LiberoInputs` / `LiberoOutputs` |
| `LeRobotXxxDataConfig` | 怎么从 LeRobot 数据集里读训练样本 | `LeRobotLiberoDataConfig` |
| `TrainConfig` | 超参数、数据配置、加载哪个基座权重（π0 / π0-FAST / π0.5 各有示例） | 同文件里的 `pi05_libero` 等 |

**第 3 步：算归一化统计，然后训练**

```bash
uv run scripts/compute_norm_stats.py --config-name pi05_libero
XLA_PYTHON_CLIENT_MEM_FRACTION=0.9 uv run scripts/train.py pi05_libero --exp-name=my_experiment --overwrite
```

`XLA_PYTHON_CLIENT_MEM_FRACTION=0.9` 允许 JAX 用 90% 显存（默认 75%）；`--overwrite` 覆盖同名实验的旧检查点。检查点存在 `checkpoints/` 下，训练曲线可在 Weights & Biases 看。如果你的机器人本来就在 PI 的预训练混合里，可以按 `docs/norm_stats.md` 直接复用预训练的归一化统计。

> 🔗 关联：动作归一化为什么用分位数、换机器人为什么不能沿用别人的统计，见 [VLA 基础 07 动作表示](../Basic/07-action-representation.md)。

**第 4 步：起服务并推理**

```bash
uv run scripts/serve_policy.py policy:checkpoint --policy.config=pi05_libero --policy.dir=checkpoints/pi05_libero/my_experiment/20000
```

服务监听 8000 端口；机器人侧用 `openpi-client` 通过 websocket 发观测、收动作，最小示例见 `docs/remote_inference.md`。这种"模型在 GPU 机器、机器人在另一台电脑"的结构，让你可以用更强的显卡，也把机器人环境和模型环境隔开。LIBERO 评测则推荐用仓库提供的 Docker 工作流一次起服务 + 评测脚本。

### 6.5 JAX 还是 PyTorch

openpi 原生是 JAX 实现，2025 年 9 月加入了 π0 和 π0.5 的 PyTorch 实现（已在 LIBERO 上验证推理和微调）。PyTorch 版暂不支持：π0-FAST、混合精度训练、FSDP、LoRA、EMA 权重。用法差异只在权重格式：

```bash
# 把 JAX 检查点转成 PyTorch 格式
uv run examples/convert_jax_model_to_pytorch.py --checkpoint_dir /path/to/jax/checkpoint --config_name <config name> --output_path /path/to/converted/pytorch/checkpoint
# 单卡训练
uv run scripts/train_pytorch.py <config_name> --exp_name <run_name> --save_interval <interval>
# 单机多卡
uv run torchrun --standalone --nnodes=1 --nproc_per_node=<num_gpus> scripts/train_pytorch.py <config_name> --exp_name <run_name>
```

> ⚠️ 注意：PyTorch 版需要把 `src/openpi/models_pytorch/transformers_replace/` 里的文件覆盖到 `.venv` 的 transformers（4.53.2）里。README 警告：uv 默认用硬链接，这个覆盖会**永久改掉 uv 缓存里的 transformers**，可能影响其他项目；要彻底撤销得运行 `uv cache clean transformers`。建议在独立机器或 Docker 里做。

精度：JAX 推理大多数权重与计算用 bfloat16，训练默认混合精度；PyTorch 训练默认全 bfloat16（省显存但损失略高），可改全 float32。开 `torch.compile` 后两者推理速度相当。

### 6.6 换到自己的机器人要改什么

| 要改的地方 | 为什么 |
|---|---|
| 观测键名与相机数量（`XxxInputs`） | 基座按 PI 的相机布局训练；少一路相机要按仓库约定做掩码 |
| 动作空间与维度（`XxxOutputs`） | 关节空间还是末端位姿、夹爪如何表示，必须和你的控制器一致 |
| 控制频率与重规划间隔 | 动作块按采集频率解释；见 [02 章](02-pi0-architecture-and-flow-matching.md) |
| 归一化统计 | 新机器人必须重新 `compute_norm_stats` |
| 安全限位 | 模型输出不受物理约束，机器人侧要做限幅与急停 |

仓库自带 `examples/ur5`，和本知识库的 [UR：VLA 数据采集与部署](../../UR/10-vla-data-collection-and-deployment.md) 配合使用。

## 动手练习

1. 在一台有 GPU 的机器上完成安装，用 `examples/simple_client` 在没有机器人的情况下跑通一次 `pi05_droid` 推理（验收：能打印出动作块的形状）。

<details><summary>参考做法</summary>

```bash
GIT_LFS_SKIP_SMUDGE=1 uv sync && GIT_LFS_SKIP_SMUDGE=1 uv pip install -e .
uv run scripts/serve_policy.py --env DROID   # 具体参数以 examples/simple_client/README.md 为准
# 另开终端按 examples/simple_client/README.md 启动客户端
```
第一次运行会下载权重到 `~/.cache/openpi`，注意磁盘空间。
</details>

2. 读 `src/openpi/training/config.py`，找出 `pi05_libero` 这个 `TrainConfig` 加载的是哪个基座权重、用的是 LoRA 还是全量微调。

<details><summary>参考做法</summary>

在 `TrainConfig` 的 weight loader 字段里能看到权重路径（`gs://openpi-assets/checkpoints/pi05_base`），LoRA 与否由模型配置里的 LoRA 相关字段决定；仓库版本不同字段名会变，以源码为准。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `uv sync` 依赖冲突 | 旧的虚拟环境或旧版 uv | `rm -rf .venv` 后重跑；`uv self update` |
| 训练 OOM | JAX 默认只用 75% 显存 | 设 `XLA_PYTHON_CLIENT_MEM_FRACTION=0.9`；多卡用 `--fsdp-devices <n>`；仍不够就关 EMA |
| 报缺 norm stats | 没先算统计 | 先跑 `scripts/compute_norm_stats.py --config-name <配置名>` |
| 策略服务连不上 | 服务没起、端口或防火墙 | 确认服务在监听 8000，检查两台机器网络 |
| 动作维度不匹配 | `Inputs` / `Outputs` 的维度和机器人不一致 | 核对策略类里的动作空间定义 |
| 训练损失发散 | 某些很少动的维度 `q01` / `q99` / `std` 极小，归一化后数值爆炸 | 检查 `norm_stats.json`，手动调整那几维 |
| 数据集下载失败 | 网络或未登录 HuggingFace | `huggingface-cli login` |

## 小结

- openpi 是 π0 / π0-FAST / π0.5 的官方实现，基座权重 `pi0_base`、`pi0_fast_base`、`pi05_base` 用来微调，DROID / ALOHA / LIBERO 的微调权重可直接推理。
- 推理 > 8 GB、LoRA > 22.5 GB、全量 > 70 GB 显存。
- 微调四步：转 LeRobot 数据 → 写 `Inputs/Outputs + DataConfig + TrainConfig` → 算 norm stats 并训练 → 起策略服务。
- 新机器人必须改观测 / 动作映射并重算归一化统计；PyTorch 版可用但功能子集更小。

## 自测题

1. 为什么训练前一定要跑 `compute_norm_stats`，直接复用预训练的统计行不行？

<details><summary>答案</summary>统计描述的是你这台机器人的状态 / 动作分布，换了机器人分布就变了；只有你的机器人本来就在 PI 预训练混合里时，才可以按 `docs/norm_stats.md` 复用预训练统计。</details>

2. 策略服务和机器人分开部署有什么好处？

<details><summary>答案</summary>模型可以跑在更强的远程 GPU 上；机器人侧只需要轻量客户端，两边的软件环境互不干扰。</details>

3. 想用 LoRA 微调 π0.5，应该选 JAX 版还是 PyTorch 版？

<details><summary>答案</summary>JAX 版：README 明确 PyTorch 版暂不支持 LoRA、FSDP、混合精度和 EMA。</details>

## 参考资料

- [openpi 仓库 README（GitHub）](https://github.com/Physical-Intelligence/openpi) —— 本章所有命令的出处，以它为准
- [openpi 远程推理文档](https://github.com/Physical-Intelligence/openpi/blob/main/docs/remote_inference.md) —— 策略服务 / 客户端最小示例
- [LeRobot（HuggingFace）](https://github.com/huggingface/lerobot) —— 数据格式与采集工具
- [VLA 基础 08 训练与微调](../Basic/08-training-and-finetuning.md) —— LoRA、显存与训练流程的通用知识

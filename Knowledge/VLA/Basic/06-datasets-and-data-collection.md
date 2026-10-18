---
title: 数据集与数据采集
type: tutorial
topic: vla
chapter: 6
level: intermediate
tags: [Open X-Embodiment, BridgeData, DROID, LeRobot, 遥操作, 数据采集, 数据质量]
prerequisites: [04-vla-concept]
estimated_time: 45min
sources:
  - https://arxiv.org/abs/2310.08864
  - https://arxiv.org/abs/2308.12952
  - https://arxiv.org/abs/2403.12945
  - https://huggingface.co/docs/lerobot
status: draft
created: 2026-10-17
updated: 2026-10-18
---

# 数据集与数据采集

> VLA 是"吃数据"长大的。这一章回答：主流数据集有哪些、一条机器人数据长什么样、自己怎么采集、什么样的数据才算好。

## 学习目标

- 能说出 Open X-Embodiment、BridgeData V2、DROID 各自的规模和特点
- 能描述 LeRobot 数据格式里一个 episode 包含哪些字段
- 能列出一次遥操作采集的完整流程
- 能判断一批数据的质量好坏

## 前置知识

- 需要先读：[04 VLA 是什么](04-vla-concept.md)
- 建议会用 [Linux 命令](../../LinuxCommand/00-README.md) 中的基本文件操作

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **episode（轨迹）** | 一次完整的任务示范，从开始到结束的所有帧 | 一段完整的教学视频 |
| **帧（frame / timestep）** | 轨迹中的一个时刻，包含图像、状态、动作 | 视频的一帧 + 当时的操作记录 |
| **遥操作（teleoperation）** | 人用设备远程控制机器人完成任务并录制 | 用手柄遥控玩具车，同时录像 |
| **主从臂（leader-follower）** | 人拖动一个小臂，机器人大臂同步跟随 | 牵线木偶 |
| **跨本体数据集** | 包含多种机器人的数据 | 多个驾校的教学录像合集 |
| **数据格式** | 数据在硬盘上怎么组织（RLDS、LeRobot v2 等） | 录像的文件格式 |

## 详细讲解

### 6.1 主流数据集

| 数据集 | 年份 | 规模 | 机器人 | 特点 |
|---|---|---|---|---|
| **BridgeData V2** | 2023 | 约 6 万条轨迹，24 个环境，13 种技能 | WidowX 250（低成本单臂） | 场景多样，是 OXE 的核心子集 |
| **Open X-Embodiment（OXE）** | 2023 | 100 万+ 条轨迹，22 种机器人，500+ 技能 | 60 个数据集汇总 | 第一次把全球实验室的数据统一格式（RLDS），RT-X、OpenVLA、Octo 都用它 |
| **DROID** | 2024 | 约 7.6 万条轨迹，564 个场景，86 个任务 | Franka Panda | 在真实家庭 / 办公室"野外"采集，场景多样性最高 |
| **RT-1 数据** | 2022 | 13 万条轨迹，700+ 任务 | Google 移动机械臂 | 单一机器人、高度一致的采集条件 |
| **LeRobot 社区数据集** | 2024~ | 数百个小数据集 | SO-100、Koch、ALOHA 等 | Hugging Face Hub 上即下即用 |

> ⚠️ 注意：OXE 是"数据集的集合"，各子集的许可证不同，部分为非商业许可。商用前要逐个检查。

### 6.2 一条数据长什么样

以 LeRobot v2 格式为例，一个数据集是一个文件夹：

```text
my_dataset/
├── meta/
│   ├── info.json          # 字段定义、fps、机器人类型
│   ├── episodes.jsonl     # 每条轨迹的长度、任务描述
│   └── stats.json         # 每个字段的均值 / 方差，用于归一化
├── data/
│   └── chunk-000/
│       └── episode_000000.parquet   # 表格：每行一帧
└── videos/
    └── chunk-000/
        └── observation.images.wrist/episode_000000.mp4
```

parquet 表格里每一行（一帧）典型包含：

| 字段 | 含义 | 示例形状 |
|---|---|---|
| `observation.images.top` | 第三人称相机（在 mp4 里，表里存索引） | 480×640×3 |
| `observation.images.wrist` | 腕部相机 | 480×640×3 |
| `observation.state` | 本体状态（关节角 + 夹爪） | 7 或 8 维 |
| `action` | 这一帧人类给出的动作 | 7 维 |
| `timestamp` | 时间戳 | 标量 |
| `episode_index` / `frame_index` | 属于第几条轨迹、第几帧 | 整数 |
| `task` | 语言指令 | 字符串 |

> 💡 要点：**action 是"人在这一帧做了什么"，state 是"机器人在这一帧处于什么位置"**。训练时模型看 state 和图像，学着预测 action。

OXE 使用的 RLDS 格式（TensorFlow Datasets）概念相同，只是存成 tfrecord。

### 6.3 遥操作采集流程

一次标准的采集流程：

1. **搭场景**：固定相机位置（之后不要再动），布置物体
2. **校准**：相机内外参、主从臂零点、夹爪开合范围
3. **写指令**：为这批数据写清楚语言指令，如 "put the red block in the bowl"
4. **录制**：操作员用主从臂 / VR 手柄 / 3D 鼠标控制机器人完成任务，系统以固定频率（10~50 Hz）同步记录图像、状态、动作
5. **标注与筛选**：标记失败的轨迹（通常丢弃或单独保存），必要时切分子任务
6. **格式化**：转成 LeRobot 或 RLDS 格式，计算归一化统计量
7. **可视化检查**：回放几条，确认图像、动作时间对齐

常见采集设备：

- **主从臂**（ALOHA、GELLO、SO-100 leader）：直观、精度高、便宜，最适合单 / 双臂操作
- **VR 手柄**（Quest）：适合末端位姿控制，学习成本低
- **3D 鼠标 / 游戏手柄**：便宜但操作慢，难做精细动作

### 6.4 什么是"好数据"

模仿学习的上限由数据决定。好数据的几个标准：

| 维度 | 好 | 差 |
|---|---|---|
| **一致性** | 同一任务的示范策略相近 | 一会儿从左绕一会儿从右绕，模型学成"直冲" |
| **多样性** | 物体位置、颜色、背景、光照有变化 | 每次都放在同一位置，换位置就失效 |
| **流畅性** | 动作连贯、不犹豫 | 频繁停顿、来回修正 |
| **覆盖恢复** | 包含"出错后纠正"的片段 | 只有完美示范，一出错就不知道怎么办 |
| **时间对齐** | 图像和动作时间戳严格对应 | 延迟几帧，模型学到错误的因果关系 |

> 🔍 深入：数据量和多样性的关系：100 条高度多样的数据往往比 1000 条完全相同场景的数据更有用。微调 π0 / OpenVLA 做一个新任务，典型需要 50~300 条示范。

> 🔗 关联：接触丰富任务（插拔、擦拭）还需要记录力 / 力矩信号，这是 ForceVLA 数据集的特点，详见 [10 力觉与触觉感知](10-force-and-tactile-sensing.md)。

## 动手练习

1. 用 LeRobot 下载并可视化一个小数据集。

<details><summary>参考做法</summary>

```bash
pip install lerobot
python -m lerobot.scripts.visualize_dataset \
  --repo-id lerobot/aloha_sim_insertion_human \
  --episode-index 0
```

会弹出一个 rerun 窗口，能同时看到图像、状态曲线和动作曲线。命令随版本可能变化，以 LeRobot 文档为准。
</details>

2. 读 `meta/info.json`，找出 fps 和 action 的维度。

<details><summary>参考做法</summary>

```bash
cat ~/.cache/huggingface/lerobot/lerobot/aloha_sim_insertion_human/meta/info.json | head -50
```

查找 `"fps"` 和 `"action"` 下的 `"shape"` 字段。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 训练后机器人只会"原地抖动" | 动作和图像时间不对齐，或 action 实际上是 state 的复制 | 回放数据检查；确认 action 是"下一步目标"而非"当前位置" |
| 换个位置放物体就失败 | 数据多样性不够 | 采集时随机化物体位置 |
| 模型在两条路径之间"犹豫" | 示范策略不一致 | 统一操作员的策略，或改用扩散类动作头 |
| 下载 OXE 子集时报许可证错误 | 部分数据需同意条款 | 到各子集原始页面确认许可 |

> 🔗 关联：用 UR 机械臂实际采集示教数据（自由驱动示教、遥操作、多传感器同步记录）见 [UR 10 VLA 数据采集与部署](../../UR/10-vla-data-collection-and-deployment.md)。

## 小结

- OXE 是最大的跨本体合集，DROID 场景最多样，BridgeData V2 是常用小基线，LeRobot 让数据即下即用。
- 一条数据 = 若干帧，每帧有图像、state、action、指令。
- 采集流程：搭场景 → 校准 → 写指令 → 录制 → 筛选 → 格式化 → 检查。
- 好数据：一致、多样、流畅、含恢复、时间对齐。

## 自测题

1. 为什么同一任务的示范"策略不一致"会伤害模型？

<details><summary>答案</summary>模型在相同观察下看到多种不同动作，若用回归 / 交叉熵训练会学成平均值，可能是一个从未出现过的无效动作。</details>

2. LeRobot 数据集里 `stats.json` 存的是什么，为什么需要它？

<details><summary>答案</summary>每个字段的均值、标准差、最大最小值。训练时用它把 state 和 action 归一化到相近的数值范围，推理时再反归一化。</details>

3. 一个任务只采了 20 条示范，物体每次都在同一位置。预测这个模型的表现。

<details><summary>答案</summary>在相同位置可能成功，物体稍微移动就大概率失败——数据量太少且没有多样性，模型没学到"根据画面找物体"的能力。</details>

## 参考资料

- [Open X-Embodiment 论文（arXiv）](https://arxiv.org/abs/2310.08864) 与 [项目页](https://robotics-transformer-x.github.io/)
- [BridgeData V2（arXiv）](https://arxiv.org/abs/2308.12952)
- [DROID（arXiv）](https://arxiv.org/abs/2403.12945) 与 [项目页](https://droid-dataset.github.io/)
- [LeRobot 文档](https://huggingface.co/docs/lerobot) —— 数据格式、采集脚本、可视化工具
- [GELLO 低成本主从臂（GitHub）](https://github.com/wuphilipp/gello_software)

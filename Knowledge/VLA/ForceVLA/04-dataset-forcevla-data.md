---
title: 数据集 ForceVLA-Data：五个接触任务与采集方式
type: tutorial
topic: forcevla
chapter: 4
level: beginner
tags: [ForceVLA-Data, 数据集, 遥操作, Flexiv Rizon, RealSense, LeRobot, 力数据]
prerequisites: [01-paper-overview]
estimated_time: 30min
sources:
  - https://arxiv.org/html/2505.22159v3
  - https://github.com/ft-robotic/ForceVLA
  - https://sites.google.com/view/forcevla2025
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 数据集 ForceVLA-Data：五个接触任务与采集方式

> 本章介绍论文自建的数据集：有哪些任务、用什么机器人和传感器采的、规模多大、数据长什么样，以及它和公开的大规模机器人数据集是什么关系。

## 学习目标

- 能说出 5 个任务各自考验的是哪种"力的能力"。
- 能列出采集硬件（机械臂、夹爪、相机、遥操作设备）及其参数。
- 能说出数据集规模（轨迹数、时间步数）和每条样本包含的字段。
- 能解释为什么这个数据集**不能**直接用 Open X-Embodiment 替代。

## 前置知识

- 需要先读：[01 论文总览](01-paper-overview.md)
- 建议先读：[VLA 基础：数据集](../Basic/06-datasets-and-data-collection.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **轨迹**（trajectory / episode） | 一次完整的任务演示，从开始到结束的所有帧 | 一段录像 |
| **时间步**（timestep） | 轨迹里的一帧，包含同一时刻的图像、状态、力、动作 | 录像的一帧 |
| **遥操作**（teleoperation） | 人远程操控机器人做示范，机器人记录下来当训练数据 | 用手柄玩游戏，游戏录下你的操作 |
| **本体感知**（proprioception） | 机器人对自身关节角度、末端位姿的感知 | 闭眼也知道胳膊在哪 |
| **LeRobot 格式** | HuggingFace 推出的机器人数据集标准格式 | 一种统一的"录像文件格式" |

## 详细讲解

### 4.1 五个任务

| 任务 | 考验的能力 | 为什么难 |
|---|---|---|
| 按压泵瓶（Bottle pumping） | 精确的垂直按压 | 压轻了不出液，压重了瓶子倒 |
| 插插头（Plug insertion） | 精确对准 + 受控插入 | 毫米级对准，卡住要会调整 |
| 插 U 盘（USB drive insertion） | 精确对准 + 受控插入 | 比插头更小、更容易插反 |
| 擦白板（Whiteboard wiping） | 平滑轨迹 + 维持表面接触 | 力太小擦不干净，太大板会晃 |
| 削黄瓜（Cucumber peeling） | 持续接触中维持恒定力 | 力随表面曲率变化，要实时调 |

> 💡 要点：这 5 个任务是按"力的类型"挑的——瞬时压力、插入阻力、滑动摩擦、持续切削力——而不是随便挑的日常任务。

### 4.2 采集硬件

| 部件 | 型号 / 参数 |
|---|---|
| 机械臂 | Flexiv Rizon，7 自由度（带关节力矩传感器，可估计末端外力） |
| 夹爪 | 大寰（Dahuan）自适应夹爪 |
| 第三人称相机 | Intel RealSense D435，1280×720，30 FPS，固定位置 |
| 腕部相机 | Intel RealSense D415，640×480，30 FPS，装在末端 |
| 力/力矩 | 由机械臂估计的 TCP 外力（世界坐标系，6 维） |
| 遥操作 | Meta Quest 3 VR 头显，自定义映射到末端控制 |
| 操作员 | 5 位专家操作员 |

> ❓ 待解决：论文没有写明是否另装了独立的六轴 F/T 传感器；从"estimated wrench"的描述看应是机械臂自身估计。换到其他平台时要确认力的来源和坐标系一致。

### 4.3 数据规模与格式

- **规模**：244 条轨迹，约 140,000 个同步时间步；每个任务约 50 条用于微调。
- **图像**：训练时统一缩放到 480×640。
- **动作**：目标 TCP 位姿 + 夹爪宽度（论文表 4 给出 D_action = 32，应含动作块与填充）。
- **控制频率**：论文未说明。

每个时间步大致包含：

```yaml
observation:
  image_third_person: 480x640x3
  image_wrist: 480x640x3
  state: 机器人本体状态（关节角 / 末端位姿 / 夹爪）
  force: [Fx, Fy, Fz, Mx, My, Mz]   # 世界系 TCP 估计外力
action: 目标 TCP 位姿 + 夹爪宽度
language_instruction: "insert the plug into the socket"
```

> ❓ 待解决：以上字段名是根据论文描述推断的；准确字段请以 HuggingFace 数据集 `qiaojunyu/ForceVLA-real-data` 的 `meta/info.json` 为准。

### 4.4 公开情况

- 项目页承诺公开数据与采集/处理脚本；GitHub 仓库 `ft-robotic/ForceVLA` 已上线（Apache-2.0），README 指向 HuggingFace 数据集 `qiaojunyu/ForceVLA-real-data`，使用 **LeRobot 格式**。
- 下载方式见 [06 复现指南](06-reproduction-guide.md)。

### 4.5 与 Open X-Embodiment 的关系

**Open X-Embodiment（OXE）** 是谷歌牵头汇总的大规模跨机器人数据集，π0 等模型的预训练用到了类似的大数据。但 OXE 的绝大多数数据**没有力/力矩通道**，所以：

1. 预训练阶段（学视觉-语言-动作的通用能力）可以靠 OXE 类数据；
2. 力感知能力只能靠 ForceVLA-Data 这类**带力标注的小数据**在微调阶段学到。

这解释了 ForceVLA 的设计：预训练部分不动（晚期融合），只用 244 条带力数据训练新增的 FVLMoE。

> 🔗 关联：[VLA 基础：数据集](../Basic/06-datasets-and-data-collection.md) 介绍 OXE 的结构；[力觉与触觉感知](../Basic/10-force-and-tactile-sensing.md) 讨论在其他机械臂上如何得到同类力数据。

## 动手练习

1. 为"拧瓶盖"任务设计一条数据采集方案：需要哪些传感器、记录哪些字段、如何判定一条轨迹成功。
<details><summary>参考做法</summary>
传感器：腕部相机 + 第三人称相机 + 六轴 F/T（或关节力矩估计）。字段：图像×2、关节角、末端位姿、6 维力、夹爪宽度、指令文本。成功判定：瓶盖旋转角度达到阈值且末端力矩曲线出现"到底"的突变。
</details>

2. 估算：若每个时间步的两张图各约 50 KB（压缩后），140k 步的数据集大约多大？
<details><summary>参考做法</summary>
140,000 × 2 × 50 KB ≈ 14 GB（仅图像），实际 LeRobot 格式用视频编码会小得多。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 用 OXE 微调后模型对力无反应 | OXE 没有力通道 | 必须用带力标注的数据集 |
| 自采数据训练后行为抖动 | 力坐标系与论文不一致（工具系 vs 世界系） | 统一转换为世界系 TCP 外力 |
| 数据加载报字段缺失 | 字段名与 LeRobot `info.json` 不符 | 先读 `meta/info.json` 核对 |

## 小结

- 5 个任务覆盖压、插、擦、削四类接触力模式。
- 硬件：Flexiv Rizon 7 轴臂 + 大寰夹爪 + D435/D415 相机 + Quest 3 遥操作。
- 规模：244 条轨迹、约 14 万时间步，每任务约 50 条用于微调。
- 力来自机械臂估计的世界系 TCP 外力，不是独立传感器。
- OXE 类大数据负责预训练，ForceVLA-Data 负责教会模型"用力"。

## 自测题

1. 数据集有多少条轨迹、多少时间步？
<details><summary>答案</summary>244 条轨迹，约 140,000 个同步时间步。</details>

2. 腕部相机和第三人称相机分别是什么型号、分辨率？
<details><summary>答案</summary>腕部 RealSense D415（640×480，30 FPS）；第三人称 RealSense D435（1280×720，30 FPS）。</details>

3. 为什么不能只用 Open X-Embodiment 训练 ForceVLA？
<details><summary>答案</summary>OXE 几乎没有力/力矩通道，无法让模型学到力感知；需要 ForceVLA-Data 这种带力标注的数据微调 FVLMoE。</details>

## 参考资料

- [ForceVLA 论文 §3 数据集](https://arxiv.org/html/2505.22159v3) —— 任务与硬件描述来源
- [HuggingFace 数据集 qiaojunyu/ForceVLA-real-data](https://huggingface.co/datasets/qiaojunyu/ForceVLA-real-data) —— 实际数据与字段
- [LeRobot 数据集格式文档](https://github.com/huggingface/lerobot) —— 理解 `info.json` 与视频编码
- [Open X-Embodiment](https://robotics-transformer-x.github.io/) —— 大规模跨机器人数据集

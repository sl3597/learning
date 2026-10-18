---
title: 示教器 PolyScope 编程入门
type: tutorial
topic: ur
chapter: 4
level: beginner
tags: [PolyScope, 示教器, Freedrive, 航点, MoveJ, MoveL, 混合半径, TCP]
prerequisites: [02-safety-and-risk-assessment, 03-coordinates-poses-and-tcp]
estimated_time: 60min
sources:
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/move_g5/move_tab_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/BasicProgNodes/commandtab_move_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/BasicProgNodes/commandtab_way_blend.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/BasicProgNodes/commandtab_set_payload_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/installation_g5/installation_TCP_configuration_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/installation_g5/Payload_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/filemanager_g5/program_and_installation_manager_en.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/movej_qa14v105t0r.htm
  - https://github.com/UniversalRobots/Universal_Robots_Client_Library/blob/master/doc/polyscope_compatibility.rst
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# 示教器 PolyScope 编程入门（PolyScope Teach Pendant）

> 不写一行代码，用示教器上的触摸屏"点一点、拖一拖"就能让 UR 机械臂完成抓取-放置。本章带你认识 PolyScope 界面、学会移动机械臂、记录航点、选对运动类型，并把工具和负载设置正确。

## 学习目标

- 能说出 PolyScope 顶栏各标签页的用途。
- 能用 Move 页和自由驱动（Freedrive）移动机械臂并记录航点。
- 能根据任务选择 MoveJ、MoveL 或 MoveP，并合理设置混合半径。
- 能搭出"抓取-放置"小程序，保存为 `.urp` 并重新加载。
- 能在安装设置（Installation）里配置 TCP 和负载，并说明为什么要先配好。

## 前置知识

- 需要先读：[02 安全与风险评估](02-safety-and-risk-assessment.md)、[03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)
- 没有真机：先按 [05 URSim 仿真器](05-ursim-simulator.md) 装好仿真器，本章操作都能在里面完成。

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **示教器（Teach Pendant）** | 连着控制柜的手持触摸屏，带急停按钮 | 机械臂的"遥控器 + 显示器" |
| **PolyScope** | 示教器上的图形界面软件，用来编写和运行程序 | 手机的系统界面 |
| **航点（Waypoint）** | 程序里记录的一个目标位置 | 导航里的途经点 |
| **自由驱动（Freedrive）** | 按住按钮后可以用手直接拖动机械臂 | 手把手教小孩写字 |
| **混合半径（Blend radius）** | 进入航点周围这个半径就开始拐弯，不必停下 | 过路口提前打方向盘，而不是停车再转 |
| **安装设置（Installation）** | 与程序分开保存的机器人配置：TCP、负载、安装角度、安全设置等 | 开车前先调座椅和后视镜 |

## 详细讲解

### 4.1 PolyScope 界面导览

**PolyScope** 是示教器触摸屏上的**图形界面**（GUI，用鼠标/手指点按的界面，而不是敲命令）。官方手册把它分成三块：顶栏（Header）、底栏（Footer）和中间的工作区。

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶栏：运行 | 程序 | 安装设置 | 移动 | I/O | 日志   新建 打开 保存  ☰ │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                 工作区（随所选标签页变化）                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ 底栏：初始化(电源状态)  速度滑块  仿真/真机   ▶ 播放  ⏭ 单步  ■ 停止 │
└──────────────────────────────────────────────────────────────┘
```

| 位置 | 作用 |
|---|---|
| 运行（Run） | 给操作工运行现成程序 |
| 程序（Program） | 左边选节点，中间是程序树，右边配置节点 |
| 安装设置（Installation） | TCP、负载、安装方式、I/O、安全配置 |
| 移动（Move） | 手动移动机械臂、查看位姿 |
| I/O / 日志（Log） | 输入输出状态 / 报错和 `textmsg` 信息 |
| 新建 / 打开 / 保存、☰ | 文件管理；☰ 里是网络、密码、远程控制等系统设置 |

开机后先点底栏左下角的初始化按钮，点 **ON** 上电、再点 **START** 松闸，机械臂才能动。

### 4.2 手动移动：Move 页

Move 页上有两组箭头：上面一组**平移**工具（沿 X/Y/Z 走），下面一组**旋转**工具（绕 TCP 转）。**按住**箭头才会动，松手就停。

- **Feature（参考坐标系）**：Base、Tool 或 View。选 View 并把 3D 视角转得和真机一致，箭头方向最直观。
- **Tool Position**：TCP 在所选坐标系下的位姿，点 Edit pose 可直接输入数值。
- **Joint Position**：逐个关节转动，默认范围 −360°～+360°。

> ⚠️ 注意：真机上按箭头前，确认移动方向无人无障碍，速度滑块调到 30% 以下，另一只手放急停旁。

### 4.3 自由驱动（Freedrive）

按住示教器上的实体 Freedrive 按钮（或 Move 页的 Freedrive 屏幕按钮），机械臂会"变软"，可以用手拖到目标位置；松开立即锁住。带三位使能开关的 **3PE 示教器**操作方式不同：轻按、松开、再轻按并保持。

> ⚠️ 注意：官方手册明确要求——使用 Freedrive 之前，**负载和安装角度必须设置正确**，否则机械臂可能在你松手时下坠或自己漂移。只有风险评估允许时才使用 Freedrive。

在 URSim 仿真器里没有实体可拖，Freedrive 练不了，用 Move 页箭头代替即可。

### 4.4 航点与三种运动类型

程序页 Basic → Move 会同时添加 **Move 节点**（决定怎么走）和**航点**（决定走到哪）。航点分固定（Fixed）、相对（Relative，相对上一点的位移）和变量（Variable，来自程序变量）三种。

| 类型 | 在哪个空间插值 | TCP 走出的轨迹 | 适用场景 |
|---|---|---|---|
| **MoveJ** | 关节空间：各关节同时开始、同时结束 | 一般是**曲线** | 空中转场，通常最快 |
| **MoveL** | 工具空间：TCP 走直线 | **直线** | 接近/离开工件、插入、贴近表面 |
| **MoveP** | 工具空间：恒定速度 + 航点处圆弧混合 | 直线段 + 圆弧拐角，**全程匀速** | 涂胶、点胶、焊缝等工艺路径 |

```text
俯视图：从 A 移到 B

MoveJ（关节插值）             MoveL（直线）              MoveP（多航点匀速）
A ●                          A ●                        A ●────────╮
   ╲                            ╲                                  │ ← 圆弧混合
    ╲__                           ╲                                │
       ╲__                          ╲                     ╭────────╯
          ● B                         ● B                 ╰───────● B
TCP 走弧线，路径不直观          TCP 严格走直线             速度恒定，拐角处圆弧过渡
```

MoveP 下还可以加 **MoveCircle**（经途经点到终点的圆弧）。MoveP 匀速途中不能停下来等 I/O 或人工操作，否则会导致停止。

对应第 6 章的 URScript：MoveJ ≈ `movej(q, a=1.4, v=1.05)`（rad/s²、rad/s），MoveL ≈ `movel(pose, a=1.2, v=0.25)`（m/s²、m/s），括号里是官方默认值。

### 4.5 混合半径（Blend）

不设混合时，机械臂在**每个航点都短暂停下**。给中间航点设混合半径（如 20 mm），机械臂进入该范围就开始过渡到下一段——更快更顺，但**不会精确经过这个航点**。

```text
不混合：   WP1 ──────► WP2(停) ──────► WP3
混合 r：   WP1 ───────╮ (r 范围内开始拐弯)
                      ╰──────────────► WP3      WP2 本身不会被精确到达
```

经验法则：

- 抓取点、放置点**不要**设混合（必须精确到达）；纯粹绕障碍的途经点适合设混合。
- 混合半径相对航点间距太大会报错（如错误码 C171），一般不超过相邻路径段长度的一半。

### 4.6 动手搭一个"抓取-放置"程序

程序树示意（夹爪用工具数字输出 0 控制只是举例，实际取决于你的夹爪型号或其 URCap 插件）：

```text
Robot Program
 ├─ MoveJ
 │   └─ Home                        # 安全起始位姿
 ├─ MoveJ
 │   └─ 抓取上方（混合 r=20mm 可选）  # 在物体正上方 10 cm
 ├─ MoveL
 │   └─ 抓取点                       # 直线下降，不设混合
 ├─ Set  工具数字输出[0] = 开        # 闭合夹爪
 ├─ Wait 0.5 s
 ├─ Set Payload  物体+夹爪           # 夹住后、移动前更新负载
 ├─ MoveL
 │   └─ 抓取上方                     # 直线抬起
 ├─ MoveJ
 │   └─ 放置上方
 ├─ MoveL
 │   └─ 放置点
 ├─ Set  工具数字输出[0] = 关        # 松开夹爪
 ├─ Wait 0.5 s
 ├─ Set Payload  仅夹爪              # 松开后恢复负载
 └─ MoveL
     └─ 放置上方
```

操作步骤：

1. 顶栏 **新建 → 程序**；Basic → **Move**，右侧下拉框选运动类型。
2. 点航点 → Set Waypoint，在 Move 页把机械臂移到位，点 OK 记录；选中航点再点 Basic → **Waypoint** 可追加航点。
3. Basic → **Set** / **Wait** / **Set Payload** 分别控制输出、等待、切换负载。官方建议夹爪闭合后、移动前更新负载。
4. 黄色节点表示配置不完整，全部变白才能运行。

> ⚠️ 注意：真机第一次运行新程序时，速度滑块调到 10%～25%，人站在工作范围外，手放在急停上；可以先用底栏的**单步**逐节点运行。建议先在 [URSim](05-ursim-simulator.md) 里跑通。

### 4.7 保存与加载程序

顶栏 保存… → **Save All** 同时保存程序（`.urp`）和安装设置（`.installation`）；Save Program As… / Save Installation As… 用于另存。打开… → 程序 加载 `.urp` 时，关联的安装设置会一起加载；若安全配置不同，会提示"应用并重启"。

### 4.8 安装设置里配 TCP 和负载

**为什么要先配：** 直线运动、Freedrive 重力补偿、碰撞检测都依赖"末端点在哪、有多重"。配错了轻则轨迹偏，重则频繁保护性停止或 Freedrive 时下坠。

**TCP**（安装设置 → General → TCP）：

- X/Y/Z 是 TCP 相对**法兰中心**的偏移，RX/RY/RZ 是姿态；全为 0 时 TCP 就在法兰中心。
- 新建并命名（如 `gripper_tip`），填入指尖偏移（如 Z = 150 mm），点 **Set as default**。

**负载**（安装设置 → General → Payload）：

- 填质量（kg）和重心 CX/CY/CZ（相对法兰），同样 **Set as default**。
- 不知道重心时用 **Measure** 向导：摆四个尽量不同的姿态自动估算；估算前安装角度要正确，过程中不要碰工具。

**安装角度**（安装设置 → General → Mounting）：告诉控制器重力方向，非地面安装时必须改。

> 🔗 关联：TCP 的含义见 [03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)；脚本里用 `set_tcp`、`set_target_payload` 设置，见 [06 URScript 与网络接口](06-urscript-and-network-interfaces.md)；负载不准会影响力传感读数，见 [09 力传感与 force_mode](09-force-sensing-and-force-mode.md)。

### 4.9 PolyScope 5 与 PolyScope X

| 项目 | PolyScope 5 | PolyScope X |
|---|---|---|
| 软件版本号 | 5.x | 10.x，界面全新设计 |
| 适用硬件 | e-Series、UR Series | e-Series 与 UR Series，但需要 CB5.6 控制柜 |
| Dashboard Server（端口 29999） | 有 | 没有，10.11 起用 Robot API 部分替代 |

据官方 10.13 发行说明，升级 PolyScope X 需更换为 CB5.6 控制柜，且不支持降级。本知识库以 **PolyScope 5** 为准，后续 Dashboard 示例只适用于它。

> ❓ 待解决：PolyScope 5 的 `.urp` 程序能否迁移到 PolyScope X，尚未找到官方说明。

## 动手练习

1. 在 URSim 里用 Move 页把 TCP 沿 Base 的 Z 轴上移约 50 mm。（验收：Tool Position 的 Z 值增加约 50 mm）
<details><summary>参考做法</summary>

Feature 选 Base，按住平移区"向上"箭头，Z 值增加约 50 mm 时松手。选 Tool 时"向上"方向会随工具姿态改变。
</details>

2. 新建程序：一个 MoveL 下放 3 个航点，第 2 个设混合半径 20 mm，运行观察。（验收：机械臂不在第 2 点停顿，拐角变圆弧）
<details><summary>参考做法</summary>

Basic → Move（选 MoveL）记录 Waypoint_1，再用 Basic → Waypoint 追加两个。选 Waypoint_2，把 "Stop at this point" 改为 "Blend with radius"，填 20 mm。相邻点间距要大于 40 mm。
</details>

3. 在安装设置里新建 TCP `gripper_tip`（Z = 150 mm）和 1.0 kg、重心 Z = 60 mm 的负载，设为默认并另存安装设置。（验收：Move 页 Active TCP 显示 `gripper_tip`）
<details><summary>参考做法</summary>

安装设置 → General → TCP → 新建 → Z 填 150 → Set as default；Payload 同理；最后 保存… → Save Installation As…。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 按 Move 箭头机械臂不动 | 机械臂没上电或抱闸没松 | 底栏初始化 → ON → START |
| 运行时报混合重叠 / C171 | 混合半径相对航点间距太大 | 减小半径或拉开航点距离 |
| MoveL 报无法到达或奇异点 | 直线路径经过奇异位形或超出范围 | 改用 MoveJ 转场或调整航点 |
| 频繁保护性停止 | 负载或 TCP 配置错误 | 用 Payload 向导重新测量，核对安装角度 |

## 小结

- PolyScope 顶栏分 运行 / 程序 / 安装设置 / 移动 / I/O / 日志；先初始化（ON → START）才能动。
- Move 页按住箭头移动，Freedrive 用手拖；用 Freedrive 前必须配好负载和安装角度。
- MoveJ 走关节插值（快、轨迹弯），MoveL 走直线，MoveP 匀速走工艺路径；抓放点不混合，途经点可混合。
- 程序存 `.urp`，安装设置存 `.installation`，TCP 和负载在安装设置里配并设为默认。
- PolyScope X（10.x）是新一代软件，没有 Dashboard Server，本知识库以 PolyScope 5 为准。

## 自测题

1. 机械臂从 A 到 B，要求 TCP 走直线插入孔中，应选哪种 Move？为什么？
<details><summary>答案</summary>MoveL，它保证 TCP 走直线；MoveJ 的 TCP 轨迹一般是曲线，可能刮到孔壁。</details>

2. 给抓取点设置 30 mm 的混合半径会有什么后果？
<details><summary>答案</summary>机械臂在距抓取点 30 mm 内就拐向下一段，不会精确到达，夹爪可能夹空或撞到物体。抓放点不应混合。</details>

3. 为什么用 Freedrive 前必须设置正确的负载？
<details><summary>答案</summary>Freedrive 靠动力学模型做重力补偿，负载或安装角度错了，机械臂可能下坠或漂移。</details>

4. 一个程序在另一台机器人上运行时 TCP 位置不对，最可能是哪个文件没一起拷过去？
<details><summary>答案</summary>安装设置文件（`.installation`），TCP、负载、安装角度都存在里面。</details>

## 参考资料

- [PolyScope 5 手册：Move 页](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/move_g5/move_tab_en.htm) —— 控件与 Freedrive 安全要求。
- [PolyScope 5 手册：Move 节点](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/BasicProgNodes/commandtab_move_en.htm) —— 四种运动类型。
- [PolyScope 5 手册：Blending](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/BasicProgNodes/commandtab_way_blend.htm) —— 混合半径。
- [PolyScope 5 手册：TCP 配置](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/installation_g5/installation_TCP_configuration_en.htm) 与 [负载](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/installation_g5/Payload_en.htm) —— 安装设置。
- [PolyScope 5 手册：程序与安装设置管理器](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-usr-man/software/PolyScope/content/filemanager_g5/program_and_installation_manager_en.htm) —— 保存与加载。
- [UR Client Library：PolyScope 版本兼容性](https://github.com/UniversalRobots/Universal_Robots_Client_Library/blob/master/doc/polyscope_compatibility.rst) —— PolyScope X 的差异。
- [UR 学院（Academy）](https://www.universal-robots.com/academy/) —— 官方免费在线课程。

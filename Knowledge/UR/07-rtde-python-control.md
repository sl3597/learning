---
title: RTDE 与 Python 控制：用 ur_rtde 读状态、发运动
type: tutorial
topic: ur
chapter: 7
level: intermediate
tags: [RTDE, ur_rtde, Python, servoL, 实时控制, 控制循环, UR]
prerequisites: [05-ursim-simulator, 06-urscript-and-network-interfaces]
estimated_time: 60min
sources:
  - https://www.universal-robots.com/developer/communication-protocol/rtde/
  - https://docs.universal-robots.com/tutorials/communication-protocol-tutorials/rtde-guide.html
  - https://sdurobotics.gitlab.io/ur_rtde/
  - https://sdurobotics.gitlab.io/ur_rtde/pages/reference/api.html
  - https://sdurobotics.gitlab.io/ur_rtde/pages/getting_started/environment_setup.html
  - https://sdurobotics.gitlab.io/ur_rtde/pages/examples/high_frequency_servoing/servol_example.html
  - https://pypi.org/project/ur-rtde/
  - https://github.com/UniversalRobots/RTDE_Python_Client_Library
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# RTDE 与 Python 控制：用 ur_rtde 读状态、发运动

> 想用自己电脑上的 Python 程序以每秒几百次的频率读取 UR 机械臂的关节角、末端位姿和受力，并实时给它发运动指令？这一章讲 UR 的 RTDE 接口和最常用的 Python 库 ur_rtde。

## 学习目标

- 能说清 RTDE 的端口、recipe，以及 e-Series 与 CB3 的频率差别
- 能判断自己的平台能否直接 `pip install ur_rtde`，不能时知道怎么绕开
- 能用 `RTDEReceiveInterface` 读出关节角、TCP 位姿和力，并说出单位
- 能用 `moveL` 发点到点运动，用 `servoL` + `initPeriod` / `waitPeriod` 写固定频率控制循环并正确收尾
- 能说出官方 RTDE Python Client Library 和 ur_rtde 的区别

## 前置知识

- 需要先读：[05 URSim 仿真器](05-ursim-simulator.md)（本章代码都先在仿真器里跑）、[06 URScript 与网络接口](06-urscript-and-network-interfaces.md)
- 建议读过：[03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)、[12 网络基础](../LinuxCommand/12-networking-basics.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **RTDE**（Real-Time Data Exchange，实时数据交换） | UR 控制器在 30004 端口上提供的 TCP 协议，按固定频率双向同步数据 | 机器人和电脑之间的"定时班车" |
| **recipe**（配方） | 客户端事先声明"我要哪些字段"，之后每个数据包只装这些字段 | 先勾好菜单，之后按时送同样的菜 |
| **输出 / 输入 recipe** | 输出 = 机器人→电脑（状态）；输入 = 电脑→机器人（写寄存器等） | 班车的去程和回程 |
| **ur_rtde** | 南丹麦大学 SDU Robotics 开发的 C++ 库 + Python 绑定，把 RTDE 封装成 `moveL()` 等函数 | 把"写寄存器"翻译成"走直线"的翻译官 |
| **servo 类指令**（servoJ / servoL） | 每个控制周期发一个很近的新目标，机器人连续跟踪 | 骑车时盯着前方一小段路不断微调 |
| **控制周期 dt** | 控制循环每一圈的时间，500 Hz 对应 2 ms | 节拍器的一拍 |

## 详细讲解

### 7.1 为什么需要 RTDE

[06 章](06-urscript-and-network-interfaces.md)讲过，往 30002 / 30003 端口发 URScript 字符串就能让机器人动，但这些接口的频率不保证，也没法做 2 ms 一次的连续跟踪。**RTDE** 专为"高频、定时"设计，UR 官方开发者页面写明它运行在专用端口 **30004**。流程分三步：

1. 连接 30004；
2. 发送 **recipe**：输出 recipe 列出想收的字段（如 `actual_q`），输入 recipe 列出想写的字段（如 `input_double_register_24`）；
3. 开始同步：控制器按设定频率推送状态包，客户端随时写入输入包。

频率上限跟着控制器的实时控制环走：

| 控制器 | RTDE 最高频率 | 一拍时长 |
|---|---|---|
| e-Series（PolyScope 5）/ UR-Series | 500 Hz | 2 ms |
| CB3 / CB3.1 | 125 Hz | 8 ms |

官方 RTDE 指南还写明：协议 v2 的输出频率参数可设为 1~500 Hz。

> 💡 要点：RTDE 只负责"按节拍搬运数据"，不会让机器人动。控制运动需要机器人上运行一段读寄存器、执行运动的 URScript；ur_rtde 会**自动上传**这段脚本，你只管调用 `moveL()`、`servoL()`。

### 7.2 安装 ur_rtde 与平台支持

官方安装方式只有一行：

```bash
pip install ur_rtde
```

能否一行装好，取决于有没有**预编译 wheel**（编译好的安装包；没有时 pip 会下载源码现场编译，需要 Boost、CMake 和 C++ 编译器）。2026-10-18 查询 PyPI，最新版 1.6.5（2026-08-09 发布）：

| 平台 | 1.6.5 有无 wheel | Python 3.9 |
|---|---|---|
| Linux x86_64 / Windows 64 位 | 有，cp37~cp312 | ✅ |
| macOS Intel | 无（最后带 macOS wheel 的是 1.5.9） | 装旧版或源码编译 |
| macOS Apple Silicon（arm64） | 无，历史上也未发布过 | 只能源码编译 |
| Linux aarch64（如 Mac 上的 Ubuntu 虚拟机） | 无 | 只能源码编译 |

> ⚠️ 注意：项目 README 的支持矩阵给 macOS Intel 和 manylinux aarch64 打了 ✅，但 PyPI 上 1.6.5 实际没有这些文件。以 PyPI 为准，可先用 `pip download ur_rtde --no-deps -d ~/demo/whl` 看下到的是 `.whl` 还是 `.tar.gz`。

> ❓ 待解决：Apple Silicon Mac + Python 3.9 上先 `brew install boost` 再源码编译 ur_rtde 能否成功，未实测。官方文档只说 macOS 可以用 brew 装 Boost 后从源码构建。

**给 Mac arm64 + Python 3.9 读者的建议**：首选在 x86_64 Ubuntu 工作站上建虚拟环境运行，通过 [SSH](../LinuxCommand/17-ssh-and-remote.md) 远程写代码；只想读数据、学协议时用 7.7 的官方纯 Python 客户端。不建议在 Mac 上连真机做 500 Hz 控制，macOS 不是实时系统，时序抖动无法控制。

```bash
# 在 Ubuntu x86_64 工作站上
python3 -m venv ~/demo/ur-venv
source ~/demo/ur-venv/bin/activate
pip install --upgrade pip
pip install ur_rtde numpy
python -c "import rtde_receive, rtde_control; print('ok')"
```

```text
# 输出：
ok
```

**机器人端准备**（ur_rtde 官方 Environment Setup 页面）：

- **CB3**：无需特别设置。
- **e-Series（PolyScope 5）**：`RTDEControlInterface` 默认自动上传控制脚本，要求开启**远程控制**（Settings → System → Remote Control，再在示教器右上角切到 Remote）。PolyScope 5.10 及以上还要在 Settings → Security → Services 里启用 RTDE 等服务。
- 不想开远程控制时，可改用 External Control URCap（见 [08 章](08-ros2-driver-and-moveit.md)），构造函数传 `RTDEControl.FLAG_USE_EXT_UR_CAP` 和端口（默认 50002）。

只读数据的 `RTDEReceiveInterface` 不上传脚本，不需要远程控制。

### 7.3 读状态：RTDEReceiveInterface

下面的代码只读不动。`192.168.56.101` 是 ur_rtde 文档中 Docker 版 URSim 的地址，连真机时换成机器人 IP。

```python
# ~/demo/read_state.py
from rtde_receive import RTDEReceiveInterface as RTDEReceive

ROBOT_IP = "192.168.56.101"
rtde_r = RTDEReceive(ROBOT_IP)  # 第二个参数 frequency 默认 -1.0 = 用控制器默认频率

print("控制器运行时间 [s]:", rtde_r.getTimestamp())
print("关节角 q [rad]:", rtde_r.getActualQ())
print("关节速度 qd [rad/s]:", rtde_r.getActualQd())
print("TCP 位姿 [m, rad]:", rtde_r.getActualTCPPose())
print("TCP 力 [N, Nm]:", rtde_r.getActualTCPForce())
print("机器人模式:", rtde_r.getRobotMode(), " 保护性停止:", rtde_r.isProtectiveStopped())
```

```text
# 输出（数值随机器人姿态不同）：
控制器运行时间 [s]: 1234.56
关节角 q [rad]: [0.0, -1.57, 0.0, -1.57, 0.0, 0.0]
...
机器人模式: 7  保护性停止: False
```

| 函数 | 返回 | 单位 / 说明 |
|---|---|---|
| `getActualQ()` | 6 个关节角 | rad |
| `getActualQd()` | 6 个关节速度 | rad/s |
| `getActualTCPPose()` | `[x, y, z, rx, ry, rz]` | 前三个 m，后三个是旋转向量（rad），相对基座坐标系 |
| `getActualTCPForce()` | 6 维广义力 | 官方 API 只写"TCP 处的广义力"；按惯例前三个 N、后三个 Nm，参考系细节见 [09 章](09-force-sensing-and-force-mode.md) |
| `getRobotMode()` | 整数 | 7 = RUNNING，5 = IDLE，3 = POWER_OFF |

> 💡 要点：TCP 位姿的姿态部分是**旋转向量**，不是欧拉角（RPY）。拿去训练 VLA 前通常要转换，见 [07 动作表示](../VLA/Basic/07-action-representation.md)。

### 7.4 发运动：moveJ 与 moveL

> ⚠️ 注意：以下代码会让机械臂运动。① 先在 URSim 里跑通；② 上真机时速度减半、示教器速度滑块调低；③ 确认工作空间无人，一只手放在急停旁；④ 目标用"当前位姿 + 小偏移"计算，不要抄别人的绝对坐标。见 [02 安全与风险评估](02-safety-and-risk-assessment.md)。

官方 API 签名（默认值来自 ur_rtde 1.6.5 API 文档）：

| 函数 | 参数（按顺序） | 默认值 |
|---|---|---|
| `moveJ(q, speed, acceleration, asynchronous)` | 关节角 rad、主导关节速度 rad/s、加速度 rad/s² | 1.05、1.4、False |
| `moveL(pose, speed, acceleration, asynchronous)` | 位姿、工具速度 m/s、加速度 m/s² | 0.25、1.2、False |

默认**阻塞**，到位后才返回；传 `asynchronous=True` 则立刻返回，可用 `stopL()` / `stopJ()` 中途停下。

```python
# ~/demo/move_small.py —— 先上 2 cm，再回原处
from rtde_control import RTDEControlInterface as RTDEControl
from rtde_receive import RTDEReceiveInterface as RTDEReceive

ROBOT_IP = "192.168.56.101"
rtde_c = RTDEControl(ROBOT_IP)   # 连接时会上传控制脚本，e-Series 需处于 Remote 模式
rtde_r = RTDEReceive(ROBOT_IP)

try:
    start = rtde_r.getActualTCPPose()
    up = start[:]
    up[2] += 0.02                  # z 方向 +2 cm
    rtde_c.moveL(up, 0.05, 0.3)    # 5 cm/s，故意比默认值慢
    rtde_c.moveL(start, 0.05, 0.3)
finally:
    rtde_c.stopScript()            # 结束机器人上的控制脚本
```

### 7.5 速度与伺服：speedL 和 servoL

遥操作、轨迹跟踪、部署策略时需要每个周期发一条新指令，这时用：

- `speedL(xd, acceleration=0.25, time=0.0)`：给 TCP 一个速度旋量 `[vx, vy, vz, wx, wy, wz]`（m/s、rad/s），结束用 `speedStop(a=10.0)`。
- `servoL(pose, speed, acceleration, time, lookahead_time, gain)`：给一个**很近的**目标位姿，结束用 `servoStop(a=10.0)`。

`servoL` 参数含义（整理自官方 API 文档）：

| 参数 | 含义 | 官方范围 / 说明 |
|---|---|---|
| `pose` | 目标位姿 `[x, y, z, rx, ry, rz]` | 与当前位姿只差一小步 |
| `speed`、`acceleration` | 当前版本**不使用** | 不能省略，示例填 0.5 |
| `time` | 本条指令控制机器人的时长，函数阻塞这么久 | 通常等于控制周期 dt（500 Hz 时 0.002） |
| `lookahead_time` | 前瞻时间，用来平滑轨迹 | 0.03~0.2 s；越大越平滑但越滞后 |
| `gain` | 跟踪目标位置的比例增益 | 100~2000；越大跟得越紧，也越容易抖 |

类比：`lookahead_time` 像开车时往前看多远，`gain` 像方向盘灵敏度。

> ⚠️ 注意：servo 类是**实时控制**，比 `moveL` 危险：① 第一个目标必须等于或非常接近当前位姿，否则机器人会全力冲过去；② 相邻目标只能差一小步（0.25 m/s 在 500 Hz 下每步仅 0.5 mm）；③ `servoStop()` 和 `stopScript()` 必须写在 `finally` 里，保证崩溃或 Ctrl+C 时也会执行；④ 官方文档提醒 servoL 每周期在机器人内部做逆运动学，目标跳变会导致关节大幅跳动。

### 7.6 固定频率控制循环

`time.sleep()` 不够准。ur_rtde 1.6.5 提供 `initPeriod()`（记下本圈开始时刻）和 `waitPeriod(t_start)`（用"睡眠 + 自旋"补足剩余时间），周期由构造时的频率决定，e-Series 默认 500 Hz。

> ⚠️ 注意：下面的程序让 TCP 在 z 方向做幅度 1 cm、周期 4 秒的上下运动，共 8 秒。只在 URSim 中运行；上真机前先读 [02 安全](02-safety-and-risk-assessment.md) 并减小幅度。

```python
# ~/demo/servo_loop.py
import math
import time
from rtde_control import RTDEControlInterface as RTDEControl
from rtde_receive import RTDEReceiveInterface as RTDEReceive

ROBOT_IP = "192.168.56.101"
dt = 1.0 / 500          # 2 ms，与 e-Series 默认 RTDE 频率一致（CB3 改为 1/125）
lookahead_time = 0.1
gain = 300              # 取官方范围 100~2000 的偏软值
amplitude = 0.01        # 1 cm
period = 4.0            # 秒
duration = 8.0

rtde_c = RTDEControl(ROBOT_IP)
rtde_r = RTDEReceive(ROBOT_IP)

start = rtde_r.getActualTCPPose()   # 从当前位姿出发，第一步几乎为 0
t0 = time.time()
try:
    while time.time() - t0 < duration:
        t_start = rtde_c.initPeriod()
        t = time.time() - t0
        target = start[:]
        target[2] = start[2] + amplitude * math.sin(2 * math.pi * t / period)
        rtde_c.servoL(target, 0.5, 0.5, dt, lookahead_time, gain)
        rtde_c.waitPeriod(t_start)
finally:
    rtde_c.servoStop()
    rtde_c.stopScript()
```

> 🔍 深入：每圈只有 2 ms，垃圾回收、打印、网络抖动都可能超时。官方建议 Linux 实时内核（PREEMPT_RT）并在构造函数设 `rt_priority`；不用也能跑，只是时序精度略差。VLA 推理通常只有几到几十 Hz，常见做法是"低频出动作 + 高频 servo 插值"，见 [10 章](10-vla-data-collection-and-deployment.md)。

### 7.7 替代方案：官方 RTDE Python Client Library

UR 官方维护 [RTDE_Python_Client_Library](https://github.com/UniversalRobots/RTDE_Python_Client_Library)，README 说明兼容 Python 2.7+ 和 3.6+，纯 Python 实现，**Mac arm64 + Python 3.9 可直接用**。

```bash
pip install git+https://github.com/UniversalRobots/RTDE_Python_Client_Library.git@main
```

它直接按协议操作：XML 写 recipe，手动连接、开始同步。官方 `examples/record.py` 的核心流程：

```python
import rtde.rtde as rtde
import rtde.rtde_config as rtde_config

conf = rtde_config.ConfigFile("record_configuration_v2.xml")   # 仓库 examples/ 里自带，内含 <recipe key="out"> 和字段
output_names, output_types = conf.get_recipe("out")

con = rtde.RTDE("192.168.56.101", 30004)
con.connect()
con.get_controller_version()
con.send_output_setup(output_names, output_types, frequency=125)
con.send_start()
state = con.receive()          # 一个数据包，字段按 recipe 名字访问，如 state.actual_q
con.send_pause()
con.disconnect()
```

| 对比项 | ur_rtde | 官方 RTDE Python Client |
|---|---|---|
| 实现 | C++ + Python 绑定 | 纯 Python |
| Mac arm64 / Python 3.9 | 无预编译包 | 直接可用 |
| 读状态 | `getActualQ()` 等现成函数 | 自己写 recipe，按字段名取 |
| 发运动 | `moveL` / `servoL` 等现成函数，自动上传脚本 | 只能写寄存器，需配合示教器上的程序（官方示例 `example_control_loop.py` + `rtde_control_loop.urp`） |
| 适合 | 实际控制、数据采集 | 学协议、只读监控、记录数据 |

## 动手练习

1. **只读监控**：在 URSim 中用 `RTDEReceiveInterface` 以约 10 Hz 打印 5 秒 TCP 位姿，同时在示教器上手动移动机器人。（验收：终端里的 xyz 随你的操作变化，单位是米。）

<details><summary>参考做法</summary>

```python
import time
from rtde_receive import RTDEReceiveInterface as RTDEReceive
r = RTDEReceive("192.168.56.101")
for _ in range(50):
    print([round(v, 4) for v in r.getActualTCPPose()])
    time.sleep(0.1)
```
</details>

2. **安全收尾**：在 7.6 的 `servo_loop.py` 的 `finally` 块里加一行 `print("stopped")`，在 URSim 里运行，中途按 Ctrl+C。（验收：终端打印 `stopped`，仿真机器人平稳停下，示教器上没有残留运行中的程序。）

<details><summary>参考做法</summary>

Ctrl+C 抛出 `KeyboardInterrupt` 后 Python 仍会执行 `finally`：`servoStop()` 以默认 10 m/s² 减速停下，`stopScript()` 结束控制器上的脚本。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `pip install ur_rtde` 报 Boost / CMake 找不到 | 平台无预编译 wheel，转为源码编译 | 换到 Linux x86_64 / Windows，或先装 Boost |
| `RTDEControl(...)` 构造时卡住或报错，`RTDEReceive` 正常 | e-Series 未开远程控制或处于 Local 模式，脚本无法上传 | 开启并切到 Remote，或改用 External Control URCap |
| PolyScope 5.10+ 上连接失败 | Services 中未启用 RTDE 等服务 | 用管理员密码解锁后启用 |
| servoL 时抖动或保护性停止 | 相邻目标跳太大、gain 太高、循环超时 | 减小步长，降低 gain，加大 lookahead_time，循环内不打印 |
| 位姿姿态和示教器的 RPY 对不上 | 返回的是旋转向量 | 用 scipy 等库转换 |

## 小结

- RTDE 走 30004 端口，先发 recipe 再同步数据；e-Series 最高 500 Hz，CB3 125 Hz。
- ur_rtde 分为读接口和控制接口；控制接口自动上传脚本，e-Series 需远程控制或 External Control URCap。
- ur_rtde 1.6.5 只有 Linux x86 和 Windows 的 wheel，Mac arm64 建议改到 x86_64 Linux 工作站运行。
- `servoL` 的 speed / acc 不使用，lookahead 0.03~0.2 s，gain 100~2000；配合 `initPeriod` / `waitPeriod` 做循环，收尾放进 `finally`。
- 官方 RTDE Python Client 是纯 Python，适合读数据和学协议。

## 自测题

1. RTDE 的"输出 recipe"指什么方向的数据？e-Series 和 CB3 的最高频率各是多少？

<details><summary>答案</summary>机器人→客户端的状态数据。e-Series 最高 500 Hz，CB3 为 125 Hz。</details>

2. `servoL(target, 0.5, 0.5, 0.002, 0.1, 300)` 中每个数字分别是什么意思？哪两个实际不起作用？

<details><summary>答案</summary>依次是 speed、acceleration、time（本条指令控制 0.002 s，即一个 500 Hz 周期）、lookahead_time（0.1 s 前瞻平滑）、gain（比例增益 300）。按官方文档，speed 和 acceleration 在当前版本不使用。</details>

3. 为什么 servo 循环的第一个目标要取 `getActualTCPPose()` 的当前值？

<details><summary>答案</summary>servo 会以较高增益尽快靠近目标，第一个目标离当前位姿远就等于让机器人瞬间跳过去，造成剧烈运动甚至危险。从当前位姿出发，第一步位移几乎为 0。</details>

## 参考资料

- [UR 开发者页面：RTDE](https://www.universal-robots.com/developer/communication-protocol/rtde/) —— 30004 端口与三步流程
- [UR 官方 RTDE Guide](https://docs.universal-robots.com/tutorials/communication-protocol-tutorials/rtde-guide.html) —— 协议细节与全部字段名
- [ur_rtde 官方文档](https://sdurobotics.gitlab.io/ur_rtde/) —— 安装、环境准备、示例
- [ur_rtde API 参考](https://sdurobotics.gitlab.io/ur_rtde/pages/reference/api.html) —— 参数、单位、默认值以本页为准
- [ur_rtde 的 PyPI 页面](https://pypi.org/project/ur-rtde/) —— 查看各平台 wheel
- [UniversalRobots/RTDE_Python_Client_Library（GitHub）](https://github.com/UniversalRobots/RTDE_Python_Client_Library) —— 官方纯 Python 客户端

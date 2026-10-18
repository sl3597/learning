---
title: URScript 与网络接口
type: tutorial
topic: ur
chapter: 6
level: intermediate
tags: [URScript, Dashboard Server, 网络接口, socket, Python, RTDE, 端口]
prerequisites: [03-coordinates-poses-and-tcp, 05-ursim-simulator]
estimated_time: 60min
sources:
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/movej_qa14v105t0r.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/movel_posea12v025t.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/set_target_payload.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/Connecting_to_URControl.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-dashboard/Dashboard_table.htm
  - https://www.universal-robots.com/articles/ur/dashboard-server-e-series-port-29999/
  - https://www.universal-robots.com/articles/ur/interface-communication/remote-control-via-tcpip/
  - https://www.universal-robots.com/articles/ur/interface-communication/overview-of-client-interfaces/
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# URScript 与网络接口（URScript & Network Interfaces）

> 示教器上的程序底层都会变成 URScript 脚本。本章教你直接写 URScript，并从电脑通过网络发送脚本和"开机、加载、运行"命令——这是用 Python、ROS 和 VLA 策略控制 UR 的基础。

## 学习目标

- 能写出含 `movej`、`movel`、位姿 `p[...]`、`textmsg`、`sleep` 的 URScript 程序，并说出参数单位。
- 能用 `set_tcp` 和 `set_target_payload` 在脚本里设置工具和负载。
- 能说出 29999、30001～30004 各端口的用途和频率。
- 能用 `nc` 和 Python 向 Dashboard Server 发送 `power on`、`load`、`play` 等命令。
- 能用 Python 把一段 URScript 程序发送到 URSim 并在日志里看到结果。

## 前置知识

- 需要先读：[03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)、[05 URSim 仿真器](05-ursim-simulator.md)（本章所有示例都连接 URSim）
- 建议了解：[12 网络基础](../LinuxCommand/12-networking-basics.md)（IP 与端口）、[15 Shell 脚本基础](../LinuxCommand/15-shell-scripting-basics.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **URScript** | UR 控制器能直接执行的脚本语言，PolyScope 程序最终也会转成它 | 机械臂的"母语" |
| **位姿（pose）** | `p[x, y, z, rx, ry, rz]`：位置（米）+ 旋转向量（弧度） | 门牌号 + 朝向 |
| **socket** | 两台电脑之间的一条 TCP 连接 | 一根拨通的电话线 |
| **Dashboard Server** | 29999 端口的文字指令服务：开机、加载、运行、查询 | 前台总机，不管具体干活 |
| **Primary / Secondary / Real-time 接口** | 30001 / 30002 / 30003 端口：发送机器人状态，也接收 URScript | 广播电台 + 投稿信箱 |
| **RTDE** | 30004 端口的实时数据交换协议，可自定义读写哪些数据 | 按需订阅的数据快递 |

## 详细讲解

### 6.1 URScript 基础语法

URScript 有点像 Python，但每个代码块要以 `end` 结束，程序以 `def 程序名():` 开头：

```python
def hello_ur():
  # 注释用井号
  textmsg("hello from URScript")
  n = 3
  i = 0
  while i < n:
    textmsg("loop i = ", i)
    i = i + 1
  end
  sleep(1.0)
end
```

> 💡 要点：代码块标 `python` 只为高亮，URScript 不是 Python：`def`、`while`、`if` 都要以 `end` 结束，真假值是 `True` / `False`。示例中的中文注释只为讲解，通过网络发送时必须删掉（见 6.6）。

| 语法 | 示例 | 说明 |
|---|---|---|
| 变量 | `speed = 0.1` | 类型由第一次赋值决定 |
| 列表 | `q = [0, -1.57, 1.57, -1.57, -1.57, 0]` | 关节角，6 个数，单位弧度 |
| 位姿 | `target = p[0.4, 0.0, 0.3, 0, 3.14, 0]` | 注意前缀 `p` |
| 函数 | `def add(a, b): ... end` | 可带默认参数，支持命名参数调用 |
| 打印 | `textmsg("value=", 3)` | 两个参数拼接后显示在 PolyScope 日志页 |
| 等待 | `sleep(0.5)` | 单位秒 |
| 角度换算 | `d2r(90)` | 角度转弧度，结果约 1.57 |

### 6.2 运动指令与单位

以下签名和默认值来自官方脚本手册（PolyScope 5.26）：

| 函数 | 签名（默认值） | 参数单位 |
|---|---|---|
| `movej` | `movej(q, a=1.4, v=1.05, t=0, r=0)` | a：rad/s²，v：rad/s，t：秒，r：米 |
| `movel` | `movel(pose, a=1.2, v=0.25, t=0, r=0)` | a：m/s²，v：m/s，t：秒，r：米 |
| `movep` | `movep(pose, a=1.2, v=0.25, r=0)` | 同 movel，匀速工艺运动 |

- `movej` 在关节空间插值，`movel` 让 TCP 走直线，对应第 4 章的 MoveJ / MoveL。
- `movej` 的 `q` 也可以给一个位姿，控制器会用逆运动学算出关节角；`movel` 的 `pose` 也可以给关节角。
- 如果指定了时间 `t`，会忽略 `a` 和 `v`；`r` 是混合半径。
- 位姿 `p[x, y, z, rx, ry, rz]` 位置单位是**米**，姿态是**旋转向量**（弧度），默认在基座坐标系。示教器常显示毫米，记得除以 1000。

> ⚠️ 注意：默认速度对新手偏快（`movel` 默认 250 mm/s）。下文示例都显式写了更小的 `a` 和 `v`。任何让机械臂运动的脚本都先在 URSim 里跑；上真机时把示教器速度滑块调低，人在工作范围外，手放急停旁。

常用的辅助函数：

```python
def move_demo():
  home_q = [0, d2r(-90), d2r(90), d2r(-90), d2r(-90), 0]
  movej(home_q, a=0.5, v=0.3)                  # 关节空间回到一个"Home"姿态
  p0 = get_actual_tcp_pose()                   # 读当前 TCP 位姿（基座坐标系）
  p_up = pose_add(p0, p[0, 0, 0.05, 0, 0, 0])  # 沿基座 Z 向上 5 cm
  movel(p_up, a=0.2, v=0.05)                   # 以 5 cm/s 直线移动
  movel(p0, a=0.2, v=0.05)                     # 回到原位
  textmsg("move_demo done")
end
```

`pose_add` 在基座坐标系下平移；想沿**工具自身**方向移动，用 `pose_trans(p0, p[0, 0, 0.05, 0, 0, 0])`。

> 🔗 关联：位姿与旋转向量的数学含义见 [03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)；VLA 策略输出的末端增量动作如何对应到这些位姿，见 [VLA 动作表示](../VLA/Basic/07-action-representation.md)。

### 6.3 在脚本里设置 TCP 与负载

```python
def tool_setup():
  set_tcp(p[0, 0, 0.15, 0, 0, 0])        # TCP 在法兰 Z 方向 150 mm 处
  set_target_payload(1.0, [0, 0, 0.06])   # 负载 1.0 kg，重心在法兰 Z 方向 60 mm
end
```

- `set_tcp(pose, tcp_name="")`：设置从法兰到 TCP 的变换。
- `set_target_payload(m, cog, inertia=[0, 0, 0, 0, 0, 0], transition_time=0)`：质量 kg、重心 m（相对法兰）、惯量矩阵、过渡时间 s。抓起或放下物体后都要调用；重物可设 `transition_time` 避免"跳一下"。
- 旧函数 `set_payload(m, cog)` 自 5.10 起**弃用**。设置负载时内置力/力矩传感器读数会自动清零。

### 6.4 网络接口总览

UR 控制器在机器人 IP 上开放了多个 TCP 端口（e-Series / PolyScope 5）：

| 端口 | 名称 | 做什么 | 频率 | 能接收 URScript？ |
|---|---|---|---|---|
| 29999 | Dashboard Server | 文本命令：上电、松闸、加载/运行/停止程序、查询状态 | 一问一答 | 否 |
| 30001 | Primary | 发送机器人状态 + 附加消息（如版本、报错文本） | 10 Hz | 是 |
| 30002 | Secondary | 只发送机器人状态 | 10 Hz | 是 |
| 30003 | Real-time | 发送机器人状态（二进制） | 500 Hz（CB3 为 125 Hz） | 是 |
| 30004 | RTDE | 按"配方"订阅/写入自定义数据 | 最高 500 Hz（CB3 为 125 Hz） | 否 |
| 30011～30013 | 只读版 Primary/Secondary/Real-time | 本地模式下也能读状态 | 同上 | 否 |

```text
你的电脑（Python / nc）                         UR 控制器
     │ ── "power on\n" ─────────────────►  29999 Dashboard（开关、加载、运行）
     │ ── "def prog(): ... end\n" ───────►  30002 Secondary（执行脚本）
     │ ◄── 二进制状态包 10 Hz ──────────── 30001 / 30002
     │ ◄── 二进制状态包 500 Hz ─────────── 30003 Real-time
     │ ◄─► 自定义数据（配方）最高 500 Hz ── 30004 RTDE（第 7 章）
```

> 💡 要点：30001～30003 发出的是**二进制**状态包，格式随软件版本变化，不适合自己手工解析。读状态请用 RTDE（第 7 章）；本章只用 30002 来"发脚本"。

如果在 PolyScope 设置里启用了**远程控制**（Remote Control）功能，机器人处于**本地模式**时不接受 URScript，30001～30003 的连接会断开；只读端口 30011～30013 和 RTDE 30004 在两种模式下都能读状态。Dashboard 中部分命令也只在远程模式下可用（见 6.5 表格）。

### 6.5 Dashboard Server（29999）

规则很简单：连上后服务器先回一行欢迎语；之后**每条命令一行、以换行符 `\n` 结尾**，不区分大小写，服务器回一行文本。常用命令（摘自官方表格）：

| 命令 | 成功时返回 | 仅远程模式 | 作用 |
|---|---|---|---|
| `power on` | `Powering on` | 是 | 机械臂上电 |
| `brake release` | `Brake releasing` | 是 | 松开抱闸 |
| `power off` | `Powering off` | 是 | 机械臂断电 |
| `load <文件.urp>` | `Loading program: <文件.urp>` | 是 | 加载程序（连同其安装设置） |
| `play` / `pause` / `stop` | `Starting program` / `Pausing program` / `Stopped` | 是 | 运行 / 暂停 / 停止 |
| `programState` | `STOPPED`、`PLAYING`、`PAUSED` 加程序名 | 否 | 程序状态 |
| `robotmode` | `Robotmode: POWER_OFF` 等 | 否 | 机器人模式（RUNNING 表示已松闸可运动） |
| `safetystatus` | `Safetystatus: NORMAL` 等（5.4.0+） | 否 | 安全状态 |
| `unlock protective stop` | `Protective stop releasing` | 是 | 解除保护性停止（发生后 5 秒内会失败） |
| `get loaded program` | `Loaded program: <路径>` | 否 | 当前加载的程序 |
| `is in remote control` | `true` / `false`（5.6.0+） | 否 | 是否处于远程模式 |
| `quit` | `Disconnected` | 否 | 关闭连接 |

官方说明：从 5.22 起 `power on` 不再顺带松闸，必须先 `power on`、再单独发 `brake release`。

用 `nc` 试一下（只读命令，安全）：

```bash
printf 'PolyscopeVersion\nrobotmode\nsafetystatus\nquit\n' | nc 127.0.0.1 29999
```

```text
# 输出（示例，版本号因镜像而异）：
Connected: Universal Robots Dashboard Server
URSoftware 5.26.x.xxxxx (...)
Robotmode: RUNNING
Safetystatus: NORMAL
Disconnected
```

> ⚠️ 注意：`unlock protective stop` 和 `close safety popup` 在真机上会让本已停下的机械臂恢复可动。官方明确要求先检查保护性停止的原因再解锁；不要在脚本里无条件循环调用。

Python 版最小客户端（只用标准库）：

```python
import socket
import time

ROBOT_IP = "127.0.0.1"   # URSim 本机地址；真机改成示教器里显示的 IP


class Dashboard:
    def __init__(self, host, port=29999):
        self.sock = socket.create_connection((host, port), timeout=10)
        self.f = self.sock.makefile("r", encoding="ascii", newline="\n")
        print("welcome:", self.f.readline().strip())

    def cmd(self, text):
        self.sock.sendall((text + "\n").encode("ascii"))
        reply = self.f.readline().strip()
        print(f"> {text}\n< {reply}")
        return reply

    def close(self):
        self.cmd("quit")
        self.sock.close()


db = Dashboard(ROBOT_IP)
db.cmd("power on")
time.sleep(3)
db.cmd("brake release")
for _ in range(30):                       # 松闸需要几秒，轮询直到 RUNNING
    if "RUNNING" in db.cmd("robotmode"):
        break
    time.sleep(1)
db.cmd("safetystatus")
db.close()
```

加载并运行第 4 章保存的程序（URSim 里程序目录是 `/ursim/programs`）：

```python
db = Dashboard(ROBOT_IP)
db.cmd("load /ursim/programs/hello.urp")
db.cmd("play")
time.sleep(5)
db.cmd("programState")
db.cmd("stop")
db.close()
```

> ❓ 待解决：真机上程序目录的绝对路径，以及 `load` 是否接受相对 programs 目录的文件名，官方 Dashboard 文档没有写明；请先用 `get loaded program` 查看实际路径再照着填写。

### 6.6 用 Python 发送 URScript（30002）

官方手册《Connecting to URControl》规定：脚本以纯文本发送，每行以 `\n` 结尾；第一行必须在**行首**写 `def`（或 `sec`），其余行至少缩进一个空格，最后一行在行首写 `end`；文本只能是扩展 ASCII（**不要在脚本里写中文**，包括注释和 `textmsg`）。手册还建议关闭 socket 前至少读取 79 个字节，否则数据可能在执行前被丢弃。

> ⚠️ 注意：下面的脚本会让机械臂运动。先在 URSim 里运行；上真机前把速度再调低、确认上方 5 cm 内没有障碍物，人站在工作范围外，手放急停旁。

```python
import socket

ROBOT_IP = "127.0.0.1"
SECONDARY_PORT = 30002

SCRIPT = """def py_demo():
  textmsg("py_demo start")
  p0 = get_actual_tcp_pose()
  movel(pose_add(p0, p[0, 0, 0.05, 0, 0, 0]), a=0.2, v=0.05)
  sleep(0.5)
  movel(p0, a=0.2, v=0.05)
  textmsg("py_demo done")
end
"""

with socket.create_connection((ROBOT_IP, SECONDARY_PORT), timeout=5) as s:
    s.sendall(SCRIPT.encode("ascii"))     # 含非 ASCII 字符时这里会直接报错，正好提醒你
    received = 0
    while received < 79:                   # 按手册建议，关闭前至少读 79 字节
        chunk = s.recv(4096)
        if not chunk:
            break
        received += len(chunk)
print("sent, read", received, "bytes of state data")
```

运行后，PolyScope 日志页会出现 `py_demo start` 和 `py_demo done`，TCP 先上升 5 cm 再回来。

> ⚠️ 注意：通过 30002 发送一个新的 `def` 程序，会接管控制器的主程序，正在运行的 PolyScope 程序通常会被中断。不要在别人用示教器运行程序时这样做。

> ❓ 待解决：上述"新脚本会中断正在运行的程序"来自社区经验与驱动实现，官方手册未逐字说明，请在 URSim 中自行验证。

> 🔍 深入：想往**正在运行的程序**里追加语句，可用 30020 端口的解释器模式；`sec` 定义的次级程序可与主程序并行处理 I/O，但不能含 `sleep` 或运动指令。

## 动手练习

1. 用 `nc` 向 URSim 的 Dashboard 依次发送 `robotmode`、`get robot model`、`quit`。（验收：看到机型，比如 `UR5`）
<details><summary>参考做法</summary>

```bash
printf 'robotmode\nget robot model\nquit\n' | nc 127.0.0.1 29999
```
</details>

2. 先在 PolyScope 底部把机械臂断电，然后只用 Python Dashboard 客户端把它上电并松闸。（验收：`robotmode` 返回 `Robotmode: RUNNING`）
<details><summary>参考做法</summary>

运行 6.5 的第一段 Python 代码。若 `brake release` 失败，确认先发了 `power on` 并等了几秒。
</details>

3. 修改 6.6 的脚本：让 TCP 依次沿基座 X、Y 方向各移动 3 cm 再回到原位，并用 `textmsg` 打印每一步。（验收：日志页出现 4 条消息，机械臂回到起点）
<details><summary>参考做法</summary>

```python
SCRIPT = """def square_demo():
  p0 = get_actual_tcp_pose()
  textmsg("step 1: +x")
  movel(pose_add(p0, p[0.03, 0, 0, 0, 0, 0]), a=0.2, v=0.05)
  textmsg("step 2: +x +y")
  movel(pose_add(p0, p[0.03, 0.03, 0, 0, 0, 0]), a=0.2, v=0.05)
  textmsg("step 3: +y")
  movel(pose_add(p0, p[0, 0.03, 0, 0, 0, 0]), a=0.2, v=0.05)
  textmsg("step 4: back")
  movel(p0, a=0.2, v=0.05)
end
"""
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 发送脚本后什么都没发生 | `def`/`end` 没顶格，或其余行没缩进，或最后缺换行 | 按 6.6 的格式检查；确保字符串以 `end\n` 结尾 |
| Python 报 `UnicodeEncodeError` | 脚本里有中文或全角符号 | 只用 ASCII，中文注释写在 Python 里而不是脚本里 |
| Dashboard 返回 `Command is not allowed due to safety reasons, please switch robot to Remote Control mode...` | 已启用远程控制但机器人处于本地模式 | 在示教器右上角切换到远程模式后重连 |
| `brake release` 后 `robotmode` 一直不是 RUNNING | 没先 `power on`，或松闸还没完成 | 先上电，再轮询 `robotmode` |
| `load` 返回 `File not found` | 路径不对 | 用 `get loaded program` 查看实际目录 |
| 机械臂移动方向和预期不同 | 位姿单位写成毫米，或混淆了基座/工具坐标系 | 位置用米；工具方向移动用 `pose_trans` |
| 连接 30001～30003 被断开 | 机器人处于本地模式 | 切到远程模式，或用 30011～30013 / RTDE 读状态 |

## 小结

- URScript 程序以 `def` 开头、`end` 结尾；位姿 `p[...]` 用米和弧度；`movej` 走关节空间，`movel` 走直线，默认速度偏快要手动调低。
- 负载用 `set_target_payload`（`set_payload` 已弃用），TCP 用 `set_tcp`。
- 29999 发文本命令（上电、松闸、加载、运行）；30001/30002 为 10 Hz、30003 为 500 Hz 的状态流，都能收 URScript；30004 是 RTDE。
- 发脚本时只用 ASCII、格式严格，关闭前读至少 79 字节；先在 URSim 里试。
- 5.22 起 `power on` 和 `brake release` 要分两步。

## 自测题

1. `movel(p[0.4, 0, 0.3, 0, 3.14, 0], a=0.2, v=0.05)` 中 0.3 和 0.05 的单位分别是什么？
<details><summary>答案</summary>0.3 是 Z 方向位置，单位米（即 300 mm）；0.05 是工具速度，单位 m/s（即 50 mm/s）。</details>

2. 想以 500 Hz 读取关节角和 TCP 力，应该用哪个接口？为什么不推荐解析 30003？
<details><summary>答案</summary>用 RTDE（30004），可只订阅需要的字段且格式有官方规范；30003 的包格式随版本变化，手工解析易错。</details>

3. 用 Dashboard 让一台刚开机的 e-Series（PolyScope 5.22 以上）进入可运动状态，要发哪些命令？
<details><summary>答案</summary>先 `power on`，等几秒后发 `brake release`，再轮询 `robotmode` 直到返回 `Robotmode: RUNNING`。</details>

4. 下面的脚本发到 30002 后为什么不执行？`"  def demo():\n  textmsg(\"hi\")\n  end\n"`
<details><summary>答案</summary>`def` 和 `end` 前有空格，没从第一列开始，控制器无法识别。</details>

5. `set_payload` 和 `set_target_payload` 应该用哪个？
<details><summary>答案</summary>用 `set_target_payload`。`set_payload` 自 5.10 起已弃用，而且会把惯量矩阵重置。</details>

## 参考资料

- [URScript 手册：movej](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/movej_qa14v105t0r.htm)、[movel](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/movel_posea12v025t.htm) —— 官方签名、默认值与单位。
- [URScript 手册：set_target_payload](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/set_target_payload.htm) —— 负载设置及注意事项。
- [URScript 手册：Connecting to URControl](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-scriptmanual/all_scripts/Connecting_to_URControl.htm) —— 通过 socket 发送脚本的格式要求。
- [Dashboard Server 命令表（PolyScope 5.26）](https://www.universal-robots.com/manuals/EN/HTML/SW5_26/Content/prod-dashboard/Dashboard_table.htm) —— 全部命令、返回值、最低版本。
- [UR 文章：Dashboard Server e-Series](https://www.universal-robots.com/articles/ur/dashboard-server-e-series-port-29999/) —— 解除保护性停止的规则与 PDF 版命令表。
- [UR 文章：Remote Control via TCP/IP](https://www.universal-robots.com/articles/ur/interface-communication/remote-control-via-tcpip/) —— 各端口频率与本地/远程模式的影响。
- [UR 文章：客户端接口总览](https://www.universal-robots.com/articles/ur/interface-communication/overview-of-client-interfaces/) —— 所有接口一览。
- 下一步：[07 RTDE 与 Python 控制](07-rtde-python-control.md)、[08 ROS 2 驱动与 MoveIt 2](08-ros2-driver-and-moveit.md)。

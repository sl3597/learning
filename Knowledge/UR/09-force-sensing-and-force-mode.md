---
title: 力传感与力控模式：读力、恒力下压与对接 ForceVLA
type: tutorial
topic: ur
chapter: 9
level: intermediate
tags: [力传感器, force_mode, 恒力控制, 置零, 负载, ur_rtde, ForceVLA]
prerequisites: [03-coordinates-poses-and-tcp, 05-ursim-simulator, 07-rtde-python-control]
estimated_time: 60min
sources:
  - https://www.universal-robots.com/manuals/latest/en/datasheets/ur3e/
  - https://www.universal-robots.com/manuals/latest/en/datasheets/ur5e/
  - https://www.universal-robots.com/manuals/latest/en/datasheets/ur10e/
  - https://www.universal-robots.com/manuals/latest/en/datasheets/ur16e/
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_24/Content/prod-scriptmanual/all_scripts/force_mode_task_frame_selection_vector.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_24/Content/prod-scriptmanual/all_scripts/get_tcp_force.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_24/Content/prod-scriptmanual/all_scripts/set_target_payload.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_24/Content/prod-scriptmanual/all_scripts/force_mode_set_damping_damping.htm
  - https://www.universal-robots.com/articles/ur/programming/force-mode-performing-motion-using-the-force-mode-compliant-in-a-specific-feature-and-direction/
  - https://docs.universal-robots.com/tutorials/communication-protocol-tutorials/rtde-guide.html
  - https://sdurobotics.gitlab.io/ur_rtde/pages/reference/api.html
  - https://sdurobotics.gitlab.io/ur_rtde/pages/examples/force_torque_control/forcemode_example.html
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# 力传感与力控模式（Force Sensing & Force Mode）

> UR e-Series 手腕里自带力传感器。本章教你读出力、让机械臂用恒力压住桌面擦一擦，再把力信号整理成 ForceVLA 这类模型能用的样子。

## 学习目标

- 能说出自己型号 e-Series 内置力传感器的量程与精度，并判断某个任务的力是否"测得准"
- 能用 URScript 和 ur_rtde 两种方式读出六维力，并正确置零、设置负载
- 能写出 `force_mode` 的五个参数，在 URSim 里跑通"沿 Z 恒力下压 + 沿 X 擦拭"
- 能说出把 UR 力信号接入 ForceVLA 要处理的三件事

## 前置知识

- 需要先读：[03 坐标系、位姿与 TCP](03-coordinates-poses-and-tcp.md)、[05 URSim 仿真器](05-ursim-simulator.md)、[07 RTDE 与 ur_rtde](07-rtde-python-control.md)
- 力觉的通用概念（六维力、阻抗 / 导纳）：[VLA 基础 10 力觉与触觉感知](../VLA/Basic/10-force-and-tactile-sensing.md)
- 安全前提：[02 安全与风险评估](02-safety-and-risk-assessment.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **六维力（wrench）** | 3 个力 Fx/Fy/Fz（N）+ 3 个力矩 TRx/TRy/TRz（Nm） | 手腕同时感觉到"被推"和"被拧" |
| **置零（zero / tare）** | 把当前读数当作零点，之后的读数都减去它 | 电子秤放上空碗后按"去皮" |
| **负载（payload）** | 装在法兰上的工具和工件的质量与重心 | 告诉秤"碗有多重" |
| **力控模式（force mode）** | 某些方向不守位置，改为追目标力 | 擦桌时手"按着"而不是"停在某高度" |
| **选择向量（selection vector）** | 6 个 0/1，1 表示这个方向做力控（柔顺） | 哪几根手指放松 |
| **任务坐标系（task frame）** | 力控的方向参照哪个坐标系来定义 | "向下"是相对地面还是相对手掌 |

## 详细讲解

### 9.1 内置力传感器：先看清量程和精度

e-Series 在工具法兰处内置了**力 / 力矩传感器**，不用另装硬件就能读力、做力控。官方 datasheet 指标：

| 型号 | 力量程 | 力精密度（precision） | 力准确度（accuracy） | 力矩量程 | 力矩精密度 | 力矩准确度 |
|---|---|---|---|---|---|---|
| UR3e | ±30.0 N | ±2.0 N | ±3.5 N | ±10.0 Nm | ±0.1 Nm | ±0.1 Nm |
| UR5e | ±50.0 N | ±3.5 N | ±4.0 N | ±10.0 Nm | ±0.2 Nm | ±0.3 Nm |
| UR10e | ±100.0 N | ±5.0 N | ±5.5 N | ±10.0 Nm | ±0.2 Nm | ±0.5 Nm |
| UR16e | ±160.0 N | ±5.0 N | ±5.5 N | ±10.0 Nm | ±0.2 Nm | ±0.5 Nm |

**精密度**指重复测量的抖动；**准确度**指读数离真值多远。

> 💡 要点：UR5e 力准确度 ±4 N，"轻轻按 2 N"基本做不到，目标力要比准确度大几倍才有意义；需要零点几牛分辨率的任务（如插 USB），内置传感器可能不够。

> ❓ 待解决：datasheet 未写传感器内部采样率（RTDE 最高 500 Hz 输出不等于传感器带宽）；UR15、UR20、UR30 等型号的参数本章未核实。

### 9.2 读力：三个入口

| 入口 | 写法 | 官方说明（摘要） |
|---|---|---|
| URScript | `get_tcp_force()` | 返回 `p[Fx, Fy, Fz, TRx, TRy, TRz]`，在工具法兰处测得，用**基座坐标系的方向**表示 |
| RTDE 输出 | `actual_TCP_force` | "TCP 处的广义力"，已补偿负载产生的力 |
| RTDE 输出 | `ft_raw_wrench` | 原始读数，工具法兰坐标系，**不补偿负载，也不受 `zero_ftsensor()` 影响** |
| ur_rtde | `getActualTCPForce()` / `getFtRawWrench()` | 分别对应上面两个 RTDE 字段 |

先只读、不动机械臂：

```python
import time
import numpy as np
from rtde_receive import RTDEReceiveInterface

ROBOT_IP = "192.168.56.101"          # URSim 地址见 05 章 5.6 节；真机换成机器人 IP
rtde_r = RTDEReceiveInterface(ROBOT_IP, 500.0)   # e-Series 默认就是 500 Hz

samples = []
t0 = time.time()
while time.time() - t0 < 2.0:        # 采 2 秒
    samples.append(rtde_r.getActualTCPForce())
    time.sleep(0.002)
f = np.array(samples)
print("样本数:", len(f))
print("均值:", f.mean(axis=0).round(2))
print("标准差:", f.std(axis=0).round(2))
```

```text
# 输出：（格式示意，具体数值因机器、负载、温度而异）
样本数: 约 1000
均值: [Fx Fy Fz TRx TRy TRz]   ← 无接触时应接近 0，偏得多说明需要置零或负载没设对
标准差: [...]                  ← 反映噪声大小，可与 9.1 的精密度对照
```

> ❓ 待解决：URScript 手册说 `get_tcp_force()` "在工具法兰处测得"，RTDE 指南说 `actual_TCP_force` 是"TCP 处的广义力"，参考点说法不一致（影响力矩），请在你的软件版本上实测。

> ❓ 待解决：URSim 里没有真实接触，力读数的表现（是否恒为 0）本章未核实。

### 9.3 零漂、置零与负载

**零漂**：空载读数也不为 0，还会慢慢变。在**静止、无接触**时调用 `zero_ftsensor()`（ur_rtde：`zeroFtSensor()`）置零。

**负载**：工具的重量会被传感器测到，且随姿态在各轴间变化；控制器按你设置的负载扣掉这部分，所以负载必须设对：

- 在示教器 Installation 里设好 TCP 和负载（见 [04 示教器](04-polyscope-teach-pendant.md)）。
- 抓起 / 放下工件时调用 `set_target_payload(m, cog, inertia, transition_time)`（ur_rtde：`setTargetPayload(mass, cog, inertia)`）更新。手册写明：设置负载会**自动置零**力测量。

> ⚠️ 注意：负载设错不只影响力读数，自由驱动时机械臂也可能自己下坠或上漂。换工具后第一件事就是改负载。

### 9.4 力控模式 force_mode

函数签名（URScript 与 ur_rtde 参数相同）：

```text
URScript:  force_mode(task_frame, selection_vector, wrench, type, limits)
ur_rtde:   rtde_c.forceMode(task_frame, selection_vector, wrench, type, limits)
```

| 参数 | 含义（按官方手册） |
|---|---|
| `task_frame` | 一个位姿，定义力坐标系相对**基座**的位置和朝向 |
| `selection_vector` | 6 个 0/1；1 表示该轴柔顺（做力控） |
| `wrench` | 机器人**施加给环境**的力 / 力矩；只对柔顺轴生效；受安全限制可能偏小 |
| `type` | 1：力坐标系的 y 轴指向"从 TCP 到力坐标系原点"；2：不变换（最常用）；3：x 轴取 TCP 速度在 x-y 平面上的投影 |
| `limits` | 6 个数；柔顺轴上是**最大 TCP 速度**，非柔顺轴上是实际位置与程序位置的**最大允许偏差** |

配套函数：

| URScript | ur_rtde | 作用 |
|---|---|---|
| `end_force_mode()` | `forceModeStop()` | 退出力控（程序停止时也会自动退出） |
| `force_mode_set_damping(damping)` | `forceModeSetDamping(damping)` | 阻尼 0~1，默认 0.005；越大，没有力时减速越快 |
| `force_mode_set_gain_scaling(scaling)` | `forceModeSetGainScaling(scaling)` | 增益缩放 0~2，默认 1；大于 1 碰硬物时可能不稳定 |

阻尼和增益要在进入力控**之前**设置。手册提醒：进入力控前避免沿柔顺轴运动和急减速（建议先 `sleep(0.02)`），力控中避免大加速度。

> ⚠️ 注意：柔顺轴在"空中"没有接触时，机器人会朝目标力方向加速到 `limits` 规定的速度并一直运动——它在"找"那个力。所以下压前 TCP 要贴近表面、柔顺轴速度上限要小，并加"下降超过 N 厘米就停"的保护。

### 9.5 示例：沿 Z 恒力下压并擦桌面

> ⚠️ 注意：以下代码会让机械臂运动并施力。**先在 URSim 里跑通**；上真机时速度和力从更小值开始，手放急停旁，工作区无人；起点在桌面上方约 1 cm，并设一个略低于桌面的安全平面兜底（见 [02 安全](02-safety-and-risk-assessment.md)）。示例假设机器人正装、基座 Z 轴朝上，TCP 和负载已正确设置。

**URScript 版**（擦 10 cm 再擦回来；发送方式见 [06 URScript 与网络接口](06-urscript-and-network-interfaces.md)）：

```python
def wipe_table():
  start = get_actual_tcp_pose()
  sleep(0.02)
  zero_ftsensor()
  # 基座系；只有 Z 柔顺；向 -Z（向下）压 10 N
  force_mode(p[0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0], [0.0, 0.0, -10.0, 0.0, 0.0, 0.0], 2, [0.05, 0.05, 0.02, 0.1, 0.1, 0.1])
  sleep(2.0)
  movel(pose_add(start, p[0.10, 0, 0, 0, 0, 0]), a=0.2, v=0.02)
  movel(start, a=0.2, v=0.02)
  end_force_mode()
  stopl(5.0)
  movel(start, a=0.2, v=0.02)
end
```

`limits` 含义：Z（柔顺）最快 0.02 m/s；X、Y（非柔顺）最多偏离程序路径 5 cm；转轴最多偏离 0.1 rad。力控期间 `movel` 的 Z 分量由力控接管。（代码块借用 python 高亮，URScript 并不是 Python。）

**ur_rtde 版**（只做恒力下压，带超时和下降距离保护；写法参照 ur_rtde 官方 forceMode 示例，每个周期调用一次 `forceMode`）：

```python
import time
from rtde_control import RTDEControlInterface
from rtde_receive import RTDEReceiveInterface

ROBOT_IP = "192.168.56.101"
rtde_c = RTDEControlInterface(ROBOT_IP)
rtde_r = RTDEReceiveInterface(ROBOT_IP)

task_frame = [0, 0, 0, 0, 0, 0]
selection = [0, 0, 1, 0, 0, 0]
wrench = [0, 0, -10.0, 0, 0, 0]          # 向下 10 N（官方示例同样用负 Fz 表示向下）
limits = [0.05, 0.05, 0.02, 0.1, 0.1, 0.1]
MAX_DROP = 0.03                           # 下降超过 3 cm 还没压实就认为下面没东西

z0 = rtde_r.getActualTCPPose()[2]
rtde_c.zeroFtSensor()
time.sleep(0.2)
t0 = time.time()
i = 0
try:
    while time.time() - t0 < 5.0:
        t_cycle = rtde_c.initPeriod()
        rtde_c.forceMode(task_frame, selection, wrench, 2, limits)
        if z0 - rtde_r.getActualTCPPose()[2] > MAX_DROP:
            print("下降超限，停止")
            break
        if i % 100 == 0:
            print("Fz =", round(rtde_r.getActualTCPForce()[2], 2))
        i += 1
        rtde_c.waitPeriod(t_cycle)
finally:
    rtde_c.forceModeStop()
    rtde_c.stopScript()
```

URSim 里没有桌面，预期 TCP 以 ≤0.02 m/s 一直下降直到触发 3 cm 保护。

> ❓ 待解决：按压桌面时 `actual_TCP_force` 的 Fz 读数是正是负（与 `wrench` 的"施加给环境"符号是否相反），请在真机上轻推工具实测后再写进数据管线。

### 9.6 内置传感器还是外置传感器

| 方案 | 量程 / 指标 | 优点 | 缺点 |
|---|---|---|---|
| e-Series 内置 | 见 9.1（UR5e：±50 N，准确度 ±4 N） | 零安装，直接参与 `force_mode`，RTDE 500 Hz 读取 | 小力不准；量程随型号固定，不能换 |
| Robotiq FT 300-S | 产品资料标称 ±300 N / ±30 Nm，数据流 100 Hz | 有 UR 插件（URCap），量程大 | 多一个部件；输出频率低于 RTDE |
| ATI（Mini45、Gamma 等） | 型号多，按量程 / 分辨率选 | 分辨率高，科研常用 | 需采集卡 / 网络盒，自己做驱动和同步 |

外置传感器若要参与 UR 自己的力控，用 `ft_rtde_input_enable(...)` 并通过 RTDE 输入 `external_force_torque` 持续喂数据；只是"记录给模型"的话，用厂商驱动读即可。外置传感器的质量和重心要算进负载。

### 9.7 把 UR 的力接进 ForceVLA 这类模型

ForceVLA 用 Flexiv Rizon 估计的**世界系 TCP 外力**（6 维），见 [ForceVLA 数据集](../VLA/ForceVLA/04-dataset-forcevla-data.md)。换成 UR 要对齐三件事：

1. **频率**：力 500 Hz、相机约 30 Hz、策略约 10 Hz。每个图像帧取最近一个窗口（如 33 ms）的均值，可附加最大值，同 [VLA 10 章 10.6 节](../VLA/Basic/10-force-and-tactile-sensing.md)。
2. **坐标系**：`get_tcp_force()` 用基座方向表示；"世界系"取基座系时方向天然一致。要工具系的力，用当前 TCP 姿态旋转（手册 `get_tcp_force` 条目有示例）。符号见 9.5 的 ❓。
3. **归一化**：力与关节角数值范围差很多，要单独统计；训练前跑 norm stats（见 [ForceVLA 复现指南](../VLA/ForceVLA/06-reproduction-guide.md)），超量程的值截断。

> 💡 要点：Flexiv 的估计外力与 UR 传感器读数特性不同，不要直接混在一起训练，至少分开统计、分开评估。

> 🔗 关联：带力数据的采集与部署见 [10 VLA 数据采集与部署](10-vla-data-collection-and-deployment.md)。

## 动手练习

1. 静止时用 9.2 的脚本采 10 秒，记下均值和标准差；置零后再采一次对比。（验收：说出置零前后均值、标准差各有什么变化。）
<details><summary>参考做法</summary>

先调用 `RTDEControlInterface(ROBOT_IP).zeroFtSensor()` 再跑。均值回到 0 附近，标准差基本不变——置零去不掉噪声。
</details>

2. 在 URSim 里运行 9.5 的 ur_rtde 版，把 Z 的速度上限改成 0.01，记录触发"下降超限"的时间。（验收：约 3 cm ÷ 0.01 m/s = 3 秒，加速过程会让它略长。）
<details><summary>参考做法</summary>

在 `break` 前打印 `time.time() - t0`。明显短于 3 秒时检查 `selection` 和 `limits` 是否写错轴。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 空载 Fz 有好几牛且随姿态变 | 负载没设对 | 重设负载或 `set_target_payload` |
| 进入力控后一直往下走 | 下方无接触面或起点太远 | 起点贴近表面；加下降保护；调小速度上限 |
| 力控时抖动、敲击表面 | 增益过大、阻尼过小或表面太硬 | 增益 ≤1；增大阻尼；降低目标力 |
| 目标 3 N，读数忽大忽小 | 目标力接近传感器准确度 | 提高目标力或换外置传感器 |

## 小结

- e-Series 法兰内置六维力传感器；UR5e 量程 ±50 N、准确度 ±4 N，小力任务先算准不准。
- 读力：`get_tcp_force()`、RTDE `actual_TCP_force`（补偿负载）/ `ft_raw_wrench`（原始），ur_rtde 对应 `getActualTCPForce()` / `getFtRawWrench()`。
- 静止无接触时置零；换工具、抓放工件要更新负载（设置负载会自动置零）。
- `force_mode` 五参数：任务坐标系、选择向量、目标力、类型、限值；空中开力控会持续运动，要加保护。
- 接 ForceVLA：力按窗口对齐到图像帧、统一到基座 / 世界系、单独归一化。

## 自测题

1. UR10e 上想控制 3 N 的接触力，可行吗？为什么？
<details><summary>答案</summary>不太可行。UR10e 力准确度 ±5.5 N，3 N 比误差还小；应提高目标力或换外置传感器。</details>

2. `limits = [0.05, 0.05, 0.02, 0.1, 0.1, 0.1]`、`selection = [0, 0, 1, 0, 0, 0]` 时，0.02 和 0.05 分别是什么意思？
<details><summary>答案</summary>Z 柔顺，0.02 是 Z 向最大速度 0.02 m/s；X、Y 非柔顺，0.05 是允许偏离程序位置的最大距离 0.05 m。</details>

3. `actual_TCP_force` 和 `ft_raw_wrench` 有什么区别？做 VLA 数据采集用哪个？
<details><summary>答案</summary>前者补偿负载、受置零影响；后者是法兰坐标系原始值，两者都不做。采集一般用前者（更接近"外力"），可同时记录后者备查。</details>

## 参考资料

- [UR5e 官方 datasheet](https://www.universal-robots.com/manuals/latest/en/datasheets/ur5e/) —— 力传感器指标出处（其他型号替换网址中的型号）
- [URScript 手册：force_mode](https://www.universal-robots.com/manuals/EN/HTML/SW5_24/Content/prod-scriptmanual/all_scripts/force_mode_task_frame_selection_vector.htm) —— 五个参数的权威定义
- [UR 官方文章：用力控模式做柔顺运动](https://www.universal-robots.com/articles/ur/programming/force-mode-performing-motion-using-the-force-mode-compliant-in-a-specific-feature-and-direction/) —— 示教器生成的力控脚本
- [RTDE 官方指南](https://docs.universal-robots.com/tutorials/communication-protocol-tutorials/rtde-guide.html) —— 力相关字段说明
- [ur_rtde API 参考](https://sdurobotics.gitlab.io/ur_rtde/pages/reference/api.html) 与 [forceMode 示例](https://sdurobotics.gitlab.io/ur_rtde/pages/examples/force_torque_control/forcemode_example.html) —— Python 函数与示例
- [Robotiq FT 300-S 产品手册（PDF）](https://assets.robotiq.com/website-assets/support_documents/document/FT300-S_Sensor_Manual_general_PDF_20210831.pdf) —— 外置传感器参数
- [ATI 六维力传感器产品页](https://www.ati-ia.com/products/ft/sensors.aspx) —— 选型参考

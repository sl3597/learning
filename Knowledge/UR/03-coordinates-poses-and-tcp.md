---
title: 坐标系、位姿表示与 TCP 设置
type: tutorial
topic: ur
chapter: 3
level: beginner
tags: [坐标系, 位姿, 旋转向量, RPY, TCP, 负载, 特征坐标系, URScript]
prerequisites: [01-ur-e-series-hardware]
estimated_time: 50min
sources:
  - https://www.universal-robots.com/manuals/EN/PDF/SW5_24/scriptmanualG5/script_directory_Poly5.pdf
  - https://www.universal-robots.com/manuals/EN/PDF/SW5_23/Poly5_handbook_online/e-Series_Software_Handbook_en_Global.pdf
  - https://www.universal-robots.com/articles/ur/application-installation/explanation-on-robot-orientation/
  - https://docs.ros.org/en/jazzy/p/ur_description/doc/robot_frames.html
  - https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.transform.Rotation.html
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# 坐标系、位姿表示与 TCP 设置

> UR 显示的 `p[0.3, -0.1, 0.2, 2.2, 2.2, 0]` 是什么意思？本章讲坐标系、UR 的位姿写法（旋转向量）与 RPY 的换算，以及为什么 TCP 和负载必须设对。

## 学习目标

- 能说出基座坐标系、工具坐标系、特征坐标系各自的原点在哪里
- 能区分关节空间和笛卡尔空间，并说出 `movej` 与 `movel` 的区别
- 能读懂 UR 位姿的单位和含义，并用 Python 换算旋转向量与 RPY
- 能设置 TCP 和负载，并说出设错的后果

## 前置知识

- 需要先读：[01 UR e-Series 硬件总览](01-ur-e-series-hardware.md)
- 建议了解：[07 动作表示](../VLA/Basic/07-action-representation.md) 中关于旋转表示的部分

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **坐标系**（Frame） | 原点加三根互相垂直的轴 | 以学校大门为原点的地图 |
| **位姿**（Pose） | 位置（3 个数）+ 姿态（3 个数）合起来的 6 个数 | 你站在哪 + 你面朝哪 |
| **TCP**（Tool Center Point，工具中心点） | 工具上真正关心的点，如两指中间 | 笔尖，而不是握笔的手 |
| **关节空间** | 用 6 个关节角描述机械臂 | 告诉别人“肩抬 30°、肘弯 90°” |
| **笛卡尔空间** | 用末端的位置和姿态描述机械臂 | 告诉别人“手放到桌子左上角” |
| **旋转向量**（Rotation Vector，轴角） | 方向 = 旋转轴，长度 = 转角（弧度） | 螺丝朝向 + 拧了多少 |
| **RPY**（Roll-Pitch-Yaw） | 依次绕 X、Y、Z 轴各转一个角 | 飞机的横滚、俯仰、偏航 |
| **负载与重心**（Payload / CoG） | 法兰上挂的东西多重、重心在哪 | 手里拎的包 |

## 详细讲解

### 3.1 UR 的三类坐标系

“往前走 10 厘米”要有参照物：机械臂的前方、夹爪的前方还是桌子的前方？坐标系就是参照物。UR 常用三类：

| 坐标系 | 原点 | 用途 |
|---|---|---|
| **Base（基座坐标系）** | 机械臂底座中心 | 默认参考系，`get_actual_tcp_pose()` 返回值相对它 |
| **Tool（工具坐标系）** | 当前激活 TCP 的中心 | “沿夹爪方向前进”这类动作 |
| **Feature（特征坐标系）** | 用点 / 线 / 平面示教 | 把程序“绑”在桌子、料盘上 |

**特征坐标系**：在 Installation → Features 中用 Point、Line 或 Plane 示教出一个坐标系（如桌面），移动指令可以相对它。桌子挪动后只需重新示教这个特征，相关航点会一起平移。官方建议优先用 Line、Plane，它们由多个点算出，更精确。在 Move 页面切换 Feature，方向箭头的含义也随之切换。

```text
        Z (Base)                       工具法兰
        ↑                              ┌─────┐
        │                              │  ●  │ ← TCP 全为 0 时，就在法兰中心
        │                              └──┬──┘
        └────→ X                          │ Z (Tool)：从法兰指向外
     底座中心 = Base 原点                  ↓
     （右手系，Y 轴朝向以示教器 3D 视图为准）
```

> 🔗 关联：在 ROS 2 驱动中，`base` 坐标系对应 PolyScope 的 Base，而 `base_link` 与它位置相同但绕 Z 轴转了 180°。查询 `tool0` 相对 `base` 的位姿，才与示教器上选 Base 时显示的一致。详见 [08 ROS 2 驱动与 MoveIt](08-ros2-driver-and-moveit.md)。

### 3.2 关节空间 vs 笛卡尔空间

- **关节空间**：`q = [底座, 肩, 肘, 腕1, 腕2, 腕3]`，单位是**弧度**。
- **笛卡尔空间**：末端位姿 `p[x, y, z, rx, ry, rz]`。

两种空间对应两种基本运动指令（URScript 手册中的默认参数）：

| 指令 | 插值空间 | 默认加速度 / 速度 | 轨迹特点 |
|---|---|---|---|
| `movej(q, a=1.4, v=1.05)` | 关节空间 | 1.4 rad/s²，1.05 rad/s | 各关节同时到位，末端走曲线 |
| `movel(pose, a=1.2, v=0.25)` | 工具空间 | 1.2 m/s²，0.25 m/s | 末端走直线 |

同一末端位姿通常对应多组关节角；靠近**奇异位形**（某些方向“使不上劲”的姿态）时关节可能突然高速转动。

> ⚠️ 注意：下面的代码会让机械臂运动。先在 [URSim](05-ursim-simulator.md) 里跑；上真机时速度滑块调到 10% 左右，手放在急停旁，确认工具前方 2 cm 内没有任何东西。

```python
# URScript（在 PolyScope 的 Script 节点或通过 06 章的接口发送）
p_now = get_actual_tcp_pose()                       # 当前 TCP 位姿，相对 Base
q_now = get_actual_joint_positions()                # 当前 6 个关节角（弧度）
textmsg("pose: ", p_now)
p_goal = pose_trans(p_now, p[0, 0, 0.01, 0, 0, 0])  # 沿“工具”Z 轴前进 1 cm
movel(p_goal, a=0.1, v=0.02)                        # 比默认值慢得多
```

`pose_trans(p_from, p_from_to)` 的含义是：先到 `p_from`，再在它的坐标系里移动 `p_from_to`，相当于矩阵乘法 $T_{base \to to} = T_{base \to from} \cdot T_{from \to to}$。所以上面的 1 cm 是沿**工具**方向，而不是沿基座 Z 轴。

### 3.3 UR 的位姿表示：米 + 旋转向量

UR 的位姿写作 `p[x, y, z, rx, ry, rz]`：

- `x, y, z`：位置，URScript 中单位是**米**（PolyScope 界面按公制显示时为毫米）。
- `rx, ry, rz`：**旋转向量**，单位是**弧度**。向量的方向是旋转轴，长度 $\theta = \sqrt{r_x^2 + r_y^2 + r_z^2}$ 是转角。

例如 `p[0.5, 0, 0, 3.14, 0, 0]`：位置在 x = 0.5 m，姿态是绕 X 轴转约 180°。

旋转向量只有 3 个数、没有万向锁，但**不直观**。PolyScope 的 Move 页面可以把姿态显示从 “Rotation Vector [rad]” 切换到 “RPY [°]”。

UR 对 RPY 的定义（URScript 手册 `rotvec2rpy`）：绕**固定的** X、Y、Z 轴依次旋转 roll、pitch、yaw（外旋），等价于绕 Z-Y'-X'' 内旋，矩阵形式为

$$R_{rpy} = R_z(\text{yaw})\,R_y(\text{pitch})\,R_x(\text{roll})$$

URScript 自带换算函数，手册给出的例子：

```python
rotvec2rpy([3.14, 1.57, 0])   # URScript，返回 [-2.80856, -0.16202, 0.9]
rpy2rotvec([3.14, 1.57, 0])   # URScript，返回 [2.22153, 0.00177, -2.21976]
```

**用 Python 换算**（需要先 `pip install scipy`）。SciPy 中**小写** `"xyz"` 表示外旋，正好对应 UR 的 RPY 定义；大写 `"XYZ"` 是内旋，用错了结果会不同：

```python
import numpy as np
from scipy.spatial.transform import Rotation as R

rotvec = [3.14, 1.57, 0.0]                       # UR 位姿的后三个数
rpy = R.from_rotvec(rotvec).as_euler("xyz")      # 小写 xyz = 外旋 = UR 的 RPY
print("RPY (rad):", np.round(rpy, 5))
print("RPY (deg):", np.round(np.degrees(rpy), 2))

back = R.from_euler("xyz", rpy).as_rotvec()      # RPY → 旋转向量
print("rotvec:", np.round(back, 5))

# 把整个 UR 位姿转成 4x4 齐次变换矩阵
def pose_to_matrix(pose):
    T = np.eye(4)
    T[:3, :3] = R.from_rotvec(pose[3:]).as_matrix()
    T[:3, 3] = pose[:3]
    return T

print(pose_to_matrix([0.3, -0.1, 0.2, 0.0, 3.14159, 0.0]).round(3))
```

```text
# 输出（预期；RPY 与 URScript 手册的例子一致，数字的空格排版可能略有不同）：
RPY (rad): [-2.80856 -0.16202  0.9    ]
RPY (deg): [-160.92   -9.28   51.57]
rotvec: [-2.47985 -1.23993  0.     ]
[[-1.     0.     0.     0.3  ]
 [ 0.     1.     0.    -0.1  ]
 [-0.     0.    -1.     0.2  ]
 [ 0.     0.     0.     1.   ]]
```

注意第三行：转回来的旋转向量**不是**原来的 `[3.14, 1.57, 0]`。原向量长度约 3.51 rad，超过了 π；SciPy 总是返回转角在 0~π 之间的写法，于是给出方向相反、转角为 $2\pi - 3.51 \approx 2.77$ rad 的等价向量。两者表示的是**同一个姿态**。

> ⚠️ 注意：同一个姿态可以有不同的写法。例如绕 Y 轴转 180°，旋转向量是 `[0, π, 0]`，换成 RPY 却是 `[π, 0, π]`；转角接近 180° 时，旋转向量还可能在 `r` 和方向相反、长度为 $2\pi - \theta$ 的另一种写法之间跳变。**不要对旋转向量或欧拉角逐分量做平均或插值**，录数据做模型训练时尤其要注意，见 [07 动作表示](../VLA/Basic/07-action-representation.md)。

### 3.4 TCP 设置

TCP 由相对**工具法兰中心**的平移和旋转组成；全为 0 时 TCP 就是法兰中心。设置位置：Installation → General → TCP。

- **手动填写**：按夹爪说明书填。例如夹爪指尖中心在法兰正前方 150 mm，则 TCP 为 `p[0, 0, 0.15, 0, 0, 0]`（Z 轴从法兰指向外）。
- **自动测量位置**：点 Measure，选工作空间里一个固定尖点，从**至少 3 个不同角度**让工具尖端碰到它，系统自动算出 TCP；第 4 个点可用来验证。姿态差异不够大时指示灯会变红。
- **默认 TCP**：可以定义多个 TCP，运行程序前必须把需要的那个设为默认（Set as default）。
- **脚本中切换**：`set_tcp(p[0, 0, 0.15, 0, 0, 0], "gripper")`。

TCP 设对后，直线运动和旋转都以指尖为准；设错了，旋转时指尖会画出圆弧。

### 3.5 负载与重心

在 Installation → General → Payload 中设置**质量、重心（CX、CY、CZ，相对工具法兰）**，可选**惯量矩阵**（不填时按密度 1 g/cm³ 的球体估算）。也可以用 **Payload Estimation 向导**：让机械臂摆 4 个尽量不同的姿态，自动测出质量和重心。

为什么必须设对：

| 设错的后果 | 原因 |
|---|---|
| Freedrive 时机械臂下坠或漂移 | 控制器按错误的重量做重力补偿 |
| 运行中频繁保护性停止（C153、C157） | 实际受力与动力学模型对不上，被判为碰撞 |
| 力传感器读数偏差 | 设置负载时力/力矩读数会自动清零补偿，负载错了补偿也错 |
| 安全限制不准 | 功率限制把负载视为机械臂的一部分 |

**安装方向**告诉控制器重力朝哪，同样必须正确。

脚本中抓起或放下工件时更新负载，用 `set_target_payload`（SW 5.10 起旧的 `set_payload` 已弃用）：

```python
# URScript：抓起 0.5 kg 工件后，总负载 1.4 kg，重心在法兰前方 8 cm
set_target_payload(1.4, [0, 0, 0.08], transition_time=0.5)   # 过渡时间避免机械臂“跳一下”
```

> 🔗 关联：力传感器的置零与力控用法见 [09 力觉与力控](09-force-sensing-and-force-mode.md)。

## 动手练习

1. 用 3.3 节的 Python 代码，把 `p[0.4, 0.1, 0.3, 0, 3.14159, 0]` 的姿态换成 RPY（度），并说明这个姿态的工具朝向。验收标准：结果约为 `[180, 0, 180]`（个别分量可能显示为 −180，是等价写法），并能解释为什么不是 `[0, 180, 0]`。

<details><summary>参考做法</summary>

```python
from scipy.spatial.transform import Rotation as R
import numpy as np
print(np.degrees(R.from_rotvec([0, 3.14159, 0]).as_euler("xyz")))
```

绕 Y 轴转 180° 后工具 Z 轴朝下，是最常见的“垂直向下抓取”姿态。RPY 分解不唯一，SciPy 把 pitch 限制在 ±90° 内，所以给出等价的 `[180, 0, 180]`。

</details>

2. 在 [URSim](05-ursim-simulator.md) 中新建一个 TCP，Z = 150 mm，设为默认，然后在 Move 页面选 Tool 坐标系、按旋转箭头。验收标准：观察到机械臂绕着离法兰 150 mm 的点旋转（蓝色小球不动）。

<details><summary>参考做法</summary>

Installation → General → TCP → 加号新建 → Z 填 150 → Set as default。Move 页面中 TCP 显示为蓝色小球，旋转时它保持原位，法兰绕它转动。

</details>

3. 某夹爪重 0.9 kg，重心在法兰前方 60 mm，指尖中心在法兰前方 145 mm。写出对应的 `set_tcp` 和 `set_target_payload` 语句。

<details><summary>参考做法</summary>

```python
set_tcp(p[0, 0, 0.145, 0, 0, 0], "gripper")
set_target_payload(0.9, [0, 0, 0.06])
```

注意单位是米和千克。

</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 脚本里写 `p[300, 0, 200, ...]`，机械臂报错或乱动 | 把毫米当成了米 | URScript 位置单位是米：`p[0.3, 0, 0.2, ...]` |
| 姿态差得离谱 | 把度数当弧度填进旋转向量 | 用 `d2r()` 或 `np.radians()` 先换算 |
| Python 换算结果与示教器 RPY 对不上 | SciPy 用了大写 `"XYZ"`（内旋） | UR 的 RPY 对应小写 `"xyz"` |
| `movel` 时指尖画弧线 | TCP 没设或没设为默认 | 设置 TCP 并 Set as default |
| Freedrive 时下坠、运行中频繁保护性停止 | 负载、重心或安装方向错误 | 用 Payload Estimation 向导重测，核对安装方向 |

## 小结

- UR 有 Base、Tool、Feature 三类坐标系；Feature 让程序跟着桌子、料盘走。
- 关节空间用 6 个弧度值，笛卡尔空间用 `p[x,y,z,rx,ry,rz]`，位置单位米，姿态是旋转向量（弧度）。
- UR 的 RPY 是绕固定 X-Y-Z 轴的外旋，对应 SciPy 的小写 `"xyz"`；URScript 有 `rotvec2rpy` / `rpy2rotvec`。
- TCP 决定直线运动和旋转以哪个点为准；负载、重心和安装方向决定动力学补偿是否正确。
- 设错 TCP 或负载的典型症状：画弧线、下坠、频繁保护性停止、力读数偏差。

## 自测题

1. 旋转向量 `[0, 0, 1.57]` 表示什么姿态？

<details><summary>答案</summary>绕 Z 轴旋转约 1.57 弧度（90°）。方向 (0,0,1) 是旋转轴，长度 1.57 是转角。</details>

2. `pose_trans(p, p[0,0,0.01,0,0,0])` 和直接把 `p` 的 z 加 0.01，有什么区别？

<details><summary>答案</summary>前者沿位姿 `p` 自身（工具）的 Z 轴移动 1 cm；后者沿基座 Z 轴（竖直向上）移动 1 cm。只有工具 Z 轴恰好与基座 Z 轴同向时两者才相同。</details>

3. 为什么换了一个更重的夹爪后，需要重新设置负载？

<details><summary>答案</summary>控制器用负载做重力补偿和碰撞检测；不更新会导致 Freedrive 下坠、误报碰撞、力读数偏差。</details>

## 参考资料

- [URScript 函数目录 PolyScope 5（SW 5.24，PDF）](https://www.universal-robots.com/manuals/EN/PDF/SW5_24/scriptmanualG5/script_directory_Poly5.pdf) —— `movej`、`movel`、`pose_trans`、`rotvec2rpy`、`set_tcp`、`set_target_payload` 的权威定义
- [PolyScope 5 软件手册 SW 5.23（PDF）](https://www.universal-robots.com/manuals/EN/PDF/SW5_23/Poly5_handbook_online/e-Series_Software_Handbook_en_Global.pdf) —— 第 5 章 TCP、Payload、Mounting、Features，第 6 章 Move 页面
- [Explanation on robot orientation（UR 官方文章）](https://www.universal-robots.com/articles/ur/application-installation/explanation-on-robot-orientation/) —— 旋转向量与 RPY 的区别
- [ur_description Robot Frames（ROS 文档）](https://docs.ros.org/en/jazzy/p/ur_description/doc/robot_frames.html) —— `base`、`base_link`、`tool0` 的关系
- [SciPy Rotation 文档](https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.transform.Rotation.html) —— 外旋 / 内旋的大小写约定

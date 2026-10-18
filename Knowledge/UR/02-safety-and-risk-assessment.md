---
title: UR 安全基础：停止类别、安全配置与风险评估
type: tutorial
topic: ur
chapter: 2
level: beginner
tags: [安全, 急停, 保护性停止, 安全配置, 风险评估, ISO 10218, 协作机器人]
prerequisites: [01-ur-e-series-hardware]
estimated_time: 45min
sources:
  - https://www.universal-robots.com/manuals/EN/PDF/SW5_19/user-manual-UR5e-PDF_online/710-965-00_UR5e_User_Manual_en_Global.pdf
  - https://www.universal-robots.com/manuals/EN/PDF/SW5_23/Poly5_handbook_online/e-Series_Software_Handbook_en_Global.pdf
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_19/Content/prod-usr-man/complianceUR5e/H_g5_sections/safetyFunctionsAndinterfaces/configurable_functions.htm
  - https://www.universal-robots.com/manuals/EN/HTML/SW5_20/Content/prod-usr-man/software/PolyScope/content/safety_g5/Robot_limits_g5_en.htm
  - https://docs.universal-robots.com/tutorials/controlling-robot-externally/stop-recovery.html
  - https://www.universal-robots.com/insights/faq/
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# UR 安全基础：停止类别、安全配置与风险评估

> “协作机械臂”不等于“碰到人也没事”。本章讲 UR 的停止方式、安全配置、风险评估，以及首次上电前的检查。

## 学习目标

- 能说出急停、保护性停止停下后电机是否还带电
- 能解释各类安全限制分别防什么
- 能区分正常模式、缩减模式和恢复模式
- 能说出 ISO 10218 与 ISO/TS 15066 各管什么
- 能按清单完成一次实验室首次上电前的检查

## 前置知识

- 需要先读：[01 UR e-Series 硬件总览](01-ur-e-series-hardware.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **急停**（Emergency Stop） | 红色按钮，按下后受控停下并断电 | 公交车紧急制动拉手 |
| **保护性停止**（Protective Stop，新版手册称 Robot Stop） | 检测到碰撞或接近限制时自动停下，电机保持通电 | 汽车自动刹车，发动机没熄火 |
| **停止类别**（Stop Category 0/1/2） | IEC 60204-1 定义的三种停法 | 拔电源 / 刹车后熄火 / 刹车不熄火 |
| **安全配置**（Safety Configuration） | 密码保护的一组限值，由安全控制器监控 | 汽车限速器 |
| **缩减模式**（Reduced Mode） | 更严格的另一套限值 | 学校门口限速 |
| **恢复模式**（Recovery Mode） | 上电时已违反限制，只允许挪回去 | 车陷沟里先倒出来 |
| **风险评估**（Risk Assessment） | 找出危险、评估、制定降险措施 | 出游前的安全预案 |

## 详细讲解

### 2.1 为什么“协作”不等于“安全”

UR 用户手册写明：机械臂是**部分完成的机械**，应用是否安全取决于末端工具、工件和周围环境。夹爪尖角、搬运的刀具都可能让“协作”机械臂变得危险。协作应用只适用于**整体风险低**的场景；风险评估由**集成方**负责（实验室里往往就是你自己），且必须在**第一次上电之前**完成。

> 💡 要点：安全功能是降险工具，不是免检证明；安全配置的值由风险评估决定。

### 2.2 三种停止类别

UR 按 IEC 60204-1 的定义使用三类停止：

| 类别 | 怎么停 | 停后是否断电 | UR 中什么情况触发 |
|---|---|---|---|
| 类别 0 | 立即切断电源，靠刹车停住 | 断电 | 违反安全限值、安全系统故障；进入缩减模式后仍持续违规 |
| 类别 1 | 先受控减速停下，再断电 | 断电 | 示教器急停、机器人急停输入、系统急停 |
| 类别 2 | 受控停下，保持轨迹 | **不断电** | 安全防护停止（Safeguard Stop）输入、3PE 使能开关松开或按到底；保护性停止同样是停下后保持通电 |

几个容易误解的点：

- **急停不是防护措施。** 手册引用 ISO 12100：急停只是补充措施，不能预防伤害。
- **急停会锁住。** 先查明原因、检查设备，再顺时针旋转复位，然后重新上电。
- **保护性停止**会弹窗显示错误代码（常见 C153 位置偏离路径、C157 关节检测到碰撞），排除原因后才能解锁。官方指出，频繁的保护性停止说明应用有问题或关节硬件故障。

### 2.3 安全配置：给机械臂装“限速器”

安全配置在 Installation → Safety 下，**必须先设置安全密码**才能修改。**机器人限制**可以用滑块选出厂预设，也可以自定义；手册提醒：**滑块的值只是建议，不能代替风险评估。**

| 限制项 | 防的是什么 |
|---|---|
| 功率（Power） | 碰撞时传给人的能量（负载算作机械臂的一部分） |
| 动量（Momentum） | 高速撞击的冲击力 |
| 停止时间 / 停止距离 | 停不住；限得越严，整体速度越慢 |
| 工具 / 肘部速度 | 速度过快 |
| 工具 / 肘部力 | 把人的手夹在机械臂和桌子之间 |

其他安全功能：关节位置与速度限制、**安全平面**（如“工具不准低于桌面”）、工具姿态限制（如“尖头不准朝向操作员”）、安全 I/O（接光栅、门开关、外部急停）。

**三种安全模式**：

- **正常模式**：默认生效。
- **缩减模式**：TCP 越过“触发缩减”平面或某个输入被触发时生效，速度与动量限制必须比正常模式更严；安全系统保证 0.5 秒内进入缩减限值，否则触发类别 0 停止。
- **恢复模式**：上电时已违反某个限制时进入，只用于把机械臂挪回限值内。此时**关节位置、工具位置和工具姿态限制是关闭的**，要格外小心。

修改后要 **Apply → Apply and Restart**，核对弹窗中的全部数值后点 **Confirm Safety Configuration**。右上角的**安全校验和**只随安全配置改变，手册建议每次在机械臂旁工作前看一眼它有没有变。

> ⚠️ 注意：改了安全配置，要在实验室记录里写明改了什么、为什么改、新的校验和。

### 2.4 风险评估：概念与相关标准

| 标准 | 管什么 | 和你的关系 |
|---|---|---|
| ISO 12100 | 通用风险评估方法 | 方法论 |
| ISO 10218-1 | 机器人本体（制造商） | UR e-Series 已通过认证 |
| ISO 10218-2 | 机器人系统与集成 | **你搭的实验台**要满足它 |
| ISO/TS 15066 | 协作应用补充规范 | 协作方式与人体接触的指导 |

ISO/TS 15066 常提到四种协作方式：**安全级监控停止**、**手动引导**、**速度与间隔监控**（人越近越慢）、**功率与力限制**（碰到人时力和能量可接受）。UR 的功率/力/动量限制主要服务于最后一种。

UR 手册要求风险评估覆盖示教调试、维护、正常运行**全部任务**，从**严重度、可能性、能否避开**三方面评估，并列出典型危险：尖角刺伤、撞击、工件掉落或甩出、螺栓松动、搞不清哪个急停管哪台机器、安全参数被设错或擅改。

> ❓ 待解决：UR 官方 FAQ 提到 ISO 10218 已有 2025 修订版；有二手资料称 ISO/TS 15066 的内容已并入 ISO 10218-2:2025。本章未核对标准原文，请以最新版标准为准。

### 2.5 实验室安全清单与首次上电前检查

日常清单：

- [ ] 书面风险评估贴在实验台旁
- [ ] 安全密码只有负责人知道，校验和已记录
- [ ] 人人知道急停在哪，急停在操作员伸手可及处
- [ ] 安全平面防止撞到桌面、墙面、相机支架
- [ ] 新程序先仿真，真机首次运行时速度滑块调低

首次上电前：

1. 机械臂固定牢靠，螺栓拧紧；线缆无破损，供电有接地、漏电保护和可锁定总开关。
2. 安装方向、TCP、负载与实物一致（见 [03 坐标系与 TCP](03-coordinates-poses-and-tcp.md)）。
3. 安全配置已按风险评估设置并确认。
4. 工作范围内无杂物，人员退出可达范围。
5. 测试急停：按下 → 停止并断电 → 复位 → 能重新上电。

## 动手练习

1. 为你的实验台写一份一页纸的风险评估表：至少列出 5 个危险源，每个写出严重度、可能性和降险措施。验收标准：每条措施都能对应到安全配置项、硬件防护或操作规程之一。

<details><summary>参考做法</summary>

| 危险源 | 严重度 | 可能性 | 降险措施 |
|---|---|---|---|
| 手指被夹在工件与桌面之间 | 中 | 中 | 工具力限制；安全平面 |
| 机械臂撞到头部 | 高 | 低 | 速度限制；限制工具高度 |
| 有人误改安全配置 | 高 | 低 | 安全密码；记录校验和 |

</details>

2. 在 [URSim 仿真器](05-ursim-simulator.md) 中修改一个安全限制（例如把工具速度调低），走完 Apply → Apply and Restart → Confirm 的流程，记录前后的安全校验和。验收标准：能说出校验和变化的原因。

<details><summary>参考做法</summary>

设置安全密码 → Installation → Safety → Robot Limits → Custom → 修改 Tool Speed → Apply → 核对弹窗 → Confirm。改完右上角校验和会变化，因为它只由安全配置生成。

</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 进不了安全设置 | 还没设置安全密码 | 菜单 → Settings → Password → Safety，设置后再解锁 |
| 改了安全配置但机器人上不了电 | 没有完成 Apply and Restart 和确认 | 按弹窗核对后点 Confirm Safety Configuration |
| 机械臂整体变得很慢 | 停止时间/停止距离限制设得很严 | 这是预期行为；按风险评估权衡 |
| 频繁保护性停止 | 负载错、路径有障碍、加速度大或关节故障 | 先查负载和路径，仍频繁则联系售后 |

## 小结

- 急停是类别 1（停下再断电）；安全防护停止和保护性停止停下后不断电；违反安全限值触发类别 0。
- 安全配置限制功率、动量、力、速度、停止时间/距离、关节、安全平面和工具姿态，必须设密码。
- 正常模式是默认；缩减模式更严；恢复模式下位置类限制关闭，移动要格外小心。
- 风险评估由集成方在首次上电前完成，方法依据 ISO 12100 和 ISO 10218-2，协作应用参考 ISO/TS 15066。
- 每次在机械臂旁工作前，先看一眼安全校验和。

## 自测题

1. 按下示教器急停后，电机是否还带电？保护性停止呢？

<details><summary>答案</summary>急停是类别 1：受控停下后断电、刹车抱死。保护性停止停下后电机保持通电。</details>

2. 为什么出厂预设滑块不能代替风险评估？

<details><summary>答案</summary>安全与否取决于具体的工具、工件和环境；滑块只是通用建议值。</details>

3. 恢复模式下需要特别注意什么？

<details><summary>答案</summary>此时关节位置、工具位置和姿态限制是关闭的，必须慢速小心地移回限值内。</details>

## 参考资料

- [UR5e 用户手册（PolyScope 5，PDF）](https://www.universal-robots.com/manuals/EN/PDF/SW5_19/user-manual-UR5e-PDF_online/710-965-00_UR5e_User_Manual_en_Global.pdf) —— 停止类别、风险评估、急停
- [PolyScope 5 软件手册 SW 5.23（PDF）](https://www.universal-robots.com/manuals/EN/PDF/SW5_23/Poly5_handbook_online/e-Series_Software_Handbook_en_Global.pdf) —— 安全配置详解
- [Configurable Safety Functions（官方手册页）](https://www.universal-robots.com/manuals/EN/HTML/SW5_19/Content/prod-usr-man/complianceUR5e/H_g5_sections/safetyFunctionsAndinterfaces/configurable_functions.htm) —— 安全功能与安全 I/O 一览
- [Robot Limits（官方手册页）](https://www.universal-robots.com/manuals/EN/HTML/SW5_20/Content/prod-usr-man/software/PolyScope/content/safety_g5/Robot_limits_g5_en.htm) —— 各项限制的定义
- [Stop recovery 教程](https://docs.universal-robots.com/tutorials/controlling-robot-externally/stop-recovery.html) —— 各类停止后如何恢复，见 [06 URScript 与网络接口](06-urscript-and-network-interfaces.md)
- [UR 官方 FAQ](https://www.universal-robots.com/insights/faq/) —— 认证情况与 ISO 10218 修订的说明

---
title: 认识 Linux 与终端
type: tutorial
topic: linux
chapter: 1
level: beginner
tags: [linux, unix, macos, 终端, shell, 入门]
prerequisites: []
estimated_time: 30min
sources:
  - https://linuxcommand.org/lc3_lts0010.php
  - https://missing.csail.mit.edu/2020/course-shell/
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 认识 Linux 与终端（Linux & Terminal）

> 本章回答三个问题：Linux 是什么、终端是什么、为什么学机器人和 AI 必须会它。读完你会敲出人生第一条命令。

## 学习目标

- 能用一句话说清 Linux、Unix、macOS 之间的关系。
- 能在 macOS 上打开终端，并识别出"提示符"。
- 能运行 `echo`、`whoami`、`date` 三条命令并理解输出。
- 能区分"终端"和"shell"两个词。

## 前置知识

- 无。会用鼠标点开一个应用程序即可。

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **操作系统** | 管理硬件、让程序能跑起来的底层软件 | 一栋楼的物业公司 |
| **Linux** | 开源的操作系统内核，服务器世界的主流 | 一种被全世界共同维护的"物业管理方案" |
| **Unix** | 1970 年代诞生的操作系统家族，Linux 和 macOS 都受其影响 | Linux 和 macOS 的"共同祖先" |
| **终端（Terminal）** | 一个显示文字、接收你键盘输入的窗口程序 | 对讲机的外壳和话筒 |
| **Shell** | 终端里真正解释你输入命令的程序（如 zsh、bash） | 对讲机里把你的话翻译给对方的"翻译官" |
| **提示符（Prompt）** | 每行开头那串字符，表示"轮到你输入了" | 对方说"请讲" |

## 详细讲解

### 1.1 Linux、Unix、macOS 是什么关系

**Unix** 是 1970 年代贝尔实验室开发的操作系统，它确立了"一切皆文件""小工具组合"等设计思想。后来出现了两条重要分支：

- **Linux**：1991 年 Linus Torvalds 写的开源内核，加上 GNU 工具就成了完整系统。常见的"发行版"（把内核和软件打包好的版本）有 **Ubuntu**、Debian、CentOS 等。几乎所有云服务器、GPU 训练机、机器人控制器都跑 Linux。
- **macOS**：苹果的系统，底层是经过 Unix 认证的 Darwin。所以 macOS 的终端里大部分命令和 Linux 一模一样。

> 💡 要点：你在 Mac 上学的终端命令，90% 可以直接搬到 Ubuntu 服务器上用。本教程会在有差异的地方单独标注。

### 1.2 为什么做 AI / 机器人必须会命令行

- 训练模型的服务器通常没有图形界面，只能靠命令行操作。
- 机器人上的控制程序、ROS、日志，全部通过命令行启动和查看。
- 批量处理数据（上千个文件改名、筛选）用图形界面要点一天，命令行只要一行。

### 1.3 打开终端

**macOS**：按 `Command + 空格`，输入 `Terminal`（或"终端"），回车。也可以在"应用程序 → 实用工具 → 终端"找到。推荐额外安装 iTerm2，但系统自带的够用。

**Ubuntu 桌面版**：按 `Ctrl + Alt + T`。

打开后你会看到类似这样的一行：

```text
sde@MacBook-Pro ~ %
```

这就是**提示符**。它通常包含：用户名（`sde`）、机器名（`MacBook-Pro`）、当前目录（`~` 表示家目录）、结尾符号（zsh 用 `%`，bash 用 `$`，管理员 root 用 `#`）。

### 1.4 终端 vs Shell

很多人把两者混用，但它们不同：

- **终端**是"窗口"，负责显示文字和接收按键。
- **Shell** 是跑在窗口里的"解释程序"，读懂你的命令并执行。

macOS 从 Catalina 起默认 shell 是 **zsh**；多数 Linux 服务器默认是 **bash**。两者语法 95% 相同。查看你当前用的 shell：

```bash
echo $SHELL
```

```text
# 输出：
/bin/zsh
```

### 1.5 第一条命令

在提示符后输入下面的命令，每行按一次回车：

```bash
echo "Hello, Linux"
whoami
date
```

```text
# 输出（示例）：
Hello, Linux
sde
Fri Oct 17 22:40:12 CST 2026
```

- `echo` 把后面的文字原样打印出来——它是以后调试脚本最常用的命令。
- `whoami` 显示当前登录用户名。
- `date` 显示当前日期时间。

> ⚠️ 注意：命令对大小写敏感。`Date`、`DATE` 都会报 `command not found`。

### 1.6 命令出错了怎么办

看到 `command not found`，先检查拼写和大小写；看到 `Permission denied`，说明没有权限，这会在 [07 权限与用户](07-permissions-and-users.md) 里讲。记住一个原则：**错误信息是朋友，一定要读完它**。

## 动手练习

1. 打开终端，用 `echo` 打印你的名字和今天的日期（两行）。
<details><summary>参考做法</summary>

```bash
echo "我是 Katrina"
date
```
</details>

2. 运行 `echo $SHELL`，判断你用的是 zsh 还是 bash，再运行 `uname -a` 看看系统信息，找出其中的系统名称（Darwin 或 Linux）。
<details><summary>参考做法</summary>

```bash
echo $SHELL
uname -a
```
macOS 输出以 `Darwin` 开头，Ubuntu 输出以 `Linux` 开头。
</details>

3. 故意输错一条命令（比如 `dat`），阅读完整的错误信息，再改正。
<details><summary>参考做法</summary>

```bash
dat
# zsh: command not found: dat
date
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `command not found` | 拼写错误 / 大小写错误 / 程序未安装 | 检查拼写；用 `which 命令名` 确认是否存在 |
| 输入后没有任何反应 | 命令在等待更多输入（例如少了引号） | 按 `Ctrl + C` 取消，重新输入 |
| 提示符结尾是 `#` | 你正在以 root（最高权限）身份操作 | 新手阶段尽量退出 root，输入 `exit` |

## 小结

- Linux 是开源内核，Ubuntu 等发行版是完整系统；macOS 与 Linux 同属 Unix 家族，命令高度相似。
- 终端是窗口，shell 是解释命令的程序；macOS 默认 zsh，Linux 常用 bash。
- 提示符出现表示可以输入；命令大小写敏感。
- `echo`、`whoami`、`date` 是最安全的三条入门命令。
- 读完整的错误信息是排错第一步。

## 自测题

1. macOS 的终端命令为什么和 Linux 大部分相同？
<details><summary>答案</summary>因为 macOS 底层 Darwin 是 Unix 系统，Linux 也遵循 Unix 的设计与命令规范，两者有共同祖先。</details>

2. "终端"和"shell"分别指什么？
<details><summary>答案</summary>终端是显示文字、接收输入的窗口程序；shell 是运行在终端中、解释并执行命令的程序，如 zsh、bash。</details>

3. 提示符结尾的 `%`、`$`、`#` 分别暗示什么？
<details><summary>答案</summary>`%` 通常是 zsh 普通用户，`$` 是 bash 普通用户，`#` 表示当前是 root 超级用户。</details>

4. 输入 `Echo hi` 会发生什么？
<details><summary>答案</summary>报 `command not found`，因为命令区分大小写，正确写法是 `echo hi`。</details>

## 参考资料

- [The Linux Command Line – What Is the Shell?](https://linuxcommand.org/lc3_lts0010.php) —— 经典免费教材的第一章，图文并茂。
- [MIT Missing Semester – The Shell](https://missing.csail.mit.edu/2020/course-shell/) —— 面向程序员的"缺失的一课"，有视频。
- [Ubuntu 官方终端入门](https://ubuntu.com/tutorials/command-line-for-beginners) —— Ubuntu 视角的入门教程。

---
title: 文件系统导航
type: tutorial
topic: linux
chapter: 3
level: beginner
tags: [文件系统, 路径, pwd, cd, ls, 目录树, 隐藏文件]
prerequisites: [02-shell-basics]
estimated_time: 40min
sources:
  - https://linuxcommand.org/lc3_lts0020.php
  - https://man7.org/linux/man-pages/man7/hier.7.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 文件系统导航（Filesystem Navigation）

> 终端里没有"双击文件夹"，你要靠路径告诉电脑你在哪、要去哪。本章解决"我在哪、这里有什么、怎么去别处"三个问题。

## 学习目标

- 能画出 Linux 目录树的顶层结构，并说出 `/home`、`/etc`、`/tmp` 的用途。
- 能区分绝对路径和相对路径，并正确使用 `~`、`.`、`..`。
- 能用 `pwd`、`cd`、`ls` 及其常用选项在任意目录间移动和查看。
- 能查看隐藏文件。

## 前置知识

- 需要先读：[02 Shell 基础](02-shell-basics.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **根目录 `/`** | 整个文件系统的起点，所有东西都挂在它下面 | 一棵树的树根 |
| **家目录 `~`** | 属于当前用户的私人目录 | 你自己的房间 |
| **绝对路径** | 从 `/` 开始写的完整地址 | "中国上海市浦东新区 XX 路 1 号" |
| **相对路径** | 相对于当前位置的地址 | "往前走两个路口左转" |
| **工作目录** | 你当前"站着"的目录 | 你现在所处的房间 |
| **隐藏文件** | 以 `.` 开头的文件，默认不显示 | 衣柜里的抽屉 |

## 详细讲解

### 3.1 目录树长什么样

Linux 没有 C 盘 D 盘，只有一棵从 `/` 开始的树：

```text
/
├── bin/     # 基本命令程序（ls、cp 等）
├── etc/     # 系统配置文件
├── home/    # 普通用户的家目录（Linux）；macOS 对应 /Users
├── root/    # root 用户的家目录
├── tmp/     # 临时文件，重启可能清空
├── usr/     # 用户安装的程序和库
├── var/     # 日志、缓存等经常变化的数据
└── dev/     # 设备文件（硬盘、USB、机械臂串口都在这）
```

> 🔗 关联：机器人通过串口通信时，设备常以 `/dev/ttyUSB0` 这类文件出现，部署细节见 [VLA 基础：评估与部署](../VLA/Basic/09-evaluation-and-deployment.md)。

### 3.2 我在哪：pwd

```bash
pwd
```

```text
# 输出：
/Users/sde
```

`pwd` = print working directory，打印当前工作目录。

### 3.3 这里有什么：ls

```bash
ls            # 简单列出
ls -l         # 详细信息：权限、大小、时间
ls -a         # 包含隐藏文件
ls -lh        # 大小用 K/M/G 显示（human readable）
ls -la ~/Desktop   # 列出指定目录
```

`-l` 输出每行的含义会在 [07 权限与用户](07-permissions-and-users.md) 详细解释。

### 3.4 去别处：cd

```bash
cd /tmp           # 绝对路径
cd Desktop        # 相对路径：进入当前目录下的 Desktop
cd ..             # 回上一级
cd ../..          # 回上两级
cd ~              # 回家目录
cd                # 同上，不带参数也是回家
cd -              # 回到上一次所在的目录（来回切换很方便）
```

### 3.5 三个特殊符号

| 符号 | 含义 | 示例 |
|---|---|---|
| `.` | 当前目录 | `./run.sh` 执行当前目录下的脚本 |
| `..` | 上一级目录 | `cd ..` |
| `~` | 家目录 | `cd ~/Desktop/Learning` |

绝对路径以 `/` 开头，永远唯一；相对路径不以 `/` 开头，取决于你现在在哪。

```bash
cd ~/Desktop
cd Learning/LinuxCommand    # 相对：从 Desktop 出发
pwd                         # /Users/sde/Desktop/Learning/LinuxCommand
cd /Users/sde/Desktop/Learning/LinuxCommand   # 绝对：等价
```

> 💡 要点：写脚本时尽量用绝对路径或基于 `~` 的路径，避免"换个目录运行就找不到文件"。

### 3.6 隐藏文件

以 `.` 开头的文件和目录默认不显示，多为配置文件，例如 `~/.zshrc`、`~/.ssh/`。用 `ls -a` 查看。

### 3.7 macOS 与 Linux 的差别

| 项目 | macOS | Linux |
|---|---|---|
| 家目录位置 | `/Users/用户名` | `/home/用户名` |
| 桌面 | `~/Desktop` | `~/Desktop`（有桌面环境时） |
| 文件名大小写 | 默认不区分（但保留大小写） | 区分（`A.txt` 和 `a.txt` 是两个文件） |

> ⚠️ 注意：在 Mac 上能跑的脚本，搬到服务器后可能因为大小写不一致而找不到文件。

## 动手练习

1. 从家目录出发，只用相对路径进入 `Desktop/Learning`，再用一条命令回到家目录。
<details><summary>参考做法</summary>

```bash
cd ~
cd Desktop/Learning
cd
```
</details>

2. 在 `/etc` 目录中用 `ls -lh` 查看，找出最大的一个文件（先看看，不用改）。然后用 `cd -` 回到之前的目录。
<details><summary>参考做法</summary>

```bash
cd /etc
ls -lhS | head      # -S 按大小排序（head 见第 5 章）
cd -
```
</details>

3. 在家目录列出所有隐藏文件，找出 `.zshrc` 是否存在。
<details><summary>参考做法</summary>

```bash
ls -a ~ | grep zshrc
```
没有也正常，后面章节会创建它。
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `cd: no such file or directory` | 路径拼错，或当前位置不对导致相对路径失效 | 先 `pwd` 确认位置，再用 Tab 补全路径 |
| `ls` 看不到配置文件 | 隐藏文件默认不显示 | `ls -a` |
| `cd Desktop` 报错但目录明明存在 | 当前不在家目录 | `cd ~/Desktop` |
| 在服务器上找不到 `/Users` | Linux 家目录在 `/home` | `cd ~` 即可 |

## 小结

- 一切从 `/` 开始；用户文件在 `~`（macOS 是 `/Users/名`，Linux 是 `/home/名`）。
- `pwd` 看位置，`ls` 看内容，`cd` 移动。
- `.` 当前、`..` 上级、`~` 家、`cd -` 回上次。
- 绝对路径以 `/` 开头、全局唯一；相对路径依赖当前位置。
- `ls -a` 看隐藏文件。

## 自测题

1. 当前在 `/home/alice/projects`，执行 `cd ../../bob` 后在哪？
<details><summary>答案</summary>`/home/bob`。两次 `..` 到 `/home`，再进入 `bob`。</details>

2. `~/.ssh` 这个路径里，`~` 和 `.` 分别表示什么？
<details><summary>答案</summary>`~` 是家目录；`.ssh` 的 `.` 使其成为隐藏目录（不是"当前目录"的意思）。</details>

3. `ls -lh` 比 `ls -l` 多了什么？
<details><summary>答案</summary>文件大小以 K、M、G 等人类可读单位显示。</details>

4. 为什么同一个脚本在 Mac 上能找到 `Data.csv`，在 Ubuntu 上却报找不到？
<details><summary>答案</summary>Linux 区分大小写，实际文件可能叫 `data.csv`；macOS 默认不区分所以能找到。</details>

## 参考资料

- [The Linux Command Line – Navigation](https://linuxcommand.org/lc3_lts0020.php) —— 配图讲解目录树。
- [hier(7) 文件系统层次手册](https://man7.org/linux/man-pages/man7/hier.7.html) —— 每个顶层目录的官方定义。
- [Filesystem Hierarchy Standard](https://refspecs.linuxfoundation.org/fhs.shtml) —— Linux 目录结构标准。

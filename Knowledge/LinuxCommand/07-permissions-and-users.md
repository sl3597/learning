---
title: 权限与用户
type: tutorial
topic: linux
chapter: 7
level: beginner
tags: [权限, chmod, chown, sudo, 用户, 组, ls -l]
prerequisites: [06-finding-things]
estimated_time: 50min
sources:
  - https://man7.org/linux/man-pages/man1/chmod.1.html
  - https://linuxcommand.org/lc3_lts0090.php
  - https://help.ubuntu.com/community/FilePermissions
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 权限与用户（Permissions & Users）

> `Permission denied` 是新手遇到最多的报错。本章让你读懂 `ls -l` 那串 `-rwxr-xr--`，并学会用 `chmod`、`chown`、`sudo` 正确地解决权限问题——而不是一律 `777`。

## 学习目标

- 能逐位解释 `ls -l` 输出中的权限字符串。
- 能用数字法（`755`）和符号法（`u+x`）修改权限。
- 能用 `chown` 更改文件所有者，用 `sudo` 临时获得管理员权限。
- 能说出为什么 `chmod 777` 是坏习惯，并给出正确替代。

## 前置知识

- 需要先读：[06 查找文件与内容](06-finding-things.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **用户（user）** | 登录系统的账号 | 住户 |
| **组（group）** | 一批用户的集合，方便统一授权 | 同一层楼的住户 |
| **root** | 超级用户，拥有一切权限 | 物业经理，有万能钥匙 |
| **r / w / x** | 读 / 写 / 执行三种权限 | 看 / 改 / 运行 |
| **sudo** | 以 root 身份执行一条命令 | 临时借用万能钥匙 |
| **chmod / chown** | 改权限 / 改所有者 | 换锁 / 过户 |

## 详细讲解

### 7.1 读懂 ls -l

```bash
mkdir -p ~/demo && cd ~/demo
touch script.sh && mkdir data
ls -l
```

```text
# 输出：
drwxr-xr-x  2 sde  staff   64 Oct 17 22:00 data
-rw-r--r--  1 sde  staff    0 Oct 17 22:00 script.sh
```

拆解第一列 `-rw-r--r--`（共 10 个字符）：

```text
 -    rw-    r--    r--
 │     │      │      │
类型  所有者   组    其他人
```

- 第 1 位：`-` 普通文件，`d` 目录，`l` 符号链接。
- 之后每 3 位一组，分别是**所有者（u）**、**所属组（g）**、**其他人（o）**的权限。
- 每组三位依次为 `r`（读）、`w`（写）、`x`（执行），`-` 表示没有。

后面几列：链接数、所有者 `sde`、组 `staff`、大小、修改时间、文件名。

对目录来说：`r` 能列出内容、`w` 能新建删除文件、`x` 能进入（`cd`）。

### 7.2 数字法：每组权限是一个数字

| 权限 | 二进制 | 数字 |
|---|---|---|
| `---` | 000 | 0 |
| `--x` | 001 | 1 |
| `-w-` | 010 | 2 |
| `-wx` | 011 | 3 |
| `r--` | 100 | 4 |
| `r-x` | 101 | 5 |
| `rw-` | 110 | 6 |
| `rwx` | 111 | 7 |

记忆：r=4，w=2，x=1，相加。

```bash
chmod 755 script.sh   # rwxr-xr-x：自己全权，别人可读可执行（脚本常用）
chmod 644 config.txt  # rw-r--r--：自己可改，别人只读（普通文件默认）
chmod 600 id_rsa      # rw-------：只有自己能读写（私钥必须这样）
chmod 700 ~/.ssh      # rwx------：私密目录
```

### 7.3 符号法：增减某一位

格式：`chmod [ugoa][+-=][rwx] 文件`

```bash
chmod u+x script.sh     # 给所有者加执行权限（让脚本能运行，最常用）
chmod g-w data          # 去掉组的写权限
chmod o=r file.txt      # 其他人设为只读
chmod a+r file.txt      # 所有人加读（a = all）
chmod -R 755 project/   # -R 递归作用于目录内所有内容
```

> 💡 要点：写完一个 `.sh` 脚本不能运行，99% 是缺 `x`，`chmod +x 脚本名` 即可。

### 7.4 为什么不能 chmod 777

```bash
chmod -R 777 /some/dir
```

> ⚠️ 注意：`777` 意味着**任何人都能读、改、执行**。在多用户服务器上，别人可以篡改你的脚本并以你的身份运行；SSH 甚至会拒绝使用权限过宽的私钥。遇到 `Permission denied` 时正确思路是：搞清楚"谁需要什么权限"，然后只给那一点。

### 7.5 所有者与组：chown / chgrp

```bash
sudo chown alice file.txt          # 所有者改为 alice
sudo chown alice:dev file.txt      # 所有者 alice，组 dev
sudo chown -R $USER:$USER ~/data   # 把目录收回给自己（从 root 创建的文件常需要）
id                                 # 查看自己的用户 ID 和所属组
groups                             # 查看自己所在的组
```

### 7.6 sudo：借一下管理员权限

```bash
sudo apt update          # 以 root 身份执行
sudo -i                  # 进入 root 交互 shell（提示符变 #），exit 退出
sudo !!                  # 用 root 重跑上一条命令
```

规则：

- 输入的是**你自己的密码**，且屏幕不会显示星号。
- 只在必要时用 `sudo`，不要把 `sudo` 当前缀习惯性地加在每条命令前。
- 用 `sudo` 创建的文件属于 root，之后自己可能无法修改——需要 `chown` 收回。

macOS 同样有 `sudo`，但系统目录受 SIP（系统完整性保护）限制，即使 root 也不能随意改 `/System`。

### 7.7 用户管理（Linux 服务器）

```bash
sudo adduser bob                 # 新建用户（Ubuntu）
sudo usermod -aG sudo bob        # 把 bob 加进 sudo 组，使其能用 sudo
sudo usermod -aG dialout $USER   # 常见：加入 dialout 组才能访问串口 /dev/ttyUSB0
sudo passwd bob                  # 改密码
sudo deluser bob                 # 删除用户
```

> 🔗 关联：访问机械臂、力传感器等 USB/串口设备时，`Permission denied` 的标准解法就是把用户加入 `dialout` 组并**重新登录**，部署细节见 [VLA 基础：评估与部署](../VLA/Basic/09-evaluation-and-deployment.md)。

## 动手练习

1. 创建 `hello.sh`，内容是 `echo hello`，尝试 `./hello.sh` 运行，观察报错，然后修复它。
<details><summary>参考做法</summary>

```bash
echo 'echo hello' > hello.sh
./hello.sh          # Permission denied
chmod u+x hello.sh
./hello.sh          # hello
```
</details>

2. 把 `hello.sh` 的权限改为"自己可读写执行，组可读执行，其他人无任何权限"，用 `ls -l` 验证。
<details><summary>参考做法</summary>

```bash
chmod 750 hello.sh
ls -l hello.sh      # -rwxr-x---
```
</details>

3. 用 `sudo touch /tmp/rootfile` 创建文件，查看所有者，再用 `chown` 把它改成你自己。
<details><summary>参考做法</summary>

```bash
sudo touch /tmp/rootfile
ls -l /tmp/rootfile        # 所有者 root
sudo chown $USER /tmp/rootfile
ls -l /tmp/rootfile
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `./x.sh: Permission denied` | 脚本没有执行权限 | `chmod +x x.sh` |
| `Permission denied` 访问 `/dev/ttyUSB0` | 不在 `dialout` 组 | `sudo usermod -aG dialout $USER` 后重新登录 |
| SSH 报 `Permissions 0644 for 'id_rsa' are too open` | 私钥权限过宽 | `chmod 600 ~/.ssh/id_rsa` |
| 自己家目录里的文件改不了 | 用 `sudo` 创建的文件属于 root | `sudo chown -R $USER:$USER 路径` |
| `sudo` 输密码没反应 | 密码不回显是正常的 | 直接输完回车 |

## 小结

- `ls -l` 的 10 位：类型 + 所有者/组/其他人各 rwx。
- 数字法 r=4、w=2、x=1：`755` 脚本、`644` 普通文件、`600` 私钥。
- 符号法 `chmod u+x` 最常用；`-R` 递归。
- `777` 是坏味道；搞清楚谁需要什么权限。
- `sudo` 临时借用 root；用 root 创建的文件记得 `chown` 收回。

## 自测题

1. `-rwxr-x---` 代表什么？
<details><summary>答案</summary>普通文件；所有者可读写执行，组可读执行，其他人无权限；数字是 750。</details>

2. 把一个脚本改成"所有人都能执行，但只有自己能改"，数字是多少？
<details><summary>答案</summary>755（rwxr-xr-x）。</details>

3. 为什么 SSH 会拒绝 644 权限的私钥？
<details><summary>答案</summary>其他人可读意味着私钥可能泄露，SSH 出于安全强制要求私钥仅所有者可读写（600）。</details>

4. 在 Ubuntu 上插上机械臂的串口线后报 `Permission denied`，该怎么办？
<details><summary>答案</summary>把当前用户加入 `dialout` 组：`sudo usermod -aG dialout $USER`，然后注销重新登录。</details>

## 参考资料

- [chmod(1) 手册](https://man7.org/linux/man-pages/man1/chmod.1.html) —— 权限位与模式的完整定义。
- [The Linux Command Line – Permissions](https://linuxcommand.org/lc3_lts0090.php) —— 权限模型的图解。
- [Ubuntu 社区：File Permissions](https://help.ubuntu.com/community/FilePermissions) —— Ubuntu 视角的实用说明。

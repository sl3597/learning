---
title: 进程管理
type: tutorial
topic: linux
chapter: 10
level: intermediate
tags: [进程, ps, top, htop, kill, 信号, 后台, nohup, jobs]
prerequisites: [08-pipes-and-redirection]
estimated_time: 45min
sources:
  - https://man7.org/linux/man-pages/man7/signal.7.html
  - https://man7.org/linux/man-pages/man1/ps.1.html
  - https://htop.dev/
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 进程管理（Process Management）

> 训练卡住了怎么强制停掉？怎么让任务在后台跑着、自己先去干别的？本章教你看、停、挂起、恢复进程。

## 学习目标

- 能用 `ps`、`top`/`htop` 找到某个进程及其 PID、CPU、内存占用。
- 能用 `kill` 发送信号优雅或强制结束进程。
- 能用 `&`、`Ctrl + Z`、`jobs`、`fg`、`bg` 在前后台切换任务。
- 能用 `nohup` 让任务在断开终端后继续运行。

## 前置知识

- 需要先读：[08 管道与重定向](08-pipes-and-redirection.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **进程（process）** | 一个正在运行的程序实例 | 一位正在工作的员工 |
| **PID** | 进程的唯一编号 | 工号 |
| **信号（signal）** | 操作系统发给进程的"通知" | 给员工发的通知单 |
| **前台 / 后台** | 占着终端 / 不占终端运行 | 当面汇报 / 自己默默干 |
| **nohup** | 终端关了也不挂断进程 | 下班后继续加班 |

## 详细讲解

### 10.1 看进程：ps 与 top

```bash
ps                    # 当前终端的进程
ps aux                # 系统所有进程（a 全部用户，u 详细，x 含无终端的）
ps aux | grep python  # 找 python 进程
ps -ef | grep train   # 另一种风格，Linux 常用
pgrep -f train.py     # 直接按名字找 PID
```

`ps aux` 关键列：`USER`、`PID`、`%CPU`、`%MEM`、`STAT`（状态）、`COMMAND`。

动态查看：

```bash
top          # 按 q 退出；按 M 按内存排序，P 按 CPU 排序（Linux）
htop         # 更友好，需安装：brew install htop / sudo apt install htop
```

GPU 任务用 `nvidia-smi` 看显存占用和对应 PID（Linux + NVIDIA）。

### 10.2 结束进程：kill 与信号

```bash
kill 12345            # 发送 SIGTERM（15），请求进程优雅退出
kill -9 12345         # 发送 SIGKILL（9），强制立即结束，无法被忽略
kill -15 12345        # 同第一条
killall python        # 按名字结束所有同名进程
pkill -f train.py     # 按命令行匹配结束
```

常用信号：

| 信号 | 编号 | 含义 | 对应快捷键 |
|---|---|---|---|
| SIGINT | 2 | 中断 | `Ctrl + C` |
| SIGTSTP | 20 | 暂停 | `Ctrl + Z` |
| SIGTERM | 15 | 请求终止（默认） | — |
| SIGKILL | 9 | 强制杀死 | — |
| SIGHUP | 1 | 终端挂断 | 关闭终端窗口 |

> ⚠️ 注意：`kill -9` 不给程序保存数据、释放资源的机会。先 `kill`，等几秒没反应再 `kill -9`。`killall` 在 Linux 上按进程名匹配，别输错名字。

### 10.3 前台与后台

```bash
sleep 100             # 前台运行，终端被占住
# 按 Ctrl + Z 暂停 → 显示 [1]+ Stopped
jobs                  # 列出本终端的任务
bg %1                 # 让任务 1 在后台继续
fg %1                 # 把任务 1 调回前台
sleep 200 &           # 直接在后台启动（结尾加 &）
```

> 💡 要点：`Ctrl + C` 是杀掉，`Ctrl + Z` 是暂停。暂停后的任务不会跑，记得 `bg` 或 `fg`。

### 10.4 关掉终端还能跑：nohup

后台任务默认会在你关闭终端（SIGHUP）时一起死掉。解决方法：

```bash
nohup python train.py > train.log 2>&1 &
echo $!               # 打印刚启动的后台进程 PID，记下来
```

- `nohup`：忽略挂断信号。
- `> train.log 2>&1`：输出存文件，否则默认写到 `nohup.out`。
- `&`：后台。

更推荐的做法是用 `tmux`，可以随时回来看屏幕，见 [17 SSH 与远程](17-ssh-and-remote.md)。

### 10.5 进程状态与僵尸

`ps` 的 `STAT` 列：`R` 运行、`S` 睡眠（等待）、`T` 暂停、`Z` 僵尸（已结束但父进程没回收）、`D` 不可中断（通常在等磁盘/IO）。

`D` 状态的进程 `kill -9` 也杀不掉，只能等 IO 完成或重启。

### 10.6 macOS 差异

- `ps aux` 可用，但 `ps -ef` 列顺序略不同。
- 没有 `nvidia-smi`；用"活动监视器"或 `top -o cpu`。
- `htop` 需 `brew install htop`。

## 动手练习

1. 后台启动 `sleep 300`，用 `ps` 找到它的 PID，用 `kill` 结束它，并用 `jobs` 确认。
<details><summary>参考做法</summary>

```bash
sleep 300 &
ps aux | grep "sleep 300"
kill <PID>
jobs
```
</details>

2. 前台运行 `sleep 100`，用 `Ctrl + Z` 暂停，`bg` 让它后台继续，再 `fg` 调回前台并用 `Ctrl + C` 结束。
<details><summary>参考做法</summary>按顺序：`sleep 100` → `Ctrl+Z` → `bg` → `fg` → `Ctrl+C`。</details>

3. 用 `nohup` 运行 `python3 -c "import time; [print(i, flush=True) or time.sleep(1) for i in range(30)]"`，输出到 `count.log`，关闭终端窗口后重新打开，用 `tail -f` 确认它还在跑。
<details><summary>参考做法</summary>

```bash
nohup python3 -c "import time; [print(i, flush=True) or time.sleep(1) for i in range(30)]" > count.log 2>&1 &
# 关闭终端，重新打开
tail -f ~/demo/count.log
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 关闭终端后训练停了 | 收到 SIGHUP | 用 `nohup` 或 `tmux` |
| `kill` 后进程还在 | 程序忽略了 SIGTERM | 等几秒后 `kill -9` |
| `kill -9` 都杀不掉 | 进程处于 `D` 状态等待 IO | 等待或重启 |
| `ps aux | grep train` 看到的是 grep 自己 | grep 命令行里含关键词 | `grep [t]rain` 或用 `pgrep` |
| GPU 显存没释放 | 僵尸子进程 | `nvidia-smi` 找 PID，`kill -9` |

## 小结

- `ps aux | grep 名字`、`pgrep -f` 找 PID；`top/htop` 看实时占用。
- `kill PID` 优雅，`kill -9 PID` 强制；先礼后兵。
- `&` 后台、`Ctrl + Z` 暂停、`jobs/fg/bg` 切换。
- 长任务用 `nohup ... > log 2>&1 &`，更好的选择是 tmux。

## 自测题

1. `Ctrl + C` 和 `Ctrl + Z` 的区别？
<details><summary>答案</summary>`Ctrl + C` 发送 SIGINT 终止程序；`Ctrl + Z` 发送 SIGTSTP 暂停程序，可用 `fg/bg` 恢复。</details>

2. 为什么不要一上来就 `kill -9`？
<details><summary>答案</summary>SIGKILL 无法被捕获，程序没机会保存 checkpoint、关闭文件、释放显存。</details>

3. `nohup python train.py &` 的输出去哪了？
<details><summary>答案</summary>默认写入当前目录的 `nohup.out`。</details>

4. 如何查看后台刚启动进程的 PID？
<details><summary>答案</summary>`echo $!`。</details>

## 参考资料

- [signal(7) 手册](https://man7.org/linux/man-pages/man7/signal.7.html) —— 所有信号的定义。
- [ps(1) 手册](https://man7.org/linux/man-pages/man1/ps.1.html) —— 各种选项风格。
- [htop 官网](https://htop.dev/) —— 交互式进程查看器。

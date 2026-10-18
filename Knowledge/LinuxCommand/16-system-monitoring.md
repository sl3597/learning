---
title: 系统监控
type: tutorial
topic: linux
chapter: 16
level: intermediate
tags: [df, du, free, uptime, lsof, dmesg, systemctl, journalctl, 监控]
prerequisites: [10-process-management]
estimated_time: 45min
sources:
  - https://man7.org/linux/man-pages/man1/systemctl.1.html
  - https://man7.org/linux/man-pages/man1/journalctl.1.html
  - https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 系统监控（System Monitoring）

> "磁盘满了""内存不够""服务起没起来"——本章给你一套快速体检服务器的命令，以及 Linux 服务管理的基本操作。

## 学习目标

- 能用 `df`、`du` 查磁盘用量并找出占空间的大户。
- 能用 `free`、`uptime`、`top` 判断内存与负载情况。
- 能用 `lsof`、`dmesg` 排查"文件被占用""硬件 / 驱动报错"。
- 能用 `systemctl` 启停服务、用 `journalctl` 看服务日志（Linux）。

## 前置知识

- 需要先读：[10 进程管理](10-process-management.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **df / du** | 磁盘整体用量 / 某目录用量 | 看油表 / 称某个箱子 |
| **free** | 内存用量 | 看工作台还剩多少空位 |
| **负载（load average）** | 等待 CPU 的平均任务数 | 排队人数 |
| **lsof** | 列出打开的文件（谁在用这个文件 / 端口） | 查谁借了这本书 |
| **dmesg** | 内核消息，硬件插拔、驱动错误都在这 | 机房的监控录像 |
| **systemd 服务** | 开机自动运行的后台程序，用 `systemctl` 管 | 大楼的常驻设施 |

## 详细讲解

### 16.1 磁盘：df 与 du

```bash
df -h                 # 各分区用量，看 Use% 和 Mounted on
du -sh ~/data         # 某目录总大小（s 汇总，h 可读）
du -sh ~/* | sort -rh | head -n 10   # 家目录下最大的 10 个
du -h --max-depth=1 . | sort -rh     # 当前目录一层（Linux）
du -hd 1 . | sort -rh                # 同上，macOS 写法
```

磁盘满的常见元凶：模型 checkpoint、日志、`~/.cache`（pip/huggingface）、conda 包缓存（`conda clean -a`）。

### 16.2 内存与负载

```bash
free -h               # Linux：total/used/free/available，看 available
uptime                # 运行时长 + 1/5/15 分钟负载
top                   # 综合实时
vmstat 1              # 每秒刷新一次的内存/CPU 概览（Linux）
```

负载解读：数值 ≈ 核心数时 CPU 用满；远超核心数说明排队严重。核心数用 `nproc`（Linux）或 `sysctl -n hw.ncpu`（macOS）查看。

macOS 没有 `free`，用 `top -l 1 | grep PhysMem` 或 `vm_stat`。

GPU：

```bash
nvidia-smi                  # 显存、利用率、占用进程
watch -n 1 nvidia-smi       # 每秒刷新
```

### 16.3 lsof：谁在用它

```bash
lsof /path/to/file       # 谁打开了这个文件
lsof -i :8000            # 谁占用了端口
lsof -u $USER | wc -l    # 我打开了多少文件
lsof +D ~/data           # 目录下被打开的文件（慢）
```

典型场景：U 盘弹不出、日志删了磁盘空间没释放（进程还握着文件句柄，重启进程即可）。

### 16.4 dmesg：硬件与内核消息

```bash
sudo dmesg | tail -n 30      # 最近的内核消息
sudo dmesg -w                # 实时跟踪（插拔设备时看）
sudo dmesg | grep -i usb     # USB 设备
sudo dmesg | grep -i "out of memory"   # OOM 杀进程记录
```

> 🔗 关联：机械臂、力传感器通过 USB/串口接入时，`dmesg -w` 能立刻看到它被识别成了 `/dev/ttyUSB0` 还是 `/dev/ttyACM0`，部署细节见 [VLA 基础：评估与部署](../VLA/Basic/09-evaluation-and-deployment.md)。

### 16.5 服务管理：systemctl（Linux）

现代 Linux 用 **systemd** 管理后台服务（SSH、Docker、数据库等）：

```bash
systemctl status ssh           # 状态
sudo systemctl start docker    # 启动
sudo systemctl stop docker
sudo systemctl restart docker
sudo systemctl enable docker   # 开机自启
sudo systemctl disable docker
systemctl list-units --type=service --state=running   # 正在运行的服务
```

把自己的程序做成服务（开机自动跑、崩溃自动重启）：

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My app
After=network.target

[Service]
User=sde
WorkingDirectory=/home/sde/myapp
ExecStart=/home/sde/miniconda3/envs/vla/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now myapp
```

### 16.6 日志：journalctl（Linux）

```bash
journalctl -u ssh                # 某服务的日志
journalctl -u myapp -f           # 实时跟踪
journalctl -u myapp --since "1 hour ago"
journalctl -b                    # 本次开机以来
journalctl -p err                # 只看错误级别
```

传统日志文件在 `/var/log/`，如 `/var/log/syslog`、`/var/log/auth.log`（登录记录）。

### 16.7 macOS 对应

| Linux | macOS |
|---|---|
| `systemctl` | `launchctl`（服务配置在 `~/Library/LaunchAgents`） |
| `journalctl` | `log show --last 1h` 或"控制台"应用 |
| `free` | `vm_stat` |
| `dmesg` | `sudo dmesg`（信息较少）或 `log stream` |

## 动手练习

1. 找出你家目录下占空间最大的 5 个目录。
<details><summary>参考做法</summary>

```bash
du -sh ~/* 2>/dev/null | sort -rh | head -n 5
```
</details>

2. 启动 `python3 -m http.server 8000 &`，用 `lsof` 找出它打开的网络端口，然后结束它。
<details><summary>参考做法</summary>

```bash
python3 -m http.server 8000 &
lsof -i :8000
kill %1
```
</details>

3. （Linux）查看 ssh 服务状态与最近 20 条日志；（macOS）用 `log show --last 10m | head` 看系统日志。
<details><summary>参考做法</summary>

```bash
systemctl status ssh
journalctl -u ssh -n 20
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `No space left on device` | 磁盘满 | `df -h` 定位分区，`du -sh` 找大户，清缓存 |
| 删了大文件空间没释放 | 进程仍持有文件 | `lsof | grep deleted`，重启该进程 |
| 训练进程莫名消失 | 内存不足被 OOM killer 杀掉 | `dmesg | grep -i "out of memory"` 确认，减小 batch |
| `systemctl` 报 `Unit not found` | 服务名错 | `systemctl list-unit-files | grep 关键词` |
| 服务 `failed` | 启动命令出错 | `journalctl -u 服务名 -n 50` 看原因 |

## 小结

- 磁盘 `df -h` 看整体、`du -sh` 找大户；内存 `free -h`；负载 `uptime`。
- `lsof` 查文件 / 端口占用；`dmesg` 查硬件和 OOM。
- `systemctl start/stop/enable/status` 管服务，`journalctl -u 服务 -f` 看日志。
- GPU 用 `nvidia-smi`。

## 自测题

1. `df -h` 和 `du -sh` 的区别？
<details><summary>答案</summary>`df` 看整个文件系统（分区）用量；`du` 统计指定目录实际占用。</details>

2. 负载 8.0 在 4 核机器上意味着什么？
<details><summary>答案</summary>平均有 8 个任务在争 4 个核心，CPU 严重过载。</details>

3. 如何让自己的程序开机自启且崩溃自动重启？
<details><summary>答案</summary>写一个 systemd service 文件，设置 `Restart=always`，`systemctl enable --now`。</details>

4. 怎样确认训练进程是不是被系统因内存不足杀掉的？
<details><summary>答案</summary>`sudo dmesg | grep -i "out of memory"` 或 `journalctl -k | grep -i oom`。</details>

## 参考资料

- [systemctl(1) 手册](https://man7.org/linux/man-pages/man1/systemctl.1.html) —— 服务管理全集。
- [journalctl(1) 手册](https://man7.org/linux/man-pages/man1/journalctl.1.html) —— 日志过滤选项。
- [GNU df 手册](https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html) —— 磁盘用量。
- [Ubuntu：systemd 服务入门](https://ubuntu.com/core/docs/system-services) —— 编写 service 文件。

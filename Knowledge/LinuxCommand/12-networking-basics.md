---
title: 网络基础命令
type: tutorial
topic: linux
chapter: 12
level: intermediate
tags: [网络, ip, ping, curl, wget, 端口, ss, netstat, hosts]
prerequisites: [08-pipes-and-redirection]
estimated_time: 45min
sources:
  - https://man7.org/linux/man-pages/man8/ip.8.html
  - https://curl.se/docs/manpage.html
  - https://man7.org/linux/man-pages/man8/ss.8.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 网络基础命令（Networking Basics）

> "服务器连不上""端口被占用""下载模型权重"——本章给你一套排查网络问题和从命令行下载文件的工具。

## 学习目标

- 能查看本机 IP 地址，并用 `ping` 判断网络是否通。
- 能用 `curl` / `wget` 下载文件和测试 HTTP 接口。
- 能解释"端口"是什么，并用 `ss` / `lsof` 找出谁占用了某个端口。
- 能修改 `hosts` 文件做本地域名映射。

## 前置知识

- 需要先读：[08 管道与重定向](08-pipes-and-redirection.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **IP 地址** | 网络中一台机器的地址 | 门牌号 |
| **端口（port）** | 一台机器上不同服务的编号（0~65535） | 同一栋楼里的房间号 |
| **ping** | 发个小包看对方是否回应 | 喊一声"在吗" |
| **curl / wget** | 命令行下载 / 请求网页 | 命令行版浏览器 |
| **DNS** | 把域名翻译成 IP | 电话簿 |
| **hosts 文件** | 本机优先级最高的"私人电话簿" | 手机通讯录 |

## 详细讲解

### 12.1 我的 IP 是多少

```bash
ip addr          # Linux，看 inet 后面的地址
ip a             # 简写
ifconfig         # macOS / 老 Linux
hostname -I      # Linux 只打印 IP
curl ifconfig.me # 公网 IP（出口 IP）
```

`127.0.0.1`（或 `localhost`）永远指向本机；`192.168.x.x`、`10.x.x.x` 是局域网内网地址。

### 12.2 通不通：ping

```bash
ping -c 4 8.8.8.8          # 发 4 个包（不加 -c 会一直 ping，Ctrl+C 停）
ping -c 4 www.baidu.com    # 能 ping 域名说明 DNS 也正常
```

ping 不通 IP → 网络/防火墙问题；ping 通 IP 但 ping 不通域名 → DNS 问题。

### 12.3 下载：curl 与 wget

```bash
curl https://example.com                     # 打印网页内容
curl -O https://example.com/model.pth        # 下载，保留原文件名
curl -o my.pth https://example.com/model.pth # 下载并改名
curl -L -O URL                               # -L 跟随重定向（GitHub 下载常需要）
curl -I https://example.com                  # 只看响应头
curl -s URL | head                           # -s 静默，不显示进度

wget URL                                     # 下载（Ubuntu 自带，macOS 需 brew install wget）
wget -c URL                                  # 断点续传（大模型权重必备）
wget -O name.zip URL
```

测试 API 接口：

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

> 🔗 关联：知识库的 Agent 系统启动后就是一个本地 HTTP 服务，可以用 `curl` 测试它的接口，见 [知识库总览](../../README.md)。

### 12.4 端口与谁在监听

一台机器可以同时运行多个网络服务，用端口区分：22 SSH、80 HTTP、443 HTTPS、8000/8080 常见开发服务器、6006 TensorBoard、8888 Jupyter。

```bash
ss -tulnp              # Linux：列出监听中的 TCP/UDP 端口及进程
sudo ss -tulnp | grep 8000
netstat -tulnp         # 老版本 Linux
lsof -i :8000          # macOS/Linux 通用：谁占用了 8000 端口
```

```text
# lsof -i :8000 输出示例：
COMMAND   PID  USER   FD   TYPE  DEVICE  SIZE/OFF NODE NAME
python  12345  sde    3u  IPv4  ...           0t0  TCP *:8000 (LISTEN)
```

端口被占用时，找到 PID 后用 `kill` 结束（见 [10 进程管理](10-process-management.md)）。

测试远程端口是否开放：

```bash
nc -zv 192.168.1.10 22       # netcat，-z 只探测不发数据
curl -v telnet://192.168.1.10:22
```

### 12.5 hosts 文件

`/etc/hosts` 让你给 IP 起名字，优先于 DNS：

```bash
sudo nano /etc/hosts
```

加一行：

```text
192.168.1.50   gpu-server
```

之后 `ssh gpu-server`、`ping gpu-server` 都能用。macOS 和 Linux 路径相同。

### 12.6 排查套路

1. `ping 127.0.0.1` → 本机网络栈正常？
2. `ping 网关`（`ip route` 看 default via 后的地址）→ 局域网正常？
3. `ping 8.8.8.8` → 外网正常？
4. `ping www.baidu.com` → DNS 正常？
5. `curl -I 目标` → 目标服务正常？
6. `ss -tulnp` / `lsof -i` → 本机服务监听了吗？

### 12.7 macOS 差异

macOS 没有 `ip`、`ss` 命令，对应用 `ifconfig`、`netstat -an`、`lsof -i`。`wget` 需 brew 安装，`curl` 自带。

## 动手练习

1. 查出你的局域网 IP 和公网 IP。
<details><summary>参考做法</summary>

```bash
ifconfig | grep "inet "     # macOS；Linux 用 ip a
curl ifconfig.me
```
</details>

2. 用 `python3 -m http.server 8000` 在 `~/demo` 启动一个文件服务器，再用 `curl` 访问它、用 `lsof` 找到它的 PID，最后结束它。
<details><summary>参考做法</summary>

```bash
cd ~/demo && python3 -m http.server 8000 &
curl http://localhost:8000/
lsof -i :8000
kill <PID>
```
</details>

3. 用 `curl -L -O` 下载一个 GitHub 上的 README（例如 `https://raw.githubusercontent.com/torvalds/linux/master/README`），用 `wc -l` 统计行数。
<details><summary>参考做法</summary>

```bash
curl -L -O https://raw.githubusercontent.com/torvalds/linux/master/README
wc -l README
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `Address already in use` | 端口被占用 | `lsof -i :端口` 找到并 kill，或换端口 |
| `curl: (6) Could not resolve host` | DNS 失败或断网 | `ping 8.8.8.8` 判断是断网还是 DNS |
| 下载 GitHub 文件得到一个 HTML | 没加 `-L` 或用了网页 URL 而非 raw URL | 用 raw 链接并加 `-L` |
| `ping` 不通但网页能打开 | 对方禁用了 ICMP | 用 `curl -I` 或 `nc -zv` 测端口 |

## 小结

- `ip a` / `ifconfig` 看 IP，`ping -c 4` 测连通。
- `curl -L -O`、`wget -c` 下载；`curl -X POST -d` 测 API。
- 端口 = 房间号；`ss -tulnp` / `lsof -i :端口` 找占用者。
- `/etc/hosts` 给 IP 起别名。
- 排查按"本机 → 网关 → 外网 → DNS → 服务"逐层。

## 自测题

1. `127.0.0.1` 代表什么？
<details><summary>答案</summary>本机回环地址，等价于 `localhost`。</details>

2. 启动服务时报 `Address already in use`，第一步做什么？
<details><summary>答案</summary>`lsof -i :端口号` 找出占用进程。</details>

3. `ping 8.8.8.8` 通但 `ping www.google.com` 不通，问题在哪？
<details><summary>答案</summary>DNS 解析失败（网络本身是通的）。</details>

4. `wget -c` 的 `-c` 是什么意思？
<details><summary>答案</summary>continue，断点续传。</details>

## 参考资料

- [ip(8) 手册](https://man7.org/linux/man-pages/man8/ip.8.html) —— Linux 现代网络配置命令。
- [curl 手册](https://curl.se/docs/manpage.html) —— 所有选项。
- [ss(8) 手册](https://man7.org/linux/man-pages/man8/ss.8.html) —— 套接字统计。
- [Ubuntu 网络配置文档](https://ubuntu.com/server/docs/network-configuration) —— 静态 IP、netplan。

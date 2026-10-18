---
title: URSim 仿真器：不用真机也能练习
type: tutorial
topic: ur
chapter: 5
level: beginner
tags: [URSim, Docker, 仿真器, noVNC, 端口映射, macOS, Apple Silicon]
prerequisites: [04-polyscope-teach-pendant, 12-networking-basics]
estimated_time: 45min
sources:
  - https://hub.docker.com/r/universalrobots/ursim_e-series
  - https://hub.docker.com/r/universalrobots/ursim_polyscopex
  - https://github.com/UniversalRobots/Universal_Robots_Client_Library/blob/master/scripts/start_ursim.sh
  - https://www.universal-robots.com/articles/ur/interface-communication/remote-control-via-tcpip/
  - https://forum.universal-robots.com/t/ursim-on-m1-macbook/14668
status: draft
created: 2026-10-18
updated: 2026-10-18
---

# URSim 仿真器：不用真机也能练习（URSim Simulator）

> 真机贵、危险、还不一定随时能用。URSim 是官方仿真器，界面和真机的 PolyScope 一样，也开放同样的网络端口。本章教你在 Mac 上用 Docker 跑起 URSim，并让后面几章的程序连上它。

## 学习目标

- 能用一条 `docker run` 命令启动官方 URSim e-Series 镜像，并在浏览器里打开 PolyScope。
- 能解释每个 `-p` 端口映射的用途，知道后续章节需要映射哪些端口。
- 能在 Apple Silicon Mac 上正确设置 Rosetta 与 `--platform`，并知道遇到 "No Controller" 时的备选方案。
- 能把程序文件保存到 Mac 本地目录，容器删除后不丢失。
- 能为 06/07/08 章的程序填对机器人 IP。

## 前置知识

- 需要先读：[04 示教器 PolyScope 编程](04-polyscope-teach-pendant.md)、[12 网络基础](../LinuxCommand/12-networking-basics.md)（IP、端口的概念）
- 建议了解：[10 进程管理](../LinuxCommand/10-process-management.md)（前台/后台进程、Ctrl+C）

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **URSim** | UR 官方的机器人仿真器，运行真实的控制器软件和 PolyScope 界面，只是没有实体机械臂 | 驾校的模拟驾驶舱 |
| **Docker 镜像 / 容器** | 镜像是打包好的软件环境，容器是镜像运行起来的一个实例 | 镜像是菜谱，容器是按菜谱做出来的一盘菜 |
| **端口映射（-p）** | 把 Mac 上的某个端口转发到容器里的同一（或另一）端口 | 公司前台把外线电话转到某个分机 |
| **VNC / noVNC** | VNC 是远程桌面协议；noVNC 让你用浏览器直接看远程桌面 | 用网页看监控摄像头画面 |
| **卷挂载（-v）** | 把 Mac 的一个文件夹"接"到容器里，容器写的文件直接落在 Mac 上 | 给临时工位配一个自己的抽屉，人走了抽屉还在 |
| **Rosetta** | Apple 的转译层，让 Apple Silicon（arm64）Mac 运行 x86_64（amd64）程序 | 同声传译 |

## 详细讲解

### 5.1 准备 Docker Desktop

URSim 官方以 Docker 镜像发布，Mac 上需要先装 **Docker Desktop**（Docker 的图形化安装包，自带一个小 Linux 虚拟机来跑容器）。从 Docker 官网下载安装，或用 Homebrew：

```bash
brew install --cask docker
```

安装后打开 Docker Desktop，等左下角显示 Engine running，再在终端确认：

```bash
docker version
uname -m
```

```text
# 输出（Apple Silicon 上 uname -m 显示 arm64，Intel Mac 显示 x86_64）：
arm64
```

> ⚠️ 注意：Apple Silicon 用户还要在 Docker Desktop → Settings → General 里勾选 **Use Rosetta for x86_64/amd64 emulation on Apple Silicon**（新版本通常默认已勾选）。原因见 5.4。

### 5.2 启动 URSim e-Series

官方镜像名是 `universalrobots/ursim_e-series`，标签（tag）就是 PolyScope 版本号，例如 `5.26`。镜像下载约 1 GB。官方 Docker Hub 页面给出的最简命令只映射了 5900 和 6080；为了让后续章节能连接，这里按官方 `start_ursim.sh` 脚本的做法，把 Dashboard 和 30001～30004 也映射出来：

```bash
mkdir -p ~/ursim/programs ~/ursim/urcaps

docker run --rm -it \
  --platform linux/amd64 \
  --name ursim \
  -e ROBOT_MODEL=UR5 \
  -p 127.0.0.1:5900:5900 \
  -p 127.0.0.1:6080:6080 \
  -p 29999:29999 \
  -p 30001-30004:30001-30004 \
  -v ~/ursim/programs:/ursim/programs \
  -v ~/ursim/urcaps:/urcaps \
  universalrobots/ursim_e-series:5.26
```

逐项解释：

| 参数 | 作用 |
|---|---|
| `--rm -it` | 前台交互运行，按 Ctrl+C 停止后自动删除容器 |
| `--platform linux/amd64` | 镜像只有 amd64 版本；在 Apple Silicon 上显式声明，避免平台不匹配警告（Intel Mac 可省略） |
| `--name ursim` | 给容器起名，方便 `docker stop ursim` |
| `-e ROBOT_MODEL=UR5` | 选机型，可选 UR3、UR5、UR7、UR8LONG、UR10、UR12、UR15、UR16、UR18、UR20、UR30，默认 UR5 |
| `-p 127.0.0.1:6080:6080` | noVNC 网页界面，只允许本机访问 |
| `-p 127.0.0.1:5900:5900` | 普通 VNC 客户端端口 |
| `-p 29999:29999` | Dashboard Server（第 6 章） |
| `-p 30001-30004:...` | Primary / Secondary / Real-time / RTDE 接口（第 6、7 章） |
| `-v ~/ursim/programs:/ursim/programs` | 程序存到 Mac 本地，容器删了也不丢 |
| `-v ~/ursim/urcaps:/urcaps` | 启动时自动安装放在这里的 URCap 插件（`.jar` 文件，第 8 章会用到） |

如果想把终端还给自己，可以去掉 `-it`、加 `-d` 让容器在后台运行，之后用 `docker logs -f ursim` 看日志。

> ⚠️ 注意：`-p 29999:29999` 这种写法会监听 Mac 所有网卡，同一局域网的人也能连上并控制你的仿真器。在公共网络里改成 `-p 127.0.0.1:29999:29999` 这种只绑定本机的形式。

### 5.3 用浏览器打开 PolyScope

容器启动后等 30 秒左右，在浏览器打开：

```text
http://localhost:6080/vnc.html?host=localhost&port=6080
```

点 Connect，就能看到和真机示教器一样的 PolyScope。然后：

1. 点左下角红色的初始化按钮，进入初始化界面。
2. 点 **ON**，等状态变为 Idle；再点 **START** 松开（虚拟的）抱闸，状态变为 Normal。
3. 去 Move 页按箭头，3D 视图里的机械臂会跟着动——成功了。

也可以用 VNC 客户端连 `localhost:5900`。

在另一个终端检查端口是否通：

```bash
nc -vz 127.0.0.1 29999
printf 'robotmode\nquit\n' | nc 127.0.0.1 29999
```

```text
# 输出（示例，版本信息因镜像而异）：
Connection to 127.0.0.1 port 29999 [tcp/*] succeeded!
Connected: Universal Robots Dashboard Server
Robotmode: RUNNING
Disconnected
```

### 5.4 Apple Silicon Mac 的坑

`ursim_e-series` 镜像**只提供 amd64 架构**（可在 Docker Hub 的标签页看到），在 M1～M4 Mac 上只能靠 Rosetta 转译运行。UR 官方论坛里有用户报告：容器和网页都能打开，但 PolyScope 左下角一直显示 **No Controller**，无法上电；也有用户报告开启 Docker Desktop 的 Rosetta 转译后可以正常运行。UR 官方没有在该帖中给出支持声明。

遇到 No Controller 时按顺序尝试：

1. 确认 Docker Desktop 的 Rosetta 选项已勾选，并带 `--platform linux/amd64` 重新启动容器。
2. 换一台 x86_64 的 Linux 电脑（或实验室服务器）运行 URSim，Mac 通过局域网 IP 连接（见 5.6）。
3. 改用官方的 PolyScope X 仿真器 `universalrobots/ursim_polyscopex`，它提供原生 arm64 镜像。官方命令中 Apple Silicon 要设 `HOST_ARCH=arm64`，界面通过浏览器访问 `localhost`：

```bash
docker run --rm -it -p 80:80 \
  --add-host "host.docker.internal:host-gateway" \
  --env HOST_ARCH=arm64 \
  --network bridge --privileged \
  universalrobots/ursim_polyscopex:latest
```

> ⚠️ 注意：`--privileged` 让容器拥有很高的系统权限，这是官方命令的要求，只在自己的电脑上使用。PolyScope X 没有 29999 端口的 Dashboard Server，界面也和第 4 章不同，所以它只是"能练习"的备选。

> ❓ 待解决：URSim e-Series 在 Apple Silicon + Rosetta 下能否稳定运行，取决于 Docker Desktop 与 macOS 版本，官方未给出支持说明；如果你验证成功，请记录所用版本。

### 5.5 停止、保存与重启

```bash
docker stop ursim          # 停止（--rm 会顺便删除容器）
ls ~/ursim/programs        # 程序文件仍在 Mac 上
docker images | grep ursim # 查看已下载的镜像
```

在 PolyScope 里用 保存… → Save All 保存的 `.urp` 和 `.installation` 都会出现在 `~/ursim/programs`。下次启动带同样的 `-v` 参数就能 打开… 加载它们。

### 5.6 后续章节的"机器人 IP"怎么填

Docker Desktop for Mac 的容器跑在一个隐藏的虚拟机里，**Mac 访问不到容器自己的 IP**（官方脚本的输出里也提示了这一点）。所以只能通过端口映射访问：

| 场景 | 机器人 IP 填什么 | 需要的映射 |
|---|---|---|
| 06 章：Python socket / nc 连 Dashboard 和 30002 | `127.0.0.1` | 29999、30001～30003 |
| 07 章：RTDE / ur_rtde | `127.0.0.1` | 30004；ur_rtde 的控制接口还会用到其他端口，把 29999、30001～30004 都映射最省事 |
| 08 章：ROS 2 驱动 | 见下方说明 | 30001～30004、29999，外加机器人反向连接主机 |
| URSim 跑在另一台 Linux 电脑上 | 那台电脑的局域网 IP（用 `ip addr` 查） | 同上，且防火墙放行这些端口 |
| 真机 | PolyScope 里 ☰ → 设置 → 系统 → 网络 显示的 IP | Mac 与机器人在同一网段 |

ROS 2 驱动比较特殊：除了主机连机器人，机器人上的 External Control 插件还要**反过来**连接主机（默认端口 50001～50004），所以在 PolyScope 里要填"主机 IP"。在 Docker Desktop 里，容器访问 Mac 主机通常用特殊主机名 `host.docker.internal`。详细做法留到 [08 ROS 2 驱动与 MoveIt 2](08-ros2-driver-and-moveit.md)。

> ❓ 待解决：URSim e-Series 容器内的 External Control URCap 在 Docker Desktop for Mac 下应填写的主机 IP（`host.docker.internal` 解析出的地址是否可用），尚未在 Mac 上实测验证。

> 🔗 关联：在 Linux 上，官方的 `start_ursim.sh` 脚本会建一个专用网络，并给容器固定 IP `192.168.56.101`，此时可以直接用这个 IP 连接。该脚本使用了 bash 4 和 GNU grep 的语法，macOS 自带的 bash 3.2 可能无法直接运行，Mac 上用本章的 `docker run` 更省事。

## 动手练习

1. 启动 URSim，在浏览器里完成初始化（ON → START），并在 Move 页把机械臂移动一下。（验收：PolyScope 底部状态为 Normal）
<details><summary>参考做法</summary>

按 5.2 的命令启动，打开 `http://localhost:6080/vnc.html?host=localhost&port=6080`，点 Connect → 左下角初始化按钮 → ON → START。
</details>

2. 在 PolyScope 里新建一个只有一个 MoveJ 航点的程序，保存为 `hello.urp`，然后在 Mac 终端里找到它。（验收：`ls ~/ursim/programs` 能看到 `hello.urp`）
<details><summary>参考做法</summary>

```bash
ls -l ~/ursim/programs
```
</details>

3. 用 `nc` 向 Dashboard 查询机型和程序状态。（验收：输出里有机型和 `STOPPED` 或 `PLAYING`）
<details><summary>参考做法</summary>

```bash
printf 'get robot model\nprogramState\nquit\n' | nc 127.0.0.1 29999
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 浏览器打不开 6080 | 容器还在启动，或没加 `-p 6080:6080` | 等 30 秒；`docker ps` 看 PORTS 列 |
| `Bind for 0.0.0.0:29999 failed: port is already allocated` | 已有另一个 URSim 容器占着端口 | `docker ps` 找到旧容器，`docker stop` 它 |
| PolyScope 左下角 No Controller | Apple Silicon 上 amd64 控制器转译失败 | 见 5.4：开 Rosetta、换 x86 Linux 主机或用 PolyScope X 仿真器 |
| `nc` 显示 Connection refused | 没映射 29999/30002 或容器已退出 | 检查 `docker run` 参数和 `docker ps` |
| 重启后程序没了 | 没挂载 `/ursim/programs` | 加 `-v ~/ursim/programs:/ursim/programs` |
| 用容器 IP（如 172.17.x.x）连不上 | Docker Desktop for Mac 不暴露容器网络 | 改用 `127.0.0.1` + 端口映射 |

## 小结

- URSim 是官方仿真器，镜像 `universalrobots/ursim_e-series`，标签即 PolyScope 版本。
- 浏览器访问 `localhost:6080/vnc.html`；后续章节需要额外映射 29999 和 30001～30004。
- 用 `-v ~/ursim/programs:/ursim/programs` 持久保存程序。
- 镜像只有 amd64，Apple Silicon 需 Rosetta，可能遇到 No Controller；备选是 x86 Linux 主机或 PolyScope X 仿真器。
- 在 Mac 上，06/07 章的机器人 IP 填 `127.0.0.1`。

## 自测题

1. 为什么在 Mac 上不能用 `docker inspect` 查到的容器 IP 去连 URSim？
<details><summary>答案</summary>Docker Desktop for Mac 的容器运行在一个隐藏的 Linux 虚拟机里，容器网络不直接暴露给 macOS，只能通过 `-p` 映射到 Mac 本机的端口访问。</details>

2. 想让第 6 章的 Python 程序发送 URScript 和 Dashboard 命令，至少要映射哪些端口？
<details><summary>答案</summary>29999（Dashboard）和 30002（Secondary，发送脚本）；通常把 30001～30004 一起映射，方便后续章节。</details>

3. 容器用 `--rm` 启动后停止，在 PolyScope 里保存的程序还在吗？
<details><summary>答案</summary>如果挂载了 `-v ~/ursim/programs:/ursim/programs` 就在 Mac 的 `~/ursim/programs` 里；没挂载就随容器一起删除了。</details>

4. M2 Mac 上 URSim 显示 No Controller，有哪些办法？
<details><summary>答案</summary>确认 Docker Desktop 启用 Rosetta 并带 `--platform linux/amd64`；换到 x86_64 Linux 主机运行 URSim 后用局域网 IP 连接；或改用支持 arm64 的 `ursim_polyscopex`（但没有 Dashboard Server）。</details>

## 参考资料

- [Docker Hub：universalrobots/ursim_e-series](https://hub.docker.com/r/universalrobots/ursim_e-series) —— 官方镜像、端口、ROBOT_MODEL 与卷挂载说明。
- [Docker Hub：universalrobots/ursim_polyscopex](https://hub.docker.com/r/universalrobots/ursim_polyscopex) —— PolyScope X 仿真器，支持 arm64。
- [官方 start_ursim.sh 脚本（GitHub）](https://github.com/UniversalRobots/Universal_Robots_Client_Library/blob/master/scripts/start_ursim.sh) —— 官方使用的端口映射与网络设置。
- [UR 文章：Remote Control via TCP/IP](https://www.universal-robots.com/articles/ur/interface-communication/remote-control-via-tcpip/) —— 各端口用途与频率。
- [UR 论坛：URSim on M1 MacBook](https://forum.universal-robots.com/t/ursim-on-m1-macbook/14668) —— Apple Silicon 上的社区经验（非官方）。

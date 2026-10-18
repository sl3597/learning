---
title: SSH 与远程工作
type: tutorial
topic: linux
chapter: 17
level: intermediate
tags: [ssh, 密钥, scp, rsync, tmux, 远程服务器, GPU训练]
prerequisites: [10-process-management, 12-networking-basics]
estimated_time: 60min
sources:
  - https://man.openbsd.org/ssh
  - https://man7.org/linux/man-pages/man1/rsync.1.html
  - https://github.com/tmux/tmux/wiki
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# SSH 与远程工作（SSH & Remote Work）

> 训练 VLA 模型的 GPU 服务器在机房里，你在自己的 Mac 前。本章教你安全地连上去、把文件传过去、让任务在你断线后继续跑。

## 学习目标

- 能用 `ssh 用户@主机` 登录服务器，并用密钥实现免密登录。
- 能用 `~/.ssh/config` 给服务器起别名。
- 能用 `scp` / `rsync` 在本地与服务器之间传文件。
- 能用 `tmux` 创建会话、分离、重新接入，让训练任务不因断网而中断。
- 掌握"在服务器上跑训练任务"的标准流程。

## 前置知识

- 需要先读：[10 进程管理](10-process-management.md)、[12 网络基础](12-networking-basics.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **SSH** | 加密的远程登录协议和命令 | 加密电话线 |
| **公钥 / 私钥** | 一对钥匙：公钥放服务器（锁），私钥留本机（钥匙） | 锁与钥匙 |
| **scp / rsync** | 通过 SSH 复制文件；rsync 只传差异 | 快递 / 增量快递 |
| **tmux** | 终端复用器，会话在服务器上持续存在 | 可以随时离开再回来的工位 |
| **端口转发** | 把服务器的端口映射到本机 | 把远程电视信号接到本地屏幕 |

## 详细讲解

### 17.1 登录

```bash
ssh sde@192.168.1.50          # 用户名@IP 或域名
ssh -p 2222 sde@host          # 非默认端口
exit                          # 退出
```

第一次连接会问 "Are you sure you want to continue connecting?"，输入 `yes`，服务器指纹会存入 `~/.ssh/known_hosts`。

### 17.2 密钥免密登录

```bash
ssh-keygen -t ed25519 -C "katrina@mac"     # 生成密钥对，一路回车（可设密码短语）
ls ~/.ssh/                                 # id_ed25519（私钥）、id_ed25519.pub（公钥）
ssh-copy-id sde@192.168.1.50               # 把公钥装到服务器（输一次密码）
ssh sde@192.168.1.50                       # 之后免密
```

没有 `ssh-copy-id` 时手动：把 `~/.ssh/id_ed25519.pub` 内容追加到服务器的 `~/.ssh/authorized_keys`。

> ⚠️ 注意：私钥 `id_ed25519` 绝不要发给任何人、不要提交到 Git。权限必须是 `600`，`~/.ssh` 目录 `700`。

### 17.3 别名：~/.ssh/config

```bash
nano ~/.ssh/config
```

```text
Host gpu
    HostName 192.168.1.50
    User sde
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
```

之后 `ssh gpu`、`scp file gpu:~/` 都能用。`ServerAliveInterval` 防止长时间不操作被断开。

### 17.4 传文件：scp 与 rsync

```bash
scp local.txt gpu:~/data/               # 本地 → 服务器
scp gpu:~/results/out.csv ./            # 服务器 → 本地
scp -r ./project gpu:~/                 # 目录
```

`rsync` 更适合大目录和反复同步（只传变化部分，可断点续传）：

```bash
rsync -avz --progress ./dataset/ gpu:~/dataset/     # 注意末尾 / 的含义
rsync -avz gpu:~/checkpoints/ ./checkpoints/
rsync -avz --exclude="*.pyc" --exclude="__pycache__" ./code/ gpu:~/code/
rsync -avzn ./a/ gpu:~/a/               # -n 预演，不真正传
```

- `-a` 保留权限时间等，`-v` 显示，`-z` 压缩。
- `src/`（带斜杠）= 把目录**里的内容**同步过去；`src`（不带）= 把目录本身放过去。

macOS 自带的 rsync 版本较老，可 `brew install rsync`。

### 17.5 tmux：断线不丢任务

直接在 SSH 里跑训练，网络一断进程就死。**tmux** 让会话活在服务器上，你随时离开、随时回来。

```bash
tmux new -s train           # 新建名为 train 的会话
# 在里面启动训练：
python train.py
# 按 Ctrl+B 再按 D：分离（detach），回到普通 shell，训练继续
tmux ls                     # 列出会话
tmux attach -t train        # 重新接入
tmux kill-session -t train  # 结束会话
```

tmux 的所有快捷键都先按 `Ctrl + B`（前缀键）再按另一个键：

| 按键（Ctrl+B 之后） | 作用 |
|---|---|
| `d` | 分离 |
| `c` | 新窗口 |
| `n` / `p` | 下 / 上一个窗口 |
| `%` / `"` | 左右 / 上下分屏 |
| 方向键 | 在分屏间移动 |
| `[` | 进入滚动模式（`q` 退出） |
| `x` | 关闭当前面板 |

> 💡 要点：登录服务器第一件事 `tmux attach || tmux new`，所有长任务都在 tmux 里跑。

### 17.6 端口转发：在本地看服务器上的网页

TensorBoard、Jupyter 跑在服务器的 6006/8888 端口，本地浏览器打不开。用 `-L` 把它映射过来：

```bash
ssh -L 6006:localhost:6006 gpu       # 本地 6006 → 服务器 6006
# 本地浏览器打开 http://localhost:6006
ssh -N -f -L 8888:localhost:8888 gpu  # -N 不开 shell，-f 后台
```

### 17.7 服务器跑训练的标准流程

1. `ssh gpu`，`tmux attach || tmux new -s train`。
2. `conda activate vla`，`nvidia-smi` 确认空闲 GPU。
3. `cd ~/project && git pull`（代码用 git 同步，数据用 rsync）。
4. `CUDA_VISIBLE_DEVICES=0 python train.py 2>&1 | tee logs/run1.log`。
5. `Ctrl+B D` 分离，`exit` 下线。
6. 回来时 `ssh gpu`，`tmux attach -t train` 或 `tail -f ~/project/logs/run1.log`。
7. 结果 `rsync -avz gpu:~/project/results/ ./results/` 拉回本地。

VS Code 用户可以安装 "Remote - SSH" 扩展，用图形编辑器直接改服务器上的代码。

## 动手练习

1. 生成 ed25519 密钥对，查看公钥内容，并确认私钥权限是 600。
<details><summary>参考做法</summary>

```bash
ssh-keygen -t ed25519
cat ~/.ssh/id_ed25519.pub
ls -l ~/.ssh/id_ed25519      # -rw-------
```
</details>

2. 本机练习 tmux：新建会话 `demo`，在里面运行 `sleep 600`，分离，`tmux ls` 查看，再接入并 `Ctrl+C` 结束，最后关闭会话。
<details><summary>参考做法</summary>`tmux new -s demo` → `sleep 600` → `Ctrl+B D` → `tmux ls` → `tmux attach -t demo` → `Ctrl+C` → `exit`。</details>

3. 用 rsync 的 `-n` 预演模式把 `~/demo` 同步到 `/tmp/demo_copy`，观察输出后去掉 `-n` 真正执行。
<details><summary>参考做法</summary>

```bash
rsync -avn ~/demo/ /tmp/demo_copy/
rsync -av ~/demo/ /tmp/demo_copy/
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `Permission denied (publickey)` | 公钥没装对 / 私钥权限不对 / 用户名错 | `ssh -v` 看详细；检查 `authorized_keys` 与 `chmod 600` |
| `Connection refused` | 服务器 sshd 没运行或端口错 | 服务器上 `systemctl status ssh`；确认 `-p` |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | 服务器重装导致指纹变化 | 确认安全后 `ssh-keygen -R 主机` 删除旧指纹 |
| 断网后训练停了 | 没用 tmux | 以后在 tmux 里跑 |
| rsync 把目录套了一层 | 源路径末尾少了 `/` | 注意 `src/` 与 `src` 区别 |

## 小结

- `ssh 用户@主机` 登录；`ssh-keygen` + `ssh-copy-id` 免密；`~/.ssh/config` 起别名。
- 小文件 `scp`，大目录 `rsync -avz`，`-n` 先预演。
- 长任务一律在 `tmux` 里跑：`new`、`Ctrl+B D`、`attach`。
- `ssh -L` 端口转发看 TensorBoard / Jupyter。

## 自测题

1. 公钥和私钥分别放在哪台机器？
<details><summary>答案</summary>公钥放服务器的 `~/.ssh/authorized_keys`，私钥留在本机 `~/.ssh/` 且不外传。</details>

2. tmux 中分离会话的按键？
<details><summary>答案</summary>先 `Ctrl+B`，再按 `d`。</details>

3. `rsync -avz ./data/ gpu:~/data/` 和 `rsync -avz ./data gpu:~/data/` 的区别？
<details><summary>答案</summary>前者把 data 里的内容放进远程 data；后者会生成远程 `~/data/data/`。</details>

4. 想在本地浏览器打开服务器上 6006 端口的 TensorBoard，怎么做？
<details><summary>答案</summary>`ssh -L 6006:localhost:6006 gpu`，然后访问 `http://localhost:6006`。</details>

## 参考资料

- [OpenSSH ssh 手册](https://man.openbsd.org/ssh) —— 所有选项与 config 字段。
- [rsync(1) 手册](https://man7.org/linux/man-pages/man1/rsync.1.html) —— 同步规则。
- [tmux 官方 Wiki](https://github.com/tmux/tmux/wiki) —— 入门与配置。
- [Ubuntu：OpenSSH Server](https://ubuntu.com/server/docs/openssh-server) —— 服务器端配置。

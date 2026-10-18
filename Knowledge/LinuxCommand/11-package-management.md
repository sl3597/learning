---
title: 软件包管理
type: tutorial
topic: linux
chapter: 11
level: beginner
tags: [apt, dnf, brew, pip, conda, 软件安装, 软件源]
prerequisites: [07-permissions-and-users]
estimated_time: 40min
sources:
  - https://ubuntu.com/server/docs/package-management
  - https://docs.brew.sh/Manpage
  - https://pip.pypa.io/en/stable/user_guide/
  - https://docs.conda.io/projects/conda/en/stable/user-guide/getting-started.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 软件包管理（Package Management）

> 终端里没有"下载安装包双击下一步"。本章教你用包管理器一条命令装软件：系统级用 apt / brew，Python 级用 pip / conda。

## 学习目标

- 能用 `apt` 在 Ubuntu 上搜索、安装、更新、卸载软件。
- 能用 `brew` 在 macOS 上做同样的事。
- 能区分系统包管理器与 Python 包管理器（pip / conda）的职责。
- 能创建并切换一个 conda 虚拟环境。
- 知道什么是"软件源"以及为什么要换国内源。

## 前置知识

- 需要先读：[07 权限与用户](07-permissions-and-users.md)（理解 `sudo`）

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **包（package）** | 打包好的软件及其元数据 | 一盒拼装好的家具 |
| **包管理器** | 负责下载、安装、更新、卸载、解决依赖的工具 | 应用商店 |
| **依赖（dependency）** | 一个软件运行所需的其他软件 | 家具需要的螺丝 |
| **软件源（repository）** | 包管理器下载包的服务器地址 | 商店的仓库 |
| **虚拟环境** | 隔离的 Python 环境，各项目互不干扰 | 每个项目一间独立工作室 |

## 详细讲解

### 11.1 Ubuntu / Debian：apt

```bash
sudo apt update                 # 刷新软件列表（安装前必做）
sudo apt upgrade                # 升级所有已装软件
apt search htop                 # 搜索
apt show htop                   # 看详情
sudo apt install htop git tmux  # 安装（可多个）
sudo apt remove htop            # 卸载，保留配置
sudo apt purge htop             # 卸载并删配置
sudo apt autoremove             # 清理不再需要的依赖
dpkg -l | grep python3          # 列出已安装的包
```

> 💡 要点：`apt update` 不升级软件，只更新"货架清单"；`apt upgrade` 才真正升级。

CentOS / Fedora 用 `dnf`（旧版 `yum`）：`sudo dnf install htop`。

### 11.2 macOS：Homebrew

macOS 没有自带包管理器，社区标准是 **Homebrew**。安装（官方一行命令）：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> ⚠️ 注意：从网上 `curl | bash` 等于"下载并直接执行脚本"，只对可信来源（如 Homebrew 官网）这样做。

```bash
brew install htop wget tmux     # 命令行工具
brew install --cask iterm2      # 图形应用（cask）
brew search coreutils
brew upgrade                    # 升级全部
brew uninstall htop
brew list
brew doctor                     # 诊断问题
```

Homebrew 不需要 `sudo`。

### 11.3 Python 包：pip

**pip** 是 Python 自带的包管理器，装的是 Python 库（如 numpy、torch）。

```bash
pip install numpy               # 安装
pip install "torch>=2.0"        # 指定版本
pip install -r requirements.txt # 按清单批量安装
pip list                        # 已安装
pip show torch                  # 版本、位置
pip uninstall numpy
pip freeze > requirements.txt   # 导出当前环境清单
```

> ⚠️ 注意：不要在系统 Python 上 `sudo pip install`，会弄乱系统。请先创建虚拟环境（下一节）。

### 11.4 conda：环境 + 包一起管

**conda**（推荐轻量版 Miniconda）既能管 Python 版本，又能装非 Python 依赖（如 CUDA 相关库），深度学习项目几乎都用它。

```bash
conda create -n vla python=3.10      # 创建名为 vla 的环境
conda activate vla                   # 进入（提示符前会出现 (vla)）
pip install torch transformers       # 在环境里装包（conda 环境里也用 pip）
conda deactivate                     # 退出
conda env list                       # 所有环境
conda env remove -n vla              # 删除
conda env export > environment.yml   # 导出
```

规则：**一个项目一个环境**。切换环境后 `which python` 会指向该环境的解释器。

### 11.5 换软件源

国内访问默认源可能很慢。思路都是"把下载地址改成镜像站"：

- apt：编辑 `/etc/apt/sources.list`（Ubuntu 22.04+ 在 `/etc/apt/sources.list.d/ubuntu.sources`），把 `archive.ubuntu.com` 换成镜像域名，然后 `sudo apt update`。
- pip：`pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple`。
- conda：编辑 `~/.condarc` 添加镜像 channels。
- brew：参考镜像站说明设置环境变量 `HOMEBREW_BREW_GIT_REMOTE` 等。

常用镜像站：清华 TUNA、中科大 USTC、阿里云。具体配置以各镜像站首页说明为准。

### 11.6 从源码安装

包管理器里没有的软件通常走：

```bash
git clone https://github.com/xxx/yyy.git
cd yyy
pip install -e .          # Python 项目：可编辑安装，改代码即生效
# 或 C/C++ 项目：
mkdir build && cd build && cmake .. && make -j8 && sudo make install
```

## 动手练习

1. 在你的系统上安装 `htop` 和 `tree`（Ubuntu 用 apt，macOS 用 brew），运行 `tree ~/demo` 查看效果。
<details><summary>参考做法</summary>

```bash
brew install htop tree        # macOS
sudo apt install htop tree    # Ubuntu
tree ~/demo
```
</details>

2. 创建 conda 环境 `test310`，Python 3.10，装 `numpy`，验证 `python -c "import numpy; print(numpy.__version__)"`，然后删除该环境。
<details><summary>参考做法</summary>

```bash
conda create -n test310 python=3.10 -y
conda activate test310
pip install numpy
python -c "import numpy; print(numpy.__version__)"
conda deactivate
conda env remove -n test310
```
</details>

3. 把 pip 源换成清华镜像，再 `pip download requests` 感受速度（不安装）。
<details><summary>参考做法</summary>

```bash
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple
pip download requests -d /tmp/pipdl
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `E: Unable to locate package` | 没 `apt update` 或包名拼错 | `sudo apt update` 后 `apt search` |
| `Could not get lock /var/lib/dpkg/lock` | 另一个 apt 正在运行 | 等待或 `ps aux | grep apt` 后处理 |
| `pip install` 装到了错误的 Python | 多个 Python 共存 | `which pip`，或用 `python -m pip install` |
| `conda activate` 报 shell 未初始化 | 未执行 `conda init` | `conda init zsh` 后重开终端 |
| brew 报 `Permission denied` | 用 sudo 装过 brew 导致权限混乱 | `sudo chown -R $(whoami) $(brew --prefix)/*` |

## 小结

- Ubuntu：`sudo apt update && sudo apt install 包名`；macOS：`brew install 包名`。
- Python 库用 pip；环境和复杂依赖用 conda；一个项目一个环境。
- 不要 `sudo pip`。
- 慢就换国内镜像源。

## 自测题

1. `apt update` 和 `apt upgrade` 有什么区别？
<details><summary>答案</summary>`update` 刷新可用软件列表；`upgrade` 实际升级已安装的软件。</details>

2. 为什么推荐用 conda 环境而不是直接 pip 到系统 Python？
<details><summary>答案</summary>隔离不同项目的依赖，避免版本冲突和损坏系统 Python。</details>

3. 如何确认当前 pip 属于哪个 Python？
<details><summary>答案</summary>`which pip` 或 `python -m pip --version`。</details>

4. macOS 上的包管理器叫什么，需要 sudo 吗？
<details><summary>答案</summary>Homebrew（brew），不需要 sudo。</details>

## 参考资料

- [Ubuntu Server 文档：Package Management](https://ubuntu.com/server/docs/package-management) —— apt 官方指南。
- [Homebrew 手册](https://docs.brew.sh/Manpage) —— 全部子命令。
- [pip 用户指南](https://pip.pypa.io/en/stable/user_guide/) —— requirements、配置文件。
- [conda 入门](https://docs.conda.io/projects/conda/en/stable/user-guide/getting-started.html) —— 环境管理。
- [清华大学开源软件镜像站](https://mirrors.tuna.tsinghua.edu.cn/) —— 各类换源教程。

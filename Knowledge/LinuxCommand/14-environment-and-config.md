---
title: 环境变量与 Shell 配置
type: tutorial
topic: linux
chapter: 14
level: intermediate
tags: [环境变量, PATH, export, zshrc, bashrc, alias, source]
prerequisites: [11-package-management]
estimated_time: 45min
sources:
  - https://www.gnu.org/software/bash/manual/html_node/Environment.html
  - https://zsh.sourceforge.io/Doc/Release/Files.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 环境变量与 Shell 配置（Environment & Config）

> "为什么我装了 conda 但 `python` 还是系统的？""为什么每次开终端都要重新设置？"答案都在环境变量和 `.zshrc` 里。本章让你掌握 shell 的"设置面板"。

## 学习目标

- 能解释环境变量是什么，并用 `echo`、`env`、`export` 查看和设置。
- 能解释 `PATH` 的查找机制，并正确地给 `PATH` 添加目录。
- 能编辑 `.zshrc` / `.bashrc` 让设置永久生效，并用 `source` 立即加载。
- 能用 `alias` 创建命令别名。

## 前置知识

- 需要先读：[11 软件包管理](11-package-management.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **变量** | 一个名字对应一个值 | 贴了标签的盒子 |
| **环境变量** | 会传递给子程序的变量，如 `HOME`、`PATH` | 全公司都能看到的公告 |
| **PATH** | shell 查找命令的目录列表，冒号分隔 | 找人时依次查的办公室列表 |
| **export** | 把普通变量升级为环境变量 | 把便签贴到公告栏 |
| **.zshrc / .bashrc** | 每次打开 shell 自动执行的配置脚本 | 开机自启动的设置 |
| **alias** | 给长命令起短名 | 快捷键 |
| **source** | 在当前 shell 里执行脚本（而不是开新进程） | 现场宣读而不是派人去读 |

## 详细讲解

### 14.1 查看与设置变量

```bash
echo $HOME            # 家目录
echo $USER
echo $SHELL
env                   # 列出所有环境变量
env | grep CUDA       # 过滤
printenv PATH

MYVAR="hello"         # 设置普通变量（等号两边不能有空格）
echo $MYVAR
python3 -c "import os; print(os.environ.get('MYVAR'))"   # None：子程序看不到

export MYVAR          # 升级为环境变量
python3 -c "import os; print(os.environ.get('MYVAR'))"   # hello
export CUDA_VISIBLE_DEVICES=0,1   # 一步到位：常用来指定训练用哪几张 GPU
unset MYVAR           # 删除
```

只对一条命令生效的写法：

```bash
CUDA_VISIBLE_DEVICES=1 python train.py
```

### 14.2 PATH：命令是怎么被找到的

```bash
echo $PATH
```

```text
# 输出示例：
/opt/miniconda3/bin:/usr/local/bin:/usr/bin:/bin
```

输入 `python` 时，shell 从左到右依次在这些目录找名为 `python` 的可执行文件，**找到第一个就停**。所以：

- conda 把自己的目录加在最前面，`python` 就变成了 conda 的。
- 自己写的脚本放进 PATH 里的目录（或把目录加进 PATH），就能像命令一样直接调用。

```bash
which -a python       # 看所有候选，第一个是实际使用的
export PATH="$HOME/bin:$PATH"     # 把 ~/bin 加到最前面
export PATH="$PATH:/opt/tool/bin" # 加到最后
```

> ⚠️ 注意：一定要带上 `:$PATH`，否则会覆盖整个 PATH，连 `ls` 都找不到。如果不小心弄坏了，关闭终端重开即可（只要没写进配置文件）。

### 14.3 让设置永久生效：配置文件

终端里直接 `export` 的变量在关闭窗口后消失。要永久生效，写进配置文件：

| Shell | 文件 | 加载时机 |
|---|---|---|
| zsh（macOS 默认） | `~/.zshrc` | 每次打开交互式 shell |
| bash（Ubuntu 默认） | `~/.bashrc` | 每次打开交互式 shell |
| bash 登录 shell | `~/.bash_profile` 或 `~/.profile` | 登录时（SSH 登录会读它） |

```bash
nano ~/.zshrc
```

在末尾加入：

```bash
# 自定义 PATH
export PATH="$HOME/bin:$PATH"
# 常用环境变量
export EDITOR=nano
export HF_HOME="$HOME/.cache/huggingface"   # 模型缓存目录
```

保存后让它立即生效：

```bash
source ~/.zshrc      # 或 . ~/.zshrc
```

> 💡 要点：`source` 在**当前** shell 里执行文件；直接 `bash ~/.zshrc` 会在子进程里执行，设置不会留下来。

### 14.4 alias：命令别名

```bash
alias ll='ls -lah'
alias gs='git status'
alias rm='rm -i'                 # 删除前确认
alias train='cd ~/proj && conda activate vla && python train.py'
alias                            # 列出所有别名
unalias ll
```

写进 `~/.zshrc` 后永久生效。想临时绕过别名，在命令前加 `\`：`\rm file`。

### 14.5 conda 是怎么改你的 shell 的

`conda init zsh` 会在 `~/.zshrc` 末尾插入一段 `>>> conda initialize >>>`，它把 conda 目录加进 PATH 并定义 `conda activate` 函数。这就是为什么装完 conda 要重开终端。

如果不想每次开终端都自动进入 base 环境：

```bash
conda config --set auto_activate_base false
```

### 14.6 常用的内置变量

| 变量 | 含义 |
|---|---|
| `$HOME` | 家目录 |
| `$PWD` | 当前目录 |
| `$USER` | 用户名 |
| `$?` | 上一条命令的退出码（0 成功） |
| `$$` | 当前 shell 的 PID |
| `$!` | 最近一个后台进程的 PID |
| `$0` | 当前脚本名 |

## 动手练习

1. 创建 `~/bin/hi`，内容为 `echo "hi from $USER"`，加执行权限，把 `~/bin` 加入 PATH 并写进 `~/.zshrc`，在任意目录输入 `hi` 验证。
<details><summary>参考做法</summary>

```bash
mkdir -p ~/bin
echo 'echo "hi from $USER"' > ~/bin/hi
chmod +x ~/bin/hi
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
cd /tmp && hi
```
</details>

2. 定义别名 `ll='ls -lah'` 并写进配置文件，重开终端验证仍可用。
<details><summary>参考做法</summary>

```bash
echo "alias ll='ls -lah'" >> ~/.zshrc
source ~/.zshrc
ll
```
</details>

3. 只对一条命令设置 `MODE=debug`，用 `python3 -c "import os; print(os.environ['MODE'])"` 验证，然后再 `echo $MODE` 确认它没留下来。
<details><summary>参考做法</summary>

```bash
MODE=debug python3 -c "import os; print(os.environ['MODE'])"
echo $MODE      # 空
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 改了 `.zshrc` 没效果 | 没 `source` 或改错了文件（bash 用户改了 zshrc） | `echo $SHELL` 确认，`source` 对应文件 |
| 所有命令都 `command not found` | PATH 被覆盖 | 关闭终端重开；检查配置文件里是否漏了 `:$PATH` |
| `MYVAR = 1` 报错 | 等号两边有空格 | `MYVAR=1` |
| SSH 登录后环境变量没了 | 登录 shell 读的是 `.bash_profile` 不是 `.bashrc` | 在 `.bash_profile` 里加 `source ~/.bashrc` |
| `python` 仍是系统版 | conda 目录不在 PATH 前面 | `conda activate`，或检查 `which -a python` |

## 小结

- `export VAR=值` 设环境变量；`VAR=值 命令` 只对一条命令生效。
- PATH 从左到右找命令，第一个命中为准；追加时必带 `$PATH`。
- 永久设置写 `~/.zshrc`（zsh）或 `~/.bashrc`（bash），`source` 立即生效。
- `alias` 短命令，`\命令` 绕过别名。

## 自测题

1. `export PATH="/opt/x/bin"` 会造成什么后果？
<details><summary>答案</summary>覆盖整个 PATH，除 `/opt/x/bin` 外所有命令都找不到；应写 `export PATH="/opt/x/bin:$PATH"`。</details>

2. `source ~/.zshrc` 和 `zsh ~/.zshrc` 的区别？
<details><summary>答案</summary>`source` 在当前 shell 执行，变量和别名留下；`zsh 文件` 在子进程执行，结束后一切消失。</details>

3. 怎样让 `python train.py` 只用第 2 张 GPU？
<details><summary>答案</summary>`CUDA_VISIBLE_DEVICES=1 python train.py`（编号从 0 开始）。</details>

4. `$?` 是什么？
<details><summary>答案</summary>上一条命令的退出码，0 表示成功。</details>

## 参考资料

- [Bash 手册：Environment](https://www.gnu.org/software/bash/manual/html_node/Environment.html) —— 环境变量的继承规则。
- [zsh 启动文件说明](https://zsh.sourceforge.io/Doc/Release/Files.html) —— `.zshrc`、`.zprofile` 的加载顺序。
- [Ubuntu 社区：EnvironmentVariables](https://help.ubuntu.com/community/EnvironmentVariables) —— 系统级与用户级设置。

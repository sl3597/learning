---
title: Shell 脚本入门
type: tutorial
topic: linux
chapter: 15
level: intermediate
tags: [shell脚本, bash, 变量, 条件, 循环, 函数, 退出码]
prerequisites: [14-environment-and-config]
estimated_time: 60min
sources:
  - https://www.gnu.org/software/bash/manual/bash.html
  - https://www.shellcheck.net/
  - https://missing.csail.mit.edu/2020/shell-tools/
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# Shell 脚本入门（Shell Scripting Basics）

> 把你每天重复敲的那几条命令放进一个文件，就是脚本。本章用一个"批量跑实验"的例子，带你学会变量、判断、循环、函数和参数。

## 学习目标

- 能写出带 shebang、可执行的 bash 脚本并运行。
- 能正确使用变量、引号、命令替换 `$(...)`。
- 能用 `if`、`for`、`while` 控制流程，用函数复用代码。
- 能读取脚本参数 `$1`、`$@`，并用退出码判断成功失败。
- 能用 `set -e` 和 shellcheck 写出更安全的脚本。

## 前置知识

- 需要先读：[14 环境变量与配置](14-environment-and-config.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **shebang `#!`** | 脚本第一行，指定用哪个解释器运行 | 文件开头写"请用中文读" |
| **变量** | 存值的名字，用 `$名` 取值 | 盒子 |
| **命令替换 `$(cmd)`** | 把命令输出当成值 | 把计算结果填进表格 |
| **退出码** | 命令结束时返回的数字，0 成功，非 0 失败 | 任务完成单上的勾或叉 |
| **位置参数 `$1 $2`** | 运行脚本时传进来的参数 | 函数的入参 |

## 详细讲解

### 15.1 第一个脚本

```bash
mkdir -p ~/demo/scripts && cd ~/demo/scripts
nano hello.sh
```

```bash
#!/usr/bin/env bash
# 这是注释。上一行是 shebang：用环境里的 bash 来执行
echo "Hello, $USER! Today is $(date +%Y-%m-%d)"
```

```bash
chmod +x hello.sh
./hello.sh
```

脚本用 bash 而不是 zsh 写，是因为服务器上 bash 一定在，兼容性最好。

### 15.2 变量与引号

```bash
name="VLA"                 # 等号两边无空格
count=3
echo "model: $name, runs: $count"      # 双引号：会展开变量
echo 'model: $name'                    # 单引号：原样输出
echo "files: $(ls | wc -l)"            # 命令替换
dir="my project"
ls "$dir"                              # 变量一定加双引号，否则空格会拆成两个参数
```

> 💡 要点：变量取值时**总是**写 `"$var"`，这能避免 90% 的脚本 bug。

### 15.3 参数与退出码

```bash
#!/usr/bin/env bash
echo "脚本名: $0"
echo "第一个参数: $1"
echo "参数个数: $#"
echo "所有参数: $@"
```

```bash
./args.sh a b c
```

退出码：

```bash
ls /nonexistent
echo $?          # 2，失败
ls /
echo $?          # 0，成功
exit 1           # 脚本中主动以失败退出
```

### 15.4 条件判断：if

```bash
#!/usr/bin/env bash
if [ -z "$1" ]; then          # -z：字符串为空
  echo "用法: $0 <config.yaml>"
  exit 1
fi

if [ -f "$1" ]; then          # -f：是文件
  echo "找到配置 $1"
elif [ -d "$1" ]; then        # -d：是目录
  echo "$1 是目录"
else
  echo "不存在" && exit 1
fi

if [ "$count" -gt 2 ]; then echo "大于 2"; fi    # 数字比较：-eq -ne -gt -lt -ge -le
if [[ "$name" == VLA* ]]; then echo "以 VLA 开头"; fi   # [[ ]] 支持通配与 &&、||
```

`[ ]` 内部两边必须有空格。

### 15.5 循环：for 与 while

```bash
for f in *.yaml; do
  echo "处理 $f"
done

for i in {1..3}; do echo "run $i"; done

for lr in 0.001 0.0005 0.0001; do
  echo "python train.py --lr $lr"
done

n=0
while [ "$n" -lt 3 ]; do
  echo "n=$n"; n=$((n + 1))        # $(( )) 算术
done

while read -r line; do           # 逐行读文件
  echo "行: $line"
done < servers.txt
```

### 15.6 函数

```bash
log() {
  echo "[$(date +%H:%M:%S)] $*"
}

run_exp() {
  local lr="$1"                   # local：局部变量
  log "开始 lr=$lr"
  python train.py --lr "$lr" || return 1
  log "完成 lr=$lr"
}

run_exp 0.001
```

### 15.7 更安全的脚本模板

```bash
#!/usr/bin/env bash
set -euo pipefail
# -e：任一命令失败立即退出
# -u：使用未定义变量报错
# -o pipefail：管道中任一环节失败视为失败

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"   # 脚本所在目录，无论从哪运行
cd "$SCRIPT_DIR"

main() {
  local config="${1:-config.yaml}"   # 默认值
  echo "using $config"
}

main "$@"
```

检查脚本：`shellcheck script.sh`（`brew install shellcheck` / `apt install shellcheck`），它会指出引号、空格等常见错误。

### 15.8 综合示例：批量跑实验

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p logs
for lr in 0.001 0.0005; do
  for bs in 16 32; do
    name="lr${lr}_bs${bs}"
    echo "=== $name ==="
    python train.py --lr "$lr" --batch-size "$bs" > "logs/$name.log" 2>&1 || echo "FAILED: $name"
  done
done
echo "all done"
```

## 动手练习

1. 写 `backup.sh`：接受一个目录参数，把它打包成 `目录名_日期.tar.gz`；参数缺失时打印用法并以退出码 1 结束。
<details><summary>参考做法</summary>

```bash
#!/usr/bin/env bash
set -euo pipefail
if [ -z "${1:-}" ]; then echo "用法: $0 <dir>"; exit 1; fi
name="$(basename "$1")_$(date +%Y%m%d).tar.gz"
tar -czf "$name" "$1" && echo "created $name"
```
</details>

2. 写 `count_lines.sh`：遍历当前目录所有 `.txt` 文件，打印每个文件的行数，最后打印总行数。
<details><summary>参考做法</summary>

```bash
#!/usr/bin/env bash
total=0
for f in *.txt; do
  n=$(wc -l < "$f"); echo "$f: $n"; total=$((total + n))
done
echo "total: $total"
```
</details>

3. 用 `shellcheck` 检查上面两个脚本，修复所有警告。
<details><summary>参考做法</summary>`shellcheck backup.sh count_lines.sh`，常见警告是变量未加引号。</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `Permission denied` | 没加执行权限 | `chmod +x` |
| `bad interpreter` | shebang 路径错，或文件是 Windows 换行（CRLF） | `tr -d '\r'` 或 `dos2unix` |
| `[: too many arguments` | 变量含空格没加引号 | `[ "$var" = x ]` |
| `unbound variable` | `set -u` 下用了未定义变量 | 用 `${var:-默认}` |
| 变量在循环后消失 | 管道 `| while` 在子 shell 里运行 | 用 `while ... done < file` 重定向 |

## 小结

- 脚本 = shebang + 命令；`chmod +x` 后 `./运行`。
- 变量 `name=值`，取值 `"$name"`，命令替换 `$(...)`，算术 `$(( ))`。
- `if [ ]`、`for in`、`while`、函数 + `local`。
- `$1 $@ $# $?`；`exit 非0` 表示失败。
- 模板开头 `set -euo pipefail`，写完跑 shellcheck。

## 自测题

1. `echo '$HOME'` 和 `echo "$HOME"` 输出分别是什么？
<details><summary>答案</summary>前者原样输出 `$HOME`，后者输出家目录路径。</details>

2. 如何判断脚本至少收到一个参数？
<details><summary>答案</summary>`if [ $# -lt 1 ]; then ...; fi` 或 `if [ -z "${1:-}" ]`。</details>

3. `set -e` 的作用？
<details><summary>答案</summary>任一命令返回非 0 退出码时脚本立即终止。</details>

4. 为什么推荐 `#!/usr/bin/env bash` 而不是 `#!/bin/bash`？
<details><summary>答案</summary>`env` 会在 PATH 中查找 bash，适配 bash 不在 `/bin` 的系统（如 macOS 用 brew 装的新版 bash）。</details>

## 参考资料

- [GNU Bash 手册](https://www.gnu.org/software/bash/manual/bash.html) —— 语法权威。
- [ShellCheck](https://www.shellcheck.net/) —— 在线脚本检查器。
- [MIT Missing Semester – Shell Tools and Scripting](https://missing.csail.mit.edu/2020/shell-tools/) —— 脚本实战。
- [Bash Pitfalls](https://mywiki.wooledge.org/BashPitfalls) —— 最常见的 bash 坑。

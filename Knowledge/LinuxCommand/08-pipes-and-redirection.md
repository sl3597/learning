---
title: 管道与重定向
type: tutorial
topic: linux
chapter: 8
level: intermediate
tags: [管道, 重定向, stdin, stdout, stderr, tee, xargs]
prerequisites: [07-permissions-and-users]
estimated_time: 50min
sources:
  - https://www.gnu.org/software/bash/manual/html_node/Redirections.html
  - https://linuxcommand.org/lc3_lts0070.php
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 管道与重定向（Pipes & Redirection）

> Unix 的哲学是"每个工具只做一件事，再把它们串起来"。管道 `|` 和重定向 `>` 就是那根"串"，学会它们，命令行才真正开始发挥威力。

## 学习目标

- 能解释 stdin、stdout、stderr 三个"流"分别是什么。
- 能用 `>`、`>>`、`<`、`2>`、`&>` 把输出存到文件、把错误单独处理。
- 能用 `|` 把多个命令串成流水线。
- 能用 `tee` 同时看屏幕和存文件，用 `xargs` 把输出变成参数。

## 前置知识

- 需要先读：[07 权限与用户](07-permissions-and-users.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **stdin（0）** | 标准输入，命令默认从键盘读 | 进水口 |
| **stdout（1）** | 标准输出，正常结果默认打到屏幕 | 出水口 |
| **stderr（2）** | 标准错误，报错信息默认也打到屏幕，但是独立的管道 | 排污口 |
| **重定向** | 把某个流接到文件上 | 把水管接到水桶 |
| **管道 `|`** | 把前一个命令的 stdout 接到后一个命令的 stdin | 把两根水管接起来 |

## 详细讲解

### 8.1 三个流

每个程序运行时都自带三根"管子"：

```text
         ┌──────────┐
键盘 ──▶ │  命令    │ ──▶ 屏幕（stdout, 1）
 (stdin,0)│          │ ──▶ 屏幕（stderr, 2）
         └──────────┘
```

正常结果和错误信息虽然都显示在屏幕上，但走的是不同管道。这就是为什么可以"只把错误存起来"。

### 8.2 输出重定向：> 与 >>

```bash
mkdir -p ~/demo && cd ~/demo
ls -l > list.txt         # 覆盖写入：文件原内容被清空
echo "new line" >> list.txt   # 追加写入
cat list.txt
```

> ⚠️ 注意：`>` 会先清空目标文件再写。`cat a.txt > a.txt` 会把 a.txt 清空！想追加永远用 `>>`。

### 8.3 错误重定向：2> 与 &>

```bash
ls /nonexistent 2> error.txt     # 只把错误写入文件，屏幕上没有
ls /nonexistent 2>/dev/null      # 丢弃错误（/dev/null 是"黑洞"文件）
ls / /nonexistent > out.txt 2>&1 # 正常和错误都写入 out.txt（2>&1 表示"2 跟着 1 走"）
ls / /nonexistent &> all.txt     # 同上，bash/zsh 的简写
```

训练脚本常见写法：

```bash
python train.py > train.log 2>&1 &
```

把所有输出存到 `train.log`，`&` 让它在后台跑（见 [10 进程管理](10-process-management.md)）。

### 8.4 输入重定向：<

```bash
wc -l < list.txt        # 从文件读入作为 stdin
sort < names.txt
```

与 `wc -l list.txt` 的区别：用 `<` 时 `wc` 不知道文件名，输出里不会带文件名。

### 8.5 管道：|

```bash
ls -l | less                       # 列表太长，分页看
cat train.log | grep loss          # 过滤含 loss 的行
grep loss train.log | tail -n 5    # 最后 5 条 loss
ps aux | grep python               # 找正在运行的 python 进程
history | grep ssh                 # 以前敲过哪些 ssh 命令
ls | wc -l                         # 当前目录有几个条目
```

多级流水线：

```bash
cat access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -n 10
```

含义：取日志第一列（IP）→ 排序 → 去重并计数 → 按次数倒序 → 前 10。这些命令在 [09 文本处理](09-text-processing.md) 详讲。

> 💡 要点：管道只传 stdout，不传 stderr。想把错误也送进管道用 `2>&1 |` 或 `|&`。

### 8.6 tee：一边看一边存

```bash
python train.py 2>&1 | tee train.log       # 屏幕实时显示，同时写入文件
python train.py 2>&1 | tee -a train.log    # -a 追加
```

### 8.7 xargs：把输出变成参数

有些命令（如 `rm`、`mkdir`）不从 stdin 读内容，而是从参数读。`xargs` 负责把上一级的输出"贴"成参数：

```bash
find . -name "*.tmp" | xargs rm           # 删除所有 .tmp
find . -name "*.py" | xargs wc -l         # 统计所有 py 文件行数
cat servers.txt | xargs -I{} ping -c 1 {} # -I{} 把每行放到 {} 的位置
find . -name "*.log" -print0 | xargs -0 rm   # 文件名含空格时用 -print0/-0
```

## 动手练习

1. 把 `ls -l /etc` 的结果存到 `etc.txt`，再把 `ls /nonexistent` 的错误追加到同一个文件。
<details><summary>参考做法</summary>

```bash
ls -l /etc > etc.txt
ls /nonexistent 2>> etc.txt
tail -n 3 etc.txt
```
</details>

2. 用一条管道统计 `/etc` 下有多少个以 `.conf` 结尾的文件。
<details><summary>参考做法</summary>

```bash
ls /etc | grep "\.conf$" | wc -l
```
</details>

3. 用 `seq 1 20` 生成数字，通过管道只保留能被 5 整除的（提示：grep 行尾 0 或 5），并同时存到 `five.txt`。
<details><summary>参考做法</summary>

```bash
seq 1 20 | grep -E "[05]$" | tee five.txt
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| 文件内容被清空了 | 用了 `>` 而不是 `>>` | 改用 `>>`；重要文件先备份 |
| `2>&1 >file` 错误没进文件 | 顺序错了，重定向从左到右生效 | 写成 `>file 2>&1` |
| `xargs rm` 对含空格的文件名报错 | 空格被当作分隔符 | `find -print0 | xargs -0` |
| 管道里 `grep` 看不到报错信息 | stderr 不走管道 | 前面加 `2>&1` |

## 小结

- 0 stdin、1 stdout、2 stderr；`>` 覆盖、`>>` 追加、`2>` 错误、`&>` 全部。
- `>file 2>&1` 是"全部存文件"的标准写法，顺序不能反。
- `|` 把 stdout 接给下一个命令的 stdin，可以无限串。
- `tee` 边看边存，`xargs` 把行变参数。

## 自测题

1. `cmd > out.txt 2>&1` 和 `cmd 2>&1 > out.txt` 有什么区别？
<details><summary>答案</summary>前者把 stdout 和 stderr 都写进 out.txt；后者先把 stderr 指向当时的 stdout（屏幕），再把 stdout 改到文件，结果错误仍在屏幕上。</details>

2. 如何丢弃一条命令的所有输出？
<details><summary>答案</summary>`cmd > /dev/null 2>&1` 或 `cmd &> /dev/null`。</details>

3. 为什么 `echo "a.txt" | rm` 不能删除文件？
<details><summary>答案</summary>`rm` 从参数而不是 stdin 读取文件名；应写 `echo "a.txt" | xargs rm`。</details>

4. 训练时想实时看日志又想保存，用什么？
<details><summary>答案</summary>`python train.py 2>&1 | tee train.log`。</details>

## 参考资料

- [Bash 手册：Redirections](https://www.gnu.org/software/bash/manual/html_node/Redirections.html) —— 所有重定向语法。
- [The Linux Command Line – Redirection](https://linuxcommand.org/lc3_lts0070.php) —— 图解三个流。
- [MIT Missing Semester – Shell Tools and Scripting](https://missing.csail.mit.edu/2020/shell-tools/) —— 管道的实战案例。

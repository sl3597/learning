---
title: 查找文件与内容
type: tutorial
topic: linux
chapter: 6
level: beginner
tags: [find, locate, which, whereis, grep, 查找, 搜索]
prerequisites: [05-viewing-and-editing-text]
estimated_time: 40min
sources:
  - https://man7.org/linux/man-pages/man1/find.1.html
  - https://www.gnu.org/software/grep/manual/grep.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 查找文件与内容（Finding Things）

> "那个文件放哪了？""哪个文件里写了这个参数？"本章用 `find` 和 `grep` 回答这两个最高频的问题。

## 学习目标

- 能用 `find` 按名字、类型、大小、修改时间查找文件。
- 能用 `which` / `whereis` 定位一个命令的程序文件在哪。
- 能用 `grep` 在文件中搜索文字，并使用 `-i`、`-r`、`-n` 三个常用选项。
- 知道 `locate` 与 `find` 的区别。

## 前置知识

- 需要先读：[05 查看与编辑文本](05-viewing-and-editing-text.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **find** | 按条件遍历目录树找文件（找"文件本身"） | 翻遍整个柜子找某个文件夹 |
| **locate** | 从预建的数据库里秒查文件名 | 查图书馆的检索卡 |
| **which** | 告诉你一个命令对应的可执行文件路径 | 查"这个人住哪" |
| **grep** | 在文件内容里搜索文字（找"文件里的字"） | 用荧光笔在书里找某个词 |
| **正则表达式** | 描述文字模式的"公式"，grep 的高级用法 | 模糊搜索的语法 |

## 详细讲解

准备练习环境：

```bash
mkdir -p ~/demo/search/{src,logs,data} && cd ~/demo/search
echo "learning_rate = 0.001" > src/config.py
echo "print('hello')" > src/main.py
echo "epoch 1 loss 0.9" > logs/train.log
echo "epoch 2 loss 0.5" >> logs/train.log
seq 1 50000 > data/big.csv
```

### 6.1 find：按条件找文件

语法：`find 起始目录 条件...`

```bash
find . -name "*.py"              # 当前目录下所有 .py 文件
find . -iname "*.LOG"            # -iname 忽略大小写
find . -type d                   # 只找目录（f 文件，d 目录）
find . -type f -size +100k       # 大于 100KB 的文件（+ 大于，- 小于）
find . -mtime -1                 # 最近 1 天内修改过的
find ~ -name "*.pth" 2>/dev/null # 全家目录找模型权重，忽略权限错误
```

把找到的文件交给其他命令处理：

```bash
find . -name "*.log" -exec wc -l {} \;    # 对每个结果执行 wc -l，{} 代表文件名
find . -name "*.tmp" -delete              # 直接删除（⚠️ 先去掉 -delete 预览一遍）
```

> ⚠️ 注意：`-delete` 和 `-exec rm` 不可撤销。先运行不带删除动作的版本，确认列表无误。

### 6.2 locate：秒查但可能过时

`locate` 查的是定期更新的数据库，所以快，但新文件可能查不到。Ubuntu 需要 `sudo apt install plocate`，macOS 用 `mdfind`（Spotlight 的命令行版）：

```bash
locate config.py          # Linux
mdfind -name config.py    # macOS
```

### 6.3 which / whereis：命令在哪

```bash
which python3        # /usr/bin/python3
which -a python3     # 列出 PATH 中所有同名程序（排查"用的是哪个 python"）
whereis ls           # 程序、源码、手册的位置（Linux）
type ls              # 告诉你 ls 是别名、内建还是外部程序
```

> 🔗 关联：装了 conda 后 `which python` 的结果会变化，原理在 [14 环境变量与配置](14-environment-and-config.md) 的 PATH 部分。

### 6.4 grep：在内容里找字

语法：`grep 选项 "要找的文字" 文件...`

```bash
grep "loss" logs/train.log           # 打印含 loss 的行
grep -n "loss" logs/train.log        # 带行号
grep -i "LOSS" logs/train.log        # 忽略大小写
grep -r "learning_rate" .            # 递归搜索整个目录
grep -rn "learning_rate" src/        # 递归 + 行号，最常用组合
grep -c "epoch" logs/train.log       # 只数匹配行数
grep -v "epoch 1" logs/train.log     # 反选：不含 "epoch 1" 的行
grep -l "print" src/*.py             # 只列出含匹配的文件名
```

```text
# grep -rn "learning_rate" src/ 的输出：
src/config.py:1:learning_rate = 0.001
```

### 6.5 正则表达式入门

grep 默认支持基础正则：

| 符号 | 含义 | 示例 |
|---|---|---|
| `^` | 行首 | `grep "^epoch"` |
| `$` | 行尾 | `grep "0.5$"` |
| `.` | 任意一个字符 | `grep "lo.s"` |
| `*` | 前一个字符重复 0 次或多次 | `grep "lo*"` |
| `[0-9]` | 数字 | `grep "epoch [0-9]"` |
| `-E` 扩展正则 | 支持 `+`、`?`、`|`、`()` | `grep -E "loss (0\.[0-9]+)"` |

更深入的用法在 [09 文本处理三剑客](09-text-processing.md)。

### 6.6 find + grep 组合

"在所有 Python 文件里找 `torch.load`"：

```bash
grep -rn "torch.load" --include="*.py" .
# 或
find . -name "*.py" -exec grep -n "torch.load" {} +
```

## 动手练习

1. 在 `~/demo/search` 下找出所有大于 100KB 的文件，并显示它们的大小。
<details><summary>参考做法</summary>

```bash
find . -type f -size +100k -exec ls -lh {} \;
```
</details>

2. 找出 `logs/train.log` 中 loss 小于 0.6 的行（提示：先用 grep 找含 `loss 0.` 的行，再思考怎么筛选）。
<details><summary>参考做法</summary>

```bash
grep -E "loss 0\.[0-5]" logs/train.log
```
`[0-5]` 匹配小数点后第一位是 0~5。
</details>

3. 查出你系统里有几个 `python3`，分别在哪。
<details><summary>参考做法</summary>

```bash
which -a python3
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `find: Permission denied` 刷屏 | 遍历到无权限目录 | 末尾加 `2>/dev/null` |
| `find . -name *.py` 结果不对 | 通配符被 shell 提前展开 | 给模式加引号 `"*.py"` |
| `grep` 搜中文或特殊符号失败 | 符号被当作正则 | 用 `-F` 按字面匹配，或转义 `\.` |
| `locate` 找不到刚建的文件 | 数据库未更新 | `sudo updatedb` 或改用 `find` |

## 小结

- 找文件用 `find 目录 -name "模式"`，条件可叠加 `-type`、`-size`、`-mtime`。
- 找命令位置用 `which`，`which -a` 排查多版本冲突。
- 找内容用 `grep -rn "文字" 目录`，`-i` 忽略大小写、`-v` 反选、`-c` 计数。
- 模式一定加引号；删除动作先预览。

## 自测题

1. `find` 和 `grep` 的根本区别是什么？
<details><summary>答案</summary>`find` 按文件属性（名字、大小、时间）找文件本身；`grep` 在文件内容中搜索文字。</details>

2. 如何在当前项目所有 `.yaml` 文件里找到 `batch_size` 并显示行号？
<details><summary>答案</summary>`grep -rn "batch_size" --include="*.yaml" .`</details>

3. `find . -name "*.log" -delete` 执行前应该先做什么？
<details><summary>答案</summary>先运行 `find . -name "*.log"` 预览将被删除的文件列表。</details>

4. `grep -v` 的作用？
<details><summary>答案</summary>反选，只输出不包含模式的行。</details>

## 参考资料

- [find(1) 手册](https://man7.org/linux/man-pages/man1/find.1.html) —— 所有条件表达式。
- [GNU grep 手册](https://www.gnu.org/software/grep/manual/grep.html) —— 正则语法权威说明。
- [regex101](https://regex101.com/) —— 在线测试正则表达式，可实时看匹配结果。

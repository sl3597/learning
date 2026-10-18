---
title: 文本处理三剑客：grep、sed、awk
type: tutorial
topic: linux
chapter: 9
level: intermediate
tags: [grep, sed, awk, sort, uniq, cut, tr, 日志分析]
prerequisites: [08-pipes-and-redirection]
estimated_time: 60min
sources:
  - https://www.gnu.org/software/sed/manual/sed.html
  - https://www.gnu.org/software/gawk/manual/gawk.html
  - https://www.gnu.org/software/grep/manual/grep.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 文本处理三剑客：grep、sed、awk

> 训练日志几万行、CSV 几百列，怎么快速提取想要的数字？本章用 grep 筛选、sed 替换、awk 按列计算，再配合 sort/uniq/cut/tr，完成一次真实的日志分析。

## 学习目标

- 能用 `grep -E`、`-o`、`-A/-B` 做精确提取和上下文查看。
- 能用 `sed` 做替换、删行、原地修改文件。
- 能用 `awk` 按列取值、求和、求平均。
- 能用 `sort`、`uniq`、`cut`、`tr` 做排序、去重、取列、字符替换。
- 能组合以上命令分析一份训练日志。

## 前置知识

- 需要先读：[08 管道与重定向](08-pipes-and-redirection.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **grep** | 按模式筛选行 | 筛子 |
| **sed** | 流编辑器，对每行做替换/删除 | 查找替换 |
| **awk** | 按列处理的迷你编程语言 | Excel 公式 |
| **sort / uniq** | 排序 / 去重（uniq 只合并相邻重复行，所以先 sort） | 整理名单 |
| **cut** | 按分隔符取某几列 | 剪下表格的一列 |
| **tr** | 逐字符替换或删除 | 大小写转换器 |

## 详细讲解

准备一份模拟训练日志：

```bash
mkdir -p ~/demo && cd ~/demo
cat > train.log <<'EOF'
2026-10-17 10:00:01 INFO epoch=1 step=100 loss=0.912 acc=0.61
2026-10-17 10:00:31 INFO epoch=1 step=200 loss=0.734 acc=0.68
2026-10-17 10:01:02 WARN gpu memory high
2026-10-17 10:01:03 INFO epoch=2 step=300 loss=0.512 acc=0.75
2026-10-17 10:01:33 ERROR dataloader timeout
2026-10-17 10:02:05 INFO epoch=2 step=400 loss=0.401 acc=0.81
2026-10-17 10:02:35 INFO epoch=3 step=500 loss=0.355 acc=0.84
EOF
```

### 9.1 grep 进阶

```bash
grep -E "loss=0\.[0-4]" train.log        # 扩展正则：loss 小于 0.5
grep -o "loss=[0-9.]*" train.log          # -o 只输出匹配部分
grep -A 1 ERROR train.log                 # 错误行及其后 1 行（After）
grep -B 2 ERROR train.log                 # 错误行及其前 2 行（Before）
grep -C 1 WARN train.log                  # 前后各 1 行（Context）
grep -E "WARN|ERROR" train.log            # 或
grep -c INFO train.log                    # 计数
```

### 9.2 sed：替换与删除

语法：`sed '命令' 文件`，最常用的命令是 `s/旧/新/`。

```bash
sed 's/INFO/info/' train.log          # 每行第一个 INFO 替换为 info（只显示，不改文件）
sed 's/INFO/info/g' train.log         # g：每行所有匹配都替换
sed -n '2,4p' train.log               # 只打印 2~4 行（-n 关闭默认输出，p 打印）
sed '/WARN/d' train.log               # 删除含 WARN 的行
sed -E 's/loss=([0-9.]+)/LOSS:\1/' train.log   # 分组引用 \1
```

原地修改文件：

```bash
sed -i 's/0.001/0.0005/' config.yaml       # Linux
sed -i '' 's/0.001/0.0005/' config.yaml    # macOS 必须给 -i 一个（可为空的）后缀参数
```

> ⚠️ 注意：`sed -i` 会直接改写文件，没有撤销。先不带 `-i` 看看输出，或者用 `-i.bak` 自动留备份（两个系统都支持）。

### 9.3 awk：按列计算

awk 把每行按空白分成字段，`$1` 是第一列，`$NF` 是最后一列，`$0` 是整行。

```bash
awk '{print $3}' train.log                       # 第三列：INFO/WARN/ERROR
awk '$3=="INFO" {print $4, $6}' train.log        # 条件 + 打印
awk -F'=' '{print $NF}' <<< "loss=0.5"           # -F 指定分隔符
```

提取 loss 并求平均：

```bash
grep -o "loss=[0-9.]*" train.log | cut -d= -f2 | awk '{sum+=$1; n++} END {print "avg loss:", sum/n}'
```

```text
# 输出：
avg loss: 0.5828
```

`BEGIN{}` 在读文件前执行，`END{}` 在读完后执行，中间的 `{}` 每行执行一次。

### 9.4 sort / uniq / cut / tr

```bash
cut -d' ' -f3 train.log | sort | uniq -c           # 各级别日志数量
cut -d' ' -f3 train.log | sort | uniq -c | sort -rn   # 按数量倒序
sort -t= -k2 -n scores.txt      # 以 = 分隔，按第 2 列数值排序
sort -u names.txt               # 排序并去重
echo "hello" | tr 'a-z' 'A-Z'   # HELLO
echo "a,b,c" | tr ',' '\n'      # 逗号变换行
tr -d '\r' < win.txt > unix.txt # 删除 Windows 换行符 \r
```

> 💡 要点：`uniq` 只合并**相邻**的重复行，所以几乎总是 `sort | uniq`。

### 9.5 综合案例：分析训练日志

问题 1：每个 epoch 的最后一次 acc 是多少？

```bash
grep INFO train.log | awk '{split($4,e,"="); split($7,a,"="); last[e[2]]=a[2]} END {for (k in last) print "epoch", k, "acc", last[k]}' | sort
```

问题 2：把日志转换成 CSV（step,loss,acc）：

```bash
grep INFO train.log | sed -E 's/.*step=([0-9]+) loss=([0-9.]+) acc=([0-9.]+)/\1,\2,\3/' > metrics.csv
cat metrics.csv
```

问题 3：loss 的最小值出现在哪一步？

```bash
sort -t, -k2 -n metrics.csv | head -n 1
```

### 9.6 macOS 差异

macOS 自带的 `sed`、`awk` 是 BSD 版，`sed -i` 用法不同（见 9.2），部分 `-E` 以外的 GNU 扩展不支持。可用 `brew install gnu-sed gawk`，命令名为 `gsed`、`gawk`。

## 动手练习

1. 从 `train.log` 中提取所有 step 的数字，输出为一行、用空格分隔。
<details><summary>参考做法</summary>

```bash
grep -o "step=[0-9]*" train.log | cut -d= -f2 | tr '\n' ' '; echo
```
</details>

2. 用 sed 把日志里的日期 `2026-10-17` 全部删掉，并保存为 `short.log`（不要修改原文件）。
<details><summary>参考做法</summary>

```bash
sed 's/2026-10-17 //' train.log > short.log
```
</details>

3. 用 awk 算出所有 INFO 行中 acc 的最大值。
<details><summary>参考做法</summary>

```bash
grep -o "acc=[0-9.]*" train.log | cut -d= -f2 | awk 'NR==1||$1>max{max=$1} END{print max}'
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| macOS 上 `sed -i 's/a/b/' f` 报错 | BSD sed 需要后缀参数 | `sed -i '' 's/a/b/' f` |
| `uniq -c` 计数不对 | 没先 `sort` | `sort | uniq -c` |
| awk 的 `$1` 被 shell 展开成空 | 用了双引号 | awk 程序用单引号包住 |
| `grep -E "a|b"` 没匹配 | 在 macOS 旧版 grep 上 `-E` 行为差异 | 用 `grep -e a -e b` |

## 小结

- grep 筛行（`-E`、`-o`、`-A/B/C`），sed 改行（`s/旧/新/g`、`/模式/d`），awk 算列（`$1`、`NF`、`END`）。
- `sort | uniq -c | sort -rn` 是"统计频次"万能组合。
- `cut -d分隔符 -f列号` 取列，`tr` 换字符。
- `sed -i` 在 macOS 上写 `sed -i ''`；改文件前先不带 `-i` 预览。

## 自测题

1. 为什么 `uniq` 前面通常要 `sort`？
<details><summary>答案</summary>`uniq` 只合并相邻重复行，不排序会漏掉不相邻的重复。</details>

2. `awk '{print $NF}'` 打印什么？
<details><summary>答案</summary>每行的最后一列（NF 是字段数）。</details>

3. 写一条命令把 `config.yaml` 中所有 `cuda:0` 改成 `cuda:1` 并留备份。
<details><summary>答案</summary>`sed -i.bak 's/cuda:0/cuda:1/g' config.yaml`。</details>

4. `grep -o` 的作用？
<details><summary>答案</summary>只输出每行中匹配到的那部分文字，而不是整行。</details>

## 参考资料

- [GNU sed 手册](https://www.gnu.org/software/sed/manual/sed.html) —— 所有 sed 命令。
- [GNU awk 手册](https://www.gnu.org/software/gawk/manual/gawk.html) —— 把 awk 当语言学的权威资料。
- [GNU grep 手册](https://www.gnu.org/software/grep/manual/grep.html) —— 正则细节。
- [MIT Missing Semester – Data Wrangling](https://missing.csail.mit.edu/2020/data-wrangling/) —— 真实日志分析演示。

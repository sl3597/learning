---
title: 查看与编辑文本
type: tutorial
topic: linux
chapter: 5
level: beginner
tags: [cat, less, head, tail, wc, nano, vim, 文本编辑]
prerequisites: [04-file-operations]
estimated_time: 50min
sources:
  - https://www.gnu.org/software/coreutils/manual/html_node/Output-of-entire-files.html
  - https://www.nano-editor.org/dist/latest/cheatsheet.html
  - https://vim.rtorr.com/
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 查看与编辑文本（Viewing & Editing Text）

> 配置文件、日志、代码全是文本。本章教你在终端里"看"文本的五种姿势，以及在没有图形界面的服务器上用 nano / vim 修改文件。

## 学习目标

- 能根据文件大小选择 `cat`、`less`、`head`、`tail` 查看内容。
- 能用 `tail -f` 实时追踪日志。
- 能用 `wc` 统计行数、词数、字节数。
- 能用 nano 完成编辑并保存；能在 vim 里完成"打开—修改—保存—退出"而不卡住。

## 前置知识

- 需要先读：[04 文件操作](04-file-operations.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **cat** | 把整个文件一次性打印到屏幕 | 把整本书摊开 |
| **less** | 分页查看，可上下翻、搜索 | 一页一页翻书 |
| **head / tail** | 只看开头 / 结尾几行 | 看目录 / 看结局 |
| **wc** | 统计行数、词数、字节数 | 点字数 |
| **nano** | 最简单的终端编辑器，底部有快捷键提示 | 记事本 |
| **vim** | 强大但有"模式"的编辑器，服务器必装 | 需要学指法的专业键盘 |

## 详细讲解

先准备一个练习文件：

```bash
mkdir -p ~/demo && cd ~/demo
seq 1 100 > numbers.txt     # 生成 1~100 每行一个数（> 是重定向，第 8 章详讲）
```

### 5.1 一次看完：cat

```bash
cat numbers.txt          # 全部输出
cat -n numbers.txt       # 带行号
cat a.txt b.txt          # 拼接多个文件输出（cat 本意是 concatenate）
```

适合小文件。几千行以上会刷屏，请用 `less`。

### 5.2 分页看：less

```bash
less numbers.txt
```

| 按键 | 作用 |
|---|---|
| 空格 / `f` | 下一页 |
| `b` | 上一页 |
| `↑` `↓` | 上下一行 |
| `g` / `G` | 跳到开头 / 结尾 |
| `/关键词` | 向下搜索，`n` 下一个，`N` 上一个 |
| `q` | 退出 |

`more` 是 `less` 的老版本，只能往下翻，了解即可。

### 5.3 看头看尾：head 与 tail

```bash
head numbers.txt        # 默认前 10 行
head -n 3 numbers.txt   # 前 3 行
tail -n 5 numbers.txt   # 最后 5 行
tail -f train.log       # 实时追踪：文件有新内容会立刻显示，Ctrl+C 退出
```

> 💡 要点：`tail -f` 是看训练日志的标配。配合 `grep` 还能只看 loss 行，见 [08 管道与重定向](08-pipes-and-redirection.md)。

### 5.4 统计：wc

```bash
wc numbers.txt        # 行数 词数 字节数 文件名
wc -l numbers.txt     # 只要行数
```

```text
# 输出：
     100     100     292 numbers.txt
```

### 5.5 nano：最友好的终端编辑器

```bash
nano hello.txt
```

直接打字就是输入。底部 `^O` 表示 `Ctrl + O`：

| 快捷键 | 作用 |
|---|---|
| `Ctrl + O` 然后回车 | 保存 |
| `Ctrl + X` | 退出（未保存会询问） |
| `Ctrl + W` | 搜索 |
| `Ctrl + K` / `Ctrl + U` | 剪切 / 粘贴一行 |

macOS 自带 nano（有时实际是 pico），Ubuntu 默认也有。

### 5.6 vim：最小生存指南

vim 几乎在每台 Linux 机器上都有，但它有**模式**的概念，新手最常见的困境是"打开了不知道怎么退出"。

```bash
vim hello.txt
```

三种模式与切换：

```text
          i / a / o
 普通模式 ──────────▶ 插入模式（可以打字）
    ▲                      │
    │        Esc           │
    └──────────────────────┘
    │
    : （冒号）
    ▼
 命令行模式（保存、退出、搜索）
```

最小操作集：

| 想做什么 | 按键（在普通模式下） |
|---|---|
| 开始打字 | `i` |
| 停止打字回到普通模式 | `Esc` |
| 保存 | `:w` 回车 |
| 退出 | `:q` 回车 |
| 保存并退出 | `:wq` 或 `ZZ` |
| 不保存强制退出 | `:q!` |
| 撤销 | `u` |
| 删除当前行 | `dd` |
| 搜索 | `/关键词` 回车，`n` 下一个 |
| 跳到文件开头 / 结尾 | `gg` / `G` |

> ⚠️ 注意：卡住时，先连按几次 `Esc`，再输 `:q!` 回车，一定能出来。

### 5.7 什么时候用哪个

| 场景 | 推荐 |
|---|---|
| 看一眼小配置文件 | `cat` |
| 看大日志、找关键词 | `less` |
| 实时看训练日志 | `tail -f` |
| 改两行配置 | `nano` |
| 在只有 vim 的服务器上改文件 | `vim` |
| 写大量代码 | 本地 VS Code + 远程插件（见 [17 SSH 与远程](17-ssh-and-remote.md)） |

## 动手练习

1. 用 `seq 1 1000 > big.txt` 生成文件，分别用 `head -n 5`、`tail -n 5`、`wc -l` 查看，再用 `less` 搜索 `500` 并退出。
<details><summary>参考做法</summary>

```bash
seq 1 1000 > big.txt
head -n 5 big.txt
tail -n 5 big.txt
wc -l big.txt
less big.txt    # 输入 /500 回车，q 退出
```
</details>

2. 用 nano 创建 `todo.md`，写三行内容，保存退出，再用 `cat -n` 验证。
<details><summary>参考做法</summary>`nano todo.md` → 打字 → `Ctrl+O` 回车 → `Ctrl+X` → `cat -n todo.md`。</details>

3. 用 vim 打开 `todo.md`，在末尾新增一行"done"，保存退出；再故意打开并用 `:q!` 不保存退出。
<details><summary>参考做法</summary>`vim todo.md` → `G` 跳到末尾 → `o` 新开一行并进入插入模式 → 输入 done → `Esc` → `:wq`。第二次：`vim todo.md` → 随便改 → `Esc` → `:q!`。</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `cat` 大文件刷屏停不下来 | 文件太大 | `Ctrl + C` 终止，改用 `less` |
| vim 里打字没反应或出现奇怪跳转 | 处于普通模式 | 按 `i` 进入插入模式 |
| vim 里出现 `E37: No write since last change` | 有改动但用了 `:q` | `:wq` 保存退出，或 `:q!` 放弃 |
| `tail -f` 不更新 | 程序把日志写到了别的文件 / 使用了缓冲 | 确认日志路径；Python 可加 `-u` 取消缓冲 |

## 小结

- 小文件 `cat`，大文件 `less`，头尾 `head/tail`，追日志 `tail -f`。
- `wc -l` 数行数是最常用的统计。
- nano 看底部提示就会用；vim 记住 `i`、`Esc`、`:wq`、`:q!` 四个动作即可生存。
- 大量编辑用本地编辑器远程连接，终端编辑器用于快速修改。

## 自测题

1. 训练脚本正在往 `train.log` 写日志，如何实时查看？
<details><summary>答案</summary>`tail -f train.log`，按 `Ctrl + C` 停止查看（不影响训练）。</details>

2. 在 vim 里改了半天发现改错了，想全部放弃怎么办？
<details><summary>答案</summary>按 `Esc` 回普通模式，输入 `:q!` 回车。</details>

3. `wc -l` 的输出 `100 numbers.txt` 表示什么？
<details><summary>答案</summary>文件 `numbers.txt` 有 100 行。</details>

4. `less` 中如何搜索并跳到下一个匹配？
<details><summary>答案</summary>`/关键词` 回车，再按 `n`。</details>

## 参考资料

- [GNU Coreutils – 输出整个文件](https://www.gnu.org/software/coreutils/manual/html_node/Output-of-entire-files.html) —— cat/head/tail 官方说明。
- [nano 快捷键速查表](https://www.nano-editor.org/dist/latest/cheatsheet.html) —— 官方一页纸。
- [Vim Cheat Sheet](https://vim.rtorr.com/) —— 多语言版本的 vim 速查。
- [MIT Missing Semester – Editors (Vim)](https://missing.csail.mit.edu/2020/editors/) —— 为什么值得学 vim。

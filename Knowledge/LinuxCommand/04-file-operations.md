---
title: 文件操作：创建、复制、移动、删除
type: tutorial
topic: linux
chapter: 4
level: beginner
tags: [touch, mkdir, cp, mv, rm, 通配符, 文件操作]
prerequisites: [03-filesystem-navigation]
estimated_time: 45min
sources:
  - https://www.gnu.org/software/coreutils/manual/html_node/index.html
  - https://linuxcommand.org/lc3_lts0050.php
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 文件操作：创建、复制、移动、删除（File Operations）

> 本章是命令行里的"右键菜单"：新建、复制、重命名、删除。同时讲清楚最危险的命令 `rm -rf` 该怎样安全使用。

## 学习目标

- 能用 `touch`、`mkdir -p` 创建文件和多级目录。
- 能用 `cp`、`mv` 复制、移动、重命名文件和目录。
- 能用 `rm`、`rmdir` 删除，并知道如何避免误删。
- 能用通配符 `*`、`?`、`[]` 批量操作文件。

## 前置知识

- 需要先读：[03 文件系统导航](03-filesystem-navigation.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **touch** | 创建空文件或更新文件时间戳 | 拿一张白纸 |
| **mkdir** | 创建目录 | 买一个新文件夹 |
| **cp / mv** | 复制 / 移动（移动到同目录 = 重命名） | 复印 / 搬家 |
| **rm** | 删除，没有回收站 | 碎纸机 |
| **通配符（glob）** | `*` 等符号代表"任意字符"，用于匹配一批文件 | "所有姓王的人" |
| **递归（-r）** | 对目录及其所有子内容一起操作 | 搬家连抽屉里的东西一起搬 |

## 详细讲解

本章所有练习请在一个安全的沙盒目录进行：

```bash
mkdir -p ~/demo && cd ~/demo
```

### 4.1 创建：touch 与 mkdir

```bash
touch notes.txt            # 创建空文件；已存在则只更新修改时间
touch a.txt b.txt c.txt    # 一次创建多个
mkdir data                 # 创建目录
mkdir -p project/src/utils # -p 一次建多级，父目录不存在也行
```

### 4.2 复制：cp

```bash
cp notes.txt backup.txt           # 复制并改名
cp notes.txt data/                 # 复制到目录，保持原名
cp -r project project_copy         # 复制目录必须加 -r（递归）
cp -i notes.txt backup.txt         # -i 覆盖前询问
```

> 💡 要点：目标以 `/` 结尾时表示"放进这个目录"，不加 `/` 时如果目录不存在就会被当成新文件名。

### 4.3 移动与重命名：mv

```bash
mv notes.txt todo.txt      # 重命名
mv todo.txt data/          # 移动到 data 目录
mv data/todo.txt .         # 移回当前目录
mv project_copy archive    # 目录改名不需要 -r
```

`mv` 不会留下副本，操作几乎瞬间完成（同一磁盘内只是改了"门牌号"）。

### 4.4 删除：rm 与 rmdir

```bash
rm a.txt               # 删除文件
rm b.txt c.txt         # 删除多个
rm -i backup.txt       # 删除前确认
rmdir data             # 只能删空目录
rm -r archive          # 删除目录及内容
```

> ⚠️ 注意：**命令行删除没有回收站**。`rm` 执行完文件就不存在了。下面这条命令是 Linux 世界最危险的命令，请务必理解每个字母再使用：

```bash
rm -rf 目录名
```

- `-r`：递归，连子目录一起删。
- `-f`：force，不询问、忽略不存在的文件。

安全习惯：

1. 删之前先 `ls` 一遍要删的目标。
2. 永远不要写 `rm -rf /`、`rm -rf ~`、`rm -rf *`（在不确定的目录下）。
3. 使用变量时先确认变量非空：`rm -rf "$DIR"/` 中如果 `$DIR` 是空的，就变成了 `rm -rf /`。
4. 新手阶段可以给自己加个保险：`alias rm='rm -i'`（见 [14 环境变量与配置](14-environment-and-config.md)）。

### 4.5 通配符批量操作

| 通配符 | 含义 | 示例 |
|---|---|---|
| `*` | 任意多个字符（含零个） | `*.txt` 所有 txt 文件 |
| `?` | 任意一个字符 | `img?.png` 匹配 img1.png，不匹配 img10.png |
| `[abc]` | 方括号内任一字符 | `[ab].txt` 匹配 a.txt、b.txt |
| `[0-9]` | 范围 | `log[0-9].txt` |
| `{a,b}` | 大括号展开（不是通配，但常一起用） | `touch f{1,2,3}.txt` 创建三个文件 |

```bash
touch img1.png img2.png img10.png doc.pdf
ls *.png            # img1.png img2.png img10.png
ls img?.png         # img1.png img2.png
mkdir images && mv *.png images/
```

> ⚠️ 注意：通配符由 shell 在执行命令**之前**展开。`rm *` 会先变成 `rm img1.png img2.png ...`，所以先用 `ls *` 看看会匹配到什么，再换成 `rm`。

### 4.6 macOS 差异

macOS 自带的 `cp`、`mv`、`rm` 是 BSD 版本，功能基本一致，但没有 GNU 版的 `--verbose` 等长选项。想要和 Linux 完全一致可以 `brew install coreutils`。

## 动手练习

1. 在 `~/demo` 里创建目录 `proj/{src,data,logs}`，并在 `src` 下创建 `main.py` 和 `utils.py`。
<details><summary>参考做法</summary>

```bash
cd ~/demo
mkdir -p proj/{src,data,logs}
touch proj/src/{main,utils}.py
ls -R proj
```
</details>

2. 把 `proj` 完整复制一份叫 `proj_backup`，然后把 `proj_backup/src/main.py` 重命名为 `app.py`。
<details><summary>参考做法</summary>

```bash
cp -r proj proj_backup
mv proj_backup/src/main.py proj_backup/src/app.py
```
</details>

3. 创建 `log1.txt` ~ `log5.txt` 和 `report.txt`，用一条命令只删除 log 文件，删除前先用 `ls` 预览匹配结果。
<details><summary>参考做法</summary>

```bash
touch log{1..5}.txt report.txt
ls log*.txt
rm log*.txt
ls
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `cp: xxx is a directory (not copied)` | 复制目录没加 `-r` | `cp -r` |
| `rmdir: Directory not empty` | `rmdir` 只能删空目录 | 确认内容后用 `rm -r` |
| `mv` 后文件"消失"了 | 目标目录不存在，被当成了新文件名 | `ls` 找到那个文件名，再 `mv` 回来 |
| 误删文件 | `rm` 无回收站 | 立即停止写入磁盘，尝试备份/Time Machine；今后用 `-i` 或先 `ls` |

## 小结

- `touch` 建文件、`mkdir -p` 建多级目录。
- `cp -r` 复制目录、`mv` 既移动也重命名。
- `rm` 无回收站；`rm -rf` 删前必 `ls`，变量必加引号。
- 通配符 `*`、`?`、`[]` 批量匹配，先用 `ls` 预览再操作。

## 自测题

1. `cp report.txt backup` 在 `backup` 目录不存在时会发生什么？
<details><summary>答案</summary>会把 `report.txt` 复制成一个名为 `backup` 的文件，而不是放进目录。</details>

2. 为什么 `rm -rf "$DIR"/` 在 `$DIR` 为空时极度危险？
<details><summary>答案</summary>展开后变成 `rm -rf /`，会尝试删除整个系统。</details>

3. `ls img?.png` 和 `ls img*.png` 的区别？
<details><summary>答案</summary>`?` 只匹配一个字符（img1.png），`*` 匹配任意多个（也包含 img10.png、img.png）。</details>

4. 重命名一个目录需要 `-r` 吗？
<details><summary>答案</summary>不需要，`mv old new` 即可；只有 `cp` 和 `rm` 操作目录时需要 `-r`。</details>

## 参考资料

- [GNU Coreutils 手册](https://www.gnu.org/software/coreutils/manual/html_node/index.html) —— cp/mv/rm 等核心工具的权威文档。
- [The Linux Command Line – Manipulating Files](https://linuxcommand.org/lc3_lts0050.php) —— 通配符讲得很清楚。
- [Bash 手册：Filename Expansion](https://www.gnu.org/software/bash/manual/html_node/Filename-Expansion.html) —— 通配符展开规则。

---
title: 压缩与归档
type: tutorial
topic: linux
chapter: 13
level: beginner
tags: [tar, gzip, zip, unzip, 压缩, 归档, 打包]
prerequisites: [04-file-operations]
estimated_time: 30min
sources:
  - https://www.gnu.org/software/tar/manual/tar.html
  - https://www.gnu.org/software/gzip/manual/gzip.html
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# 压缩与归档（Archives & Compression）

> 下载的数据集是 `.tar.gz`，要传给别人的代码要打成 `.zip`。本章讲清楚"归档"和"压缩"的区别，并给出几条背下来就够用的口诀。

## 学习目标

- 能解释 `tar`、`gzip`、`zip` 各自做什么，为什么 `.tar.gz` 是两步。
- 能打包、解包 `.tar`、`.tar.gz`、`.zip` 文件。
- 能在解压前查看压缩包里有什么。
- 能根据后缀名选对解压命令。

## 前置知识

- 需要先读：[04 文件操作](04-file-operations.md)

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **归档（archive）** | 把多个文件合成一个文件，不减小体积 | 把东西装进一个箱子 |
| **压缩（compress）** | 用算法减小文件体积 | 把箱子抽真空 |
| **tar** | Unix 标准归档工具，可顺便调用压缩 | 装箱机 |
| **gzip / bzip2 / xz** | 三种压缩算法，速度与压缩率不同 | 不同强度的真空泵 |
| **zip** | 归档 + 压缩一体，Windows 通用 | 自带真空的收纳袋 |

## 详细讲解

### 13.1 为什么 .tar.gz 是两层

Unix 传统：`tar` 只负责把多个文件"捆"成一个 `.tar`，`gzip` 只负责把一个文件压小成 `.gz`。两步合起来就是 `.tar.gz`（也写作 `.tgz`）。现代 `tar` 可以用 `-z` 一步完成。

### 13.2 tar 口诀

```bash
mkdir -p ~/demo/pack && cd ~/demo/pack
mkdir dataset && seq 1 1000 > dataset/a.txt && seq 1 1000 > dataset/b.txt
```

| 口诀 | 命令 | 含义 |
|---|---|---|
| 打包压缩："c z v f" | `tar -czvf dataset.tar.gz dataset/` | create, gzip, verbose, file |
| 解包解压："x z v f" | `tar -xzvf dataset.tar.gz` | extract |
| 只看不解："t z v f" | `tar -tzvf dataset.tar.gz` | list |

常用变化：

```bash
tar -cvf data.tar dataset/            # 只归档不压缩
tar -xzvf data.tar.gz -C /tmp/out     # 解压到指定目录（目录需存在）
tar -cjvf data.tar.bz2 dataset/       # bzip2 压缩（更小更慢）
tar -cJvf data.tar.xz dataset/        # xz 压缩（最小最慢）
tar -xf data.tar.xz                   # 新版 tar 自动识别压缩格式，可省略 z/j/J
tar -czvf logs.tar.gz --exclude="*.tmp" logs/   # 排除
```

> 💡 要点：`-f` 后面必须紧跟文件名，所以 `f` 永远放在选项组的最后。

### 13.3 单文件压缩：gzip

```bash
gzip big.log            # 变成 big.log.gz，原文件被删除
gzip -k big.log         # -k 保留原文件
gunzip big.log.gz       # 解压
zcat big.log.gz | head  # 不解压直接看
```

### 13.4 zip / unzip

和 Windows、macOS 访达最兼容：

```bash
zip -r code.zip project/          # -r 递归打包目录
zip -r code.zip project/ -x "*.pyc" "*/__pycache__/*"   # 排除
unzip code.zip                    # 解压到当前目录
unzip code.zip -d /tmp/out        # 解压到指定目录
unzip -l code.zip                 # 只看内容
```

Ubuntu 可能需要 `sudo apt install zip unzip`；macOS 自带。

### 13.5 按后缀选命令

| 后缀 | 解压命令 |
|---|---|
| `.tar` | `tar -xvf` |
| `.tar.gz` / `.tgz` | `tar -xzvf` |
| `.tar.bz2` | `tar -xjvf` |
| `.tar.xz` | `tar -xJvf` |
| `.gz`（单文件） | `gunzip` |
| `.zip` | `unzip` |
| `.7z` / `.rar` | `7z x`（需安装 p7zip） / `unrar x` |

### 13.6 大文件的实用技巧

```bash
tar -czvf - dataset/ | split -b 2G - dataset.tar.gz.part_   # 切成 2GB 一块
cat dataset.tar.gz.part_* | tar -xzvf -                      # 合并解压
tar -czvf - dataset/ | ssh gpu-server "tar -xzvf - -C ~/data" # 边打包边传到服务器
```

`-` 表示 stdout/stdin，配合管道使用（见 [08 管道与重定向](08-pipes-and-redirection.md)）。

### 13.7 macOS 注意事项

macOS 的 `tar` 打包时会夹带 `._xxx` 元数据文件和 `.DS_Store`。给别人之前可以：

```bash
COPYFILE_DISABLE=1 tar -czvf clean.tar.gz --exclude=".DS_Store" project/
```

## 动手练习

1. 把 `~/demo/pack/dataset` 打成 `dataset.tar.gz`，先用 `-t` 列出内容，再解压到 `/tmp/unpack`（需先创建）。
<details><summary>参考做法</summary>

```bash
cd ~/demo/pack
tar -czvf dataset.tar.gz dataset/
tar -tzvf dataset.tar.gz
mkdir -p /tmp/unpack && tar -xzvf dataset.tar.gz -C /tmp/unpack
```
</details>

2. 比较同一目录用 gzip、bzip2、xz 压缩后的大小（`ls -lh`）。
<details><summary>参考做法</summary>

```bash
tar -czf d.tar.gz dataset/; tar -cjf d.tar.bz2 dataset/; tar -cJf d.tar.xz dataset/
ls -lh d.tar.*
```
</details>

3. 用 zip 打包 `dataset`，排除 `b.txt`，并用 `unzip -l` 验证。
<details><summary>参考做法</summary>

```bash
zip -r d.zip dataset/ -x "dataset/b.txt"
unzip -l d.zip
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `tar: Error opening archive` / `not in gzip format` | 后缀与实际格式不符 | `file xxx.tar.gz` 查看真实类型，用对应选项 |
| 解压后一堆文件散在当前目录 | 压缩包没有顶层目录 | 先 `-t` 查看；解压到新目录 `-C` |
| `tar -xzvf` 报 `-C: No such file` | 目标目录不存在 | 先 `mkdir -p` |
| Linux 上解压 Mac 打的包出现 `._` 文件 | macOS 元数据 | 打包时设 `COPYFILE_DISABLE=1` |

## 小结

- 归档是装箱（tar），压缩是抽真空（gzip 等）；`.tar.gz` 两者兼有。
- 口诀：打包 `czvf`、解包 `xzvf`、查看 `tzvf`，`f` 永远最后。
- Windows 兼容用 `zip -r` / `unzip`。
- 解压前先 `-t` 或 `unzip -l` 看结构。

## 自测题

1. `tar -czvf a.tar.gz dir/` 中每个字母的意思？
<details><summary>答案</summary>c 创建，z gzip 压缩，v 显示过程，f 指定文件名。</details>

2. 只想看 `.tar.gz` 里有什么，不解压，怎么做？
<details><summary>答案</summary>`tar -tzvf 文件名`。</details>

3. `gzip big.log` 后原文件去哪了？
<details><summary>答案</summary>被替换为 `big.log.gz`，原文件删除；用 `-k` 可保留。</details>

4. 解压 `.tar.xz` 用什么？
<details><summary>答案</summary>`tar -xJvf`，或新版 tar 直接 `tar -xf`。</details>

## 参考资料

- [GNU tar 手册](https://www.gnu.org/software/tar/manual/tar.html) —— 完整选项。
- [GNU gzip 手册](https://www.gnu.org/software/gzip/manual/gzip.html) —— 压缩级别等细节。
- [Ubuntu 手册：zip/unzip](https://manpages.ubuntu.com/manpages/noble/en/man1/zip.1.html) —— zip 的排除规则。

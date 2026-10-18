---
title: Git 基础：代码与知识库的版本管理
type: tutorial
topic: linux
chapter: 18
level: intermediate
tags: [git, 版本控制, commit, branch, github, gitignore]
prerequisites: [15-shell-scripting-basics, 17-ssh-and-remote]
estimated_time: 60min
sources:
  - https://git-scm.com/book/zh/v2
  - https://git-scm.com/docs
  - https://docs.github.com/en/get-started
status: draft
created: 2026-10-17
updated: 2026-10-17
---

# Git 基础：代码与知识库的版本管理（Git Basics）

> 改坏了想回退、和同事合作、把代码同步到服务器——都靠 Git。本章只讲最小工作流，学完就能管理自己的代码和这个知识库。

## 学习目标

- 能解释工作区、暂存区、仓库、远程四个概念。
- 能完成 `init/clone → add → commit → push/pull` 的日常循环。
- 能用 `status`、`log`、`diff` 查看状态和历史。
- 能创建、切换、合并分支。
- 能写 `.gitignore` 排除数据集、模型权重等大文件。

## 前置知识

- 需要先读：[15 Shell 脚本入门](15-shell-scripting-basics.md)、[17 SSH 与远程](17-ssh-and-remote.md)（GitHub 密钥）

## 核心概念

| 术语 | 一句话解释 | 类比 |
|---|---|---|
| **仓库（repo）** | 被 Git 管理的目录，历史存在 `.git/` 里 | 带完整修改记录的文件夹 |
| **工作区** | 你实际编辑的文件 | 书桌 |
| **暂存区（stage）** | 准备提交的改动清单 | 打包前放在门口的箱子 |
| **提交（commit）** | 一次保存的快照，有唯一 ID 和说明 | 存档点 |
| **分支（branch）** | 独立的开发线 | 平行宇宙 |
| **远程（remote）** | 托管在 GitHub 等服务器上的仓库副本 | 云端备份 |

## 详细讲解

### 18.1 初始配置

```bash
git config --global user.name "Katrina"
git config --global user.email "katrinawan1011@gmail.com"
git config --global init.defaultBranch main
git config --list
```

### 18.2 创建或克隆仓库

```bash
cd ~/Desktop/Learning
git init                       # 把当前目录变成仓库
# 或从远程复制一份：
git clone git@github.com:openvla/openvla.git
```

### 18.3 日常循环：status → add → commit

```bash
git status                     # 哪些文件改了、哪些没被跟踪
git add STANDARD.md            # 放入暂存区
git add .                      # 全部（注意 .gitignore）
git commit -m "docs: 添加知识库编写标准"   # 提交
git log --oneline              # 历史
git diff                       # 工作区 vs 暂存区的差异
git diff --staged              # 暂存区 vs 上次提交
```

三个区域的流动：

```text
工作区 ──git add──▶ 暂存区 ──git commit──▶ 仓库（历史） ──git push──▶ 远程
```

提交信息建议格式：`类型: 做了什么`，类型如 `feat`、`fix`、`docs`、`refactor`。

### 18.4 远程：push 与 pull

在 GitHub 新建空仓库后：

```bash
git remote add origin git@github.com:你的用户名/Learning.git
git push -u origin main        # 第一次 -u 记住对应关系
git push                       # 之后
git pull                       # 拉取并合并远程更新
```

用 SSH 地址（`git@github.com:`）需要把 [第 17 章](17-ssh-and-remote.md) 生成的公钥添加到 GitHub → Settings → SSH keys。

### 18.5 撤销与回退

```bash
git restore file.md            # 丢弃工作区改动（⚠️ 不可恢复）
git restore --staged file.md   # 从暂存区撤回，保留改动
git commit --amend             # 修改上一次提交（未 push 时）
git log --oneline              # 找到目标提交 ID
git checkout abc123 -- file.md # 把某文件恢复到某次提交的版本
git revert abc123              # 用一个新提交抵消某次提交（安全，适合已 push）
```

> ⚠️ 注意：`git reset --hard` 和 `git push --force` 会丢历史，新手阶段不要用。

### 18.6 分支

```bash
git branch                     # 列出分支
git switch -c exp-lr           # 创建并切换（旧写法 checkout -b）
# ...改代码、commit...
git switch main
git merge exp-lr               # 把 exp-lr 合进 main
git branch -d exp-lr           # 删除
```

冲突时 Git 会在文件里标出 `<<<<<<<`、`=======`、`>>>>>>>`，手动保留想要的内容后 `git add` + `git commit`。

### 18.7 .gitignore：别把大文件提交进去

在仓库根目录创建 `.gitignore`：

```text
# Python
__pycache__/
*.pyc
.venv/

# 数据与模型（太大，不进 Git）
data/
*.pth
*.ckpt
*.safetensors
logs/
wandb/

# 系统
.DS_Store
.env

# 知识库 Agent
agent/node_modules/
```

已经被跟踪的文件加进 `.gitignore` 不会自动移除，需要 `git rm --cached 文件`。

### 18.8 查看历史的实用命令

```bash
git log --oneline --graph --all     # 图形化分支
git log -p STANDARD.md              # 某文件的每次改动
git blame README.md                 # 每行是谁、何时改的
git show abc123                     # 某次提交的详情
git stash                           # 临时收起改动；git stash pop 取回
```

### 18.9 把知识库纳入 Git

```bash
cd ~/Desktop/Learning
git init
cat > .gitignore <<'EOF'
.DS_Store
agent/node_modules/
agent/.env
EOF
git add .
git commit -m "docs: 初始化学习知识库"
```

> 🔗 关联：Agent 系统生成的论文笔记也会落在这个仓库里，每次自动生成后建议 `git diff` 复核再提交，见 [知识库总览](../../README.md)。

## 动手练习

1. 在 `~/demo/gitlab` 初始化仓库，创建 `README.md` 写一行内容，提交；再修改一行，用 `git diff` 查看差异后再次提交，`git log --oneline` 应有两条记录。
<details><summary>参考做法</summary>

```bash
mkdir -p ~/demo/gitlab && cd ~/demo/gitlab && git init
echo "# demo" > README.md && git add . && git commit -m "init"
echo "second line" >> README.md && git diff && git add . && git commit -m "add line"
git log --oneline
```
</details>

2. 创建分支 `feature`，在其中新增 `a.txt` 并提交，切回 `main` 合并，确认 `a.txt` 出现在 `main`。
<details><summary>参考做法</summary>

```bash
git switch -c feature && touch a.txt && git add . && git commit -m "add a"
git switch main && git merge feature && ls
```
</details>

3. 创建 `.gitignore` 忽略 `*.log`，生成 `x.log`，用 `git status` 确认它不被跟踪。
<details><summary>参考做法</summary>

```bash
echo "*.log" > .gitignore && touch x.log && git status
```
</details>

## 常见错误与排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `fatal: not a git repository` | 不在仓库目录 | `cd` 到仓库根目录 |
| `Permission denied (publickey)` push 失败 | GitHub 没有你的公钥 | 把 `~/.ssh/id_ed25519.pub` 添加到 GitHub |
| `rejected: non-fast-forward` | 远程有你没有的提交 | 先 `git pull`，解决冲突后再 push |
| 不小心提交了大文件 | 没写 `.gitignore` | `git rm --cached 文件`，补 `.gitignore`，重新提交 |
| 合并冲突 | 两边改了同一处 | 编辑冲突标记，`git add`，`git commit` |

## 小结

- 四区：工作区 → `add` → 暂存区 → `commit` → 仓库 → `push` → 远程。
- 日常：`status`、`add .`、`commit -m`、`pull`、`push`。
- 分支 `switch -c`、`merge`；回退用 `restore`、`revert`，不用 `reset --hard`。
- `.gitignore` 排除数据、权重、日志、`.DS_Store`。

## 自测题

1. `git add` 和 `git commit` 分别做什么？
<details><summary>答案</summary>`add` 把改动放入暂存区；`commit` 把暂存区内容保存为一次历史快照。</details>

2. 已经 push 的错误提交该怎么撤销？
<details><summary>答案</summary>`git revert 提交ID`，生成一个反向提交，不改写历史。</details>

3. 为什么模型权重不应该进 Git？
<details><summary>答案</summary>文件巨大且每次变动都会使仓库膨胀，应用 `.gitignore` 排除，用 rsync 或对象存储管理。</details>

4. `git pull` 等于哪两个命令？
<details><summary>答案</summary>`git fetch` + `git merge`。</details>

## 参考资料

- [Pro Git 中文版](https://git-scm.com/book/zh/v2) —— 官方免费教材，前三章足够入门。
- [Git 官方文档](https://git-scm.com/docs) —— 每条命令的手册。
- [GitHub 入门文档](https://docs.github.com/en/get-started) —— 创建仓库、添加 SSH key。
- [Learn Git Branching](https://learngitbranching.js.org/?locale=zh_CN) —— 可视化交互练习分支操作。

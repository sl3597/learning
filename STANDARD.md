---
title: 知识库编写标准（Markdown 规范）
type: reference
topic: meta
level: all
tags: [标准, 规范, 模板, 知识库]
status: stable
created: 2026-10-17
updated: 2026-10-17
---

# 知识库编写标准

> 本文件是整个 `Learning` 知识库的**唯一标准**。之后新增、修改的每一个 `.md` 文件都必须遵守它。
> 人类读者和 Agent 系统都依赖这套结构来阅读、检索和学习，所以请把它当成"协议"而不是"建议"。

## 1. 设计目标

1. **零基础友好**：默认读者是完全没接触过该领域的人。任何术语第一次出现时都要用一句大白话解释。
2. **章节化**：每个主题拆成有序章节，章节之间有明确的前置关系，读者能沿着一条路线从入门走到进阶。
3. **可被机器消费**：每个文件带有 YAML frontmatter（元数据），结构固定，Agent 可以按 `topic / level / tags / prerequisites` 检索、推荐学习路径、回答问题。
4. **可沉淀**：论文笔记、实验记录、问题解答都能以同一格式回流到知识库，知识越积越多而不散乱。

## 2. 目录与文件命名

```text
Learning/
├── STANDARD.md                 # 本文件：编写标准
├── README.md                   # 知识库总览 + 学习路线 + Agent 系统说明
├── templates/                  # 各类文档模板（复制后填写）
│   ├── tutorial-template.md    # 教程章节
│   ├── paper-note-template.md  # 论文笔记
│   └── hardware-template.md    # 硬件 / 设备文档
├── Knowledge/                  # 全部知识内容
│   ├── 00-README.md            # 内容总目录、整体学习路线
│   ├── LinuxCommand/           # 主题：Linux 命令
│   │   ├── 00-README.md        # 本主题目录、学习路线
│   │   ├── 01-xxx.md           # 章节，两位数字前缀 + 英文短横线命名
│   │   └── assets/             # 图片等附件（按需）
│   ├── VLA/                    # 主题：VLA 模型
│   │   ├── 00-README.md
│   │   ├── Basic/              # VLA 基础
│   │   └── ForceVLA/           # 论文专题
│   ├── WAM/                    # 世界模型（World Model / World Action Model）
│   ├── UR/                     # UR 协作机械臂（硬件文档 + 编程教程）
│   └── Papers/                 # 论文库：按领域分子目录（VLA / WAM / Robotics），见第 11 节
├── notes/                      # 问答沉淀、临时笔记（自动创建）
└── agent/                      # Agent 系统（代码），不属于知识内容
```

命名规则：

| 规则 | 说明 | 示例 |
|---|---|---|
| 章节前缀 | 两位数字 + `-`，`00` 固定为目录文件 | `03-file-operations.md` |
| 文件名 | 小写英文、短横线分隔，不用空格和中文（保证链接与 URL 稳定） | `05-permissions.md` |
| 标题 | 文件内 H1 用中文，可附英文 | `# 文件权限（Permissions）` |
| 附件 | 放在同级 `assets/`，文件名以章节前缀开头 | `assets/03-cp-example.png` |
| 论文专题（精读） | 一篇论文一个文件夹，内部仍按章节编号，放在所属主题下 | `VLA/ForceVLA/02-method.md` |
| 论文库（泛读） | 一篇论文一个文件，放在 `Knowledge/Papers/<领域>/` | `Papers/VLA/01-openvla.md` |

## 3. Frontmatter（元数据）

每个文件**第一行**必须是 `---` 开头的 YAML 块。字段如下：

```yaml
---
title: 文件权限与用户管理            # 必填，中文标题
type: tutorial                       # 必填：tutorial | paper-note | hardware | reference | index
topic: linux                         # 必填，主题标识（小写英文），见下表
chapter: 5                           # 教程章节号；目录文件为 0
level: beginner                      # 必填：beginner | intermediate | advanced | all
tags: [权限, chmod, chown, 用户]      # 必填，3~8 个，用于检索
prerequisites: [04-file-operations]  # 选填，前置章节文件名（不带 .md）
estimated_time: 40min                # 选填，预计学习时长
sources:                             # 选填，引用来源（论文、官方文档、链接）
  - https://example.com/doc
related: [Knowledge/VLA/Basic/04-vla-concept.md]  # paper-note 必填：关联的知识章节（知识库根目录相对路径），见第 11 节
year: 2025                           # paper-note 选填：发表年份（四位数字）
venue: NeurIPS 2025                  # paper-note 选填：会议/期刊
status: draft                        # 必填：draft | reviewed | stable
created: 2026-10-17                  # 必填，ISO 日期
updated: 2026-10-17                  # 必填，每次修改更新
---
```

已登记的 `topic` 值：

| topic | 含义 |
|---|---|
| `meta` | 知识库本身（标准、总览） |
| `linux` | Linux 命令与 Shell |
| `vla` | Vision-Language-Action 模型基础 |
| `forcevla` | ForceVLA 论文专题 |
| `wam` | WAM：世界模型（World Model / World Action Model） |
| `robotics` | 通用机器人学 |
| `ur` | UR（Universal Robots）协作机械臂：硬件、安全、编程接口、力控、VLA 数据采集与部署 |
| `paper` | 无法归入任何领域的论文笔记（论文库内的论文一律用所在领域的 topic，见第 11 节） |

新增主题时在本表登记一行。

## 4. 教程章节的固定结构（type: tutorial）

章节正文必须按下面顺序组织，**标题文字固定**，这样 Agent 可以按段落精确抽取：

```markdown
# 章节标题

> 一句话说明本章解决什么问题（给完全不懂的人看）。

## 学习目标
- 学完后你能做到 ……（3~5 条，用"能做什么"描述，而不是"了解什么"）

## 前置知识
- 需要先读：[04 文件操作](04-file-operations.md)
- 没有前置时写"无"

## 核心概念
| 术语 | 一句话解释 | 类比 |
|---|---|---|
| ...  | ...        | ...  |

## 详细讲解
### 4.1 小节
正文。每个命令/概念 = 讲解 + 可运行示例 + 预期输出。

## 动手练习
1. 练习题（给出明确的任务和验收标准）
<details><summary>参考做法</summary>
...
</details>

## 常见错误与排查
| 现象 | 原因 | 解决 |
|---|---|---|

## 小结
- 用 5 条以内的要点概括本章。

## 自测题
1. 问题？
<details><summary>答案</summary>答案内容</details>

## 参考资料
- [名称](链接) —— 一句话说明为什么值得看
```

## 5. 论文笔记的固定结构（type: paper-note）

```markdown
# 论文标题（中文译名）

## 论文信息
| 项目 | 内容 |
|---|---|
| 标题 | 英文原标题 |
| 作者 / 机构 | |
| 发表 | 会议/期刊 + 年份 |
| 链接 | arXiv / 项目页 / 代码 |
| 关键词 | |

## 一句话总结
用一句话说清楚：解决什么问题、怎么解决、效果如何。

## 背景与动机
- 之前的方法有什么问题？
- 为什么这个问题重要？

## 方法
### 整体框架
（文字描述 + 必要时 ASCII 图或 Mermaid 图）
### 关键模块
逐个模块：输入 → 处理 → 输出，以及为什么这样设计。

## 实验
- 数据集 / 任务 / 基线
- 主要结果（表格）
- 消融实验说明了什么

## 优点与不足
| 优点 | 不足 / 疑问 |
|---|---|

## 与知识库的关联
- 用到了哪些基础知识：[链接]
- 可以延伸到哪些主题：[链接]

## 复现清单
- [ ] 环境
- [ ] 数据
- [ ] 关键超参数
- [ ] 预期指标

## 我的问题与想法
- 读完还没搞懂的点（Agent 可据此生成追问）
```

论文笔记的额外硬性要求（检查器会校验，细则见第 11 节）：

- frontmatter 必须有 `related`，至少包含一篇知识章节（非论文）。
- `## 与知识库的关联` 里至少有一个指向知识库文档的相对链接，并说明关联点。

## 6. 硬件 / 设备文档的固定结构（type: hardware）

```markdown
# 设备名称

## 设备概览（是什么、用来干什么）
## 关键参数（表格）
## 安全须知（⚠️ 必须放在操作之前）
## 系统组成（机械 / 电气 / 软件）
## 安装与启动流程（编号步骤 + 每步的预期现象）
## 基本操作
## 编程接口（API / SDK / ROS）
## 常见故障与排查
## 维护与关机
## 参考资料
```

## 7. 写作规则

### 7.1 面向小白

- 第一次出现的术语用**粗体**并紧跟一句解释：`**shell**（你和操作系统对话的"翻译官"程序）`。
- 先说"为什么需要它"，再说"它是什么"，最后说"怎么用"。
- 每个概念至少一个**类比**（和日常生活的事物对应）。
- 不要连续堆砌三个以上新术语。

### 7.2 代码与命令

- 所有代码块必须标语言：```` ```bash ````、```` ```python ````、```` ```yaml ````。
- 命令示例不加 `$` 前缀，方便直接复制；需要展示输出时，用单独的代码块并标注 `# 输出：`。
- 有危险的命令（`rm -rf`、`dd`、`chmod -R 777` 等）前必须有 `> ⚠️` 警告块。
- 示例尽量真实可运行，路径用 `~/demo` 这类不会误伤的目录。

### 7.3 提示块（Callout）

统一使用引用块 + emoji 前缀，Agent 会按前缀识别：

| 前缀 | 用途 |
|---|---|
| `> 💡 要点：` | 必须记住的核心结论 |
| `> ⚠️ 注意：` | 容易出错 / 有风险 |
| `> 🔍 深入：` | 进阶内容，小白可跳过 |
| `> 🔗 关联：` | 与其他章节 / 论文的联系 |
| `> ❓ 待解决：` | 作者也不确定的问题，供 Agent 追踪 |

### 7.4 链接

- 内部链接一律用**相对路径**的标准 Markdown 链接：`[04 文件操作](../LinuxCommand/04-file-operations.md)`，不要用绝对路径，不要用 `[[wiki]]` 语法（Web 端无法解析）。
- 外部链接写清楚是什么：`[OpenVLA 代码（GitHub）](https://github.com/openvla/openvla)`。

### 7.5 图表

- 优先用 Markdown 表格、ASCII 图或 Mermaid（```` ```mermaid ````），Web 端可直接渲染。
- 需要图片时放入 `assets/`，并写 alt 文本：`![cp 命令示意图](assets/03-cp.png)`。
- 数学公式用 `$...$`（行内）和 `$$...$$`（独立），Web 端用 KaTeX 渲染。

### 7.6 长度

- 一个教程章节控制在 **800~2500 中文字**，超过就拆章。
- 论文笔记不限长度，但"一句话总结"必须在 60 字以内。

## 8. 目录文件（00-README.md）

每个主题文件夹必须有 `00-README.md`，`type: index`，包含：

1. 主题简介（这个主题学完能做什么）
2. 学习路线（Mermaid 流程图或有序列表，标明每章的难度与预计时长）
3. 章节表格：`| 章节 | 文件 | 难度 | 状态 |`
4. 与其他主题的关系

## 9. 提交前检查清单

每个文件完成后逐项核对：

- [ ] frontmatter 完整且 `updated` 为今天
- [ ] 文件名符合 `NN-kebab-case.md`
- [ ] 结构与第 4/5/6 节的模板一致，标题文字未改动
- [ ] 每个新术语首次出现有解释
- [ ] 所有代码块标注了语言
- [ ] 危险命令有 ⚠️ 警告
- [ ] 内部链接可点击（相对路径、文件存在）
- [ ] 有自测题且答案折叠在 `<details>` 中
- [ ] 所在文件夹的 `00-README.md` 已登记本章（论文库目录由 `./start.sh papers` 自动生成，不手动登记）
- [ ] 论文笔记的 `related` 已填写且路径存在
- [ ] `./start.sh ci` 全部通过（提交与发布流程见根目录 `CONTRIBUTING.md`）

## 10. Agent 系统如何使用本标准

`agent/` 下的系统会：

1. 扫描所有 `.md`，解析 frontmatter，建立索引（topic / level / tags / prerequisites）。
2. 按 H2 标题把正文切块，`## 核心概念`、`## 小结`、`## 自测题` 这些固定段落会被优先用于回答问题与生成练习。
3. 读取论文（PDF / arXiv）后，**按第 5 节的模板**自动生成论文笔记写入 `Knowledge/Papers/<领域>/`，自动填写 `related` 并刷新论文库目录，再由人工复核把 `status` 改为 `reviewed`。
4. Web 端按 `00-README.md` 的章节表格渲染导航。

因此：**改动模板 = 改动协议**，若要调整本标准，先更新本文件，再同步更新 `templates/` 和 `agent/` 中的提示词。

## 11. 论文库（Knowledge/Papers）

论文库收集所有"泛读"论文，每篇论文都必须挂到已有的知识章节上，让"学知识 → 看论文 → 回到知识"形成闭环。

### 11.1 目录

```text
Knowledge/Papers/
├── 00-README.md        # 论文库总览：各领域数量 + 知识章节 → 相关论文的反向索引（自动生成部分）
├── VLA/                # 视觉-语言-动作模型相关论文，topic: vla
│   ├── 00-README.md    # 本领域论文表（自动生成部分）+ 待读清单（手写）
│   └── 01-xxx.md       # 一篇论文一个文件，type: paper-note
├── WAM/                # 世界模型相关论文，topic: wam
└── Robotics/           # 其他机器人学习论文（模仿学习、数据集等），topic: robotics
```

| 领域目录 | topic | 收录范围 |
|---|---|---|
| `VLA/` | `vla` | VLA 模型、动作表示、力/触觉融合等，与 `VLA/Basic`、`VLA/ForceVLA` 关联 |
| `WAM/` | `wam` | 世界模型、视频生成、隐空间预测、基于模型的规划，与 `WAM/` 关联 |
| `Robotics/` | `robotics` | 不属于上面两类的机器人学习论文 |

规则：

- 论文库里只有一层领域子目录；领域目录里除 `00-README.md` 外只能放 `type: paper-note`，`topic` 必须等于上表的领域 topic。
- 新增领域：先在本节表格登记，再在 `agent/src/config.js` 的 `PAPER_DOMAINS` 增加一项，并建好 `00-README.md`。
- 需要拆成多章精读的论文（如 ForceVLA）仍放在所属主题下做"论文专题"，它的 `01-paper-overview.md`（paper-note）会自动出现在对应领域的论文表里，标注"精读专题"。

### 11.2 关联（related）

- `related` 写**知识库根目录相对路径**（以 `Knowledge/` 开头），列出 2~6 篇本论文用到或延伸的知识章节，至少一篇不是论文。
- `## 与知识库的关联` 用**相对当前文件**的链接写出同样的章节，并各用一句话说明关联点（用到了什么 / 可以延伸到哪里）。
- 反方向不需要手写：索引器从 `related` 反查，网页阅读器在每个知识章节底部显示"📄 相关论文"，助教 `read_document` 时也能看到。

### 11.3 自动生成的目录

`Knowledge/Papers/` 下各 `00-README.md` 中，`<!-- AUTO-GENERATED:papers START ... -->` 与 `<!-- AUTO-GENERATED:papers END -->` 之间的内容由 `./start.sh papers` 生成，**不要手改**；标记之外的部分正常手写。导入论文后会自动刷新；手动新增或修改论文后运行一次 `./start.sh papers`。CI 会检查这些表格是否过期。

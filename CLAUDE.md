# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 这是什么仓库

一个面向零基础读者的中文学习知识库（Linux 命令、VLA 模型、ForceVLA 论文、WAM 世界模型、UR 协作机械臂、论文库），加上一个本地 Node.js Agent 系统（网页阅读器 + Claude 助教 + 论文导入）。两类工作完全不同：

- **写内容**：`Knowledge/` 下的 Markdown，必须遵守 `STANDARD.md`。
- **改代码**：`agent/` 下的 Node.js（ESM，无框架、无构建步骤）。

`STANDARD.md` 是协议而不是建议：Agent 的提示词（`agent/src/prompts.js`）会把它全文注入，规范检查器（`agent/src/kb.js` 的 `check()`）按它校验。改动 STANDARD.md 之前先问用户，改完要同步 `templates/` 和 `prompts.js`。

## 术语约定

- **WAM = 世界模型（World Model / World Action Model）**，不是 Barrett WAM 机械臂。早期草稿曾写错，已清理；不要再引入机械臂含义。
- 内容路径统一在 `Knowledge/` 下（`LinuxCommand/`、`VLA/Basic/`、`VLA/ForceVLA/`、`WAM/`、`UR/`、`Papers/`）。曾用过 `Siemens/` 前缀、根目录 `Papers/`，都已废弃（CI 守卫会拦 `Siemens/`）。
- **论文库** `Knowledge/Papers/<VLA|WAM|Robotics>/`：一篇论文一个 paper-note，`topic` 必须等于领域 topic（vla / wam / robotics）。每篇 paper-note（包括 `VLA/ForceVLA/01-paper-overview.md`）必须有 frontmatter `related: [Knowledge/...]`（知识库根目录相对路径），索引器据此反查"相关论文"。领域表在 `agent/src/config.js` 的 `PAPER_DOMAINS` 和 STANDARD.md 第 11 节，两处同步。
- 文件名 `NN-kebab-case.md`，`00-README.md` 是每个文件夹的目录文件（type: index）。

## 常用命令

```bash
./start.sh            # 启动 Web（自动 npm install、读取 agent/.env、打开浏览器）
./start.sh test       # 离线自检：索引统计 + 两次检索 + 规范检查，不需要 API Key
./start.sh check      # 只跑规范检查（等价 cd agent && npm run check）
./start.sh ask "问题"  # 命令行向助教提问（需要 ANTHROPIC_API_KEY）
./start.sh paper <arXiv链接|PDF> [目标文件夹] [topic]   # 导入论文，默认 Knowledge/Papers/VLA，topic 自动推断
./start.sh papers     # 重新生成论文库 00-README 里的 AUTO-GENERATED 表格（--check 只检查）
./start.sh ci         # 完整本地 CI（--fast 跳过测试）；这是"改完了"的标准
./start.sh setup      # git init + core.hooksPath=.githooks
./start.sh release [auto|patch|minor|major] [--dry-run]   # 只在 main、工作区干净时
./start.sh build      # 生成 GitHub Pages 静态站到 dist/（gitignored）
./start.sh service install|status|restart|logs|uninstall   # macOS launchd 开机自启的本机服务（com.learning.kb，端口 8787）

cd agent
npm run index                      # 索引统计（文档数、段落数、按 topic/status 分布）
npm run search -- 关键词            # BM25 检索，中英文都行
PORT=8788 npm start                # 换端口启动
node --check src/xxx.js            # 改完 JS 先做语法检查
```

**改完任何东西都跑 `./start.sh ci` 到 "✅ CI 通过"**。阶段：语法检查 → 密钥扫描 → 术语/路径守卫 → STANDARD 规范检查 → 论文库索引是否最新 → `agent/test/*.test.js`（`node:test`，零依赖；冒烟测试会用 `PORT=0` 起服务打 API，并用 marked 渲染全部真实文档）。新增检查器规则或 agent 行为时，在 `agent/test/` 补测试，测试用 `test/fixture.js` 在临时目录造知识库，不要依赖真实内容。

迭代流程（分支前缀、Conventional Commits 的 type、发布）见 `CONTRIBUTING.md`。提交信息 type：`content` / `paper` / `feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `ci` / `chore` / `revert`，`commit-msg` 钩子会校验。只有用户要求时才提交或发布。

**后端（`KB_BACKEND`）**：默认 `claude-code`，用户要求用 Claude Max 订阅——`src/claude-code.js` 以 headless 模式（`claude -p --output-format stream-json`）调用本机已登录的官方 `claude` CLI，子进程环境里去掉 `ANTHROPIC_API_KEY/AUTH_TOKEN/PROFILE`（否则按 API 计费），不能加 `--bare`。权限用 `--permission-mode dontAsk` + `--allowedTools` 白名单；**路径限定的写权限必须写成 `Edit(./path/**)`，`Write(path)` 规则会被忽略**。论文导入复用 `.claude/skills/import-paper/SKILL.md`，改导入流程时两边一起改。`KB_BACKEND=api` 时走 `src/agent.js` / `src/paper.js`（SDK），凭据是 `ant auth login` 或 `agent/.env` 的 API Key；空值会被清掉，`sk-ant-oat…` 订阅令牌会被 `start.sh` 拒绝——不要把订阅令牌接进 SDK。`src/backend.js` 统一两者的 `chat()` / `ingestPaper()` 接口。终端 export 的值优先于 `.env`。`agent/.env.example` 会被提交，只能写占位符（曾经误放过真实 Key）；CI 的密钥扫描会拦 `sk-ant-` 开头的长串。没有 Key 时 Web 仍能启动（只读模式），聊天/导入会返回认证错误。

## 内容写作规则（写 Markdown 时必看）

完整规则在 `STANDARD.md`，这里只列最容易踩的：

- 第一行必须是 YAML frontmatter，必填 `title / type / topic / level / tags / status / created / updated`。
- `type: tutorial` 的 H2 标题文字固定且顺序固定：学习目标 → 前置知识 → 核心概念 → 详细讲解 → 动手练习 → 常见错误与排查 → 小结 → 自测题 → 参考资料。`paper-note` 和 `hardware` 各有自己的固定段落。检查器按标题文字精确匹配。
- 所有代码块必须标语言；ASCII 图用 ```` ```text ````。检查器会报"代码块未标语言"。
- 内部链接用相对路径（`../VLA/Basic/04-vla-concept.md`），检查器会验证目标文件存在；行内代码和代码块里的链接不检查。
- 提示块用固定前缀：`> 💡 要点：`、`> ⚠️ 注意：`、`> 🔍 深入：`、`> 🔗 关联：`、`> ❓ 待解决：`。前端按前缀渲染成彩色卡片，Agent 按前缀识别。
- 新章节要在所在文件夹的 `00-README.md` 章节表登记。新增 `topic` 值要在 STANDARD.md 第 3 节的表里登记。
- 论文库的 `00-README.md` 里 `<!-- AUTO-GENERATED:papers START/END -->` 之间是生成的，不要手改；改了论文的 `related` / `year` / `status` 后跑 `./start.sh papers`。
- 查不到、不确定的事实用 `> ❓ 待解决：` 标出，不要编数字。

## Agent 系统架构（agent/）

数据流：`Knowledge/*.md` → `kb.js` 索引 → `agent.js`（聊天）/ `paper.js`（论文导入）→ `server.js`（HTTP + SSE）→ `web/`。

- **`src/kb.js`**：启动时全量扫描知识库（排除 `agent/`、`node_modules` 等），解析 frontmatter（自己写的 YAML 子集解析器，只支持 `key: value`、`[a, b]`、块列表），按 H2 切段，建 BM25 索引。分词是"ASCII 单词 + 中文字符二元组"，所以中英文混搜都能用。`check()` 在去掉代码块和行内代码后再校验标题与链接；`templates/` 被整体跳过。`safeResolve()` 是所有文件读写的边界：路径不能越出知识库根目录、不能进入排除目录。
- **`src/agent.js`**：手写的流式工具循环（`client.beta.messages.stream` + `finalMessage()`），不是 SDK 的 tool runner。工具用 `strict: true` + `eager_input_streaming: true`，所以**每个工具输入都要在 `validateInput()` 里手动校验**。五个工具：`search_knowledge_base`、`read_document`、`list_documents`、`save_note`（只能写 `.md`，禁止碰 `STANDARD.md` 和 `templates/`，默认不覆盖）、`log_qa`（追加到 `notes/qa-log.md`）。写入后会 `kb.reindex()`。默认开启服务端拒答回退（`betas: server-side-fallback-2026-06-01`，回退到 `claude-opus-4-8`），`KB_FALLBACKS=0` 关闭。
- **`src/paper.js`**：PDF 以 base64 `document` 块直接喂给模型，不做本地文本抽取；arXiv abs/html 链接会自动换成 pdf 链接。目标在论文库内时 `resolveTopic()` 强制领域 topic；提示词只给非论文的知识章节供模型选 `related`。输出必须以 frontmatter 开头才保存；文件名按目标文件夹里已有的 `NN-` 前缀自动递增；保存后自动 `syncIndexes()` 并返回该文件的规范问题（不阻断保存）。
- **`src/papers.js`**：论文库目录生成。`listPapers()` 只算 `Knowledge/` 下的 paper-note（`templates/` 不算，见 `isPaperNote()`）；`syncIndexes(kb, {write})` 只替换 AUTO 标记之间的内容。
- **`scripts/`**：`ci.js`（流水线）、`commit-msg.js`（提交信息）、`release.js`（semver + CHANGELOG + 标签）。钩子在根目录 `.githooks/`，通过 `core.hooksPath` 启用。
- **`src/server.js`**：零依赖 `http` 服务。`/api/doc` 额外返回 `related`（论文 → 知识）和 `relatedPapers`（知识 → 论文）。`PORT=0` 时打印实际端口（冒烟测试依赖这行日志）。`/api/chat` 和 `/api/paper` 用 SSE 推事件（`text` / `tool_call` / `tool_result` / `status` / `done` / `error`）。`/kb/<path>` 提供知识库内的图片等附件；`/vendor/<lib>/...` 把 `node_modules` 里的 marked、highlight.js、KaTeX、mermaid 提供给浏览器（**不依赖外网 CDN**，这是故意的，国内网络下 CDN 会导致整页空白）。`fs.watch` 监听 `.md` 变化自动重建索引。
- **`src/prompts.js`**：系统提示词在这里拼装，运行时读取 `STANDARD.md` 与模板。改标准后不用改代码，但要确认提示词里的示例路径仍然存在。
- **两种部署**：公网 GitHub Pages（`scripts/build-static.js` → `dist/`，`.github/workflows/pages.yml` 在 push main 时跑完整 CI 再发布）只读；本机 launchd 服务带 AI。静态站把 `/api/tree|stats|doc|search` 预先生成成 `data/*.json`，搜索在浏览器里用同一个 `src/search-core.js`（纯 ESM，不能引入 Node API），文档数据用同一个 `kb.docPayload()`——改 API 返回结构时两边自动一致，`test/static.test.js` 会校验。
- **`web/`**：纯静态 `index.html + app.js + style.css`，`app.js` 顶部的 `data` 对象按 `window.KB_STATIC` 切换数据来源（构建时注入）。**`index.html` 里的路径必须是相对路径**（Pages 部署在子路径 `/<仓库名>/` 下），CI 会拦以 `/` 开头的 `src/href`。hash 路由（`#/Knowledge/...md`、`#/search=...`）。对话历史只在浏览器内存里，每次请求把完整 `messages` 发给后端。

模型与参数通过环境变量配置（`src/config.js`）：`KB_BACKEND`（`claude-code` | `api`）、`KB_CC_MODEL`（默认 `opus`）、`KB_MODEL`（api 后端，默认 `claude-opus-5-5`）、`KB_CHAT_EFFORT`、`KB_PAPER_EFFORT`、`KB_FALLBACKS`、`KB_ROOT`、`PORT`。

## 容易踩的坑

- **marked 是 12.x，renderer 用位置参数**：`heading(text, level)`、`code(code, lang)`、`table(header, body)`、`link(href, title, text)`。不要写成 13+ 的对象参数 `({ text, lang })`，否则代码块会渲染成 `undefined`。升级 marked 前先改 `web/app.js` 的 renderer。
- 这台机器只有 Python 3.9，Anthropic Python SDK 1.x 需要 3.10+，所以 Agent 用 Node 实现；不要往仓库里加 Python 依赖。
- `@anthropic-ai/sdk` 当前 0.110.x 只认拒答回退的数组形式（`fallbacks: [{ model }]` + `server-side-fallback-2026-06-01`），标量形式 `"default"` 的类型还没有。
- 检查器对 `00-README.md` 的文件名有特例，其他文件必须是 `两位数字-小写短横线.md`。
- 用 `sed -i` 时记得 macOS 需要 `sed -i ''`。
- 仓库在 `~/Learning`（`~/Desktop/Learning` 是符号链接）。macOS 的隐私保护不让 launchd 服务读桌面，别把仓库挪回桌面；`start.sh` 用 `pwd -P` 取物理路径就是为此。
- `start.sh` 里变量后面紧跟全角标点（`$LOG）`）会被 bash 当成变量名的一部分，要写成 `${LOG}`。
- `CONTRIBUTING.md`、`CHANGELOG.md` 在 `EXCLUDED_FILES` 里，不被索引也不受 STANDARD 检查；根目录新增其他非知识类 .md 也要加进去，否则会被要求 frontmatter。
- 子代理并行写不同文件夹时，跨文件夹链接的文件名要事先约定，否则最后要统一修链接（历史上 ForceVLA 与 Basic 之间出过这个问题）。

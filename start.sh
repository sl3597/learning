#!/usr/bin/env bash
# Learning 知识库一键启动脚本
# 用法：
#   ./start.sh            启动 Web（默认 http://localhost:8787）
#   ./start.sh test       跑一遍离线自检（索引 / 检索 / 规范检查），不需要 API Key
#   ./start.sh ask "问题"  命令行直接向助教提问（需要 API Key）
#   ./start.sh paper <arXiv链接或PDF> [目标文件夹] [topic]   导入论文生成笔记（需要 API Key），默认 Knowledge/Papers/VLA
#   ./start.sh login      登录 Claude：默认用 Claude Code 登录 Max/Pro 订阅；KB_BACKEND=api 时用 ant auth login
#   ./start.sh check      只做规范检查
#   ./start.sh papers     重新生成论文库目录表格（--check 只检查是否过期）
#   ./start.sh setup      初始化 git 仓库并启用 .githooks（提交 / 推送前自动跑 CI）
#   ./start.sh ci         本地 CI：语法 / 密钥 / 守卫 / 规范 / 论文索引 / 测试（--fast 跳过测试）
#   ./start.sh release [auto|patch|minor|major] [--dry-run]   在 main 上发布：CI → CHANGELOG → 版本号 → 标签
#   ./start.sh service [install|uninstall|restart|status|logs]  开机自启的本机服务（macOS launchd），含 AI 助教
#   ./start.sh build      生成 GitHub Pages 静态站到 dist/（只读：阅读 + 搜索）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"  # 物理路径：从桌面快捷方式运行时也指向真实目录
AGENT="$ROOT/agent"
cd "$AGENT"

# ---------- 1. 环境检查 ----------
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 没有找到 node，请先安装 Node.js 20+（https://nodejs.org）"; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node 版本过低（$(node -v)），需要 20+"; exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 首次运行，安装依赖…"
  npm install --no-fund --no-audit
fi

# ---------- 2. 读取凭据 ----------
# SDK 的凭据顺序：ANTHROPIC_API_KEY > ANTHROPIC_AUTH_TOKEN > ant auth login 的登录档案（~/.config/anthropic/）
# 终端里已 export 的值优先于 agent/.env
_PRE_KEY="${ANTHROPIC_API_KEY:-}"; _PRE_TOKEN="${ANTHROPIC_AUTH_TOKEN:-}"
if [ -f "$AGENT/.env" ]; then
  set -a; . "$AGENT/.env"; set +a
fi
[ -n "$_PRE_KEY" ] && export ANTHROPIC_API_KEY="$_PRE_KEY"
[ -n "$_PRE_TOKEN" ] && export ANTHROPIC_AUTH_TOKEN="$_PRE_TOKEN"
# 空值也会占住优先级，让登录档案失效，所以清掉
[ -z "${ANTHROPIC_API_KEY:-}" ] && unset ANTHROPIC_API_KEY
[ -z "${ANTHROPIC_AUTH_TOKEN:-}" ] && unset ANTHROPIC_AUTH_TOKEN
case "${ANTHROPIC_API_KEY:-}" in
  sk-ant-oat*)
    echo "⚠️  ANTHROPIC_API_KEY 里是 Claude Code / Claude 订阅的登录令牌（sk-ant-oat…），不是 API Key，本程序不能用，已忽略。"
    echo "   改用 ./start.sh login，或在 Console 创建 API Key。"
    unset ANTHROPIC_API_KEY ;;
esac

has_profile() {
  [ -n "${ANTHROPIC_PROFILE:-}" ] && return 0
  ls "${ANTHROPIC_CONFIG_DIR:-$HOME/.config/anthropic}"/credentials/*.json >/dev/null 2>&1
}

# 后端：claude-code（默认，走本机 claude CLI 登录的 Max/Pro 订阅）| api（走 API Key 或 ant 登录，按 API 计费）
BACKEND="${KB_BACKEND:-claude-code}"

need_key() {
  if [ "$BACKEND" = "api" ]; then
    if [ -n "${ANTHROPIC_API_KEY:-}" ] || [ -n "${ANTHROPIC_AUTH_TOKEN:-}" ] || has_profile; then
      return 0
    fi
    echo "⚠️  KB_BACKEND=api 但没有检测到 API 凭据：./start.sh login，或在 $AGENT/.env 写 ANTHROPIC_API_KEY=sk-ant-api03-..."
    return 1
  fi
  if ! command -v claude >/dev/null 2>&1; then
    echo "⚠️  没有找到 claude 命令。先安装 Claude Code（https://claude.com/claude-code），再 ./start.sh login 用 Max 账号登录。"
    return 1
  fi
  # 不能有 API 凭据：claude -p 遇到 ANTHROPIC_API_KEY 会优先用它按 API 计费（agent 启动子进程时也会去掉）
  if ! env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN claude auth status 2>/dev/null | grep -q '"loggedIn": *true'; then
    echo "⚠️  Claude Code 还没登录。运行 ./start.sh login，用你的 Claude Max 账号登录。"
    return 1
  fi
  return 0
}

# ---------- 3. 子命令 ----------
CMD="${1:-serve}"
case "$CMD" in
  test)
    echo "== 1/3 索引统计 =="; node src/cli.js index
    echo; echo "== 2/3 检索测试（中文 / 英文）=="
    node src/cli.js search "chmod 权限" | head -6
    node src/cli.js search "world model Dreamer" | head -6
    echo; echo "== 3/3 规范检查 =="; node src/cli.js check
    echo
    if need_key; then
      echo "✅ 离线自检通过，Claude 已可用（后端：${BACKEND}）。下一步可以试试："
      echo "   ./start.sh ask \"管道和重定向有什么区别？\""
    else
      echo "✅ 离线自检通过（聊天 / 导入论文需要先 ./start.sh login）"
    fi
    ;;
  check)
    node src/cli.js check
    ;;
  login)
    if [ "$BACKEND" != "api" ]; then
      command -v claude >/dev/null 2>&1 || { echo "先安装 Claude Code：https://claude.com/claude-code"; exit 1; }
      env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN claude auth login && env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN claude auth status
      exit $?
    fi
    if ! command -v ant >/dev/null 2>&1; then
      echo "需要先安装 Anthropic 官方 CLI（ant）："
      echo "   brew install anthropics/tap/ant"
      echo "   xattr -d com.apple.quarantine \"\$(brew --prefix)/bin/ant\""
      exit 1
    fi
    [ -n "${ANTHROPIC_API_KEY:-}" ] && echo "⚠️  当前设置了 ANTHROPIC_API_KEY，它会优先于登录档案；想用登录就把 agent/.env 里那一行删掉。"
    ant auth login && ant auth status
    ;;
  papers)
    shift; node src/cli.js papers "$@"
    ;;
  ci)
    shift; node scripts/ci.js "$@"
    ;;
  setup)
    cd "$ROOT"
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
      git init -b main
    fi
    git config core.hooksPath .githooks
    chmod +x .githooks/* agent/scripts/*.js
    echo "✅ git 钩子已启用：pre-commit（快速检查）/ commit-msg（提交信息规范）/ pre-push（完整 CI）/ post-merge（依赖同步）"
    echo "   迭代流程见 CONTRIBUTING.md"
    ;;
  release)
    shift; node scripts/release.js "$@"
    ;;
  build)
    node scripts/build-static.js "$ROOT/dist"
    echo "   本地预览：cd $ROOT/dist && python3 -m http.server 8790，然后打开 http://localhost:8790"
    ;;
  daemon)
    # 给 launchd 用：前台运行服务，不打开浏览器
    PORT="${PORT:-8787}" exec node src/server.js
    ;;
  service)
    shift
    LABEL="com.learning.kb"
    PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
    LOG="$HOME/Library/Logs/learning-kb.log"
    DOMAIN="gui/$(id -u)"
    PORT="${PORT:-8787}"
    case "${1:-status}" in
      install)
        # launchd 不读 shell 配置，把 node 和 claude 所在目录写进 PATH
        SVC_PATH="$(dirname "$(command -v node)")"
        if command -v claude >/dev/null 2>&1; then SVC_PATH="$SVC_PATH:$(dirname "$(command -v claude)")"; fi
        SVC_PATH="$SVC_PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
        cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$ROOT/start.sh</string><string>daemon</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$SVC_PATH</string>
    <key>PORT</key><string>$PORT</string>
    <key>KB_BACKEND</key><string>$BACKEND</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF
        launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
        launchctl bootstrap "$DOMAIN" "$PLIST"
        echo "✅ 已安装开机自启服务：http://localhost:$PORT （日志 ${LOG}）"
        echo "   卸载：./start.sh service uninstall"
        ;;
      uninstall)
        launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
        rm -f "$PLIST"
        echo "已卸载开机自启服务"
        ;;
      restart)
        launchctl kickstart -k "$DOMAIN/$LABEL" && echo "已重启"
        ;;
      status)
        if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
          launchctl print "$DOMAIN/$LABEL" | grep -E "^\s+(state|pid|last exit code) =" || true
          curl -s --max-time 3 "http://localhost:$PORT/api/health" >/dev/null && echo "✅ 服务在线：http://localhost:$PORT" || echo "⚠️  服务已注册但没响应，看日志：./start.sh service logs"
        else
          echo "未安装。安装：./start.sh service install"
        fi
        ;;
      logs)
        tail -n 40 "$LOG"
        ;;
      *) echo "用法: ./start.sh service [install|uninstall|restart|status|logs]"; exit 1 ;;
    esac
    ;;
  ask)
    shift; need_key || exit 1
    [ $# -gt 0 ] || { echo "用法: ./start.sh ask \"你的问题\""; exit 1; }
    node src/cli.js ask "$@"
    ;;
  paper)
    shift; need_key || exit 1
    [ $# -gt 0 ] || { echo "用法: ./start.sh paper <arXiv链接|PDF链接|本地PDF> [目标文件夹] [topic]"; exit 1; }
    node src/cli.js paper "$@"
    ;;
  serve|start|"")
    PORT="${PORT:-8787}"
    if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "⚠️  端口 $PORT 已被占用，改用 PORT=8788 ./start.sh 或先关闭占用的程序"; exit 1
    fi
    need_key || echo "   （先以只读模式启动：可以阅读和搜索，助教与导入论文暂不可用）"
    [ "$BACKEND" = "api" ] || echo "🔑 助教与论文导入使用本机 Claude Code 登录的订阅额度（KB_BACKEND=api 可改回 API）"
    echo "🚀 启动 Web：http://localhost:$PORT   （Ctrl+C 停止）"
    # macOS 自动打开浏览器
    if command -v open >/dev/null 2>&1; then (sleep 1.5; open "http://localhost:$PORT") & fi
    PORT="$PORT" exec node src/server.js
    ;;
  *)
    echo "未知命令：$CMD"; sed -n 2,15p "$0"; exit 1
    ;;
esac

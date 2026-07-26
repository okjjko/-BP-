#!/bin/bash
# 自动部署脚本 - Webhook 触发执行
# 功能：fetch 合并远端 → （按需）安装依赖 → 构建 → 重启服务

set -e  # 遇到错误立即退出
set -o pipefail  # 管道中任一命令失败即整体失败（避免 tee 掩盖 git/npm 失败 → 误判成功）

# ==================== 配置 ====================
PROJECT_DIR="/root/code/bp-tool"
LOG_FILE="/root/code/bp-tool/logs/deploy.log"
PID_FILE="/root/code/bp-tool/.deploy.pid"
# 上次成功部署到的 HEAD 标记文件（运行时状态，已 gitignore）
LAST_BUILT_FILE="/root/code/bp-tool/.last-deployed-commit"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ==================== 工具函数 ====================

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"
}

# 检查是否已有部署进程在运行
check_lock() {
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if ps -p "$OLD_PID" > /dev/null 2>&1; then
            warn "已有部署进程在运行 (PID: $OLD_PID)，跳过本次部署"
            exit 0
        else
            log "清理旧 PID 文件（进程 $OLD_PID 已不存在）"
            rm -f "$PID_FILE"
        fi
    fi
    echo $$ > "$PID_FILE"
}

# 清理函数
cleanup() {
    rm -f "$PID_FILE"
}

# 注册退出时清理
trap cleanup EXIT

# git fetch 带重试（应对服务器到 GitHub 网络间歇性不通）
# lowSpeed 超时让卡住的连接快速失败，尽早进入下一次重试
git_fetch_retry() {
    local max=8
    local i
    for i in $(seq 1 "$max"); do
        if git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=15 fetch origin master 2>&1 | tee -a "$LOG_FILE"; then
            return 0
        fi
        if [ "$i" -lt "$max" ]; then
            warn "git fetch 第 $i/$max 次失败，10s 后重试..."
            sleep 10
        fi
    done
    return 1
}

# ==================== 主流程 ====================
#
# 「是否需要 build」的判定：比较 当前HEAD 与 上次成功部署的HEAD（.last-deployed-commit），
# 而非 比较 本地HEAD 与 origin/master。原因：本机既是开发机又是生产机，在本机 commit+push
# 后本地 HEAD 已等于 origin/master，旧逻辑会误判"已最新"而跳过 build，导致本机改动不上线。
# 新逻辑下：只要 当前HEAD != 上次部署HEAD 就 build，真正一致才跳过。

main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    log "========== 开始自动部署 =========="

    # 1. 检查是否已有部署进程
    check_lock

    cd "$PROJECT_DIR" || exit 1

    # 读取上次成功部署的 HEAD（首次部署时为空）
    LAST_BUILT=$(cat "$LAST_BUILT_FILE" 2>/dev/null || echo "")
    # 容错：若记录的 commit 已不在历史中（rebase/force-push），按首次部署处理
    if [ -n "$LAST_BUILT" ] && ! git cat-file -e "${LAST_BUILT}^{commit}" 2>/dev/null; then
        warn "上次部署记录 $(git rev-parse --short "$LAST_BUILT" 2>/dev/null || echo '?') 已不在历史中，按首次部署处理"
        LAST_BUILT=""
    fi

    # 2. fetch 远端最新（不合并，便于判断远端是否有新提交）
    BEFORE_FETCH=$(git rev-parse HEAD)
    log "部署前版本: $(git rev-parse --short "$BEFORE_FETCH")"

    log "正在拉取最新代码..."
    if ! git_fetch_retry; then
        error "git fetch 重试 8 次仍失败（服务器当前访问 GitHub 不通）"
        exit 1
    fi

    # 3. 快进合并远端新提交（--ff-only 拒绝 merge commit，保证历史线性）
    if [ "$BEFORE_FETCH" != "$(git rev-parse origin/master)" ]; then
        log "远端有新提交，快进合并..."
        # 清理已知会被 npm install / setup-hooks 修改的副作用文件，避免阻挡 ff merge：
        # - package-lock.json：npm install 会把 version 字段同步成 package.json 的，每次 bump version 就产生本地改动
        # - .githooks/pre-commit：setup-hooks（prepare 钩子）每次给它加可执行位（100644→100755）
        # 本机是生产服务器，工作区不应有手改；这些副作用无价值，丢弃后 merge 用远程最新版覆盖。
        git checkout -- package-lock.json .githooks/pre-commit 2>/dev/null || true
        if ! git merge --ff-only origin/master 2>&1 | tee -a "$LOG_FILE"; then
            error "git merge --ff-only 失败（工作区可能有其他未提交改动阻挡）"
            git status -sb 2>&1 | tee -a "$LOG_FILE"
            exit 1
        fi
    fi

    CURRENT=$(git rev-parse HEAD)
    log "当前版本: $(git rev-parse --short "$CURRENT")"

    # 4. 决定是否需要部署：比较 当前HEAD 与 上次成功部署的HEAD
    if [ -n "$LAST_BUILT" ] && [ "$LAST_BUILT" = "$CURRENT" ]; then
        log "当前版本与上次成功部署一致，无需部署"
        exit 0
    fi

    if [ -n "$LAST_BUILT" ]; then
        log "版本变化: $(git rev-parse --short "$LAST_BUILT") → $(git rev-parse --short "$CURRENT")"
    else
        log "首次部署（无部署记录），执行完整构建"
    fi

    # 5. 安装根依赖：仅当 package.json 在 上次部署HEAD..当前HEAD 间变化（首次必装）
    NEED_INSTALL=false
    if [ -z "$LAST_BUILT" ]; then
        NEED_INSTALL=true
    elif git diff --name-only "$LAST_BUILT" "$CURRENT" -- package.json | grep -q .; then
        NEED_INSTALL=true
    fi
    if $NEED_INSTALL; then
        # ⚠️ 必须 --include=dev：本脚本由 bp-server（ecosystem.config.cjs 注入 NODE_ENV=production）
        # spawn，继承的 NODE_ENV=production 令 npm install 默认省略 devDependencies；
        # 而 build 依赖 vite（devDep）→ 不装 dev 会 vite: command not found → 构建失败。
        log "正在安装依赖..."
        if ! npm install --include=dev 2>&1 | tee -a "$LOG_FILE"; then
            error "npm install 失败"
            exit 1
        fi
    else
        log "package.json 无变化，跳过 npm install"
    fi

    # 6. 安装 server 依赖（同理：首次或 server/package.json 变化时）
    if [ -f "server/package.json" ]; then
        SERVER_NEED_INSTALL=false
        if [ -z "$LAST_BUILT" ]; then
            SERVER_NEED_INSTALL=true
        elif git diff --name-only "$LAST_BUILT" "$CURRENT" -- server/package.json | grep -q .; then
            SERVER_NEED_INSTALL=true
        fi
        if $SERVER_NEED_INSTALL; then
            log "正在安装服务端依赖..."
            cd server
            if ! npm install --include=dev 2>&1 | tee -a "$LOG_FILE"; then
                error "server npm install 失败"
                exit 1
            fi
            cd "$PROJECT_DIR"
        fi
    fi

    # 7. 构建前端
    log "正在构建前端..."
    if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
        error "构建失败"
        exit 1
    fi

    # 8. 记录本次部署 HEAD（build 成功即视为主体完成，趁早落盘）。
    #    ⚠️ 必须放在 pm2 restart 之前：本脚本由 bp-server spawn，pm2 restart 会让 bp-server
    #    重启、其进程树受信号波及，实测 restart 之后的收尾步骤会被中断（标记没写 → 下次误判
    #    未部署而重复 build）。把"写标记 + nginx reload"提前到 restart 之前；restart 命令一旦
    #    交给 PM2 daemon 即由 daemon 独立完成，本脚本随后是否被中断都不影响部署实质。
    echo "$CURRENT" > "$LAST_BUILT_FILE"
    log "已记录部署版本: $(git rev-parse --short "$CURRENT")"

    # 9. reload aa_nginx（确保识别到新的 dist）
    if command -v /usr/sbin/aa_nginx &> /dev/null; then
        log "正在 reload aa_nginx..."
        /usr/sbin/aa_nginx -s reload 2>&1 | tee -a "$LOG_FILE" || true
    fi

    # 10. 重启服务（放最后；脚本自然 exit 时 EXIT trap 仍清理 PID 锁）
    log "正在重启服务..."
    trap '' INT TERM

    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "bp-server"; then
            pm2 restart bp-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: bp-server 已重启"
        else
            warn "PM2: 未找到 bp-server 进程"
        fi
        if pm2 list | grep -q "peerjs-server"; then
            pm2 restart peerjs-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: peerjs-server 已重启"
        fi
        if pm2 list | grep -q "bp-lobby-server"; then
            pm2 restart bp-lobby-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: bp-lobby-server 已重启"
        fi
    else
        warn "未安装 PM2，跳过服务重启"
    fi

    log "========== 部署成功完成 =========="
    log "版本: $(git rev-parse --short "$CURRENT")"
    log "时间: $(date '+%Y-%m-%d %H:%M:%S')"
}

# 运行主流程
main "$@"

#!/bin/bash
# 自动部署脚本 - Webhook 触发执行
# 功能：拉取代码 → 构建 → 重启服务

set -e  # 遇到错误立即退出
set -o pipefail  # 管道中任一命令失败即整体失败（避免 tee 掩盖 git/npm 失败 → 误判成功）

# ==================== 配置 ====================
PROJECT_DIR="/root/code/bp-tool"
LOG_FILE="/root/code/bp-tool/logs/deploy.log"
PID_FILE="/root/code/bp-tool/.deploy.pid"
MAX_BUILD_TIME=300  # 构建超时时间（秒）

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

# git fetch 带重试（应对服务器到 GitHub 网络间歇性不通，实测 6/7 失败率）
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

main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    log "========== 开始自动部署 =========="

    # 1. 检查是否已有部署进程
    check_lock

    cd "$PROJECT_DIR" || exit 1

    # 2. 记录部署前版本，fetch 远端（不合并，便于精确比较）
    OLD_COMMIT=$(git rev-parse HEAD)
    log "部署前版本: $(git rev-parse --short "$OLD_COMMIT")"

    log "正在拉取最新代码..."
    if ! git_fetch_retry; then
        error "git fetch 重试 8 次仍失败（服务器当前访问 GitHub 不通）"
        exit 1
    fi

    # 3. 检查是否有实际更新（fetch 后比较本地 HEAD 与 origin/master）
    #    注意：必须在 merge/pull 之前比较，否则本地已被拉平 → 永远判定“已最新”而跳过部署
    if [ "$OLD_COMMIT" = "$(git rev-parse origin/master)" ]; then
        log "代码已是最新，无需部署"
        exit 0
    fi

    # 4. 快进合并到 origin/master（--ff-only 拒绝产生 merge commit，保证历史线性）
    if ! git merge --ff-only origin/master 2>&1 | tee -a "$LOG_FILE"; then
        error "git merge --ff-only 失败（工作区可能有未提交改动或已分叉）"
        exit 1
    fi

    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    log "更新到版本: $CURRENT_COMMIT"

    # 5. 安装依赖（仅在根 package.json 变化时）
    if git diff --name-only "$OLD_COMMIT" HEAD -- package.json | grep -q .; then
        log "检测到 package.json 变化，正在安装依赖..."
        if ! npm install 2>&1 | tee -a "$LOG_FILE"; then
            error "npm install 失败"
            exit 1
        fi
    else
        log "package.json 无变化，跳过 npm install"
    fi

    # 6. 安装 server 依赖（如有变化）
    if [ -f "server/package.json" ] && git diff --name-only "$OLD_COMMIT" HEAD -- server/package.json | grep -q .; then
        log "检测到 server/package.json 变化，正在安装服务端依赖..."
        cd server
        if ! npm install 2>&1 | tee -a "$LOG_FILE"; then
            error "server npm install 失败"
            exit 1
        fi
        cd "$PROJECT_DIR"
    fi

    # 7. 构建前端
    log "正在构建前端..."
    if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
        error "构建失败"
        exit 1
    fi

    # 8. 重启服务
    log "正在重启服务..."

    # PM2 重启所有相关进程
    if command -v pm2 &> /dev/null; then
        # 重启 bp-server
        if pm2 list | grep -q "bp-server"; then
            pm2 restart bp-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: bp-server 已重启"
        else
            warn "PM2: 未找到 bp-server 进程"
        fi

        # 重启 peerjs-server（如果存在）
        if pm2 list | grep -q "peerjs-server"; then
            pm2 restart peerjs-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: peerjs-server 已重启"
        fi

        # 重启 bp-lobby-server（如果存在）
        if pm2 list | grep -q "bp-lobby-server"; then
            pm2 restart bp-lobby-server 2>&1 | tee -a "$LOG_FILE"
            log "PM2: bp-lobby-server 已重启"
        fi
    else
        warn "未安装 PM2，跳过服务重启"
    fi

    # 7. reload aa_nginx（可选，确保 nginx 识别到新的 dist）
    if command -v /usr/sbin/aa_nginx &> /dev/null; then
        log "正在 reload aa_nginx..."
        /usr/sbin/aa_nginx -s reload 2>&1 | tee -a "$LOG_FILE" || true
    fi

    log "========== 部署成功完成 =========="
    log "版本: $CURRENT_COMMIT"
    log "时间: $(date '+%Y-%m-%d %H:%M:%S')"
}

# 运行主流程
main "$@"

# 自动部署配置指南

## 方案概述

本项目使用 **Webhook 方案** 实现自动部署：
- GitHub/GitLab 推送代码时，发送 Webhook 到服务器的 `/webhook/deploy` 端点
- 服务器验证签名后触发部署脚本
- 部署脚本自动执行：拉取代码 → 构建 → 重启服务

## 快速配置

### 1. 设置 Webhook 密钥

```bash
# 生成随机密钥（或使用自定义字符串）
export WEBHOOK_SECRET="$(openssl rand -hex 32)"

# 将密钥添加到环境变量（PM2 方式）
pm2 restart bp-server --env "WEBHOOK_SECRET=$WEBHOOK_SECRET"

# 或直接修改 .env.local
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET" >> /root/code/bp-tool/.env.local
```

### 2. GitHub 配置

1. 进入仓库设置：`Settings` → `Webhooks` → `Add webhook`
2. 配置：
   - **Payload URL**: `https://okjjko.top/webhook/deploy`
   - **Content type**: `application/json`
   - **Secret**: 输入上面的 `WEBHOOK_SECRET`
   - **Events**: 勾选 `Just the push event`

3. 点击 `Add webhook`

### 3. GitLab 配置

1. 进入仓库设置：`Settings` → `Webhooks`
2. 配置：
   - **URL**: `https://okjjko.top/webhook/deploy`
   - **Secret token**: 输入上面的 `WEBHOOK_SECRET`
   - **Trigger**: 勾选 `Push events`

3. 点击 `Add webhook`

### 4. 测试 Webhook

在 GitHub/GitLab 的 Webhook 页面，找到刚创建的 webhook，点击 "Test" 或 "Resend" 发送测试请求。

查看服务器日志：
```bash
# 查看 PM2 日志
pm2 logs bp-server --lines 50

# 或查看部署日志
tail -f /root/code/bp-tool/logs/deploy.log
```

## 部署流程详解

### 部署脚本 (`scripts/auto-deploy.sh`) 执行流程：

1. **检查锁文件** - 防止并发部署冲突
2. **记录当前版本 + fetch** - 保存 `OLD_COMMIT`，执行 `git fetch origin master`（仅拉取，不合并）
3. **检查更新** - 比较 `OLD_COMMIT` 与 `origin/master`，无更新则退出（**必须在合并前比较**，否则本地已被拉平，会永远误判“已最新”而跳过部署）
4. **快进合并** - `git merge --ff-only origin/master`（拒绝产生 merge commit，保证历史线性）
5. **安装依赖** - 仅在 `package.json`（或 `server/package.json`）于本次更新中变化时执行 `npm install`
6. **构建前端** - `npm run build`
7. **重启服务** - PM2 重启以下进程：
   - `bp-server` (主服务，8080)
   - `peerjs-server` (如存在)
   - `bp-lobby-server` (如存在)
8. **reload nginx** - `/usr/sbin/aa_nginx -s reload`

### 日志位置：

- **部署日志**: `/root/code/bp-tool/logs/deploy.log`
- **PM2 日志**: `pm2 logs bp-server`
- **锁文件**: `/root/code/bp-tool/.deploy.pid` (防止并发)

## 高级配置

### 仅部署特定分支

默认监听 `master` 分支。如需部署其他分支，修改 `scripts/auto-deploy.sh` 中的 `git fetch` / `git merge --ff-only` 两处：

```bash
git fetch origin <your-branch>
# ...
git merge --ff-only origin/<your-branch>
```

### 自定义部署触发条件

修改 `server/index.js` 的 `handleWebhook` 函数，添加事件过滤：

```javascript
// 仅在 master 分支的 push 事件时部署
const body = JSON.parse(req.body)
const ref = body.ref
if (event === 'push' && ref !== 'refs/heads/master') {
  return res.end(JSON.stringify({ ok: true, message: 'Branch ignored' }))
}
```

### 手动触发部署

```bash
# 直接执行部署脚本
bash /root/code/bp-tool/scripts/auto-deploy.sh

# 或通过 curl 模拟 webhook
curl -X POST http://localhost:8080/webhook/deploy \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<signature>" \
  -d '{}'
```

## 故障排查

### Webhook 返回 401 UNAUTHORIZED

- 检查 `WEBHOOK_SECRET` 是否一致
- GitHub: 确认 Secret 正确
- GitLab: 确认 Secret token 正确

### 部署脚本没有执行

- 检查 `scripts/auto-deploy.sh` 是否有执行权限：`chmod +x scripts/auto-deploy.sh`
- 查看服务器日志：`pm2 logs bp-server`

### 部署后服务没有重启

- 检查 PM2 进程名是否为 `bp-server`
- 手动测试：`pm2 restart bp-server`

### Git pull 失败

- 检查 git 远程仓库配置：`git remote -v`
- 确认服务器有 git 访问权限（SSH 或 HTTPS）
- 检查本地是否有未提交的更改：`git status`

## 安全建议

1. **使用 HTTPS** - 生产环境必须使用 HTTPS（aa_nginx 已配置）
2. **随机密钥** - 使用强随机密钥（`openssl rand -hex 32`）
3. **限制来源** - 在 nginx 中限制 Webhook 请求来源 IP（GitHub/GitLab 公网 IP）
4. **定期更新密钥** - 建议每季度更新 Webhook 密钥

## 备选方案：Cron 定时部署

如果 Webhook 不可用，可使用 cron 定时部署：

```bash
# 编辑 crontab
crontab -e

# 每 5 分钟检查一次更新并部署（如无更新则脚本会自动退出）
*/5 * * * * /root/code/bp-tool/scripts/auto-deploy.sh >/dev/null 2>&1
```

## 相关文件

- 部署脚本: `scripts/auto-deploy.sh`
- Webhook 处理: `server/index.js`
- 部署日志: `logs/deploy.log`

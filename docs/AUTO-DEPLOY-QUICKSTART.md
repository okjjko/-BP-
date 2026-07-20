# 自动部署快速配置指南

## 一键配置（5分钟）

### 步骤 1: 生成 Webhook 密钥

```bash
# 生成随机密钥
export WEBHOOK_SECRET="$(openssl rand -hex 32)"

# 查看密钥（复制保存）
echo $WEBHOOK_SECRET
```

### 步骤 2: 配置环境变量

```bash
# 编辑 .env.local（生产环境）
vim /root/code/bp-tool/.env.local

# 添加以下行（替换 <your-secret>）
WEBHOOK_SECRET=<your-secret>
```

### 步骤 3: 重启服务

```bash
# PM2 重启
pm2 restart bp-server

# 验证服务启动
pm2 logs bp-server --lines 20
```

### 步骤 4: 配置 GitHub Webhook

1. 打开仓库页面：`https://github.com/your-username/bp-tool/settings/hooks`
2. 点击 `Add webhook`
3. 填写：
   - **Payload URL**: `https://okjjko.top/webhook/deploy`
   - **Content type**: `application/json`
   - **Secret**: 粘贴你的 `WEBHOOK_SECRET`
   - **Events**: 勾选 `Just the push event`
4. 点击 `Add webhook`

### 步骤 5: 测试

```bash
# 在 Webhook 页面点击 "Test" → "Push event"

# 或使用测试脚本
export WEBHOOK_SECRET="<your-secret>"
bash /root/code/bp-tool/scripts/test-webhook.sh
```

## 验证部署

推送测试代码到 GitHub：

```bash
echo "test auto deploy" >> /tmp/test.txt
git add -A
git commit -m "test: 自动部署测试"
git push origin master
```

查看部署日志：

```bash
# 实时查看部署日志
tail -f /root/code/bp-tool/logs/deploy.log

# 或查看 PM2 日志
pm2 logs bp-server
```

预期日志输出：

```
[2026-07-17 10:30:00] ========== 开始自动部署 ==========
[2026-07-17 10:30:01] 正在拉取最新代码...
[2026-07-17 10:30:02] 当前版本: abc1234
[2026-07-17 10:30:02] package.json 无变化，跳过 npm install
[2026-07-17 10:30:10] 正在构建前端...
[2026-07-17 10:30:35] 正在重启服务...
[2026-07-17 10:30:35] PM2: bp-server 已重启
[2026-07-17 10:30:36] 正在 reload aa_nginx...
[2026-07-17 10:30:36] ========== 部署成功完成 ==========
```

## GitLab 配置（替代 GitHub）

1. 打开仓库设置：`https://gitlab.com/your-username/bp-tool/settings/hooks`
2. 点击 `Add webhook`
3. 填写：
   - **URL**: `https://okjjko.top/webhook/deploy`
   - **Secret token**: 粘贴你的 `WEBHOOK_SECRET`
   - **Trigger**: 勾选 `Push events`
4. 点击 `Add webhook`

## 常见问题

### Q: Webhook 返回 401？
**A:** 检查密钥是否一致：
```bash
# 服务器
grep WEBHOOK_SECRET /root/code/bp-tool/.env.local

# GitHub/GitLab 设置页
# 确认 Secret/token 一致
```

### Q: 部署没有触发？
**A:** 检查服务器日志：
```bash
pm2 logs bp-server | grep webhook
tail -f /root/code/bp-tool/logs/deploy.log
```

### Q: 如何禁用自动部署？
**A:** 在 GitHub/GitLab 中删除 webhook，或注释掉服务器代码：
```bash
# 编辑 server/index.js
# 找到 handleWebhook 调用，注释掉
```

## 详细文档

完整配置说明：`docs/AUTO-DEPLOY.md`

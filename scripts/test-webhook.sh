#!/bin/bash
# Webhook 测试脚本 - 模拟 GitHub/GitLab Webhook 请求

# 配置
WEBHOOK_URL="${WEBHOOK_URL:-http://localhost:8080/webhook/deploy}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:-change-me-in-production}"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Webhook 测试脚本${NC}"
echo "URL: $WEBHOOK_URL"
echo ""

# 1. 测试无签名（应返回 401）
echo -e "${YELLOW}测试 1: 无签名请求（预期 401）${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": true}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "HTTP $HTTP_CODE: $BODY"
if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ 通过${NC}"
else
  echo -e "${RED}✗ 失败（预期 401）${NC}"
fi
echo ""

# 2. 测试 GitHub 签名
echo -e "${YELLOW}测试 2: GitHub 签名（预期 200）${NC}"
PAYLOAD='{"ref":"refs/heads/master","repository":{"name":"bp-tool"},"pusher":{"name":"test"},"after":"abc123"}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: push" \
  -d "$PAYLOAD")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "HTTP $HTTP_CODE: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ 通过${NC}"
else
  echo -e "${RED}✗ 失败（预期 200）${NC}"
fi
echo ""

# 3. 测试 GitLab token
echo -e "${YELLOW}测试 3: GitLab Token（预期 200）${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Gitlab-Token: $WEBHOOK_SECRET" \
  -H "X-Gitlab-Event: Push Hook" \
  -d '{"event_name":"push"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "HTTP $HTTP_CODE: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ 通过${NC}"
else
  echo -e "${RED}✗ 失败（预期 200）${NC}"
fi
echo ""

echo -e "${GREEN}测试完成${NC}"
echo ""
echo "提示："
echo "- 查看 PM2 日志：pm2 logs bp-server"
echo "- 查看部署日志：tail -f /root/code/bp-tool/logs/deploy.log"

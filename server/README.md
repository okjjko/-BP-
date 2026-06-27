# bp-lobby-server（公共房间目录服务）

为 BP 对战工具提供「公共房间列表」能力的轻量后端。房主开公开房时把房间登记到这里，
其他人通过列表看到后，**复用现有 `roomManager.joinRoom(inviteCode)`** 直接加入。
本服务**不参与 P2P 数据传输**（P2P 由 PeerJS 处理），只维护一个临时的房间目录。

- **零运行时依赖**：仅用 Node 内置 `http` / `crypto`，Node ≥ 18。
- **内存存储**：房间是临时的（房主在线才有），无心跳超 60s 自动清理；进程重启即清空。
- **API**：登记 / 查询 / 心跳 / 注销 共 4 个端点。

---

## 本地运行

```bash
cd server
node lobby-server.js          # 默认监听 8800，可 PORT=9001 node lobby-server.js
```

验证（另开终端）：

```bash
curl http://localhost:8800/rooms
# {"ok":true,"rooms":[],"serverTime":...}

# 登记一个公开房间
curl -X POST http://localhost:8800/rooms \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"inviteCode":"ABC234","hostName":"测试房主"}'
# {"ok":true,"inviteCode":"ABC234","hostSecret":"...","createdAt":...}

# 查询
curl -H "Origin: http://localhost:3000" http://localhost:8800/rooms

# 心跳（用上一步返回的 hostSecret）
curl -X POST http://localhost:8800/rooms/ABC234/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-Host-Secret: <hostSecret>" \
  -d '{"playerCount":1,"spectatorCount":0}'

# 注销
curl -X DELETE http://localhost:8800/rooms/ABC234 -H "X-Host-Secret: <hostSecret>"
```

> 注：CORS 白名单默认含 `https://okjjko.top`、`http://localhost:3000`、`http://127.0.0.1:3000`。
> 用 curl 测试时浏览器不参与，可省略 `Origin`；若要验证 CORS，需带白名单内的 Origin。

---

## HTTP API 一览

| 方法 | 路径 | 说明 | 成功响应 |
|---|---|---|---|
| GET | `/` 或 `/health` | 健康检查 | `200 {ok, service, rooms, uptime}` |
| POST | `/rooms` | 登记公开房间。Body `{inviteCode, hostName}` | `200 {ok, inviteCode, hostSecret, createdAt}` |
| GET | `/rooms` | 查询房间列表（不含 hostSecret） | `200 {ok, rooms:[...], serverTime}` |
| POST | `/rooms/:code/heartbeat` | 心跳。Header `X-Host-Secret`。Body `{playerCount, spectatorCount}` | `200 {ok, lastHeartbeat}` |
| DELETE | `/rooms/:code` | 注销。Header `X-Host-Secret` | `200 {ok}` |

错误码：`400 INVALID_PARAMS` / `403 FORBIDDEN`（secret 不匹配）/ `404 ROOM_NOT_FOUND` /
`409 ROOM_EXISTS` / `429 RATE_LIMITED`。

保活数值：房主心跳间隔 25s（前端）→ 服务端 TTL 60s 容忍 2 次心跳丢失 → 30s 定时 + 查询懒清理双保险 → 房间最长存活 6h。

---

## ECS 部署（与现有 PeerJS / coturn 同机）

参照 `docs/SERVER-SETUP.md` 的既有 PeerJS 部署范式（PM2 + nginx + Let's Encrypt）：

```bash
# 1. 上传 server/ 到 ECS（零依赖，无需 npm install）
scp -r server/ root@okjjko.top:/opt/bp-lobby-server/

# 2. 用 PM2 启动（复用已配置的 pm2 startup）
cd /opt/bp-lobby-server
pm2 start ecosystem.config.cjs
pm2 save

# 3. nginx 反代到 https 子路径（追加到现有 server 块，复用现有 Let's Encrypt 证书）
#    location /lobby/ {
#        proxy_pass http://127.0.0.1:8800/;
#        proxy_http_version 1.1;
#        proxy_set_header Host $host;
#        proxy_set_header X-Real-IP $remote_addr;
#        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#        proxy_set_header X-Forwarded-Proto $scheme;
#    }
nginx -t && nginx -s reload

# 4. 验证（8800 不对公网开放，仅走反代）
curl https://okjjko.top/lobby/rooms
# {"ok":true,"rooms":[],"serverTime":...}
```

**为什么必须 nginx 反代到 https**：前端部署在 Vercel（https），直接请求 `http://okjjko.top:8800`
会触发浏览器的**混合内容（mixed content）拦截**；反代到 `https://okjjko.top/lobby` 后同协议同域，
彻底解决。8800 端口不对公网开放，仅本机 nginx 访问。

**放行 vercel 域名**（如部署后前端域名为 `https://xxx.vercel.app`），在 PM2 环境变量里追加：

```js
// ecosystem.config.cjs 的 env
LOBBY_EXTRA_ORIGINS: 'https://xxx.vercel.app'
```

改完 `pm2 restart bp-lobby-server`。

---

## 运维

```bash
pm2 logs bp-lobby-server       # 查看日志
pm2 restart bp-lobby-server    # 重启（会清空内存房间目录）
pm2 monit                      # 监控
```

> 进程重启会清空房间目录（内存存储）。房主的心跳会在下一个周期自动重新登记——
> 但已开房的房主需要重新「创建公开房间」。这是轻量设计的可接受权衡。

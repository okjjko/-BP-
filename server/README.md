# bp-server（中心化 WebSocket 服务器）

BP 对战工具的**单进程后端**，一个 Node 进程同时提供四项能力：

1. **WebSocket hub**（`/ws`）—— 多人对战实时状态中转（房间管理、消息路由、身份分配、心跳、断线清理）。
2. **lobby HTTP 路由**（`/lobby/*`、`/rooms`、`/health`）—— 公共房间目录（登记 / 查询 / 心跳 / 注销）。
3. **静态文件托管**（`../dist/`）—— 前端构建产物（`/assets/*`、`/index.html`、`/plants/*`、`/favicon.ico`）。
4. **SPA fallback** —— history 路由刷新（任意无扩展名 GET 回 `dist/index.html`）。

> 架构变更：本服务已从 **P2P(PeerJS) + coturn + lobby 三服务** 重构为 **单进程中心化 WebSocket**。
> 不再依赖 PeerJS、coturn、STUN/TURN。TLS 由 nginx 终止，Node 监听明文 :8080。
> 协议契约见 `docs/network-protocol.md`（冻结，前后端共同遵循）。

- **运行时依赖**：仅 `ws@^8.x`（`npm install`）。
- **Node 版本**：≥ 18。
- **存储**：房间与 lobby 目录均为内存 Map，进程重启即清空（房主重新开房即可）。

---

## 本地运行

```bash
cd server
npm install                 # 安装 ws
npm start                   # = node index.js，默认监听 8080（可 PORT=8081 npm start）
```

启动后日志：

```
[server] BP 中心化服务已启动，监听 :8080
[server]   ws     : ws://localhost:8080/ws
[server]   lobby  : http://localhost:8080/lobby/rooms
[server]   health : http://localhost:8080/health
[server]   static : D:\...\dist
```

### dev 联调（前端 + 后端）

```bash
# 终端 1：起后端
cd server && npm start              # :8080

# 终端 2：起前端（vite proxy /ws → :8080）
npm run dev                         # :3000
```

vite 必须配置 `/ws` proxy（`{ target: 'http://localhost:8080', ws: true }`），否则 dev 连不上 ws。

### 路由优先级（重要）

| 优先级 | 路径 | 行为 |
|---|---|---|
| 1（upgrade） | `/ws` | WebSocket 握手（由 `ws` 库在 upgrade 事件拦截） |
| 2 | `/lobby/*`、`/rooms`、`/rooms/:code`、`/rooms/:code/heartbeat`、`/health` | lobby HTTP |
| 2.5 | `/lobby/*` 未匹配子路由 | 404 JSON（**不** SPA fallback，避免 `/lobby/rooms` 被吞） |
| 3 | `/assets/*`、`/plants/*`、`/favicon.ico` 等带扩展名 | 静态文件，不存在 → 404 |
| 4 | `/`、`/some/spa/route` 等无扩展名 GET | `dist/index.html`（SPA history 刷新） |
| 5 | dist 不存在 | 简短占位 HTML（ws/lobby 仍可用，便于纯后端自测） |

---

## lobby HTTP API 一览

| 方法 | 路径 | 说明 | 成功响应 |
|---|---|---|---|
| GET | `/health` 或 `/lobby/health` | 健康检查 | `200 {ok, service, rooms, uptime}` |
| POST | `/rooms` 或 `/lobby/rooms` | 登记公开房间。Body `{inviteCode, hostName}` | `200 {ok, inviteCode, hostSecret, createdAt}` |
| GET | `/rooms` 或 `/lobby/rooms` | 查询房间列表（不含 hostSecret） | `200 {ok, rooms:[...], serverTime}` |
| POST | `/rooms/:code/heartbeat` | 心跳。Header `X-Host-Secret`。Body `{playerCount, spectatorCount}` | `200 {ok, lastHeartbeat}` |
| DELETE | `/rooms/:code` | 注销。Header `X-Host-Secret` | `200 {ok}` |

> 注：`/lobby/*` 与无前缀路径都接受（兼容 nginx 是否 strip `/lobby`）。
> 但裸 `GET /` 是 SPA index.html，不是 health。健康检查用 `/health`。

错误码：`400 INVALID_PARAMS` / `403 FORBIDDEN`（secret 不匹配）/ `404 ROOM_NOT_FOUND` /
`409 ROOM_EXISTS` / `429 RATE_LIMITED`。

保活数值：房主心跳间隔 25s（前端）→ 服务端 TTL 60s 容忍 2 次心跳丢失 → 30s 定时 + 查询懒清理双保险 → 房间最长存活 6h。

CORS 白名单默认含 `https://okjjko.top`、`http://localhost:3000`、`http://127.0.0.1:3000`。放行额外域名用 `LOBBY_EXTRA_ORIGINS` 环境变量（逗号分隔）。

---

## WebSocket 协议

完整契约见 `docs/network-protocol.md`。要点：

- 连接地址：dev `ws://localhost:3000/ws`（vite proxy）/ prod `wss://okjjko.top/ws`（nginx 反代）。
- C2S：`createRoom` / `joinRoom` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `ping` / `leave`。
- S2C：`roomCreated` / `connected` / `roster` / `userJoined` / `userLeft` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `pong` / `error` / `connectionStatus`。
- 转发规则：`stateUpdate` 广播给同房除发送者外所有人（含 host）；`gameStart`/`customPlants` 广播除 host 外；`identityAssigned` 按 `playerName` 定向单投。
- 心跳：服务器 30s ping，45s 无响应断开清理（与客户端 30s ping 互补）。
- 断线：普通成员离开广播 `userLeft`；host 断开清房并通知其他成员 `connectionStatus:{status:'host-left'}`。

---

## 部署（单进程 + nginx）

### 1. 上传与启动

```bash
# 上传 server/ 与前端 dist/
scp -r server/ root@your-domain.com:/opt/bp-server/
# 前端构建产物（在项目根目录）
npm run build
scp -r dist/ root@your-domain.com:/opt/bp-tool/dist/   # dist 需在 server/ 的上级目录

# 启动
ssh root@your-domain.com
cd /opt/bp-server && npm install
pm2 start ecosystem.config.cjs      # 监听 8080
pm2 save && pm2 startup
```

### 2. nginx 反代（终止 TLS + wss upgrade）

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 静态前端 + SPA + lobby HTTP —— 全部反代到 Node :8080
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade —— wss 握手必须的三个头 + 调大超时
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;          # 必须
        proxy_set_header Connection "upgrade";           # 必须
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;                        # 长连接，防 idle 断开
        proxy_send_timeout 3600s;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

> 阿里云 Alibaba Cloud Linux 的 nginx 可能是 `aa_nginx` 包，命令等价。

```bash
nginx -t && nginx -s reload
```

### 3. 验证

```bash
curl https://your-domain.com/health                      # {"ok":true,...}
curl https://your-domain.com/lobby/rooms                 # {"ok":true,"rooms":[],...}
# 浏览器打开 https://your-domain.com ，F12 Network/WS 看到 /ws 101 Switching Protocols 即成功
```

8080 端口不对公网开放，仅本机 nginx 访问。

### 4. 放行前端域名（若前端部署在 vercel 等其它域名）

编辑 `ecosystem.config.cjs` 的 env：

```js
env: { NODE_ENV: 'production', PORT: 8080, LOBBY_EXTRA_ORIGINS: 'https://your-project.vercel.app' }
```

`pm2 restart bp-server`。

---

## 运维

```bash
pm2 logs bp-server            # 日志
pm2 restart bp-server         # 重启（清空内存房间目录与 ws 房间）
pm2 monit                     # 监控
```

> 进程重启会清空：① lobby 公开房间目录；② ws 实时房间。房主需重新「创建房间」。
> 这是内存存储的可接受权衡（BP 是回合制短会话）。

---

## 文件结构

```
server/
├── index.js              # 主入口：http server + ws hub + 静态托管 + SPA fallback
├── lobby-server.js       # lobby handler 模块（export，由 index.js 挂载）
├── package.json          # ws 依赖 + start 脚本
├── ecosystem.config.cjs  # PM2 配置
└── README.md             # 本文件
```

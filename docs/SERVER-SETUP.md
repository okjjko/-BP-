# 服务器部署指南

本文档说明如何在云服务器上部署 BP 对战工具的**单进程中心化 WebSocket 后端**。

> **架构变更（2026-07）**：已从「PeerJS 信令 + coturn TURN + lobby 三服务」重构为
> **单一 Node 进程**（ws hub + lobby HTTP + 静态前端 dist + SPA fallback 四合一）。
> 不再需要 PeerJS、coturn、STUN/TURN。TLS 由 nginx 终止，Node 监听明文 :8080。
> 详细后端文档见 `server/README.md`，协议契约见 `docs/network-protocol.md`。

## 目录

- [前置要求](#前置要求)
- [架构说明](#架构说明)
- [快速部署](#快速部署)
- [详细部署步骤](#详细部署步骤)
- [前端配置](#前端配置)
- [维护命令](#维护命令)
- [故障排查](#故障排查)

---

## 前置要求

- **服务器**：阿里云 ECS（1核 2GB 内存即可；多人对战为回合制、每次几十字节，资源消耗极低）
- **操作系统**：Ubuntu 20.04+ 或 Alibaba Cloud Linux 3+
- **域名**：用于 SSL 证书（强烈建议，否则 wss 无法工作）
- **权限**：root 或 sudo

---

## 架构说明

```
┌──────────────┐         ┌──────────────────────┐         ┌──────────────┐
│  客户端 A     │         │   nginx (TLS 终止)    │         │  客户端 B     │
│              │  wss    │                      │  ws     │              │
│  WebSocket ◄─┼────────►│  443 → 127.0.0.1:8080├────────►│  WebSocket   │
│              │         │  (Upgrade 头透传)     │         │              │
└──────────────┘         └──────────┬───────────┘         └──────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │  Node :8080 (单进程)  │
                         │  · ws hub /ws         │  ← 实时状态中转
                         │  · lobby /rooms       │  ← 公共房间目录
                         │  · 静态 dist          │  ← 前端构建产物
                         │  · SPA fallback       │  ← history 刷新
                         └──────────────────────┘
```

**工作流程**：每个客户端与服务器维持一条 WebSocket 连接；所有游戏状态由服务器中转。
不再有 P2P 握手、NAT 穿透、TURN 中继——连接稳定性等同于普通网站。

---

## 快速部署

```bash
# 1. 安装 Node 18+ 与 PM2、nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs nginx
npm install -g pm2

# 2. 上传代码（server/ + 根目录构建的 dist/）
#    要求部署后 server/index.js 的 ../dist 能访问到前端构建产物
git clone <repo> /opt/bp-tool && cd /opt/bp-tool
npm install && npm run build          # 生成 dist/

# 3. 启动后端
cd server && npm install
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup

# 4. 申请证书 + 配置 nginx（见下文）
certbot certonly --standalone -d your-domain.com
# 编辑 nginx 配置后
nginx -t && nginx -s reload

# 5. 开放防火墙：仅 80/443，8080 不对公网开放
ufw allow 80/tcp && ufw allow 443/tcp
```

---

## 详细部署步骤

### 第一步：安装依赖

```bash
apt-get update && apt-get upgrade -y

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v   # v18.x.x

# nginx
apt-get install -y nginx

# PM2
npm install -g pm2
pm2 --version

# Certbot（SSL）
apt-get install -y certbot
```

> 阿里云 Alibaba Cloud Linux 用户：nginx 可能是 `aa_nginx` 包（`dnf install aa_nginx`），命令与配置等价。

### 第二步：上传代码并构建前端

```bash
# 在服务器上
mkdir -p /opt/bp-tool && cd /opt/bp-tool
git clone <your-repo> .            # 或 scp 上传
npm install
npm run build                     # 生成 dist/

# 目录结构（关键）：
# /opt/bp-tool/
#   dist/                 ← 前端构建产物（被 server 当静态托管）
#   server/
#     index.js            ← ../dist 即指向 /opt/bp-tool/dist
```

> `server/index.js` 用 `path.resolve(__dirname, '..', 'dist')` 定位 dist，
> 因此 **server/ 必须与 dist/ 同级**（即 dist 在 server 的上级目录）。

### 第三步：启动 Node 后端

```bash
cd /opt/bp-tool/server
npm install                       # 安装 ws
pm2 start ecosystem.config.cjs    # 监听 127.0.0.1 隐含的 :8080（0.0.0.0，但防火墙只放 80/443）
pm2 save
pm2 startup                       # 按提示执行返回的命令，开机自启
```

验证：

```bash
curl http://localhost:8080/health
# {"ok":true,"service":"bp-server","rooms":0,"uptime":...}

pm2 logs bp-server                # 应看到「BP 中心化服务已启动，监听 :8080」
```

### 第四步：申请 SSL 证书

```bash
# 临时停 nginx 让 certbot 占用 80
nginx -s stop 2>/dev/null || true
certbot certonly --standalone -d your-domain.com

# 证书位置：
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem

# 自动续期
crontab -e
# 添加：每天凌晨检查续期，续期后重载 nginx
0 2 * * * certbot renew --quiet --post-hook "nginx -s reload"
```

### 第五步：配置 nginx（TLS 终止 + wss 反代）

编辑 `/etc/nginx/sites-available/bp-tool`（或 `conf.d/bp-tool.conf`）：

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

    # WebSocket upgrade（wss 握手关键）
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

# 80 → 443 跳转
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

启用并重载：

```bash
ln -sf /etc/nginx/sites-available/bp-tool /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

### 第六步：防火墙 / 安全组

仅放行 80、443。**8080 不对公网开放**（仅本机 nginx 访问）。

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 8080/tcp
```

阿里云安全组同理：入方向只开 80/443。

### 第七步：验证

```bash
curl https://your-domain.com/health                    # {"ok":true,...}
curl https://your-domain.com/lobby/rooms               # {"ok":true,"rooms":[],...}

# 浏览器打开 https://your-domain.com
# F12 → Network → WS：应看到 /ws 连接，状态 101 Switching Protocols
```

三端（host + 2 player）跑一小局 BP，验证状态同步、身份分配、断线重连。

---

## 前端配置

前端 ws 地址在 `src/config/network.config.js`（dev/prod 分离，由 B agent 维护）：

```js
{
  ws: {
    devUrl: 'ws://localhost:3000/ws',     // dev 经 vite proxy → 本地 :8080
    prodUrl: 'wss://your-domain.com/ws'   // 生产 nginx 反代 → :8080
  }
}
```

dev 必须在 `vite.config.js` 配置 `/ws` proxy（`{ target: 'http://localhost:8080', ws: true }`）。

放行前端域名（若前端部署在 vercel 等非 your-domain.com 域名，lobby CORS 需要）：

```bash
# 编辑 server/ecosystem.config.cjs 的 env
LOBBY_EXTRA_ORIGINS: 'https://your-project.vercel.app'
pm2 restart bp-server
```

---

## 前端项目更新部署

```bash
cd /opt/bp-tool
git pull origin master
npm install                # 如有新依赖
npm run build              # 重新生成 dist/（server 静态托管自动生效，无需重启）
# 若改了 server/ 代码：
cd server && npm install && pm2 restart bp-server
```

> 仅前端变更：`npm run build` 后无需重启 Node（server 每次请求读 dist 文件）。
> 仅 server 变更：`pm2 restart bp-server`（会清空内存房间，房主需重新开房）。

---

## 维护命令

```bash
pm2 status                          # 查看进程状态
pm2 logs bp-server                  # 实时日志
pm2 logs bp-server --lines 200      # 最近 200 行
pm2 restart bp-server               # 重启（清空房间目录与 ws 房间）
pm2 monit                           # CPU/内存监控
pm2 show bp-server                  # 详细信息

nginx -t                             # 测试配置
nginx -s reload                      # 重载配置（不中断服务）
```

---

## 故障排查

### 问题 1：浏览器 ws 连接失败（502/400/无 101）

- 检查 nginx `/ws` location 是否有 `Upgrade`/`Connection: upgrade` 头（缺一会握手失败）。
- 检查 `proxy_read_timeout` 是否过小（默认 60s 会让长连接断开，应 ≥ 3600s）。
- `pm2 logs bp-server` 看是否启动成功、有无监听 :8080。
- `curl http://localhost:8080/health` 在服务器本机验证 Node 在跑。

### 问题 2：连接频繁断开

- 服务器侧心跳：30s ping，45s 无响应断开。若客户端网络差，可能触发。检查客户端 30s ping 是否正常。
- nginx `proxy_read_timeout` 是否被中间网络节点中断（调大到 3600s）。
- `pm2 logs` 看是否有 `[ws] 连接错误` 日志。

### 问题 3：SPA 刷新 404

- 确认 `dist/` 存在于 `server/` 的上级目录。
- 确认 nginx `location /` 反代到 :8080（SPA fallback 由 Node 处理，不是 nginx）。
- `curl http://localhost:8080/some/spa/route` 应返回 index.html。

### 问题 4：lobby 公共房间列表为空

- 房主需在创建房间时勾选「公开房间」才会登记到 lobby。
- 房主心跳 25s 一次，TTL 60s。若房主掉线超过 60s 房间会被清理。
- `curl https://your-domain.com/lobby/rooms` 验证。

### 问题 5：房间状态不同步

- 检查 `stateUpdate.version` 是否单调递增（接收方按 version 去重）。
- `pm2 logs` 看 `[ws]` 转发日志。
- 协议契约详见 `docs/network-protocol.md`。

---

## 成本估算

| 项目 | 规格 | 月成本 |
|---|---|---|
| 阿里云 ECS | 1核 2GB | 30-50 元 |
| 流量 | 回合制，每局 < 1MB | < 1 元 |
| SSL 证书 | Let's Encrypt | 免费 |
| 域名 | 可选 | 约 50 元/年 |

**不再需要**：PeerJS server、coturn TURN、STUN、中继流量包。

---

## 参考资料

- [ws (WebSocket library) 文档](https://github.com/websockets/ws)
- [nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
- [协议契约](network-protocol.md)
- [后端 README](../server/README.md)
- [Let's Encrypt](https://letsencrypt.org/docs/)

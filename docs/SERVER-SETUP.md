# 服务器部署指南

本文档说明如何在阿里云服务器上部署 PeerJS 和 TURN 服务器，实现公网环境下的多人对战连接。

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

- **服务器**：阿里云 ECS 服务器（1核 2GB 内存即可）
- **操作系统**：Ubuntu 20.04+ 或 CentOS 7+
- **域名**（可选）：用于 SSL 证书，建议配置
- **权限**：服务器 root 权限或 sudo 权限

---

## 架构说明

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   客户端 A       │         │  阿里云服务器      │         │   客户端 B       │
│                 │         │                  │         │                 │
│  PeerJS Client  │◄──────►│  PeerJS Server   │◄──────►│  PeerJS Client  │
│  (信令连接)      │         │  (端口 9000)      │         │  (信令连接)      │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │
                                    │ 帮助建立连接
                                    ▼
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   客户端 A       │         │  TURN Server     │         │   客户端 B       │
│                 │◄──────►│  (coturn)        │◄──────►│                 │
│  WebRTC Data    │  (P2P  │  (端口 3478)      │  中继   │  WebRTC Data    │
│                 │  或    │                  │         │                 │
└─────────────────┘  中继  └──────────────────┘         └─────────────────┘
```

**工作流程：**

1. **信令阶段**：客户端通过 PeerJS 服务器交换连接信息
2. **连接建立**：尝试直接 P2P 连接（STUN 帮助 NAT 穿透）
3. **数据传输**：
   - 如果可以 P2P：直接传输，无需服务器参与
   - 如果无法 P2P：通过 TURN 服务器中继数据

---

## 快速部署

如果您熟悉 Linux 服务器操作，可以使用以下快速部署命令：

```bash
# 1. 安装依赖
apt-get update && apt-get install -y nodejs coturn certbot

# 2. 安装 PM2
npm install -g pm2

# 3. 部署 PeerJS 服务器
mkdir -p /opt/peerjs-server && cd /opt/peerjs-server
npm init -y
npm install peer express

# 创建 server.js (见下方详细代码)
# ...

# 4. 配置 TURN 服务器
# 编辑 /etc/turnserver.conf (见下方详细配置)
# ...

# 5. 开放防火墙
ufw allow 9000/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 49152:65535/udp
```

---

## 详细部署步骤

### 第一步：安装依赖

#### 1.1 更新系统

```bash
apt-get update
apt-get upgrade -y
```

#### 1.2 安装 Node.js 18.x

```bash
# 检查是否已安装
node -v

# 如果未安装或版本过低
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
node -v   # 应显示 v18.x.x
npm -v    # 应显示 9.x.x 或更高
```

#### 1.3 安装 coturn

```bash
apt-get install -y coturn

# 验证安装
turnserver --version
```

#### 1.4 安装 PM2

```bash
npm install -g pm2

# 验证安装
pm2 --version
```

---

### 第二步：部署 PeerJS 服务器

#### 2.1 创建项目目录

```bash
mkdir -p /opt/peerjs-server
cd /opt/peerjs-server
```

#### 2.2 初始化项目

```bash
npm init -y
npm install peer express
```

#### 2.3 创建服务器代码

```bash
nano server.js
```

**HTTP 版本（测试用，无需 SSL）：**

```javascript
const Express = require('express');
const PeerServer = require('peer').ExpressPeerServer;

const app = Express();

// 使用 HTTP（仅用于测试，生产环境请使用 HTTPS）
app.use('/peerjs', PeerServer(null, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true
}));

const PORT = 9000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PeerJS 服务器运行在端口 ${PORT}`);
  console.log(`访问地址: http://$(hostname -I | awk '{print $1}'):${PORT}/peerjs`);
});
```

**HTTPS 版本（生产环境推荐）：**

```javascript
const Express = require('express');
const PeerServer = require('peer').ExpressPeerServer;
const https = require('https');
const fs = require('fs');

const app = Express();

// HTTPS 配置（需要先获取 SSL 证书，见下方）
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/your-domain.com/fullchain.pem')
};

const server = https.createServer(options, app);

app.use('/peerjs', PeerServer(server, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true
}));

const PORT = 9000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PeerJS 服务器运行在端口 ${PORT}`);
  console.log(`访问地址: https://your-domain.com:${PORT}/peerjs`);
});
```

#### 2.4 配置 SSL 证书（可选但推荐）

**安装 Certbot：**

```bash
apt-get install -y certbot
```

**获取证书：**

```bash
# 替换为您的域名
certbot certonly --standalone -d your-domain.com

# 证书将保存在：
# /etc/letsencrypt/live/your-domain.com/privkey.pem
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
```

**设置自动续期：**

```bash
# 添加定时任务
crontab -e

# 添加以下行（每天凌晨 2 点检查并续期）
0 2 * * * certbot renew --quiet --post-hook "pm2 restart peerjs-server"
```

#### 2.5 启动 PeerJS 服务器

```bash
# 使用 PM2 启动
pm2 start server.js --name peerjs-server

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行返回的命令
```

#### 2.6 验证 PeerJS 服务器

```bash
# 查看服务状态
pm2 status peerjs-server

# 查看日志
pm2 logs peerjs-server

# 测试访问
curl http://localhost:9000/peerjs
# 应返回: {"name":"peerjs-server"}
```

---

### 第三步：部署 TURN 服务器

#### 3.1 生成认证凭证

```bash
# 生成一个随机密码（记下这个密码）
openssl rand -hex 16
# 输出示例: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### 3.2 创建 TURN 用户

```bash
# 格式：turnadmin -a -u 用户名 -p 密码 -r 域名
# 替换为您的实际密码
turnadmin -a -u bpuser -p a1b2c3d4e5f6g7h8 -r your-domain.com

# 如果使用服务器 IP 而非域名
turnadmin -a -u bpuser -p a1b2c3d4e5f6g7h8 -r $(hostname -I | awk '{print $1}')
```

#### 3.3 配置 coturn

**编辑配置文件：**

```bash
nano /etc/turnserver.conf
```

**粘贴以下配置：**

```ini
# 监听设备（根据实际情况调整）
listening-device=eth0
listening-port=3478

# 中继设备
relay-device=eth0
relay-ip=your-server-ip

# 外部 IP 地址（重要！替换为您的服务器公网 IP）
external-ip=your-server-ip

# 认证方式
lt-cred-mech

# 用户凭证（替换为您生成的密码）
user=bpuser:a1b2c3d4e5f6g7h8

# 域名
realm=your-domain.com

# 日志配置
log-file=/var/log/turnserver.log
verbose

# 启用 STUN/TURN 功能
fingerprint

# 不使用 CLI
no-cli

# 禁用旧版本 TLS
no-tlsv1
no-tlsv1.1

# 支持的传输协议
```

**注意**：将以下替换为实际值：
- `your-server-ip`：您的服务器公网 IP
- `a1b2c3d4e5f6g7h8`：您生成的密码
- `your-domain.com`：您的域名（如无域名，使用服务器 IP）

#### 3.4 配置防火墙

**使用 ufw（Ubuntu）：**

```bash
# PeerJS 端口
ufw allow 9000/tcp

# TURN 端口
ufw allow 3478/tcp
ufw allow 3478/udp

# TURN 中继端口范围
ufw allow 49152:65535/udp

# 查看防火墙状态
ufw status
```

**使用 iptables：**

```bash
# PeerJS 端口
iptables -A INPUT -p tcp --dport 9000 -j ACCEPT

# TURN 端口
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT

# 保存规则
service iptables save
# 或
iptables-save > /etc/iptables/rules.v4
```

#### 3.5 阿里云安全组配置

1. 登录阿里云控制台
2. 进入 **云服务器 ECS** → **实例**
3. 点击您的实例 → **安全组**
4. 点击 **配置规则** → **添加安全组规则**

**添加以下入方向规则：**

| 协议类型 | 端口范围 | 授权对象 | 描述 |
|---------|---------|---------|------|
| TCP | 9000 | 0.0.0.0/0 | PeerJS 服务器 |
| TCP | 3478 | 0.0.0.0/0 | TURN TCP |
| UDP | 3478 | 0.0.0.0/0 | TURN UDP |
| UDP | 49152-65535 | 0.0.0.0/0 | TURN 中继 |

#### 3.6 启动 coturn 服务

```bash
# 启用服务
systemctl enable coturn

# 启动服务
systemctl start coturn

# 检查服务状态
systemctl status coturn

# 查看日志
tail -f /var/log/turnserver.log
```

#### 3.7 测试 TURN 服务器

**方法 1：使用 Trickle ICE 测试工具**

1. 访问：https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
2. 在 **"STUN or TURN URI"** 输入：
   ```
   turn:your-server-ip:3478
   ```
3. 在 **"TURN username"** 输入：
   ```
   bpuser
   ```
4. 在 **"TURN password"** 输入：
   ```
   a1b2c3d4e5f6g7h8
   ```
5. 点击 **"Gather candidates"**

**预期结果：**
- 应该看到 `srflx`（STUN 成功）
- 应该看到 `relay`（TURN 成功）

**方法 2：命令行测试**

```bash
# 安装 turnutils_uclient
apt-get install -y turnserver

# 测试 TURN 服务器
turnutils_uclient -v -u bpuser -w a1b2c3d4e5f6g7h8 your-server-ip
```

---

### 第四步：更新前端配置

#### 4.1 编辑前端配置文件

编辑项目中的 `src/config/webrtc.config.js`：

```javascript
export default {
  debug: 2,

  // PeerJS 服务器配置
  peerjs: {
    host: 'your-domain.com',    // 替换为您的域名或服务器 IP
    port: 9000,                  // PeerJS 端口
    path: '/peerjs',
    secure: true                 // 使用 HTTPS（生产环境）
  },

  // ICE 服务器配置
  config: {
    iceServers: [
      // 公共 STUN 服务器
      { urls: 'stun:stun.l.google.com:19302' },

      // 自建 TURN 服务器
      {
        urls: [
          'turn:your-domain.com:3478?transport=udp',
          'turn:your-domain.com:3478?transport=tcp'
        ],
        username: 'bpuser',
        credential: 'a1b2c3d4e5f6g7h8'  // 您生成的密码
      }
    ]
  },

  timeout: {
    connection: 30000,
    heartbeat: 15000
  },

  retry: {
    maxAttempts: 3,
    delay: 2000
  }
}
```

#### 4.2 重新构建前端

```bash
# 在项目根目录
npm run build

# 或使用开发服务器测试
npm run dev
```

---

## 维护命令

### PeerJS 服务器管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs peerjs-server

# 重启服务
pm2 restart peerjs-server

# 停止服务
pm2 stop peerjs-server

# 查看详细信息
pm2 show peerjs-server
```

### TURN 服务器管理

```bash
# 查看服务状态
systemctl status coturn

# 启动服务
systemctl start coturn

# 停止服务
systemctl stop coturn

# 重启服务
systemctl restart coturn

# 查看日志
tail -f /var/log/turnserver.log

# 查看端口监听
netstat -tulpn | grep 3478
```

### 日志管理

```bash
# PeerJS 日志
pm2 logs --lines 100 peerjs-server

# TURN 日志（最后 100 行）
tail -n 100 /var/log/turnserver.log

# TURN 日志（实时）
tail -f /var/log/turnserver.log

# 清理旧日志（可选）
truncate -s 0 /var/log/turnserver.log
```

---

## 故障排查

### 问题 1：PeerJS 服务器无法启动

**症状：**
```bash
pm2 status peerjs-server
# 显示: errored
```

**排查步骤：**

1. 查看日志：
   ```bash
   pm2 logs peerjs-server
   ```

2. 检查端口是否被占用：
   ```bash
   netstat -tulpn | grep 9000
   ```

3. 检查 SSL 证书（如果使用 HTTPS）：
   ```bash
   ls -la /etc/letsencrypt/live/your-domain.com/
   ```

4. 重启服务：
   ```bash
   pm2 restart peerjs-server
   ```

---

### 问题 2：TURN 服务器无法连接

**症状：**
- Trickle ICE 测试中没有 `relay` 候选
- 客户端连接失败

**排查步骤：**

1. 检查服务状态：
   ```bash
   systemctl status coturn
   ```

2. 检查端口监听：
   ```bash
   netstat -tulpn | grep 3478
   ```

3. 检查防火墙：
   ```bash
   ufw status
   ```

4. 检查阿里云安全组配置

5. 查看日志：
   ```bash
   tail -f /var/log/turnserver.log
   ```

6. 验证用户凭证：
   ```bash
   # 重新创建用户
   turnadmin -a -u bpuser -p your-password -r your-domain.com
   systemctl restart coturn
   ```

---

### 问题 3：客户端连接失败

**症状：**
- 浏览器控制台显示连接错误
- "peer-unavailable" 错误

**排查步骤：**

1. 检查前端配置：
   ```javascript
   // src/config/webrtc.config.js
   // 确认 host、port、secure 配置正确
   ```

2. 测试 PeerJS 服务器：
   ```bash
   curl http://your-domain.com:9000/peerjs
   ```

3. 检查浏览器控制台错误：
   - 打开开发者工具（F12）
   - 查看 Console 标签
   - 查找错误信息

4. 检查网络连接：
   ```bash
   ping your-domain.com
   telnet your-domain.com 9000
   ```

---

### 问题 4：连接建立后经常断开

**症状：**
- 连接几分钟后自动断开
- 需要频繁重新连接

**可能原因：**
1. NAT 会话超时
2. 服务器资源不足
3. 网络不稳定

**解决方案：**

1. 检查服务器资源：
   ```bash
   free -h      # 内存使用
   df -h        # 磁盘使用
   top          # CPU 使用
   ```

2. 检查 TURN 服务器日志：
   ```bash
   tail -f /var/log/turnserver.log
   ```

3. 调整 keep-alive 设置（在 webrtc.config.js 中）

---

## 成本估算

### 服务器成本

| 配置 | 价格 | 说明 |
|-----|------|------|
| 1核 2GB | 约 30-50 元/月 | 按量付费 |
| 2核 4GB | 约 60-100 元/月 | 推荐 |

### 流量成本

| 场景 | 流量消耗 | 成本 |
|-----|---------|------|
| 局域网 P2P | 0 MB | 免费 |
| 公网 P2P | 几 KB/次 | 几乎免费 |
| TURN 中继 | 1-2 MB/分钟 | 取决于流量包 |

**估算**：
- 100 对局/月 ≈ 200 MB 流量
- 按阿里云流量价格：约 0.8 元/GB
- 月成本：< 1 元

### 免费额度

- **SSL 证书**：免费（Let's Encrypt）
- **STUN 服务器**：免费（公共 Google STUN）

---

## 性能优化

### 1. 启用 TCP 缓解

```bash
# 编辑 /etc/sysctl.conf
nano /etc/sysctl.conf

# 添加以下内容
net.core.rmem_max = 134217728
net.core.rmem_default = 131072
net.core.wmem_max = 134217728
net.core.wmem_default = 131072
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864

# 应用配置
sysctl -p
```

### 2. 调整 TURN 服务器配置

编辑 `/etc/turnserver.conf`：

```ini
# 增加最大带宽
max-bps=10000000

# 调整总配额
total-quota=500000000

# 调整每用户配额
user-quota=100000000
```

### 3. 使用 Nginx 反向代理（可选）

```bash
# 安装 Nginx
apt-get install -y nginx

# 配置反向代理
nano /etc/nginx/sites-available/peerjs
```

```nginx
upstream peerjs_backend {
    server localhost:9000;
}

server {
    listen 80;
    server_name your-domain.com;

    location /peerjs {
        proxy_pass http://peerjs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 安全建议

### 1. 使用强密码

TURN 密码应至少 32 字符，使用随机生成：

```bash
openssl rand -hex 32
```

### 2. 限制访问频率

使用 Nginx 限制请求频率：

```nginx
limit_req_zone $binary_remote_addr zone=peerjs:10m rate=10r/s;

location /peerjs {
    limit_req zone=peerjs burst=20;
    # ...
}
```

### 3. 启用防火墙限制

仅允许特定 IP 访问（如需要）：

```bash
ufw allow from 1.2.3.4 to any port 9000
```

### 4. 定期更新

```bash
# 更新系统
apt-get update && apt-get upgrade -y

# 更新 Node.js 依赖
cd /opt/peerjs-server
npm update
```

---

## 参考资料

- [PeerJS 官方文档](https://peerjs.com/docs/)
- [coturn GitHub](https://github.com/coturn/coturn)
- [WebRTC ICE 原理](https://webrtc.org/getting-started/turn-server)
- [阿里云 ECS 文档](https://help.aliyun.com/product/25365.html)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)

---

## 联系支持

如果遇到问题，请：

1. 查看本文档的故障排查部分
2. 检查服务器日志
3. 搜索错误信息
4. 在项目 GitHub 提交 Issue

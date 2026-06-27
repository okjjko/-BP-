/**
 * WebRTC 连接配置
 * 用于配置 PeerJS 服务器和 STUN/TURN 服务器，实现 NAT 穿透和公网连接
 *
 * 部署说明：
 * 1. 需要在阿里云服务器上部署 PeerJS 服务器（端口 9000）
 * 2. 需要在阿里云服务器上部署 TURN 服务器（coturn，端口 3478）
 * 3. 详细部署步骤请参考 docs/SERVER-SETUP.md
 *
 * 注意：coturn 服务器本身就包含 STUN 功能，无需额外的第三方 STUN 服务器
 */

export default {
  // 调试级别：0=关闭, 1=仅错误, 2=警告, 3=所有信息
  debug: 2,

  // PeerJS 服务器配置
  // 将 'your-domain.com' 替换为您的服务器域名或 IP 地址
  peerjs: {
    host: 'okjjko.top',    // 您的服务器域名或 IP
    port: 9000,                  // PeerJS 服务器端口
    path: '/peerjs',             // 路径
    secure: true,                // 使用 HTTPS（生产环境必须为 true）
    // debug: 2

    // 注释掉以上配置，使用默认的 PeerJS 公共服务器（仅用于开发测试）
    // 部署私有服务器后，取消注释并配置正确值
  },

  // ICE 服务器配置
  config: {
    iceServers: [
      {
        urls: [
          'stun:okjjko.top:3478',
          'turn:okjjko.top:3478?transport=udp',
          'turn:okjjko.top:3478?transport=tcp'
        ],
        username: 'bpuser',
        credential: 'eaec4904cfc27bce11bf11ba6b0d506d'
      }
    ]
  },

  // 连接超时配置
  timeout: {
    connection: 30000,  // 连接超时：30秒
    heartbeat: 15000    // 心跳间隔：15秒
  },

  // 重连配置
  retry: {
    maxAttempts: 3,     // 最大重试次数
    delay: 2000         // 重试延迟：2秒
  },

  // 公共房间目录服务（lobby）配置
  // 与 peerjs 同 ECS 部署，由 nginx 反代到 https 子路径（解决 https 前端的混合内容问题）
  // lobby 只维护"公共房间目录"，房间内 P2P 数据传输仍由 roomManager（PeerJS）处理
  lobby: {
    baseUrl: 'https://okjjko.top/lobby',  // 生产环境（经 nginx 反代，同源同协议）
    heartbeatIntervalMs: 25000,            // 房主心跳间隔（服务端 TTL 60s，留 2 次重试余量）
    listRefreshIntervalMs: 15000           // 选手公共房间列表轮询间隔
  }
}

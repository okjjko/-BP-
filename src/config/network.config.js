/**
 * 多人对战网络配置（WebSocket 中心化）
 *
 * 替代原 webrtc.config.js。PeerJS/coturn 已废弃，所有数据经单一 WebSocket 服务器中转。
 * 详见 docs/network-protocol.md（冻结契约）。
 */

export default {
  // WebSocket 连接地址
  // dev：经 vite proxy /ws（ws:true）→ 本地 Node :8080
  // prod：nginx 终止 TLS 并反代 → Node :8080
  ws: {
    devUrl: 'ws://localhost:3000/ws',
    prodUrl: 'wss://okjjko.top/ws'
  },

  // 公共房间目录服务（lobby）配置
  // lobby 只维护「公共房间目录」，房间内数据传输由 WebSocket（roomManager）处理
  // 与 ws hub 同 ECS 部署，由 nginx 反代到 https 子路径（解决 https 前端的混合内容问题）
  lobby: {
    baseUrl: 'https://okjjko.top/lobby',  // 生产环境（经 nginx 反代，同源同协议）
    heartbeatIntervalMs: 25000,            // 房主心跳间隔（服务端 TTL 60s，留 2 次重试余量）
    listRefreshIntervalMs: 15000           // 选手公共房间列表轮询间隔
  }
}

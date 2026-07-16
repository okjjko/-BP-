/**
 * PM2 配置 —— bp-server（中心化 WebSocket 三合一服务）
 *
 * 用 .cjs 后缀：主项目 package.json 声明了 "type":"module"，
 * PM2 默认按 CommonJS 读取配置文件，.cjs 可避免 ESM 解析冲突。
 *
 * 单进程同时提供：ws hub(:8080/ws) + lobby HTTP + 静态 dist + SPA fallback。
 * 部署：cd server && npm install && pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'bp-server',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
        // LOBBY_EXTRA_ORIGINS: 'https://your-project.vercel.app'  // 可选：额外放行的 Origin（逗号分隔）
      }
    }
  ]
}

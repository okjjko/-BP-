/**
 * PM2 配置 —— bp-lobby-server
 *
 * 用 .cjs 后缀：主项目 package.json 声明了 "type":"module"，
 * PM2 默认按 CommonJS 读取配置文件，.cjs 可避免 ESM 解析冲突。
 *
 * 部署：pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'bp-lobby-server',
      script: 'lobby-server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production',
        PORT: 8800
        // LOBBY_EXTRA_ORIGINS: 'https://your-project.vercel.app'  // 可选：额外放行的 Origin（逗号分隔）
      }
    }
  ]
}

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    // dev 环境：将 /lobby 代理到本地 server/index.js（lobby 已与 ws hub 同进程，默认 8080）
    // 生产环境前端直接用 https://okjjko.top/lobby（见 src/config/network.config.js），不走此 proxy
    proxy: {
      '/lobby': {
        target: process.env.LOBBY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lobby/, '')
      },
      // WebSocket 代理：dev 经 /ws 连本地 ws hub（server/index.js，默认 8080）
      // 生产环境前端用 wss://okjjko.top/ws（见 src/config/network.config.js），由 nginx 终止 TLS 并反代
      '/ws': {
        target: process.env.WS_TARGET || 'http://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    }
  },
  // 生产环境需要配置服务器将所有路由指向 index.html（SPA history 模式）
  // Nginx 配置：try_files $uri $uri/ /index.html;
})

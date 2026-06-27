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
    // dev 环境：将 /lobby 代理到本地 lobby 目录服务（server/lobby-server.js，默认 8800）
    // 生产环境前端直接用 https://okjjko.top/lobby（见 src/config/webrtc.config.js），不走此 proxy
    proxy: {
      '/lobby': {
        target: process.env.LOBBY_TARGET || 'http://localhost:8800',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/lobby/, '')
      }
    }
  },
  // 生产环境需要配置服务器将所有路由指向 index.html（SPA history 模式）
  // Nginx 配置：try_files $uri $uri/ /index.html;
})

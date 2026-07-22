import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

// 应用版本号：单一事实来源为 package.json 的 version 字段
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'))

// 构建时注入当前 git commit 短 hash。auto-deploy.sh 在 `git merge --ff-only` 之后才
// `npm run build`，故 build 期拿到的 HEAD 即最新部署 commit —— 每次自动部署后 hash
// 自动变化，前端据此确认 webhook 部署是否生效。非 git 环境兜底 'unknown'。
let gitHash = 'unknown'
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // 非 git 环境（如解压源码包构建）
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_GIT_HASH__: JSON.stringify(gitHash),
  },
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

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
    strictPort: false
  },
  // 生产环境需要配置服务器将所有路由指向 index.html（SPA history 模式）
  // Nginx 配置：try_files $uri $uri/ /index.html;
})

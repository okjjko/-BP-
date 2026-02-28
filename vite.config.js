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
    host: '0.0.0.0', // 监听所有网络接口，支持局域网访问
    port: 3000,
    strictPort: false // 如果端口被占用，自动尝试下一个端口
  }
})

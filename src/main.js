import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'
import './styles/animations.css'
import { initializeCache } from './data/customPlants'

// 初始化自定义植物缓存
initializeCache().then(() => {
  console.log('自定义植物缓存初始化完成')
}).catch(error => {
  console.error('自定义植物缓存初始化失败:', error)
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')

// 开发/测试环境：暴露 store 到 window，便于 Playwright 直接读写
if (import.meta.env.DEV) {
  import('./stores/gameStore.js').then(({ useGameStore }) => {
    const gameStore = useGameStore()
    window.$debugStore = gameStore
    console.log('[DEV] $debugStore 已挂载到 window')
  })
}

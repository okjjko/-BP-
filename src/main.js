import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
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
app.mount('#app')

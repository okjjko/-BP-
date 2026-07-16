/**
 * Vue Router 配置
 * 替代 App.vue 中的 gameStatus 条件渲染
 */
import { createRouter, createWebHistory } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

// 路由组件
import GameSetup from '@/components/GameSetup.vue'
import BanPickView from '@/views/BanPickView.vue'
import RoundResult from '@/components/RoundResult.vue'
import GameVictory from '@/components/GameVictory.vue'

const routes = [
  {
    path: '/',
    name: 'setup',
    component: GameSetup,
    meta: { title: '游戏设置' }
  },
  {
    path: '/ban-pick',
    name: 'banPick',
    component: BanPickView,
    meta: { title: 'BP对战' }
  },
  {
    path: '/result',
    name: 'result',
    component: RoundResult,
    meta: { title: '小局结算' }
  },
  {
    path: '/victory',
    name: 'victory',
    component: GameVictory,
    meta: { title: '大局结束' }
  },
]

// DEV only：多客户端 WebSocket 模拟器路由（生产构建经 import.meta.env.DEV 守卫 tree-shake）
if (import.meta.env.DEV) {
  routes.push({
    path: '/dev/sim',
    name: 'devSim',
    component: () => import('@/components/dev/MultiClientSimulator.vue'),
    meta: { title: 'DEV 多客户端模拟器', devOnly: true }
  })
}

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫：根据游戏状态自动跳转
router.beforeEach((to, from) => {
  // dev 路由跳过游戏状态守卫
  if (to.meta && to.meta.devOnly) return true

  const gameStore = useGameStore()
  const status = gameStore.gameStatus

  // 如果直接访问非 setup 页面但游戏未开始，重定向到 setup
  if (to.name !== 'setup' && status === 'setup') {
    return { name: 'setup' }
  }

  // 根据游戏状态自动跳转到正确页面
  if (to.name === 'setup') {
    // 如果游戏已在进行中，跳转到对应页面
    if (status === 'banning' || status === 'positioning') {
      return { name: 'banPick' }
    }
    if (status === 'result') {
      return { name: 'result' }
    }
    if (status === 'finished') {
      return { name: 'victory' }
    }
  }
})

export default router

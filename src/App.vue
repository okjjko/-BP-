<template>
  <div id="app" class="min-h-screen text-gray-100 overflow-x-hidden selection:bg-plant-green selection:text-white">
    <!-- 背景动画元素 -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px] animate-float"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-900/20 rounded-full blur-[100px] animate-float" style="animation-delay: -1.5s;"></div>
    </div>

    <div class="relative z-10 min-h-screen flex flex-col">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>

      <!-- 植物管理模态框（全局） -->
      <PlantManager v-model:show="uiStore.showPlantManager" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { initializeCache } from '@/data/customPlants'
import PlantManager from '@/components/PlantManager/index.vue'

const store = useGameStore()
const uiStore = useUIStore()
const router = useRouter()

// 页面加载时初始化缓存并恢复进度
onMounted(async () => {
  try {
    await initializeCache()
  } catch (error) {
    console.error('初始化自定义植物缓存失败:', error)
  }

  const restored = store.loadFromLocalStorage()
  if (restored) {
    navigateToStatus()
  }
})

// 监听 gameStatus 变化，自动导航到对应路由
watch(() => store.gameStatus, (newStatus) => {
  navigateToStatus()
})

function navigateToStatus() {
  const status = store.gameStatus
  const routeMap = {
    'setup': 'setup',
    'banning': 'banPick',
    'positioning': 'banPick',
    'result': 'result',
    'finished': 'victory'
  }

  const targetRoute = routeMap[status] || 'setup'
  if (router.currentRoute.value.name !== targetRoute) {
    router.push({ name: targetRoute })
  }
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

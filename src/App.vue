<template>
  <div id="app" class="min-h-screen text-gray-100 overflow-x-hidden selection:bg-plant-green selection:text-white">
    <!-- 无障碍：跳到主内容 -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[110] focus:top-4 focus:left-4 focus:bg-white focus:text-slate-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none"
    >
      跳到主内容
    </a>

    <!-- 背景装饰（静态，去除浮动动画） -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/15 rounded-full blur-[100px]"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-900/15 rounded-full blur-[100px]"></div>
    </div>

    <main id="main-content" class="relative z-10 min-h-screen flex flex-col">
      <router-view v-slot="{ Component }">
        <transition name="fade">
          <component :is="Component" :key="$route.path" />
        </transition>
      </router-view>

      <!-- 全局页脚 -->
      <footer class="py-3 text-center text-xs text-gray-500 font-mono tracking-widest">
        <div>
          本系统由@okjjko制作，GitHub仓库地址：<a href="https://github.com/okjjko/-BP-" target="_blank" class="text-pick-blue hover:text-pick-blue-hover underline">https://github.com/okjjko/-BP-</a>
        </div>
        <!-- 版本号 + git 短 hash：hash 随每次自动部署变化，用于确认 webhook 部署是否生效 -->
        <div class="mt-1 text-gray-600">
          v{{ APP_VERSION }} · {{ APP_GIT_HASH }}
        </div>
      </footer>

      <!-- 植物管理模态框（全局） -->
      <PlantManager v-model:show="uiStore.showPlantManager" />

      <!-- BP 规则编辑模态框（全局；赛前快速改当前对局 BP 规则，不存预设） -->
      <BPRulesDialog v-model:show="uiStore.showBPRulesEditor" />

      <!-- 全局反馈层：Toast 与 Confirm -->
      <ToastContainer />
      <ConfirmDialog />
    </main>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { initializeCache } from '@/data/customPlants'
import PlantManager from '@/components/PlantManager/index.vue'
import BPRulesDialog from '@/components/RulesEditor/BPRulesDialog.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { APP_VERSION, APP_GIT_HASH } from '@/config/buildInfo'

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

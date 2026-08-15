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

      <!-- 房主断开全局告知：房间被服务器整房清理（含对局中，BanPickView 无连接监听，
           故挂全局）。确认后停掉对已死房间的自动重连并清理会话，避免刷新后被引导重连。 -->
      <BaseDialog
        :model-value="hostLeftOpen"
        title="房主已断开"
        :closable="false"
        :close-on-backdrop="false"
        panel-class="sm:max-w-md"
        aria-label="房主已断开，房间已关闭"
        @update:model-value="onHostLeftDialog"
      >
        <p class="text-slate-300 leading-relaxed">
          房主与服务器的连接已断开，房间已被关闭，当前对局的实时同步中止。
        </p>
        <p class="mt-2 text-sm text-slate-400 leading-relaxed">
          对局进度保存在房主本地、不会丢失。房主恢复后会创建新房间并产生新邀请码，
          请通过群聊等渠道获取后重新加入；期间可保持本页查看当前局面。
        </p>
        <template #footer>
          <BaseButton variant="primary" @click="onHostLeftDialog(false)">我知道了</BaseButton>
        </template>
      </BaseDialog>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { initializeCache } from '@/data/customPlants'
import PlantManager from '@/components/PlantManager/index.vue'
import BPRulesDialog from '@/components/RulesEditor/BPRulesDialog.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import roomManager from '@/utils/roomManager'
import { APP_VERSION, APP_GIT_HASH } from '@/config/buildInfo'

const store = useGameStore()
const connStore = useConnectionStore()
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

// ========== 房主断开全局告知（多人） ==========
// 服务器在 host 断开时整房清理并给所有成员推 connectionStatus: host-left
// （server/index.js removeMember）。事件链：roomManager default 分支直接 emit，
// RoomSetup 只在挂载期间监听，对局中（BanPickView）无人处理 → 必须挂全局。
const hostLeftOpen = ref(false)

// connectionStatus 事件还携带 'connected'（ws 建立）/ 'heartbeat-lost'（心跳超时）等
// 状态（RoomSetup 也各自监听），这里只拦截 host-left 这一致命状态。
function onConnectionStatus(message) {
  if (message?.status === 'host-left') {
    hostLeftOpen.value = true
  }
}

function onHostLeftDialog(value) {
  // 单按钮告知框：仅确认一路（BaseDialog 关闭事件也走 false，幂等）
  if (value) return
  hostLeftOpen.value = false
  // 房间已被服务器删除：停掉对旧邀请码的自动重连/心跳/同步，并清掉 24h 会话，
  // 避免刷新后被引导重连不存在的房间（新邀请码需房主恢复后另行下发）。
  // 不改 roomMode/身份：维持 isMyTurn=false 的只读态，防止在死房间误操作。
  roomManager.disconnect()
  connStore.clearMultiplayerSession()
}

onMounted(() => {
  roomManager.on('connectionStatus', onConnectionStatus)
})
onBeforeUnmount(() => {
  roomManager.off('connectionStatus', onConnectionStatus)
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

<template>
  <div class="container mx-auto px-3 sm:px-4 py-3 lg:py-6 max-w-[1600px] flex-1 flex flex-col">
    <!-- 头部：信息概览 -->
    <div class="glass-panel rounded-xl p-3 lg:p-4 mb-3 lg:mb-6 animate-slide-up order-1 lg:order-none">
      <!-- 手机端紧凑头部 -->
      <div class="md:hidden">
        <!-- 状态条：选手1 + 阶段 + 选手2（组件内置 md:hidden/hidden md: 自适配紧凑/完整） -->
        <div class="flex items-center justify-between gap-2">
          <PlayerInfo player="player1" />
          <StageIndicator />
          <PlayerInfo player="player2" />
        </div>
        <!-- 紧凑 BanArea 两行 -->
        <div class="mt-2 grid grid-cols-1 gap-1">
          <BanArea player="player1" />
          <BanArea player="player2" />
        </div>
      </div>

      <!-- 桌面端头部（原样） -->
      <div class="hidden md:block">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <!-- 选手1区域 -->
          <div class="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
            <PlayerInfo player="player1" />
            <BanArea player="player1" />
          </div>

          <!-- 中央阶段指示器 -->
          <div class="flex-shrink-0">
            <StageIndicator />
          </div>

          <!-- 选手2区域 -->
          <div class="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
            <BanArea player="player2" />
            <PlayerInfo player="player2" />
          </div>
        </div>
      </div>

      <!-- 当前比赛规则摘要（所有角色可见，只读） -->
      <RulesSummary />
    </div>

    <!-- 全局状态栏：永久禁用 + 已使用植物（手机端隐藏历史 UsedPlants，改走「历史」按钮） -->
    <div class="glass-panel rounded-xl p-2 lg:p-3 mb-3 lg:mb-6 flex items-center justify-center gap-2 md:gap-3 lg:gap-6 animate-slide-up order-2 lg:order-none" :class="{ 'hidden md:flex': globalBans.length === 0 }" style="animation-delay: 0.1s;">
      <UsedPlants player="player1" class="hidden md:block" />

      <!-- 本局永久禁用植物 -->
      <div v-if="isPlantCacheReady" role="group" aria-label="本局永久禁用植物" class="bg-black/40 rounded-lg px-2 py-1.5 md:px-4 md:py-2 border border-ban-red/30 flex-shrink-0" :class="{ 'hidden md:block': globalBans.length === 0 }">
        <h3 class="text-[10px] md:text-xs font-bold mb-1 md:mb-2 text-center text-ban-red uppercase tracking-wider flex items-center justify-center gap-1 md:gap-2">
          <span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-ban-red" aria-hidden="true"></span>
          永久禁用
          <span class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-ban-red" aria-hidden="true"></span>
        </h3>
        <div class="flex justify-center gap-1 md:gap-2 flex-wrap">
          <div
            v-for="plantId in globalBans"
            :key="plantId"
            class="relative group w-7 h-7 md:w-10 md:h-10"
          >
            <img
              :src="getPlantImage(plantId)"
              :alt="`永久禁用植物：${getPlantName(plantId)}`"
              class="w-full h-full rounded border border-ban-red/50 opacity-60 grayscale lg:hover:grayscale-0 transition-all duration-300 transform lg:hover:scale-110"
            />
            <div class="hidden md:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-black/90 text-white rounded opacity-0 lg:group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              {{ getPlantName(plantId) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-black/40 rounded-lg px-2 py-1.5 md:px-4 md:py-2 border border-ban-red/30 flex-shrink-0" role="status" aria-live="polite">
        <div class="flex items-center justify-center gap-2 text-sm text-gray-400">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>正在加载植物数据...</span>
        </div>
      </div>

      <UsedPlants player="player2" class="hidden md:block" />
    </div>

    <!-- 主体操作区域（手机端：选择器置顶，两份阵容紧凑行居下） -->
    <div class="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0 animate-slide-up order-3 lg:order-none" style="animation-delay: 0.2s;">
      <div class="lg:col-span-3 order-2 md:order-none">
        <PickArea player="player1" :highlighted="connStore.myAssignedPlayer === 'player1'" />
      </div>

      <div class="lg:col-span-6 flex flex-col order-1 md:order-none">
        <PlantSelector v-if="gameStatus === 'banning'" class="flex-1" />
        <PositionSetup v-if="gameStatus === 'positioning'" class="flex-1" />
      </div>

      <div class="lg:col-span-3 order-3 md:order-none">
        <PickArea player="player2" :highlighted="connStore.myAssignedPlayer === 'player2'" />
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div class="mt-3 lg:mt-6 flex flex-wrap justify-center gap-2 lg:gap-4 animate-slide-up order-4 lg:order-none" style="animation-delay: 0.3s;">
      <!-- 局内临时抽取永禁（仅裁判/host，仅 BP 流程进行中） -->
      <BaseButton
        v-if="gameStatus === 'banning' && canDrawGlobalBan"
        variant="danger"
        :size="btnSize"
        @click="drawRandomGlobalBan"
      >
        <template #icon><Dices :size="iconSize" /></template>
        抽取永禁
      </BaseButton>
      <!-- 通用撤销：裁判随时可撤；选手可撤自己刚做的操作；BP 流程进行中且有可撤销步骤时显示 -->
      <BaseButton
        v-if="gameStatus === 'banning' && canUndo"
        variant="secondary"
        :size="btnSize"
        @click="undoLastAction"
      >
        <template #icon><Undo2 :size="iconSize" /></template>
        撤销<span v-if="undoCount > 1" class="ml-1 text-xs opacity-70">({{ undoCount }})</span>
      </BaseButton>

      <BaseButton
        v-if="gameStatus === 'positioning'"
        variant="primary"
        :size="btnSize"
        @click="finishRound"
      >
        <template #icon><Swords :size="iconSize" /></template>
        完成本小局
      </BaseButton>

      <!-- 桌面端：配置管理 / 重置游戏 直接展示（原样 size=lg） -->
      <div class="hidden md:block">
        <BaseButton variant="blue" size="lg" @click="uiStore.setShowPlantManager(true)">
          <template #icon><Sprout :size="20" /></template>
          配置管理
        </BaseButton>
      </div>
      <div class="hidden md:block">
        <BaseButton variant="secondary" size="lg" @click="resetGame">
          <template #icon><RotateCcw :size="20" /></template>
          重置游戏
        </BaseButton>
      </div>

      <!-- 手机端：历史使用（弹窗展示 UsedPlants） -->
      <div class="md:hidden">
        <BaseButton variant="ghost" size="sm" @click="showHistory = true">
          <template #icon><History :size="16" /></template>
          历史
        </BaseButton>
      </div>

      <!-- 手机端：更多 菜单（收纳配置管理 / 重置游戏） -->
      <div class="relative md:hidden">
        <BaseButton variant="secondary" size="sm" @click="showMore = !showMore">
          <template #icon><MoreHorizontal :size="16" /></template>
          更多
        </BaseButton>
        <!-- 点击空白关闭 -->
        <div v-if="showMore" class="fixed inset-0 z-40" @click="showMore = false"></div>
        <Transition name="fade">
          <div v-if="showMore" class="absolute bottom-full right-0 mb-2 z-50 min-w-[150px] glass-panel rounded-xl p-1.5 shadow-2xl border border-white/10">
            <button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 text-sm text-slate-100 transition-colors" @click="showMore = false; uiStore.setShowPlantManager(true)">
              <Sprout :size="16" class="text-plant-green" />
              配置管理
            </button>
            <button type="button" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/10 active:bg-white/15 text-sm text-slate-100 transition-colors" @click="showMore = false; resetGame()">
              <RotateCcw :size="16" class="text-slate-300" />
              重置游戏
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 手机端：历史使用植物对话框 -->
    <BaseDialog v-model="showHistory" title="历史使用植物" panel-class="max-w-md">
      <div class="space-y-3">
        <UsedPlants player="player1" />
        <UsedPlants player="player2" />
      </div>
    </BaseDialog>

    <!-- ban/pick 植物飞行动画层（Teleport 到 body，根为真实 div） -->
    <PlantFlightOverlay />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Swords, Sprout, RotateCcw, Dices, Undo2, History, MoreHorizontal } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useIsMobile } from '@/composables/useBreakpoint.js'
import { getPlantImage, getPlantName, getPlantByIdSync } from '@/data/customPlants'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import PlayerInfo from '@/components/PlayerInfo.vue'
import StageIndicator from '@/components/StageIndicator.vue'
import BanArea from '@/components/BanArea.vue'
import PickArea from '@/components/PickArea.vue'
import UsedPlants from '@/components/UsedPlants.vue'
import PlantSelector from '@/components/PlantSelector.vue'
import PositionSetup from '@/components/PositionSetup.vue'
import RulesSummary from '@/components/RulesEditor/RulesSummary.vue'
import PlantManager from '@/components/PlantManager/index.vue'
import PlantFlightOverlay from '@/components/animation/PlantFlightOverlay.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const uiStore = useUIStore()
const router = useRouter()

const gameStatus = computed(() => store.gameStatus)

// 响应式：手机端按钮 sm / 桌面端 lg（BaseButton 的 size 是 prop，需在 JS 侧按断点切换）
const isMobile = useIsMobile()
const btnSize = computed(() => (isMobile.value ? 'sm' : 'lg'))
const iconSize = computed(() => (isMobile.value ? 16 : 20))

// 手机端：历史使用弹窗 / 「更多」下拉菜单
const showHistory = ref(false)
const showMore = ref(false)

// 局内抽取永禁：仅裁判/host 可操作（单机 local 谁都能点）
const canDrawGlobalBan = computed(() =>
  connStore.roomMode === 'local' || connStore.myRole === 'host'
)
// 通用撤销权限：观众不可；裁判(local/host)永可；选手仅当 lastActor===自己（撤销自己刚做的操作）
const canUndo = computed(() => {
  if (store.gameStatus !== 'banning') return false
  if (store.undoStack.length === 0) return false
  if (connStore.isViewOnly) return false
  if (connStore.roomMode === 'local' || connStore.myRole === 'host') return true
  return store.lastActor === connStore.myAssignedPlayer
})
const undoCount = computed(() => store.undoStack.length)

const drawRandomGlobalBan = () => {
  const r = store.drawRandomGlobalBan()
  if (!r.ok) {
    if (r.reason === 'empty') {
      useToast().warning('没有可抽取的植物了（全部已永久禁用）')
    }
    // not-authority / no-round 为 UI 守卫兜底，不 toast
    return
  }
  useToast().success(`已随机永久禁用：${getPlantName(r.plantId)}`)
}

const undoLastAction = () => {
  const r = store.undoLastAction()
  if (!r.ok) {
    if (r.reason === 'empty') useToast().info('没有可撤销的操作')
    else if (r.reason === 'not-allowed') useToast().warning('当前无撤销权限')
    // wrong-phase 由 UI 隐藏兜底，不 toast
    return
  }
  const u = r.undone
  const name = u.plantId ? getPlantName(u.plantId) : ''
  if (u.action === 'globalBan') useToast().info(`已撤销永久禁用：${name}`)
  else if (u.action === 'ban') useToast().info(`已撤销禁用：${name}`)
  else if (u.action === 'pick') useToast().info(`已撤销选择：${name}`)
  else useToast().info('已撤销上一步操作')
}

const globalBans = computed(() => {
  const _version = store._plantCacheVersion
  return store.globalBans
})

const isPlantCacheReady = computed(() => {
  const bans = store.globalBans
  if (bans.length === 0) return true
  for (const plantId of bans) {
    if (!getPlantByIdSync(plantId)) return false
  }
  return true
})

const finishRound = () => {
  store.finishRound()
  router.push({ name: 'result' })
}

const { confirm } = useConfirm()

const resetGame = async () => {
  const ok = await confirm({
    title: '重置游戏',
    message: '确定要重置游戏吗？所有进度将丢失。',
    confirmText: '重置',
    variant: 'danger',
  })
  if (ok) {
    store.resetGame()
    router.push({ name: 'setup' })
  }
}
</script>

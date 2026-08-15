<template>
  <div class="container mx-auto px-3 sm:px-4 py-2 lg:py-4 max-w-[1600px] flex-1 flex flex-col">
    <!-- 头部：信息概览 -->
    <div class="glass-panel rounded-xl p-3 lg:p-4 mb-2 lg:mb-4 animate-slide-up order-1 lg:order-none">
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

    <!-- 中部：永久禁用栏 + 主体（桌面端三栏贯穿，左右 PickArea 跨两行顶到头部面板底部） -->
    <div class="flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-4 lg:grid-rows-[auto_minmax(0,1fr)] flex-1 min-h-0 animate-slide-up order-2 lg:order-none" style="animation-delay: 0.1s;">
      <!-- 左：PickArea player1（桌面端跨两行，顶部贴头部面板底部） -->
      <div class="order-3 lg:order-none lg:col-span-3 lg:col-start-1 lg:row-span-2">
        <PickArea player="player1" :highlighted="connStore.myAssignedPlayer === 'player1'" />
      </div>

      <!-- 中上：规则摘要 + 永久禁用（桌面端 col-span-6 对齐下方选择器；手机端空态隐藏） -->
      <div class="order-1 lg:order-none glass-panel rounded-xl p-2 lg:p-3 flex items-center justify-center gap-2 md:gap-3 lg:gap-4 lg:col-span-6 lg:col-start-4 lg:row-start-1" :class="{ 'hidden md:flex': globalBans.length === 0 }">
        <!-- 桌面端：规则摘要竖排（手机端保留在头部） -->
        <div class="hidden md:flex flex-col items-start gap-1.5 flex-shrink-0 pl-2 border-l border-gray-700/40">
          <RulesSummaryDesktop />
        </div>

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
      </div>

      <!-- 中下：选择器 / 站位设置 -->
      <div class="order-2 lg:order-none lg:col-span-6 lg:col-start-4 lg:row-start-2 flex flex-col">
        <PlantSelector v-if="gameStatus === 'banning'" class="flex-1" />
        <PositionSetup v-if="gameStatus === 'positioning'" class="flex-1" />
      </div>

      <!-- 右：PickArea player2（桌面端跨两行，顶部贴头部面板底部） -->
      <div class="order-4 lg:order-none lg:col-span-3 lg:col-start-10 lg:row-span-2">
        <PickArea player="player2" :highlighted="connStore.myAssignedPlayer === 'player2'" />
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div class="mt-2 lg:mt-4 flex flex-wrap justify-center gap-2 lg:gap-4 animate-slide-up order-4 lg:order-none" style="animation-delay: 0.3s;">
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
      <!-- 重置本小局（仅裁判/host；BP/站位阶段；清本局不动比分与已抽取的永久禁用） -->
      <BaseButton
        v-if="(gameStatus === 'banning' || gameStatus === 'positioning') && canResetRound"
        variant="secondary"
        :size="btnSize"
        @click="resetCurrentRound"
      >
        <template #icon><RotateCw :size="iconSize" /></template>
        重置本小局
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

      <!-- 手机端：重置游戏 -->
      <div class="md:hidden">
        <BaseButton variant="secondary" size="sm" @click="resetGame">
          <template #icon><RotateCcw :size="16" /></template>
          重置游戏
        </BaseButton>
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
import { Swords, RotateCcw, Dices, Undo2, History, RotateCw } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useConfirm } from '@/composables/useConfirm'
import { usePermission } from '@/composables/usePermission'
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
import RulesSummaryDesktop from '@/components/RulesEditor/RulesSummaryDesktop.vue'
import PlantManager from '@/components/PlantManager/index.vue'
import PlantFlightOverlay from '@/components/animation/PlantFlightOverlay.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const router = useRouter()

const gameStatus = computed(() => store.gameStatus)

// 响应式：手机端按钮 sm / 桌面端 lg（BaseButton 的 size 是 prop，需在 JS 侧按断点切换）
const isMobile = useIsMobile()
const btnSize = computed(() => (isMobile.value ? 'sm' : 'lg'))
const iconSize = computed(() => (isMobile.value ? 16 : 20))

// 手机端：历史使用弹窗
const showHistory = ref(false)

// 局内抽取永禁：仅裁判/host 可操作（单机 local 谁都能点）
const { isReferee: canDrawGlobalBan, canUndo } = usePermission()
// 重置本小局：同裁判权限（涉及重抽自动步骤，遵循权威方单点）
const canResetRound = canDrawGlobalBan
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

// 重置本小局：清本局回到起点（本小局新增的永久禁用/南瓜用量回退重抽；比分与历史使用保留），需二次确认
const resetCurrentRound = async () => {
  const ok = await confirm({
    title: '重置本小局',
    message: '本小局的禁用/选择/站位将被清空并回到本局起点；本小局内新增的永久禁用与南瓜用量将一并回退重抽。大局比分与历史使用次数不受影响。',
    confirmText: '重置',
    variant: 'danger',
  })
  if (!ok) return
  const r = store.resetCurrentRound()
  if (!r.ok) {
    if (r.reason === 'not-allowed') useToast().warning('仅裁判可以重置本小局')
    return
  }
  useToast().info(`已重置第 ${store.currentRound.roundNumber} 小局`)
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

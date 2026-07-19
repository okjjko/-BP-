<template>
  <div class="container mx-auto px-4 py-6 max-w-[1600px] flex-1 flex flex-col">
    <!-- 头部：信息概览 -->
    <div class="glass-panel rounded-xl p-4 mb-6 animate-slide-up">
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

      <!-- 当前比赛规则摘要（所有角色可见，只读） -->
      <RulesSummary />
    </div>

    <!-- 全局状态栏：永久禁用 + 已使用植物 -->
    <div class="glass-panel rounded-xl p-3 mb-6 flex items-start justify-center gap-6 animate-slide-up" style="animation-delay: 0.1s;">
      <UsedPlants player="player1" />

      <!-- 本局永久禁用植物 -->
      <div v-if="isPlantCacheReady" role="group" aria-label="本局永久禁用植物" class="bg-black/40 rounded-lg px-4 py-2 border border-ban-red/30 flex-shrink-0">
        <h3 class="text-xs font-bold mb-2 text-center text-ban-red uppercase tracking-wider flex items-center justify-center gap-2">
          <span class="w-2 h-2 rounded-full bg-ban-red" aria-hidden="true"></span>
          永久禁用
          <span class="w-2 h-2 rounded-full bg-ban-red" aria-hidden="true"></span>
        </h3>
        <div class="flex justify-center gap-2 flex-wrap">
          <div
            v-for="plantId in globalBans"
            :key="plantId"
            class="relative group w-10 h-10"
          >
            <img
              :src="getPlantImage(plantId)"
              :alt="`永久禁用植物：${getPlantName(plantId)}`"
              class="w-full h-full rounded border border-ban-red/50 opacity-60 grayscale hover:grayscale-0 transition-all duration-300 transform hover:scale-110"
            />
            <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-black/90 text-white rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
              {{ getPlantName(plantId) }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="bg-black/40 rounded-lg px-4 py-2 border border-ban-red/30 flex-shrink-0" role="status" aria-live="polite">
        <div class="flex items-center justify-center gap-2 text-sm text-gray-400">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>正在加载植物数据...</span>
        </div>
      </div>

      <UsedPlants player="player2" />
    </div>

    <!-- 主体操作区域 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 animate-slide-up" style="animation-delay: 0.2s;">
      <div class="lg:col-span-3">
        <PickArea player="player1" />
      </div>

      <div class="lg:col-span-6 flex flex-col">
        <PlantSelector v-if="gameStatus === 'banning'" class="flex-1" />
        <PositionSetup v-if="gameStatus === 'positioning'" class="flex-1" />
      </div>

      <div class="lg:col-span-3">
        <PickArea player="player2" />
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div class="mt-6 flex flex-wrap justify-center gap-4 animate-slide-up" style="animation-delay: 0.3s;">
      <!-- 局内临时抽取永禁（仅裁判/host，仅 BP 流程进行中） -->
      <BaseButton
        v-if="gameStatus === 'banning' && canDrawGlobalBan"
        variant="danger"
        size="lg"
        @click="drawRandomGlobalBan"
      >
        <template #icon><Dices :size="20" /></template>
        抽取永禁
      </BaseButton>
      <!-- 通用撤销：裁判随时可撤；选手可撤自己刚做的操作；BP 流程进行中且有可撤销步骤时显示 -->
      <BaseButton
        v-if="gameStatus === 'banning' && canUndo"
        variant="secondary"
        size="lg"
        @click="undoLastAction"
      >
        <template #icon><Undo2 :size="20" /></template>
        撤销<span v-if="undoCount > 1" class="ml-1 text-xs opacity-70">({{ undoCount }})</span>
      </BaseButton>

      <BaseButton
        v-if="gameStatus === 'positioning'"
        variant="primary"
        size="lg"
        @click="finishRound"
      >
        <template #icon><Swords :size="20" /></template>
        完成本小局
      </BaseButton>

      <BaseButton
        variant="blue"
        size="lg"
        @click="uiStore.setShowPlantManager(true)"
      >
        <template #icon><Sprout :size="20" /></template>
        植物管理
      </BaseButton>

      <BaseButton
        variant="secondary"
        size="lg"
        @click="resetGame"
      >
        <template #icon><RotateCcw :size="20" /></template>
        重置游戏
      </BaseButton>
    </div>

    <!-- ban/pick 植物飞行动画层（Teleport 到 body，根为真实 div） -->
    <PlantFlightOverlay />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Swords, Sprout, RotateCcw, Dices, Undo2 } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { getPlantImage, getPlantName, getPlantByIdSync } from '@/data/customPlants'
import BaseButton from '@/components/ui/BaseButton.vue'
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

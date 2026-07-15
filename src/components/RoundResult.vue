<template>
  <!-- 真实根元素：避免 BaseDialog 的 <Teleport> 成为路由 <Transition> 的直接子节点；
       同时让对话框 teleport 到 body，与路由 leave 过渡隔离，
       否则 BaseDialog 内层的 dialog-fade 过渡会与路由 fade 过渡嵌套，
       导致离开结算页时 leave 永不完成、router-view 被清空（只剩背景，需刷新才恢复）。 -->
  <div>
    <BaseDialog
      :model-value="true"
      :closable="false"
      :close-on-esc="true"
      :close-on-backdrop="false"
      title="小局结算"
      panel-class="max-w-xl"
      aria-label="小局结算"
      @close="cancelFinishRound"
    >
    <!-- 未选获胜方 -->
    <div v-if="!roundWinner" class="text-center space-y-8">
      <p class="text-xl text-slate-300">请选择本局获胜方</p>

      <div class="flex gap-6 justify-center items-stretch">
        <button
          @click="setWinner('player1')"
          class="group flex-1 py-6 bg-pick-blue/10 hover:bg-pick-blue/25 border-2 border-pick-blue/50 hover:border-pick-blue rounded-xl font-bold text-2xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span class="inline-block w-6 h-6 rounded-full bg-pick-blue mb-2 transition-transform group-hover:scale-110"></span>
          <div class="text-white">{{ player1Name }}</div>
        </button>

        <div class="flex items-center text-slate-500 font-black italic text-2xl">VS</div>

        <button
          @click="setWinner('player2')"
          class="group flex-1 py-6 bg-ban-red/10 hover:bg-ban-red/25 border-2 border-ban-red/50 hover:border-ban-red rounded-xl font-bold text-2xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ban-red focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span class="inline-block w-6 h-6 rounded-full bg-ban-red mb-2 transition-transform group-hover:scale-110"></span>
          <div class="text-white">{{ player2Name }}</div>
        </button>
      </div>

      <button
        @click="cancelFinishRound"
        class="text-slate-400 hover:text-white underline underline-offset-4 transition-colors text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
      >
        返回修改站位
      </button>
    </div>

    <!-- 已选获胜方 -->
    <div v-else class="text-center">
      <div class="mb-8">
        <Trophy :size="72" class="mx-auto mb-4 text-amber-400" />
        <p class="text-4xl font-black text-amber-400 mb-2">胜利!</p>
        <p class="text-2xl text-white font-bold tracking-wide">{{ winnerName }}</p>
        <div class="mt-4 flex justify-center gap-4 text-slate-400">
          <span>{{ player1Name }}: <span class="text-white font-bold font-mono tabular-nums">{{ player1Score }}</span></span>
          <span>|</span>
          <span>{{ player2Name }}: <span class="text-white font-bold font-mono tabular-nums">{{ player2Score }}</span></span>
        </div>
      </div>

      <!-- 败者选路 -->
      <fieldset v-if="!isGameEnd && needsRoadSelection" class="mt-8 pt-8 border-t border-slate-700/50">
        <legend class="text-lg font-bold text-slate-300 px-4">
          <span :class="loserIsBlue ? 'text-pick-blue' : 'text-ban-red'">{{ loserName }}</span> 败者选路
        </legend>

        <div class="flex gap-4 justify-center mb-6 mt-4">
          <button
            @click="toggleLoserRoad(2)"
            :disabled="winnerRoad === 2"
            :class="[
              loserRoadBtnBase,
              loserRingClass,
              loserRoad === 2
                ? loserSelectedClass + ' text-white'
                : winnerRoad === 2
                  ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
            ]"
          >
            2路
          </button>
          <button
            @click="toggleLoserRoad(4)"
            :disabled="winnerRoad === 4"
            :class="[
              loserRoadBtnBase,
              loserRingClass,
              loserRoad === 4
                ? loserSelectedClass + ' text-white'
                : winnerRoad === 4
                  ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
            ]"
          >
            4路
          </button>
        </div>

        <button
          v-if="loserRoad"
          @click="confirmRoadSelection"
          class="w-full min-h-[56px] py-4 bg-gradient-to-r from-plant-green-dark to-plant-green text-white rounded-xl font-bold text-xl shadow-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          确认并继续 →
        </button>
      </fieldset>

      <!-- 自动继续 (无需选路) -->
      <div v-if="!isGameEnd && !needsRoadSelection" class="mt-8 pt-8 border-t border-slate-700/50">
        <p class="text-slate-400 mb-6">下一局道路已自动确定</p>
        <button
          @click="goToNextRound"
          class="px-10 min-h-[56px] py-4 bg-plant-green hover:bg-plant-green-dark text-white rounded-xl font-bold text-xl shadow-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          下一小局 →
        </button>
      </div>

      <!-- 游戏结束 -->
      <div v-else-if="isGameEnd" class="mt-8 pt-8 border-t border-slate-700/50">
        <p class="text-slate-300 mb-6 font-mono tracking-widest">大局结束</p>
        <button
          @click="resetGame"
          class="w-full min-h-[56px] py-4 bg-ban-red hover:bg-ban-red-dark text-white rounded-xl font-bold text-xl shadow-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ban-red focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          重新开始
        </button>
      </div>
    </div>
    </BaseDialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { isGameOver } from '@/utils/validators'
import { useConfirm } from '@/composables/useConfirm'
import { Trophy } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const { confirm } = useConfirm()

const roundWinner = computed(() => store.roundWinner)
const player1Score = computed(() => store.player1.score)
const player2Score = computed(() => store.player2.score)

const player1Name = computed(() => store.player1.id || '甲')
const player2Name = computed(() => store.player2.id || '乙')

const winnerName = computed(() => {
  if (roundWinner.value === 'player1') return player1Name.value
  if (roundWinner.value === 'player2') return player2Name.value
  return ''
})

const loserName = computed(() => {
  if (roundWinner.value === 'player1') return player2Name.value
  if (roundWinner.value === 'player2') return player1Name.value
  return ''
})

const loser = computed(() => {
  if (roundWinner.value === 'player1') return 'player2'
  if (roundWinner.value === 'player2') return 'player1'
  return null
})

// 败者身份色：player1=蓝方(pick-blue) / player2=红方(ban-red)，整局稳定
const loserIsBlue = computed(() => loser.value === 'player1')
const loserSelectedClass = computed(() =>
  loserIsBlue.value ? 'bg-pick-blue border-pick-blue' : 'bg-ban-red border-ban-red'
)
const loserRingClass = computed(() =>
  loserIsBlue.value ? 'focus-visible:ring-pick-blue' : 'focus-visible:ring-ban-red'
)
const loserRoadBtnBase =
  'flex-1 min-h-[56px] py-4 rounded-lg font-bold text-xl border-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed'

const currentRound = computed(() => store.currentRound?.roundNumber || 1)
const firstPlayer = computed(() => store.firstPlayer)

const isGameEnd = computed(() => {
  return isGameOver(player1Score.value, player2Score.value, store.winThreshold)
})

const isRoundComplete = computed(() => {
  return store.currentRound?.isRoundComplete || false
})

// 判断是否需要败者选路
const needsRoadSelection = computed(() => {
  // 只有对局完成才需要败者选路
  if (!isRoundComplete.value) {
    return false
  }
  // 如果是第一局，且败者是先输入ID的选手，不需要选路
  if (currentRound.value === 1 && loser.value === firstPlayer.value) {
    return false
  }
  return true
})

// 败者临时选择的道路（未确认）
const loserRoad = ref(null)

// 胜者自动分配的道路（与败者相反）
const winnerRoad = computed(() => {
  if (loserRoad.value === 2) return 4
  if (loserRoad.value === 4) return 2
  return null
})

const setWinner = (winner) => {
  store.setRoundWinner(winner)
}

// 取消完成小局，返回站位阶段（同时作为对话框 Esc 关闭行为）
const cancelFinishRound = () => {
  store.gameStatus = 'positioning'

  // 同步状态到其他客户端
  if (connStore.roomMode !== 'local') {
    connStore.syncState()
  }
}

// 切换败者的道路选择（取消/选择）
const toggleLoserRoad = (road) => {
  if (loserRoad.value === road) {
    loserRoad.value = null // 取消选择
  } else {
    loserRoad.value = road
  }
}

// 确认道路选择
const confirmRoadSelection = () => {
  if (!loserRoad.value) return

  // 必须先同时更新败者所选道路与胜者（相反）道路，再开始下一局。
  // 若只更新一方就 startRound，getBPSequence 会因缺少另一条道路而报错并生成空序列。
  if (loser.value === 'player1') {
    store.player1.road = loserRoad.value
    store.player2.road = winnerRoad.value
  } else {
    store.player2.road = loserRoad.value
    store.player1.road = winnerRoad.value
  }

  // 重置临时状态
  loserRoad.value = null

  // 开始下一小局
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()

  // 同步状态到其他客户端
  if (connStore.roomMode !== 'local') {
    connStore.syncState()
  }
}

const goToNextRound = () => {
  // 直接进入下一小局
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()

  // 同步状态到其他客户端
  if (connStore.roomMode !== 'local') {
    connStore.syncState()
  }
}

const resetGame = async () => {
  if (await confirm({
    title: '重新开始',
    message: '确定要重置游戏吗？所有进度将丢失。',
    confirmText: '重新开始',
    variant: 'danger',
  })) {
    store.resetGame()
  }
}
</script>

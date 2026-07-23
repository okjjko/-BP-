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
          :disabled="!canControlMatch"
          class="group flex-1 py-6 bg-pick-blue/10 hover:bg-pick-blue/25 border-2 border-pick-blue/50 hover:border-pick-blue rounded-xl font-bold text-2xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span class="inline-block w-6 h-6 rounded-full bg-pick-blue mb-2 transition-transform group-hover:scale-110"></span>
          <div class="text-white">{{ player1Name }}</div>
        </button>

        <div class="flex items-center text-slate-500 font-black italic text-2xl">VS</div>

        <button
          @click="setWinner('player2')"
          :disabled="!canControlMatch"
          class="group flex-1 py-6 bg-ban-red/10 hover:bg-ban-red/25 border-2 border-ban-red/50 hover:border-ban-red rounded-xl font-bold text-2xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ban-red focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span class="inline-block w-6 h-6 rounded-full bg-ban-red mb-2 transition-transform group-hover:scale-110"></span>
          <div class="text-white">{{ player2Name }}</div>
        </button>
      </div>

      <button
        v-if="canControlMatch"
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

      <!-- 败者/胜者选路（按 loserPickMode 切换；keep 模式直接跳过选路） -->
      <fieldset v-if="!isGameEnd && needsRoadSelection && loserPickMode !== 'keep'" :disabled="!canSelectSide" class="mt-8 pt-8 border-t border-slate-700/50">
        <legend class="text-lg font-bold text-slate-300 px-4">
          <span :class="pickerIsBlue ? 'text-pick-blue' : 'text-ban-red'">{{ pickerName }}</span> {{ pickerLegendLabel }}
        </legend>

        <div class="flex gap-4 justify-center mb-6 mt-4">
          <button
            @click="togglePickerRoad(2)"
            :disabled="otherRoad === 2"
            :class="[
              pickerRoadBtnBase,
              pickerRingClass,
              pickerRoad === 2
                ? pickerSelectedClass + ' text-white'
                : otherRoad === 2
                  ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
            ]"
          >
            {{ store.sideName(2) }}
          </button>
          <button
            @click="togglePickerRoad(4)"
            :disabled="otherRoad === 4"
            :class="[
              pickerRoadBtnBase,
              pickerRingClass,
              pickerRoad === 4
                ? pickerSelectedClass + ' text-white'
                : otherRoad === 4
                  ? 'bg-gray-800 border-gray-700 text-gray-600 opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
            ]"
          >
            {{ store.sideName(4) }}
          </button>
        </div>

        <button
          v-if="pickerRoad"
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
          v-if="canControlMatch"
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
          v-if="canControlMatch"
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
import { usePermission } from '@/composables/usePermission'
import { Trophy } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const { confirm } = useConfirm()
const { canControlMatch, canSelectSide } = usePermission()

const roundWinner = computed(() => store.roundWinner)
const player1Score = computed(() => store.player1.score)
const player2Score = computed(() => store.player2.score)

const player1Name = computed(() => store.player1.id || '甲')
const player2Name = computed(() => store.player2.id || '乙')

// 功能3：败者选边模式（loser 败者选 / winner 胜者选 / keep 不换边）
const loserPickMode = computed(() => store.ruleConfig.sideSelection.loserPickMode)

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

const winner = computed(() => {
  if (roundWinner.value === 'player1') return 'player1'
  if (roundWinner.value === 'player2') return 'player2'
  return null
})

// 功能3：选边方 = loserPickMode==='winner' ? 胜者 : 败者
const picker = computed(() => {
  if (loserPickMode.value === 'winner') return winner.value
  return loser.value
})

const pickerName = computed(() => {
  if (picker.value === 'player1') return player1Name.value
  if (picker.value === 'player2') return player2Name.value
  return ''
})

// 选边方图例文案
const pickerLegendLabel = computed(() => {
  return loserPickMode.value === 'winner' ? '胜者选路' : '败者选路'
})

// 选边方身份色：player1=蓝方(pick-blue) / player2=红方(ban-red)，整局稳定
const pickerIsBlue = computed(() => picker.value === 'player1')
const pickerSelectedClass = computed(() =>
  pickerIsBlue.value ? 'bg-pick-blue border-pick-blue' : 'bg-ban-red border-ban-red'
)
const pickerRingClass = computed(() =>
  pickerIsBlue.value ? 'focus-visible:ring-pick-blue' : 'focus-visible:ring-ban-red'
)
const pickerRoadBtnBase =
  'flex-1 min-h-[56px] py-4 rounded-lg font-bold text-xl border-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed'

const currentRound = computed(() => store.currentRound?.roundNumber || 1)
const firstPlayer = computed(() => store.firstPlayer)

const isGameEnd = computed(() => {
  return isGameOver(player1Score.value, player2Score.value, store.winThreshold)
})

const isRoundComplete = computed(() => {
  return store.currentRound?.isRoundComplete || false
})

// 判断是否需要选路（败者/胜者选路模式需要；keep 模式跳过）
const needsRoadSelection = computed(() => {
  // 只有对局完成才需要选路
  if (!isRoundComplete.value) {
    return false
  }
  // keep 模式不换边，无需选路 UI（但仍需「下一小局」按钮，由 v-if 分支处理）
  if (loserPickMode.value === 'keep') {
    return false
  }
  // 如果是第一局，且选边方是先输入ID的选手，不需要选路
  if (currentRound.value === 1 && picker.value === firstPlayer.value) {
    return false
  }
  return true
})

// 选边方临时选择的道路（未确认）
const pickerRoad = ref(null)

// 对手自动分配的道路（与选边方相反）
const otherRoad = computed(() => {
  if (pickerRoad.value === 2) return 4
  if (pickerRoad.value === 4) return 2
  return null
})

const setWinner = (winner) => {
  store.setRoundWinner(winner)
}

// 取消完成小局，返回站位阶段（同时作为对话框 Esc 关闭行为）。权限由 store action 校验。
const cancelFinishRound = () => {
  store.returnToPositioning()
}

// 切换选边方的道路选择（取消/选择）
const togglePickerRoad = (road) => {
  if (pickerRoad.value === road) {
    pickerRoad.value = null // 取消选择
  } else {
    pickerRoad.value = road
  }
}

// 确认道路选择
const confirmRoadSelection = () => {
  if (!pickerRoad.value) return

  // 委托 store 统一处理（含权限校验：先同时更新双方 road 再 startRound）。
  const r = store.applyNextRoundSideSelection({
    loser: loser.value,
    winner: winner.value,
    pickerRoad: pickerRoad.value
  })
  if (!r?.ok) return

  // 重置临时状态
  pickerRoad.value = null
}

const goToNextRound = () => {
  if (!canControlMatch.value) return
  // keep 模式：不换边，委托 store 进入下一小局（统一同步逻辑）
  if (loserPickMode.value === 'keep') {
    store.applyNextRoundSideSelection({
      loser: loser.value,
      winner: winner.value,
      pickerRoad: null
    })
    return
  }

  // 第一局选边方=先输入ID选手的免选路场景：直接进入下一小局
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()

  // 同步状态到其他客户端（local 下 syncState 为 no-op）
  connStore.syncState()
}

const resetGame = async () => {
  if (await confirm({
    title: '重新开始',
    message: '确定要重置游戏吗？所有进度将丢失。',
    confirmText: '重新开始',
    variant: 'danger',
  })) {
    const r = store.resetGame()
    if (!r?.ok) return
  }
}
</script>

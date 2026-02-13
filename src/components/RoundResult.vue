<template>
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="round-result-title">
    <div class="bg-gray-800 rounded-xl p-8 max-w-lg w-full mx-4">
      <h2 id="round-result-title" class="text-3xl font-bold text-center mb-6">
        小分结算
      </h2>

      <div v-if="!roundWinner" class="text-center">
        <p class="text-xl mb-6">请选择获胜选手：</p>

        <div class="flex gap-4 justify-center mb-6" role="group" aria-label="选择获胜选手">
          <button
            @click="setWinner('player1')"
            :disabled="!true"
            :aria-label="`${player1Name} 胜，当前比分 ${player1Score} - ${player2Score}`"
            class="flex-1 py-4 bg-plant-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            {{ player1Name }} 胜
          </button>
          <button
            @click="setWinner('player2')"
            :disabled="!true"
            :aria-label="`${player2Name} 胜，当前比分 ${player1Score} - ${player2Score}`"
            class="flex-1 py-4 bg-plant-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            {{ player2Name }} 胜
          </button>
        </div>

        <div class="text-sm text-gray-400 mb-6" role="status" aria-live="polite">
          <p>当前比分：{{ player1Score }} - {{ player2Score }}</p>
        </div>

        <!-- 取消按钮 -->
        <button
          @click="cancelFinishRound"
          class="w-full py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold text-lg transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
        >
          返回修改站位
        </button>
      </div>

      <div v-else class="text-center">
        <div class="mb-6" role="status" aria-live="polite">
          <div class="text-4xl mb-4" aria-hidden="true">🎉</div>
          <p class="text-2xl font-bold text-plant-green mb-2">
            {{ winnerName }} 获胜！
          </p>
          <p class="text-lg text-gray-300">
            当前比分：{{ player1Score }} - {{ player2Score }}
          </p>
        </div>

        <!-- 败方选路 -->
        <fieldset v-if="!isGameEnd && needsRoadSelection" class="mt-6 pt-6 border-t border-gray-700">
          <legend class="text-lg font-semibold mb-3">
            {{ loserName }} 请选择下一轮的道路（败者选路权）：
          </legend>

          <!-- 败者选路按钮 -->
          <div class="flex gap-4 justify-center mb-4" role="group" :aria-label="`${loserName}选择道路`">
            <button
              @click="toggleLoserRoad(2)"
              :aria-pressed="loserRoad === 2"
              :disabled="winnerRoad === 2 || !true"
              class="flex-1 py-3 rounded-lg font-bold text-lg transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              :class="loserRoad === 2
                ? 'bg-blue-600 text-white'
                : winnerRoad === 2 || !true
                  ? 'bg-gray-800 text-gray-500'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            >
              2路
            </button>
            <button
              @click="toggleLoserRoad(4)"
              :aria-pressed="loserRoad === 4"
              :disabled="winnerRoad === 4 || !true"
              class="flex-1 py-3 rounded-lg font-bold text-lg transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              :class="loserRoad === 4
                ? 'bg-blue-600 text-white'
                : winnerRoad === 4 || !true
                  ? 'bg-gray-800 text-gray-500'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
            >
              4路
            </button>
          </div>

          <!-- 显示双方道路分配 -->
          <div v-if="loserRoad" class="mb-4 text-center" role="status" aria-live="polite">
            <p class="text-sm text-gray-300">
              <span class="font-semibold text-plant-green">{{ loserName }}</span>
              → {{ loserRoad }}路
              <span class="mx-2">|</span>
              <span class="font-semibold text-plant-green">{{ winnerName }}</span>
              → {{ winnerRoad }}路
            </p>
          </div>

          <!-- 确认按钮 -->
          <button
            v-if="loserRoad"
            @click="confirmRoadSelection"
            :disabled="!true"
            :aria-label="`确认${loserName}选择${loserRoad}路，${winnerName}选择${winnerRoad}路，进入下一小分`"
            class="w-full py-3 bg-plant-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            确认并进入下一小分
          </button>
        </fieldset>

        <!-- 第一局且败者是先输入ID的选手，自动进入下一局 -->
        <div v-if="!isGameEnd && !needsRoadSelection" class="mt-6 pt-6 border-t border-gray-700 text-center">
          <p class="text-lg font-semibold mb-3 text-plant-green">
            {{ loserName }} 的道路已在开局时确定
          </p>
          <button
            @click="goToNextRound"
            :disabled="!true"
            class="px-6 py-3 bg-plant-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            进入下一小分
          </button>
        </div>

        <!-- 游戏结束 -->
        <div v-else class="mt-6 pt-6 border-t border-gray-700">
          <p class="text-2xl font-bold text-yellow-400 mb-4" aria-hidden="true">
            🏆 游戏结束！
          </p>
          <p class="text-xl mb-6">
            最终获胜者：<span class="font-bold text-plant-green">{{ winnerName }}</span>
          </p>
          <button
            @click="resetGame"
            :disabled="!true"
            class="w-full py-3 bg-ban-red hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-lg transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            重新开始
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { isGameOver } from '@/utils/validators'

const store = useGameStore()

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

const currentRound = computed(() => store.currentRound?.roundNumber || 1)
const firstPlayer = computed(() => store.firstPlayer)

const isGameEnd = computed(() => {
  return isGameOver(player1Score.value, player2Score.value)
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

// 取消完成小分，返回站位阶段
const cancelFinishRound = () => {
  store.gameStatus = 'positioning'
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

  // 更新败者的道路
  store.selectRoad(loser.value, loserRoad.value)

  // 更新胜者的道路（自动分配相反的道路）
  const winner = roundWinner.value
  if (winner === 'player1') {
    store.player1.road = winnerRoad.value
  } else if (winner === 'player2') {
    store.player2.road = winnerRoad.value
  }

  // 重置临时状态
  loserRoad.value = null

  // 开始下一小分
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()
}

const goToNextRound = () => {
  // 直接进入下一小分
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()
}

const resetGame = () => {
  if (confirm('确定要重置游戏吗？')) {
    store.resetGame()
  }
}
</script>

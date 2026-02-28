<template>
  <div class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50" role="dialog" aria-modal="true">
    <div class="glass-card rounded-2xl p-10 max-w-xl w-full mx-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 animate-slide-up relative overflow-hidden">
      <!-- 背景光效 -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <h2 class="text-4xl font-black text-center mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 drop-shadow-lg">
        小分结算
      </h2>

      <div v-if="!roundWinner" class="text-center space-y-8">
        <p class="text-xl text-gray-300">请选择本局获胜方</p>

        <div class="flex gap-6 justify-center">
          <button
            @click="setWinner('player1')"
            class="group flex-1 py-6 bg-pick-blue/10 hover:bg-pick-blue/30 border-2 border-pick-blue/50 hover:border-pick-blue-neon rounded-xl font-bold text-2xl transition-all duration-300"
          >
            <div class="text-pick-blue-neon group-hover:scale-110 transition-transform mb-2">🔵</div>
            <div class="text-white">{{ player1Name }}</div>
          </button>
          
          <div class="flex items-center text-gray-500 font-black italic text-2xl">VS</div>

          <button
            @click="setWinner('player2')"
            class="group flex-1 py-6 bg-ban-red/10 hover:bg-ban-red/30 border-2 border-ban-red/50 hover:border-ban-red-neon rounded-xl font-bold text-2xl transition-all duration-300"
          >
            <div class="text-ban-red-neon group-hover:scale-110 transition-transform mb-2">🔴</div>
            <div class="text-white">{{ player2Name }}</div>
          </button>
        </div>

        <button
          @click="cancelFinishRound"
          class="text-gray-500 hover:text-white underline underline-offset-4 transition-colors text-sm"
        >
          返回修改站位
        </button>
      </div>

      <div v-else class="text-center relative">
        <!-- 胜利动画效果 -->
        <div class="mb-8 relative z-10">
          <div class="text-8xl mb-4 animate-bounce filter drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">🏆</div>
          <p class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 mb-2 drop-shadow-md">
            胜利!
          </p>
          <p class="text-2xl text-white font-bold tracking-wide">
            {{ winnerName }}
          </p>
          <div class="mt-4 flex justify-center gap-4 text-gray-400">
             <span>{{ player1Name }}: <span class="text-white font-bold">{{ player1Score }}</span></span>
             <span>|</span>
             <span>{{ player2Name }}: <span class="text-white font-bold">{{ player2Score }}</span></span>
          </div>
        </div>

        <!-- 败方选路 -->
        <fieldset v-if="!isGameEnd && needsRoadSelection" class="mt-8 pt-8 border-t border-gray-700/50">
          <legend class="text-lg font-bold text-gray-300 px-4">
            <span class="text-ban-red-neon">{{ loserName }}</span> 败者选路
          </legend>

          <div class="flex gap-4 justify-center mb-6 mt-4">
            <button
              @click="toggleLoserRoad(2)"
              :disabled="winnerRoad === 2"
              class="flex-1 py-4 rounded-lg font-bold text-xl border-2 transition-all duration-300"
              :class="loserRoad === 2
                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                : winnerRoad === 2
                  ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              2路
            </button>
            <button
              @click="toggleLoserRoad(4)"
              :disabled="winnerRoad === 4"
              class="flex-1 py-4 rounded-lg font-bold text-xl border-2 transition-all duration-300"
              :class="loserRoad === 4
                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                : winnerRoad === 4
                  ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              4路
            </button>
          </div>

          <!-- 确认按钮 -->
          <button
            v-if="loserRoad"
            @click="confirmRoadSelection"
            class="w-full py-4 bg-gradient-to-r from-plant-green-dark to-plant-green hover:to-plant-green-neon text-white rounded-xl font-bold text-xl shadow-lg hover:shadow-green-500/30 transition-all duration-300 transform active:scale-95"
          >
            确认并继续 →
          </button>
        </fieldset>

        <!-- 自动继续 (无需选路) -->
        <div v-if="!isGameEnd && !needsRoadSelection" class="mt-8 pt-8 border-t border-gray-700/50">
           <p class="text-gray-400 mb-6">下一局道路已自动确定</p>
           <button
            @click="goToNextRound"
            class="px-10 py-4 bg-plant-green hover:bg-plant-green-neon text-white rounded-xl font-bold text-xl shadow-lg transition-all duration-300"
          >
            下一小分 →
          </button>
        </div>

        <!-- 游戏结束 -->
        <div v-else-if="isGameEnd" class="mt-8 pt-8 border-t border-gray-700/50">
          <p class="text-gray-300 mb-6 font-mono tracking-widest">游戏结束</p>
          <button
            @click="resetGame"
            class="w-full py-4 bg-ban-red hover:bg-ban-red-neon text-white rounded-xl font-bold text-xl shadow-lg hover:shadow-red-500/30 transition-all duration-300"
          >
            全新开始
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

  // 同步状态到其他客户端
  if (store.roomMode !== 'local') {
    store.syncState()
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

  // 同步状态到其他客户端
  if (store.roomMode !== 'local') {
    store.syncState()
  }
}

const goToNextRound = () => {
  // 直接进入下一小分
  const nextRound = currentRound.value + 1
  store.startRound(nextRound)
  store.saveToLocalStorage()

  // 同步状态到其他客户端
  if (store.roomMode !== 'local') {
    store.syncState()
  }
}

const resetGame = () => {
  if (confirm('确定要重置游戏吗？')) {
    store.resetGame()
  }
}
</script>

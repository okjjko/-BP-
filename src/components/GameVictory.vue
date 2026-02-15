<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
    <!-- 背景模糊层 -->
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

    <!-- 背景动画层：金色光晕 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-[100px] animate-pulse"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" style="animation-delay: 1s;"></div>
    </div>

    <!-- 彩带粒子效果 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        v-for="(confetti, index) in confettiPieces"
        :key="index"
        class="absolute confetti-piece"
        :style="{
          left: confetti.left,
          top: confetti.top,
          animationDelay: confetti.delay,
          backgroundColor: confetti.color
        }"
      ></div>
    </div>

    <!-- 主内容卡片 -->
    <div class="relative z-10 glass-card rounded-3xl p-12 max-w-2xl w-full mx-4 shadow-[0_0_80px_rgba(255,215,0,0.3)] border border-yellow-500/30 animate-slide-up">
      <!-- 顶部光效线 -->
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent"></div>

      <!-- 胜利标题 -->
      <div class="text-center mb-10">
        <div class="text-8xl mb-6 animate-bounce filter drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]">
          🏆
        </div>
        <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-400 mb-4 drop-shadow-lg">
          胜利!
        </h1>
        <p class="text-xl text-gray-300 font-light tracking-widest">VICTORY</p>
      </div>

      <!-- 胜利者信息 -->
      <div class="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-2xl p-8 mb-8 border-2 border-yellow-500/50 shadow-[0_0_30px_rgba(255,215,0,0.2)]">
        <div class="text-center">
          <p class="text-gray-400 text-sm uppercase tracking-wider mb-3">获胜者</p>
          <p class="text-4xl font-black text-white mb-6">{{ winnerName }}</p>

          <!-- 最终比分 -->
          <div class="flex items-center justify-center gap-8">
            <div class="text-center">
              <p class="text-gray-400 text-xs mb-1">{{ player1Name }}</p>
              <p class="text-5xl font-black" :class="winner === 'player1' ? 'text-yellow-400' : 'text-gray-500'">
                {{ player1Score }}
              </p>
            </div>

            <div class="text-3xl text-gray-600 font-black">:</div>

            <div class="text-center">
              <p class="text-gray-400 text-xs mb-1">{{ player2Name }}</p>
              <p class="text-5xl font-black" :class="winner === 'player2' ? 'text-yellow-400' : 'text-gray-500'">
                {{ player2Score }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 比赛统计 -->
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div class="bg-black/30 rounded-xl p-4 border border-white/10 text-center">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">总回合数</p>
          <p class="text-3xl font-black text-white">{{ totalRounds }}</p>
        </div>
        <div class="bg-black/30 rounded-xl p-4 border border-white/10 text-center">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">获胜方式</p>
          <p class="text-xl font-bold text-yellow-400">先得4分</p>
        </div>
      </div>

      <!-- 操作按钮 -->
      <button
        @click="resetGame"
        class="w-full py-5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-orange-500 hover:from-yellow-500 hover:via-yellow-400 hover:to-orange-400 text-white rounded-xl font-bold text-xl shadow-lg hover:shadow-yellow-500/40 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
      >
        <span class="text-2xl">🔄</span>
        <span>重新开始</span>
      </button>

      <!-- 返回小分结算（调试用，可选） -->
      <button
        @click="backToRoundResult"
        class="w-full mt-3 py-2 text-gray-500 hover:text-gray-300 text-sm underline underline-offset-4 transition-colors"
      >
        查看小分结算详情
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useGameStore } from '@/store/gameStore'

const store = useGameStore()

// 判断胜利者
const winner = computed(() => {
  const p1Score = store.player1.score
  const p2Score = store.player2.score
  if (p1Score >= 4) return 'player1'
  if (p2Score >= 4) return 'player2'
  return null
})

const winnerName = computed(() => {
  if (winner.value === 'player1') return store.player1.id || '甲'
  if (winner.value === 'player2') return store.player2.id || '乙'
  return ''
})

const player1Name = computed(() => store.player1.id || '甲')
const player2Name = computed(() => store.player2.id || '乙')

const player1Score = computed(() => store.player1.score)
const player2Score = computed(() => store.player2.score)

const totalRounds = computed(() => {
  return player1Score.value + player2Score.value
})

// 彩带粒子数据
const confettiPieces = ref([])

// 生成彩带粒子
const generateConfetti = () => {
  const colors = [
    '#FFD700', // 金色
    '#FFA500', // 橙色
    '#FF6B6B', // 红色
    '#4ECDC4', // 青色
    '#45B7D1', // 蓝色
    '#96CEB4', // 绿色
    '#FFEAA7', // 浅黄色
    '#DDA0DD'  // 紫色
  ]

  const pieces = []
  for (let i = 0; i < 50; i++) {
    pieces.push({
      left: Math.random() * 100 + '%',
      top: -20 + 'px',
      delay: Math.random() * 3 + 's',
      color: colors[Math.floor(Math.random() * colors.length)]
    })
  }
  confettiPieces.value = pieces
}

// 重置游戏
const resetGame = () => {
  if (confirm('确定要重新开始吗？所有游戏进度将丢失。')) {
    store.resetGame()
  }
}

// 返回小分结算（用于调试）
const backToRoundResult = () => {
  store.gameStatus = 'result'
}

onMounted(() => {
  generateConfetti()
})
</script>

<style scoped>
@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

.confetti-piece {
  width: 10px;
  height: 10px;
  animation: confetti-fall 4s linear infinite;
  border-radius: 2px;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.6s ease-out;
}

/* 玻璃卡片效果 */
.glass-card {
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
</style>

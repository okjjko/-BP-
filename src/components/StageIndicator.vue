<template>
  <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 min-w-[280px] shadow-lg border border-gray-700" role="region" aria-label="当前游戏阶段">
    <div class="text-center">
      <h3 class="text-xl font-bold mb-2 text-white">第 {{ roundNumber }} 小分</h3>
      <div class="text-2xl font-bold mb-2" :class="stageClass">
        {{ stageName }}
      </div>

      <!-- 进度条 -->
      <div class="mb-3">
        <div class="w-full bg-gray-700 rounded-full h-2" role="progressbar" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
          <div
            class="h-2 rounded-full transition-all duration-300"
            :class="progressBarClass"
            :style="{ width: `${((step + 1) / totalSteps) * 100}%` }"
          ></div>
        </div>
        <div class="text-sm text-gray-400 mt-1">
          第 {{ step + 1 }} / {{ totalSteps }} 步
        </div>
      </div>

      <!-- 当前操作 -->
      <div class="mt-3">
        <span
          class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-base font-bold shadow-md animate-pulse-slow"
          :class="actionClass"
        >
          <span class="w-2 h-2 rounded-full bg-white"></span>
          {{ currentPlayerName }} {{ actionText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { STAGE_NAMES } from '@/utils/bpRules'

const store = useGameStore()

// 当前小分数 = 双方分数和 + 1
const roundNumber = computed(() => {
  return (store.player1.score || 0) + (store.player2.score || 0) + 1
})
const stage = computed(() => store.currentRound?.stage || 1)
const step = computed(() => store.currentRound?.step || 0)
const currentPlayer = computed(() => store.currentRound?.currentPlayer || '')
const action = computed(() => store.currentRound?.action || '')
const bpSequence = computed(() => store.currentRound?.bpSequence || [[], [], [], []])

const stageName = computed(() => STAGE_NAMES[stage.value])

const totalSteps = computed(() => {
  return bpSequence.value.reduce((total, stage) => total + stage.length, 0)
})

const currentPlayerName = computed(() => {
  if (currentPlayer.value === 'player1') {
    return store.player1.id || '甲'
  } else if (currentPlayer.value === 'player2') {
    return store.player2.id || '乙'
  }
  return ''
})

const actionText = computed(() => {
  if (action.value === 'ban') return '禁用'
  if (action.value === 'pick') return '选择'
  return ''
})

const stageClass = computed(() => {
  if (action.value === 'ban') return 'text-ban-red'
  if (action.value === 'pick') return 'text-pick-blue'
  return 'text-gray-400'
})

const actionClass = computed(() => {
  if (action.value === 'ban') return 'bg-ban-red'
  if (action.value === 'pick') return 'bg-pick-blue'
  return 'bg-gray-600'
})

const progressBarClass = computed(() => {
  if (action.value === 'ban') return 'bg-gradient-to-r from-red-500 to-red-600'
  if (action.value === 'pick') return 'bg-gradient-to-r from-blue-500 to-blue-600'
  return 'bg-gray-500'
})
</script>

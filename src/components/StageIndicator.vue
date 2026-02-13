<template>
  <div class="glass-panel rounded-xl p-4 min-w-[300px] shadow-[0_0_15px_rgba(0,0,0,0.3)] border-t border-white/10" role="region" aria-label="当前游戏阶段">
    <div class="text-center">
      <h3 class="text-sm font-bold mb-1 text-gray-400 uppercase tracking-widest">ROUND {{ roundNumber }}</h3>
      <div class="text-3xl font-black mb-4 tracking-wide" :class="stageClass">
        <span class="filter drop-shadow-md">{{ stageName }}</span>
      </div>

      <!-- 进度条 -->
      <div class="mb-4 relative">
        <div class="w-full bg-gray-800/50 rounded-full h-3 border border-gray-700" role="progressbar" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
          <div
            class="h-full rounded-full transition-all duration-500 relative overflow-hidden"
            :class="progressBarClass"
            :style="{ width: `${((step + 1) / totalSteps) * 100}%` }"
          >
            <!-- 进度条光效 -->
            <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
        <div class="flex justify-between items-center mt-1.5 px-1">
          <span class="text-[10px] text-gray-500">START</span>
          <span class="text-xs text-gray-300 font-mono font-bold">{{ step + 1 }} <span class="text-gray-600">/</span> {{ totalSteps }}</span>
          <span class="text-[10px] text-gray-500">END</span>
        </div>
      </div>

      <!-- 当前操作 -->
      <div class="mt-2">
        <div
          class="inline-flex items-center gap-3 px-6 py-2 rounded-lg text-lg font-bold shadow-lg transition-colors duration-300 border border-white/5"
          :class="actionClass"
        >
          <span class="inline-flex relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span>{{ currentPlayerName }}</span>
          <span class="opacity-80 text-sm uppercase bg-black/20 px-2 py-0.5 rounded">{{ actionText }}</span>
        </div>
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
    return store.player1.id || 'Blue'
  } else if (currentPlayer.value === 'player2') {
    return store.player2.id || 'Red'
  }
  return ''
})

const actionText = computed(() => {
  if (action.value === 'ban') return 'BANNING'
  if (action.value === 'pick') return 'PICKING'
  return ''
})

const stageClass = computed(() => {
  if (action.value === 'ban') return 'text-ban-red-neon text-shadow-glow'
  if (action.value === 'pick') return 'text-pick-blue-neon text-shadow-glow'
  return 'text-gray-400'
})

const actionClass = computed(() => {
  if (action.value === 'ban') return 'bg-ban-red hover:bg-ban-red-neon text-white'
  if (action.value === 'pick') return 'bg-pick-blue hover:bg-pick-blue-neon text-white'
  return 'bg-gray-600'
})

const progressBarClass = computed(() => {
  if (action.value === 'ban') return 'bg-gradient-to-r from-ban-red-dark to-ban-red-neon shadow-[0_0_10px_rgba(244,67,54,0.5)]'
  if (action.value === 'pick') return 'bg-gradient-to-r from-pick-blue-dark to-pick-blue-neon shadow-[0_0_10px_rgba(33,150,243,0.5)]'
  return 'bg-gray-500'
})
</script>

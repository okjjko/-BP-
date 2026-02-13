<template>
  <div
    class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-3 min-w-[140px] shadow-md border transition-all duration-300"
    :class="isCurrentPlayer ? 'ring-4 ring-plant-green shadow-lg border-plant-green' : 'border-gray-700'"
    role="region"
    :aria-label="`${playerName}，当前得分${score}分${isCurrentPlayer ? '，当前操作' : ''}`"
  >
    <div class="text-center mb-2">
      <h2 class="text-lg font-bold text-white truncate">
        {{ playerName }}
      </h2>
    </div>

    <div class="text-center">
      <div class="text-3xl font-bold mb-1" :class="isCurrentPlayer ? 'text-plant-green' : 'text-white'">
        {{ score }}
      </div>
      <div class="text-gray-400 text-xs">
        分
      </div>
    </div>

    <!-- BP开始时显示当前选手的路 -->
    <div v-if="shouldShowRoad" class="mt-2 text-center">
      <span
        class="inline-block px-3 py-1 rounded-full text-xs font-semibold shadow-sm"
        :class="playerRoad ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'"
      >
        {{ playerRoad || '未选' }}
      </span>
    </div>

    <!-- 当前操作指示器 -->
    <div v-if="isCurrentPlayer" class="mt-2 flex justify-center">
      <span class="flex items-center gap-1 text-xs text-plant-green font-semibold animate-pulse-slow" aria-hidden="true">
        <span class="w-2 h-2 rounded-full bg-plant-green"></span>
        操作中
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'

const props = defineProps({
  player: {
    type: String,
    required: true
  }
})

const store = useGameStore()

const playerName = computed(() => {
  return store[props.player]?.id || ''
})

const score = computed(() => {
  return store[props.player]?.score || 0
})

const playerRoad = computed(() => {
  const road = store[props.player]?.road
  return road ? `${road}路` : null
})

const isCurrentPlayer = computed(() => {
  return store.currentRound?.currentPlayer === props.player
})

const gameStatus = computed(() => store.gameStatus)

// 只在BP开始时显示道路
const shouldShowRoad = computed(() => {
  return gameStatus.value === 'banning'
})
</script>

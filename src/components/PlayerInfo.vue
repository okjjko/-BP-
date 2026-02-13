<template>
  <div class="flex items-center gap-4 bg-black/30 rounded-full pr-6 pl-2 py-2 border border-gray-700/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:bg-black/40 hover:border-gray-600">
    <!-- 头像/Road 图标 -->
    <div
      class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 shadow-inner proportional-nums tabular-nums relative overflow-hidden group"
      :class="isRoad2
        ? 'bg-gradient-to-br from-blue-900 to-blue-700 border-blue-400 text-blue-100 shadow-blue-900/50'
        : 'bg-gradient-to-br from-purple-900 to-purple-700 border-purple-400 text-purple-100 shadow-purple-900/50'"
    >
      <span class="relative z-10">{{ roadText }}</span>
      <div class="absolute inset-0 bg-white/20 blur opacity-0 group-hover:opacity-50 transition-opacity"></div>
    </div>

    <div class="flex flex-col">
      <!-- 名字 -->
      <span class="font-bold text-lg leading-tight tracking-wide text-white drop-shadow-md">
        {{ playerName }}
      </span>
      <!-- 分数 -->
      <div class="flex items-center gap-1 mt-0.5">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Score</div>
        <div class="flex">
          <span
            v-for="n in 5"
            :key="n"
            class="w-2 h-4 rounded-sm ml-0.5 transition-all duration-500"
            :class="n <= score
              ? (isRoad2 ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]' : 'bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.8)]')
              : 'bg-gray-700/50'"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../store/gameStore'

const props = defineProps({
  player: {
    type: String, // 'player1' or 'player2'
    required: true
  }
})

const store = useGameStore()

const playerName = computed(() => {
  return store[props.player]?.name || 'Player'
})

const score = computed(() => {
  return store[props.player]?.score || 0
})

const currentRoad = computed(() => {
  return store[props.player]?.road
})

const isRoad2 = computed(() => currentRoad.value === 2)

const roadText = computed(() => {
  return currentRoad.value ? `${currentRoad.value}路` : '?'
})
</script>

<template>
  <div class="flex items-center gap-4 bg-black/30 rounded-full pr-6 pl-2 py-2 border border-gray-700/50 backdrop-blur-sm shadow-sm transition-all duration-300 hover:bg-black/40 hover:border-gray-600">
    <!-- 头像/Road 图标 -->
    <div
      class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 shadow-inner proportional-nums tabular-nums relative overflow-hidden group"
      :class="isPlayer1
        ? 'bg-gradient-to-br from-pick-blue-dark to-pick-blue border-pick-blue text-white'
        : 'bg-gradient-to-br from-ban-red-dark to-ban-red border-ban-red text-white'"
    >
      <span class="relative z-10">{{ roadText }}</span>
      <div class="absolute inset-0 bg-white/20 blur opacity-0 group-hover:opacity-50 transition-opacity"></div>
    </div>

    <div class="flex flex-col">
      <!-- 名字 -->
      <span class="font-bold text-lg leading-tight tracking-wide text-white">
        {{ playerName }}
      </span>
      <!-- 分数 -->
      <div class="flex items-center gap-1 mt-0.5">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">得分</div>
        <div
          class="flex"
          role="img"
          :aria-label="`得分 ${score}，获胜需 ${store.winThreshold} 分`"
        >
          <span
            v-for="n in store.winThreshold + 1"
            :key="n"
            class="w-2 h-4 rounded-sm ml-0.5 transition-all duration-500"
            :class="n <= score
              ? (isPlayer1 ? 'bg-pick-blue' : 'bg-ban-red')
              : 'bg-gray-700/50'"
            aria-hidden="true"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const props = defineProps({
  player: {
    type: String, // 'player1' or 'player2'
    required: true
  }
})

const store = useGameStore()

const playerName = computed(() => {
  return store[props.player]?.name || '选手'
})

const score = computed(() => {
  return store[props.player]?.score || 0
})

const currentRoad = computed(() => {
  return store[props.player]?.road
})

// 配色正典：按选手槽位上色（player1=蓝方/player2=红方），道路仅作文字标签
const isPlayer1 = computed(() => props.player === 'player1')

const roadText = computed(() => {
  // 功能1：阵营显示名来自 ruleConfig.sideNames（默认「二路/四路」）
  return currentRoad.value ? store.sideName(currentRoad.value) : '?'
})
</script>

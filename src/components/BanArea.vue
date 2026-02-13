<template>
  <div class="glass-panel rounded-xl p-3 w-fit transition-all duration-300 hover:bg-white/5" role="region" :aria-label="`${playerName}禁用的植物`">
    <h3 class="text-sm font-bold mb-2 text-ban-red-neon flex items-center gap-2 uppercase tracking-wider">
      <span class="w-2 h-2 rounded-full bg-ban-red animate-pulse"></span>
      {{ playerName }} 禁用
    </h3>

    <!-- 本局禁用 -->
    <div>
      <div v-if="roundBans.length === 0" class="text-gray-500 text-xs italic py-2 text-center">
        等待禁用...
      </div>
      <div class="grid grid-cols-5 gap-1.5">
        <div
          v-for="plantId in roundBans"
          :key="plantId"
          class="relative group w-12 h-12"
        >
          <div class="absolute inset-0 bg-ban-red/20 rounded-lg transform rotate-3 group-hover:rotate-6 transition-transform"></div>
          <img
            :src="getPlantImage(plantId)"
            :alt="`禁用植物：${getPlantName(plantId)}`"
            class="w-full h-full object-cover rounded-lg border-2 border-ban-red/60 relative z-10 grayscale group-hover:grayscale-0 transition-all duration-300"
          />
          <div class="absolute inset-0 bg-black/60 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
            <span class="text-[10px] text-center px-1 text-white font-bold drop-shadow-md">{{ getPlantName(plantId) }}</span>
          </div>
          <!-- 禁用图标覆盖 -->
          <div class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-80 group-hover:opacity-0 transition-opacity">
            <svg class="w-8 h-8 text-ban-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a9 9 0 010 12.728m0 0l-2.829-2.829m-4.243 2.829a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-9.9a9 9 0 010-12.728m0 0l2.829 2.829m-4.243 2.829a9 9 0 0112.728 0" />
            </svg>
          </div>
        </div>
        <!-- 占位符：保持5个位置的宽度 -->
        <div
          v-for="i in (5 - roundBans.length)"
          :key="`placeholder-${i}`"
          class="w-12 h-12 border-2 border-dashed border-gray-700/50 rounded-lg flex items-center justify-center bg-black/20"
          aria-hidden="true"
        >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById } from '@/data/plants'

const props = defineProps({
  player: {
    type: String,
    required: true
  }
})

const store = useGameStore()

const playerName = computed(() => {
  return store[props.player]?.id || (props.player === 'player1' ? '甲' : '乙')
})

const roundBans = computed(() => {
  return store.currentRound?.bans?.[props.player] || []
})

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}
</script>

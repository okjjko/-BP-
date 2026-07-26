<template>
  <!-- 手机端紧凑行（md 以下）：横向滚动小图标，无 5 格占位符 -->
  <div
    class="md:hidden flex items-center gap-1.5 min-w-0 w-full"
    role="region"
    :aria-label="`${playerName}禁用的植物（${roundBans.length}）`"
  >
    <span class="text-[10px] font-bold text-ban-red-neon whitespace-nowrap flex-shrink-0">
      已禁({{ roundBans.length }})
    </span>
    <div class="flex items-center gap-1 overflow-x-auto min-w-0 custom-scrollbar py-0.5">
      <!-- 飞行终点锚点：零宽但可见（offsetParent 非空），始终存在以承接首次 ban 飞行 -->
      <span :data-ban-slot="player" class="inline-block w-0 h-6 flex-shrink-0 self-center" aria-hidden="true"></span>
      <span v-if="roundBans.length === 0" class="text-gray-600 text-[10px] italic whitespace-nowrap">等待禁用...</span>
      <div
        v-for="plantId in roundBans"
        :key="plantId"
        class="relative w-8 h-8 flex-shrink-0"
      >
        <img
          :src="getPlantImage(plantId)"
          :alt="`禁用植物：${getPlantName(plantId)}`"
          class="w-full h-full object-cover rounded border border-ban-red/60 grayscale"
        />
      </div>
    </div>
  </div>

  <!-- 桌面端完整版（md 以上，原样） -->
  <div class="hidden md:block glass-panel rounded-xl p-2 sm:p-3 w-fit transition-[background-color] duration-300 lg:hover:bg-white/5" role="region" :aria-label="`${playerName}禁用的植物`">
    <h3 class="text-sm font-bold mb-2 text-ban-red-neon flex items-center gap-2 uppercase tracking-wider">
      <span class="w-2 h-2 rounded-full bg-ban-red" aria-hidden="true"></span>
      {{ playerName }} 禁用
    </h3>

    <!-- 本局禁用 -->
    <div>
      <div v-if="roundBans.length === 0" class="text-gray-500 text-xs italic py-2 text-center">
        等待禁用...
      </div>
      <TransitionGroup name="ban" tag="div" class="relative grid grid-cols-5 gap-1 sm:gap-1.5">
        <div
          v-for="plantId in roundBans"
          :key="plantId"
          class="relative group w-10 h-10 sm:w-12 sm:h-12"
        >
          <div class="absolute inset-0 bg-ban-red/20 rounded-lg" aria-hidden="true"></div>
          <img
            :src="getPlantImage(plantId)"
            :alt="`禁用植物：${getPlantName(plantId)}`"
            class="w-full h-full object-cover rounded-lg border-2 border-ban-red/60 relative z-10 grayscale group-hover:grayscale-0 transition-all duration-300"
          />
          <div class="absolute inset-0 bg-black/60 z-20 flex items-center justify-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
            <span class="text-[10px] text-center px-1 text-white font-bold drop-shadow-md">{{ getPlantName(plantId) }}</span>
          </div>
          <!-- 禁用图标覆盖 -->
          <div class="absolute inset-0 z-20 flex items-center justify-center pointer-events-none opacity-0 lg:opacity-80 lg:group-hover:opacity-0 transition-opacity">
            <svg class="w-8 h-8 text-ban-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a9 9 0 010 12.728m0 0l-2.829-2.829m-4.243 2.829a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.828-9.9a9 9 0 010-12.728m0 0l2.829 2.829m-4.243 2.829a9 9 0 0112.728 0" />
            </svg>
          </div>
        </div>
        <!-- 占位符：保持5个位置的宽度；第一个占位符标 data-ban-slot 作为飞行终点 -->
        <div
          v-for="i in (5 - roundBans.length)"
          :key="`placeholder-${i}`"
          :data-ban-slot="i === 1 ? player : undefined"
          class="w-10 h-10 sm:w-12 sm:h-12 border-2 border-dashed border-gray-700/50 rounded-lg flex items-center justify-center bg-black/20"
          aria-hidden="true"
        >
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { getPlantImage, getPlantName } from '@/data/customPlants'

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
</script>

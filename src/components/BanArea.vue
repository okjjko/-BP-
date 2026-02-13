<template>
  <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-3 w-fit shadow-md border border-gray-700" role="region" :aria-label="`${playerName}禁用的植物`">
    <h3 class="text-sm font-bold mb-2 text-ban-red flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-ban-red"></span>
      {{ playerName }} 禁用
    </h3>

    <!-- 本局禁用 -->
    <div>
      <div class="text-xs text-gray-400 mb-1">本局禁用：</div>
      <div v-if="roundBans.length === 0" class="text-gray-500 text-xs">
        暂无
      </div>
      <div class="grid grid-cols-5 gap-1">
        <div
          v-for="plantId in roundBans"
          :key="plantId"
          class="relative group w-14"
        >
          <img
            :src="getPlantImage(plantId)"
            :alt="`禁用植物：${getPlantName(plantId)}`"
            class="w-full rounded border-2 border-ban-red opacity-75 shadow-sm transition-opacity group-hover:opacity-100"
          />
          <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded" role="tooltip">
            <span class="text-xs text-center px-1">{{ getPlantName(plantId) }}</span>
          </div>
        </div>
        <!-- 占位符：保持5个位置的宽度 -->
        <div
          v-for="i in (5 - roundBans.length)"
          :key="`placeholder-${i}`"
          class="w-14 border-2 border-dashed border-gray-600 rounded opacity-30 flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-gray-600 text-xs">空</span>
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

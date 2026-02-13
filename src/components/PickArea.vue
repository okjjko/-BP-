<template>
  <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-md border border-gray-700" role="region" :aria-label="`${playerName}选择的植物`">
    <h3 class="text-lg font-bold mb-3 text-pick-blue flex items-center gap-2">
      <span class="w-2 h-2 rounded-full bg-pick-blue"></span>
      {{ playerName }} 选择
    </h3>

    <div v-if="picks.length === 0" class="text-gray-500 text-sm py-4 text-center">
      暂无选择
    </div>

    <div class="space-y-2">
      <div
        v-for="(plantId, index) in picks"
        :key="plantId"
        class="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
      >
        <span class="text-gray-400 text-sm font-mono">#{{ index + 1 }}</span>
        <img
          :src="getPlantImage(plantId)"
          :alt="getPlantName(plantId)"
          class="w-12 h-12 rounded border-2 border-pick-blue shadow-sm"
        />
        <span class="flex-1 font-semibold">{{ getPlantName(plantId) }}</span>
      </div>
    </div>

    <!-- 使用次数提示 -->
    <div v-if="usageInfo.length > 0" class="mt-3 pt-3 border-t border-gray-700">
      <div class="text-sm text-gray-400 mb-2">已用次数：</div>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="info in usageInfo"
          :key="info.plantId"
          class="text-xs px-2 py-1 bg-gray-700 rounded border border-gray-600"
          :class="{
            'text-yellow-400 border-yellow-600': info.count === 1,
            'text-red-400 border-red-600': info.count >= 2
          }"
        >
          {{ info.name }}: {{ info.count }}/2
        </span>
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

const picks = computed(() => {
  return store.currentRound?.picks?.[props.player] || []
})

const usageInfo = computed(() => {
  const picks = store.currentRound?.picks?.[props.player] || []
  return picks.map(plantId => {
    const count = store.getPlantUsageCount(props.player, plantId)
    const plant = getPlantById(plantId)
    return {
      plantId,
      name: plant?.name || plantId,
      count
    }
  })
})

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}
</script>

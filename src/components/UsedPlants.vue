<template>
  <div class="bg-black/20 rounded-xl px-4 py-2 border border-white/5 backdrop-blur-sm" role="region" :aria-label="`${playerName}已使用植物列表`">
    <div class="flex items-center gap-2 mb-2">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="player === 'player1' ? 'bg-pick-blue' : 'bg-ban-red'"></span>
        {{ playerName }} HISTORY
      </h3>
    </div>

    <div v-if="usedPlants.length === 0" class="text-gray-600 text-xs px-1 italic">
      No plants used yet
    </div>

    <div v-else class="flex flex-wrap gap-1.5">
      <span
        v-for="item in usedPlants"
        :key="item.id"
        class="inline-flex items-center text-xs px-2 py-1 rounded border transition-all duration-200 cursor-help group"
        :class="{
          'bg-yellow-900/30 border-yellow-700/50 text-yellow-200 hover:bg-yellow-900/50': item.count === 1,
          'bg-red-900/30 border-red-700/50 text-red-200 hover:bg-red-900/50': item.count >= 2
        }"
        :title="`${getPlantName(item.id)}，已使用${item.count}/2次`"
      >
        <span class="font-medium">{{ getPlantName(item.id) }}</span>
        <span class="ml-1.5 text-[10px] px-1 rounded bg-black/30 font-bold" :class="item.count >= 2 ? 'text-red-400' : 'text-yellow-400'">{{ item.count }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById, PLANTS } from '@/data/plants'

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

// 获取该选手已使用过的植物及使用次数
const usedPlants = computed(() => {
  const plantUsage = store.plantUsage || {}
  const used = []

  // 遍历所有可能的植物
  for (const plant of PLANTS) {
    const key = `${props.player}_${plant.id}`
    const count = plantUsage[key] || 0
    if (count > 0) {
      used.push({
        id: plant.id,
        count: count
      })
    }
  }

  // 按使用次数降序排序，次数相同的按ID排序
  return used.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return a.id.localeCompare(b.id)
  })
})

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}
</script>

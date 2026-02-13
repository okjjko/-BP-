<template>
  <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl px-3 py-2 shadow-md border border-gray-700" role="region" :aria-label="`${playerName}已使用植物列表`">
    <div class="flex items-center gap-1 mb-1">
      <h3 class="text-xs font-bold text-yellow-500 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
        {{ playerName }}
      </h3>
      <span class="text-xs text-gray-400">已用：</span>
    </div>

    <div v-if="usedPlants.length === 0" class="text-gray-600 text-xs px-1">
      暂无
    </div>

    <div v-else class="flex flex-wrap gap-1">
      <span
        v-for="item in usedPlants"
        :key="item.id"
        class="inline-flex items-center text-xs px-1.5 py-0.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-help"
        :title="`${getPlantName(item.id)}，已使用${item.count}/2次`"
      >
        <span class="text-gray-300">{{ getPlantName(item.id) }}</span>
        <span class="text-yellow-400 font-semibold ml-0.5">×{{ item.count }}</span>
        <span v-if="item !== usedPlants[usedPlants.length - 1]" class="text-gray-600 mx-0.5">·</span>
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

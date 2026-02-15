<template>
  <div class="bg-black/20 rounded-xl px-4 py-2 border border-white/5 backdrop-blur-sm" role="region" :aria-label="`${playerName}已使用植物列表`">
    <div class="flex items-center mb-2">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="player === 'player1' ? 'bg-pick-blue' : 'bg-pick-red'"></span>
        {{ playerName }} 历史
      </h3>
    </div>

    <div v-if="usedPlants.length === 0" class="text-gray-600 text-xs px-1 italic">
      暂未使用植物
    </div>

    <div v-else class="flex flex-wrap gap-1.5">
      <span
        v-for="item in usedPlants"
        :key="item.id"
        class="inline-flex items-center text-xs px-2 py-1 rounded border transition-all duration-200 cursor-help group"
        :class="{
          'bg-yellow-900/30 border-yellow-700/50 text-yellow-200 hover:bg-yellow-900/50': item.count === 1 && !item.isHidden,
          'bg-red-900/30 border-red-700/50 text-red-200 hover:bg-red-900/50': item.count >= 2 && !item.isHidden,
          'bg-gray-700/30 border-gray-600/50 text-gray-400 line-through': item.isHidden
        }"
        :title="`${getPlantName(item.id)}${item.isHidden ? '（已隐藏）' : ''}，已使用${item.count}/2次`"
      >
        <span class="font-medium" :class="{ 'line-through': item.isHidden }">{{ getPlantName(item.id) }}</span>
        <span class="ml-1.5 text-[10px] px-1 rounded bg-black/30 font-bold" :class="item.isHidden ? 'text-gray-500' : (item.count >= 2 ? 'text-red-400' : 'text-yellow-400')">{{ item.count }}</span>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantByIdSync, getAllPlantsSync, getHiddenBuiltinPlants } from '@/data/customPlants'

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
  const pumpkinUsage = store.pumpkinUsage || {}
  const used = []

  // 遍历所有可能的植物（内置+自定义+已隐藏）
  const visiblePlants = getAllPlantsSync()
  const hiddenPlants = getHiddenBuiltinPlants()

  const allPlants = [
    ...visiblePlants,
    ...hiddenPlants
  ]

  // 用于去重的 Set（避免重复显示）
  const processedIds = new Set()

  for (const plant of allPlants) {
    // 南瓜头特殊处理：跳过隐藏列表中的南瓜头（避免重复）
    if (store.isPumpkinPlant(plant.id)) {
      if (hiddenPlants.includes(plant)) {
        continue // 跳过隐藏的南瓜头
      }
    }

    // 去重：如果已经处理过这个植物ID，跳过
    if (processedIds.has(plant.id)) {
      continue
    }
    processedIds.add(plant.id)

    let count = 0

    // 南瓜头特殊处理：使用 pumpkinUsage
    if (store.isPumpkinPlant(plant.id)) {
      count = pumpkinUsage[props.player] || 0
    } else {
      // 其他植物：使用 plantUsage
      const key = `${props.player}_${plant.id}`
      count = plantUsage[key] || 0
    }

    if (count > 0) {
      const isVisible = visiblePlants.find(p => p.id === plant.id)

      // 南瓜头特殊处理：即使被隐藏，也视为可见（不显示删除线）
      const isPumpkin = store.isPumpkinPlant(plant.id)
      const isActuallyHidden = !isVisible && !isPumpkin

      used.push({
        id: plant.id,
        count: count,
        isHidden: isActuallyHidden
      })
    }
  }

  // 按使用次数降序排序，已隐藏的排在最后
  return used.sort((a, b) => {
    if (a.isHidden !== b.isHidden) {
      return a.isHidden ? 1 : -1 // 未隐藏的在前
    }
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return a.id.localeCompare(b.id)
  })
})

const getPlantName = (id) => {
  const plant = getPlantByIdSync(id)
  if (!plant) {
    // 从已隐藏列表中查找
    const hiddenPlants = getHiddenBuiltinPlants()
    const hidden = hiddenPlants.find(p => p.id === id)

    // 南瓜头特殊处理：即使被隐藏，也不显示"（已隐藏）"后缀
    if (hidden && (hidden.id === 'pumpkin' || hidden.name === '南瓜头')) {
      return hidden.name
    }

    return hidden ? `${hidden.name}（已隐藏）` : '未知植物'
  }
  return plant.name
}
</script>

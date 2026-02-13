<template>
  <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 shadow-md border border-gray-700" :class="{ 'opacity-50': !hasBPPermission }">
    <h2 class="text-xl font-bold mb-3 text-center">
      <span v-if="isBan" class="text-ban-red">禁用植物</span>
      <span v-else class="text-pick-blue">选择植物</span>
    </h2>

    <!-- 确认按钮 -->
    <div class="mb-3 flex justify-center">
      <button
        @click="confirmSelection"
        @keydown.enter="confirmSelection"
        :disabled="!hasSelectedPlant || !hasBPPermission"
        :aria-label="`确认${isBan ? '禁用' : '选择'}${selectedPlantInfo?.name || '植物'}`"
        class="px-6 py-2 rounded-lg font-bold text-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
        :class="isBan ? 'bg-ban-red hover:bg-red-600' : 'bg-pick-blue hover:bg-blue-600'"
      >
        确认{{ isBan ? '禁用' : '选择' }}
      </button>
    </div>

    <!-- 当前选中植物详情 -->
    <div v-if="selectedPlantInfo" class="mb-3 bg-gray-700 rounded-lg p-3" role="region" :aria-label="`已选择：${selectedPlantInfo.name}`">
      <div class="flex gap-3">
        <img
          :src="selectedPlantInfo.image"
          :alt="selectedPlantInfo.name"
          class="w-24 h-24 rounded-lg border-3 flex-shrink-0"
          :class="isBan ? 'border-ban-red' : 'border-pick-blue'"
        />
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold mb-1 truncate">{{ selectedPlantInfo.name }}</h3>
          <p class="text-gray-300 text-sm mb-1 line-clamp-2">{{ selectedPlantInfo.description }}</p>
          <p class="text-xs text-gray-400">类型：{{ selectedPlantInfo.type }}</p>
          <p class="text-xs text-gray-400">使用次数：{{ usageCount }}/2</p>
        </div>
      </div>
    </div>

    <!-- 植物网格 -->
    <div
      class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 gap-2 max-h-[400px] overflow-y-auto pr-1.5 custom-scrollbar"
      role="listbox"
      :aria-label="isBan ? '选择要禁用的植物' : '选择要使用的植物'"
    >
      <button
        v-for="plant in availablePlants"
        :key="plant.id"
        @click="selectPlant(plant.id)"
        @keydown.enter="selectPlant(plant.id)"
        @keydown.space.prevent="selectPlant(plant.id)"
        :disabled="!canSelect(plant.id) || !hasBPPermission"
        :aria-label="`${plant.name}，${plant.description}${getUsageCount(plant.id) > 0 ? `，已使用${getUsageCount(plant.id)}次` : ''}`"
        :aria-selected="isSelected(plant.id)"
        :aria-disabled="!canSelect(plant.id) || !hasBPPermission"
        :tabindex="(canSelect(plant.id) && hasBPPermission) ? 0 : -1"
        class="relative cursor-pointer transition-all duration-200 hover:scale-105 focus-visible:scale-105 focus-visible:ring-3 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 rounded-lg aspect-square"
        :class="{
          'ring-3 ring-white': isSelected(plant.id),
          'opacity-50 cursor-not-allowed': !canSelect(plant.id) || !hasBPPermission
        }"
        role="option"
      >
        <img
          :src="plant.image"
          :alt="plant.name"
          class="w-full h-full rounded-lg border-2 pointer-events-none object-cover"
          :class="isBan ? 'border-gray-600' : 'border-gray-600'"
        />
        <div class="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center opacity-0 hover:opacity-100 transition rounded-lg pointer-events-none">
          <span class="text-xs text-center px-1 leading-tight">{{ plant.name }}</span>
        </div>
        <div v-if="getUsageCount(plant.id) > 0" class="absolute bottom-0 right-0 bg-yellow-500 text-black text-xs px-1 rounded-tl pointer-events-none" aria-hidden="true">
          {{ getUsageCount(plant.id) }}
        </div>
      </button>
    </div>

    <!-- 提示信息 -->
    <div class="mt-3 text-center text-gray-400 text-xs" role="status" aria-live="polite">
      <p v-if="isBan">点击植物选择禁用目标</p>
      <p v-else>点击植物进行选择（不能选择对方已选的植物）</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById } from '@/data/plants'
import { canBan, canPick } from '@/utils/validators'

const store = useGameStore()

// 本地工具始终允许进行BP操作
const hasBPPermission = computed(() => true)

const isBan = computed(() => store.currentRound?.action === 'ban')
const currentPlayer = computed(() => store.currentRound?.currentPlayer)

const availablePlants = computed(() => {
  return store.availablePlants || []
})

const selectedPlantInfo = computed(() => {
  const selectedId = store.currentRound?.selectedPlant
  return selectedId ? getPlantById(selectedId) : null
})

const isSelected = (plantId) => {
  return store.currentRound?.selectedPlant === plantId
}

const canSelect = (plantId) => {
  const gameState = store.$state
  const player = currentPlayer.value

  if (isBan.value) {
    const result = canBan(plantId, gameState)
    return result.valid
  } else {
    const result = canPick(plantId, player, gameState)
    return result.valid
  }
}

const getUsageCount = (plantId) => {
  const player = currentPlayer.value
  if (!player) return 0
  return store.getPlantUsageCount(player, plantId)
}

const usageCount = computed(() => {
  const selectedId = store.currentRound?.selectedPlant
  if (!selectedId) return 0
  return getUsageCount(selectedId)
})

const hasSelectedPlant = computed(() => {
  return !!store.currentRound?.selectedPlant
})

const selectPlant = (plantId) => {
  if (!canSelect(plantId)) {
    const gameState = store.$state
    const player = currentPlayer.value

    if (isBan.value) {
      const result = canBan(plantId, gameState)
      if (!result.valid) {
        alert(result.reason)
        return
      }
    } else {
      const result = canPick(plantId, player, gameState)
      if (!result.valid) {
        alert(result.reason)
        return
      }
    }
  }

  store.currentRound.selectedPlant = plantId
}

const confirmSelection = () => {
  if (!hasSelectedPlant.value) {
    alert('请先选择一个植物')
    return
  }
  store.confirmSelection()
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #6B7280;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #9CA3AF;
}
</style>

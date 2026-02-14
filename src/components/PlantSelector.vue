<template>
  <div class="glass-panel rounded-xl p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold flex items-center gap-2">
        <span v-if="isBan" class="text-ban-red-neon drop-shadow-[0_0_5px_rgba(255,23,68,0.5)]">🚫 禁用阶段</span>
        <span v-else class="text-pick-blue-neon drop-shadow-[0_0_5px_rgba(0,229,255,0.5)]">✅ 选择阶段</span>
      </h2>
      
      <!-- 确认按钮 -->
      <button
        @click="confirmSelection"
        @keydown.enter="confirmSelection"
        :disabled="!hasSelectedPlant || !hasBPPermission"
        class="px-8 py-2 rounded-lg font-bold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
        :class="isBan 
          ? 'bg-ban-red hover:bg-ban-red-neon text-white disabled:bg-gray-700 disabled:text-gray-500 hover:shadow-red-500/30' 
          : 'bg-pick-blue hover:bg-pick-blue-neon text-white disabled:bg-gray-700 disabled:text-gray-500 hover:shadow-blue-500/30'"
      >
        <span>确认{{ isBan ? '禁用' : '选择' }}</span>
        <span v-if="selectedPlantInfo" class="text-xs opacity-80 px-1 py-0.5 bg-black/20 rounded ml-1">{{ selectedPlantInfo.name }}</span>
      </button>
    </div>

    <!-- 植物网格 - 自适应填充剩余空间 -->
    <div
      class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-2 content-start"
      role="listbox"
    >
      <button
        v-for="plant in availablePlants"
        :key="plant.id"
        @click="selectPlant(plant.id)"
        :disabled="!canSelect(plant.id) || !hasBPPermission"
        class="relative group aspect-square transition-all duration-300 rounded-xl overflow-hidden"
        :class="{
          'ring-2 ring-white scale-105 z-10 shadow-[0_0_15px_rgba(255,255,255,0.3)]': isSelected(plant.id),
          'opacity-40 grayscale cursor-not-allowed': !canSelect(plant.id) || !hasBPPermission,
          'hover:scale-110 hover:z-10 hover:shadow-xl cursor-pointer': canSelect(plant.id) && hasBPPermission && !isSelected(plant.id)
        }"
      >
        <!-- 植物图片 -->
        <img
          :src="plant.image"
          :alt="plant.name"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        <!-- 边框装饰 -->
        <div class="absolute inset-0 border-2 rounded-xl pointer-events-none transition-colors duration-300"
          :class="isBan ? 'border-ban-red/30 group-hover:border-ban-red-neon' : 'border-pick-blue/30 group-hover:border-pick-blue-neon'"
        ></div>

        <!-- 悬停/选中时的遮罩信息 -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-1">
          <span class="text-[10px] text-center text-white font-bold truncate w-full shadow-black drop-shadow-md">{{ plant.name }}</span>
        </div>

        <!-- 使用次数标记 -->
        <div v-if="getUsageCount(plant.id) > 0" class="absolute top-1 right-1 bg-yellow-500/90 text-black text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm backdrop-blur-sm" aria-hidden="true">
          {{ getUsageCount(plant.id) }}
        </div>
      </button>
    </div>

    <!-- 选中预览/提示信息 -->
    <div class="mt-4 h-16 glass-card rounded-lg p-2 flex items-center justify-between px-4">
      <div v-if="selectedPlantInfo" class="flex items-center gap-3 animate-fade-in w-full">
         <img
          :src="selectedPlantInfo.image"
          class="w-12 h-12 rounded border border-gray-500/50"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-lg text-white">{{ selectedPlantInfo.name }}</h3>
            <span class="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{{ selectedPlantInfo.type }}</span>
          </div>
          <p class="text-sm text-gray-400 truncate">{{ selectedPlantInfo.description }}</p>
        </div>
        <div class="text-right text-xs text-gray-500">
          已使用: <span class="text-white font-bold">{{ usageCount }}/2</span>
        </div>
      </div>
      <div v-else class="w-full text-center text-gray-500 italic text-sm">
        {{ isBan ? '请选择一个要禁用的植物...' : '请选择一个要出战的植物...' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantByIdSync } from '@/data/customPlants'
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
  return selectedId ? getPlantByIdSync(selectedId) : null
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
        // Optional: toast notification here
        return
      }
    } else {
      const result = canPick(plantId, player, gameState)
      if (!result.valid) {
         // Optional: toast notification here
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

<template>
  <div class="glass-panel rounded-xl p-5 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold flex items-center gap-2">
        <component
          :is="isBan ? Ban : CheckCircle"
          :size="26"
          aria-hidden="true"
          :class="isBan ? 'text-ban-red' : 'text-pick-blue'"
        />
        <span :class="isBan ? 'text-ban-red' : 'text-pick-blue'">
          {{ isBan ? '禁用阶段' : '选择阶段' }}
        </span>
      </h2>
      
      <!-- 确认按钮 -->
      <BaseButton
        :variant="isBan ? 'danger' : 'blue'"
        size="lg"
        :disabled="!hasSelectedPlant || !hasBPPermission"
        @click="confirmSelection"
      >
        {{ turnText || (isBan ? '确认禁用' : '确认选择') }}
        <span v-if="selectedPlantInfo" class="ml-1 text-xs opacity-80 bg-black/20 px-1.5 py-0.5 rounded">{{ selectedPlantInfo.name }}</span>
      </BaseButton>
    </div>

    <!-- 植物网格 - 自适应填充剩余空间 -->
    <div
      class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-2 content-start"
      role="listbox"
      :aria-label="isBan ? '可禁用植物列表' : '可选植物列表'"
    >
      <button
        v-for="plant in availablePlants"
        :key="plant.id"
        role="option"
        :aria-selected="isSelected(plant.id) ? 'true' : 'false'"
        :aria-disabled="(!canSelect(plant.id) || !hasBPPermission) ? 'true' : 'false'"
        @click="selectPlant(plant.id)"
        class="relative group aspect-square transition-all duration-300 rounded-xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:ring-white"
        :class="{
          'ring-2 ring-white scale-105 z-10 shadow-lg': isSelected(plant.id),
          'opacity-40 grayscale cursor-not-allowed': !canSelect(plant.id) || !hasBPPermission,
          'hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer': canSelect(plant.id) && hasBPPermission && !isSelected(plant.id)
        }"
      >
        <!-- 植物图片 -->
        <img
          :src="getPlantImageUrl(plant)"
          :alt="plant.name"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <!-- 边框装饰 -->
        <div class="absolute inset-0 border-2 rounded-xl pointer-events-none transition-colors duration-300"
          :class="isBan ? 'border-ban-red/30 group-hover:border-ban-red' : 'border-pick-blue/30 group-hover:border-pick-blue'"
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
          :src="getPlantImageUrl(selectedPlantInfo)"
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
          已使用: <span class="text-white font-bold">{{ usageCount }}/{{ store.maxPlantUsage }}</span>
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
import { Ban, CheckCircle } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { getPlantByIdSync, getPlantImage } from '@/data/customPlants'
import { canBan, canPick } from '@/utils/validators'
import { useToast } from '@/composables/useToast'
import BaseButton from '@/components/ui/BaseButton.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const toast = useToast()

// BP 权限检查：观众只读，多人模式下检查回合制权限
const hasBPPermission = computed(() => {
  // 观众：不能操作
  if (connStore.isViewOnly) return false

  // 本地模式：可以操作
  if (connStore.roomMode === 'local') return true

  // 多人模式：检查是否为当前回合
  return connStore.isMyTurn
})

// 回合提示文本
const turnText = computed(() => {
  if (connStore.roomMode === 'local') return ''
  if (connStore.isMyTurn) return '确认' + (isBan.value ? '禁用' : '选择')
  return connStore.myTurnDescription
})

const isBan = computed(() => store.currentRound?.action === 'ban')
const currentPlayer = computed(() => store.currentRound?.currentPlayer)

const availablePlants = computed(() => {
  return store.availablePlants || []
})

// 处理植物图片显示（支持 Blob 和 URL）
const getPlantImageUrl = (plant) => {
  return getPlantImage(plant.id)
}

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

  // 南瓜头特殊处理：使用 pumpkinUsage
  if (store.isPumpkinPlant(plantId)) {
    return store.pumpkinUsage?.[player] || 0
  }

  // 其他植物：历史使用次数 + 当前小局已选次数
  const historicalUsage = store.getPlantUsageCount(player, plantId)
  const ownPicks = store.currentRound?.picks[player] || []
  const currentRoundUsage = ownPicks.filter(id => id === plantId).length

  return historicalUsage + currentRoundUsage
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
    toast.error('请先选择一个植物')
    return
  }
  store.confirmSelection()
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="player in ['player1', 'player2']"
      :key="player"
      class="glass-panel rounded-xl p-6 transition-all duration-300 hover:bg-white/5"
    >
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold flex items-center gap-2 text-white">
          <span class="w-2 h-8 rounded-full" :class="player === 'player1' ? 'bg-pick-blue-neon' : 'bg-ban-red-neon'"></span>
          {{ getPlayerName(player) }} 阵型
        </h2>
        <div class="px-3 py-1 rounded bg-black/30 border border-white/10 text-sm font-mono text-gray-300">
          道路: <span class="font-bold text-white">{{ getPlayerRoad(player) }}</span>
        </div>
      </div>

      <!-- 植物站位 -->
      <fieldset class="mb-6">
        <legend class="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">战场位置 (1-5)</legend>
        <div class="flex flex-wrap gap-4" role="list">
          <button
            v-for="index in 5"
            :key="index"
            @click="openPlantSelector(player, index)"
            @dragover="handleDragOver($event, player, index)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, player, index)"
            class="relative w-20 h-20 bg-gray-800/50 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all duration-200 group"
            :class="{
              'border-gray-600 hover:border-plant-green-neon hover:shadow-[0_0_15px_rgba(76,175,80,0.3)] hover:scale-105 active:scale-95': !dropTarget || dropTarget.player !== player || dropTarget.position !== index,
              'border-solid border-gray-500 bg-gray-800': getPlantAtPosition(player, index) && (!dropTarget || dropTarget.position !== index),
              'border-plant-green-neon shadow-[0_0_20px_rgba(76,175,80,0.6)] bg-plant-green/10 scale-105 dropzone-active': dropTarget && dropTarget.player === player && dropTarget.position === index,
            }"
          >
            <!-- 序号标记 -->
            <div class="absolute -top-2 -left-2 w-6 h-6 bg-gray-700 text-gray-300 rounded-full text-xs flex items-center justify-center font-bold border border-gray-500 z-10 group-hover:bg-plant-green group-hover:text-white transition-colors">
              {{ index }}
            </div>

            <template v-if="getPlantAtPosition(player, index)">
              <div class="w-full h-full p-1">
                <img
                  :src="getPlantImage(getPlantAtPosition(player, index))"
                  :alt="getPlantName(getPlantAtPosition(player, index))"
                  class="w-full h-full object-cover rounded-lg shadow-sm"
                />
              </div>
            </template>
            <template v-else>
              <span class="text-gray-600 text-2xl group-hover:text-plant-green-neon transition-colors">+</span>
            </template>

            <!-- 拖拽悬停提示层 -->
            <div
              v-if="dropTarget && dropTarget.player === player && dropTarget.position === index"
              class="absolute inset-0 bg-plant-green/20 rounded-xl border-2 border-plant-green-neon flex items-center justify-center pointer-events-none"
            >
              <span class="text-plant-green-neon font-bold text-lg">放置</span>
            </div>
          </button>
        </div>
      </fieldset>

      <!-- 当前已选植物列表 (备选池) -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/5">
        <div class="text-xs text-gray-400 mb-3 uppercase tracking-wider">可选植物</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="plantId in getPicks(player)"
            :key="plantId"
            draggable="true"
            @dragstart="handleDragStart($event, plantId, player)"
            @dragend="handleDragEnd"
            class="flex items-center gap-2 bg-gray-800/80 px-3 py-1.5 rounded-lg border text-sm cursor-grab active:cursor-grabbing transition-all duration-200"
            :class="{
              'border-gray-700 hover:border-gray-500': !isDragging || draggedPlantId !== plantId,
              'opacity-50 scale-95 border-plant-green-neon shadow-[0_0_15px_rgba(76,175,80,0.5)]': isDragging && draggedPlantId === plantId
            }"
          >
            <img
              :src="getPlantImage(plantId)"
              class="w-6 h-6 rounded border border-gray-600 pointer-events-none"
            />
            <span class="text-gray-300 font-medium pointer-events-none">{{ getPlantName(plantId) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 植物选择模态框 -->
    <transition name="fade">
      <div
        v-if="showPlantSelector"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        @click.self="closePlantSelector"
      >
        <div class="glass-card bg-gray-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-gray-700 animate-slide-up">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-2xl font-bold text-white flex items-center gap-2">
              <span class="text-plant-green-neon">配置</span> {{ selectingPosition }} 号位
            </h3>
            <button @click="closePlantSelector" class="text-gray-400 hover:text-white transition-colors">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="grid grid-cols-5 sm:grid-cols-6 gap-3 max-h-[400px] overflow-y-auto mb-6 custom-scrollbar pr-2">
            <button
              v-for="plantId in getPicks(selectingPlayer)"
              :key="plantId"
              @click="placePlant(plantId)"
              class="group relative flex flex-col items-center gap-2 p-2 rounded-xl border border-transparent hover:bg-gray-800 transition-all duration-200"
            >
              <div class="relative w-16 h-16 group-hover:scale-110 transition-transform duration-200">
                <img
                  :src="getPlantImage(plantId)"
                  class="w-full h-full object-cover rounded-lg border-2 border-gray-600 group-hover:border-plant-green-neon shadow-lg"
                />
              </div>
              <div class="text-xs font-bold text-gray-400 group-hover:text-white transition-colors text-center w-full truncate">{{ getPlantName(plantId) }}</div>
            </button>
          </div>
          
          <div class="flex gap-4 border-t border-gray-700 pt-6">
            <button
              @click="clearPosition"
              class="flex-1 py-3 bg-red-900/50 text-red-200 hover:bg-red-800 rounded-lg font-bold border border-red-800 hover:border-red-600 transition-colors"
            >
              🗑️ 清空该位
            </button>
            <button
              @click="closePlantSelector"
              class="flex-1 py-3 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg font-bold transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById } from '@/data/plants'

const store = useGameStore()

const showPlantSelector = ref(false)
const selectingPlayer = ref(null)
const selectingPosition = ref(null)

// 拖拽状态管理
const draggedPlantId = ref(null)        // 当前拖拽的植物ID
const draggedFromPlayer = ref(null)      // 拖拽源所属玩家
const dropTarget = ref(null)             // 当前悬停的目标位置 { player, position }
const isDragging = ref(false)            // 是否正在拖拽

const getPlayerName = (player) => {
  return store[player]?.id || (player === 'player1' ? '甲' : '乙')
}

const getPlayerRoad = (player) => {
  const road = store[player]?.road
  return road ? `${road}路` : '未选路'
}

const getPicks = (player) => {
  return store.currentRound?.picks?.[player] || []
}

const getPlantAtPosition = (player, position) => {
  const plants = store.currentRound?.positions?.[player]?.plants || []
  return plants[position - 1] || null
}

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}

const openPlantSelector = (player, position) => {
  selectingPlayer.value = player
  selectingPosition.value = position
  showPlantSelector.value = true
}

const closePlantSelector = () => {
  showPlantSelector.value = false
  selectingPlayer.value = null
  selectingPosition.value = null
}

const placePlant = (plantId) => {
  const player = selectingPlayer.value
  const position = selectingPosition.value

  if (!store.currentRound.positions[player].plants) {
    store.currentRound.positions[player].plants = []
  }

  // 检查该植物是否已经放置在其他位置
  const plants = store.currentRound.positions[player].plants
  const existingIndex = plants.indexOf(plantId)

  if (existingIndex !== -1) {
    // 已存在，先移除
    plants[existingIndex] = null
  }

  // 放置到新位置
  plants[position - 1] = plantId

  closePlantSelector()
  store.saveToLocalStorage()
}

const clearPosition = () => {
  const player = selectingPlayer.value
  const position = selectingPosition.value

  if (store.currentRound.positions[player].plants) {
    store.currentRound.positions[player].plants[position - 1] = null
  }

  closePlantSelector()
  store.saveToLocalStorage()
}

// ========== 拖拽事件处理函数 ==========

// 开始拖拽
const handleDragStart = (event, plantId, player) => {
  draggedPlantId.value = plantId
  draggedFromPlayer.value = player
  isDragging.value = true
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', plantId)
}

// 拖拽结束清理
const handleDragEnd = () => {
  draggedPlantId.value = null
  draggedFromPlayer.value = null
  dropTarget.value = null
  isDragging.value = false
}

// 拖拽悬停
const handleDragOver = (event, player, position) => {
  event.preventDefault()
  if (canDropAt(player, position)) {
    dropTarget.value = { player, position }
    event.dataTransfer.dropEffect = 'copy'
  }
}

// 离开目标
const handleDragLeave = () => {
  dropTarget.value = null
}

// 放置植物
const handleDrop = (event, targetPlayer, targetPosition) => {
  event.preventDefault()
  const plantId = draggedPlantId.value
  if (!plantId || !canDropAt(targetPlayer, targetPosition)) {
    handleDragEnd()
    return
  }

  // 执行放置逻辑（复用现有逻辑）
  const player = targetPlayer
  const position = targetPosition

  if (!store.currentRound.positions[player].plants) {
    store.currentRound.positions[player].plants = []
  }

  const plants = store.currentRound.positions[player].plants
  const existingIndex = plants.indexOf(plantId)

  if (existingIndex !== -1) {
    plants[existingIndex] = null
  }

  plants[position - 1] = plantId

  store.saveToLocalStorage()
  handleDragEnd()
}

// 验证是否可放置
const canDropAt = (player, position) => {
  // 只能在同一玩家区域内拖拽
  if (draggedFromPlayer.value !== player) return false

  // 验证植物是否在可选列表中
  const plantId = draggedPlantId.value
  const picks = store.currentRound?.picks?.[player] || []
  if (!picks.includes(plantId)) return false

  return true
}
</script>

<style scoped>
/* 拖拽时的全局样式 */
:deep([draggable="true"]) {
  -webkit-user-drag: element;
  user-select: none;
  cursor: grab;
}

:deep([draggable="true"]:active) {
  cursor: grabbing;
}

/* 放置目标高亮动画 */
@keyframes pulse-dropzone {
  0%, 100% {
    box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
  }
  50% {
    box-shadow: 0 0 25px rgba(76, 175, 80, 0.6);
  }
}

.dropzone-active {
  animation: pulse-dropzone 1.5s infinite;
}
</style>

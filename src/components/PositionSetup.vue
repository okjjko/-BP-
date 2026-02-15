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
            @dragstart="handleDragStartFromPosition($event, player, index)"
            @dragover="handleDragOver($event, player, index)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, player, index)"
            :draggable="getPlantAtPosition(player, index) !== null"
            class="relative w-20 h-20 bg-gray-800/50 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all duration-200 group"
            :class="{
              'border-gray-600 hover:border-plant-green-neon hover:shadow-[0_0_15px_rgba(76,175,80,0.3)] hover:scale-105 active:scale-95': !dropTarget || dropTarget.player !== player || dropTarget.position !== index,
              'border-solid border-gray-500 bg-gray-800': getPlantAtPosition(player, index) && (!dropTarget || dropTarget.position !== index),
              'border-plant-green-neon shadow-[0_0_20px_rgba(76,175,80,0.6)] bg-plant-green/10 scale-105 dropzone-active': dropTarget && dropTarget.player === player && dropTarget.position === index,
              'dragging-from': store.dragState?.draggedFromType === 'battlefield' &&
                              store.dragState?.draggedFromPlayer === player &&
                              store.dragState?.draggedFromPosition === index
            }"
          >
            <!-- 序号标记 -->
            <div class="absolute -top-2 -left-2 w-6 h-6 bg-gray-700 text-gray-300 rounded-full text-xs flex items-center justify-center font-bold border border-gray-500 z-10 group-hover:bg-plant-green group-hover:text-white transition-colors">
              {{ index }}
            </div>

            <template v-if="getPlantAtPosition(player, index)">
              <div class="w-full h-full p-1">
                <img
                  :src="getPlantImage(getPlantAtPosition(player, index).plantId)"
                  :alt="getPlantName(getPlantAtPosition(player, index).plantId)"
                  class="w-full h-full object-cover rounded-lg shadow-sm"
                />
                <!-- 显示实例序号 -->
                <div class="absolute -bottom-1 -right-1 bg-black/60 text-white text-[8px] px-1 rounded">
                  #{{ getPlantAtPosition(player, index).sourceIndex + 1 }}
                </div>
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
            v-for="(plantId, index) in getPicks(player)"
            :key="`${player}-${plantId}-${index}`"
            draggable="true"
            @dragstart="handleDragStart($event, plantId, player, index)"
            @dragend="handleDragEnd"
            class="flex items-center gap-2 bg-gray-800/80 px-3 py-1.5 rounded-lg border text-sm cursor-grab active:cursor-grabbing transition-all duration-200"
            :class="{
              'border-gray-700 hover:border-gray-500': !store.dragState?.isDragging || store.dragState?.draggedPlantId !== plantId,
              'opacity-50 scale-95 border-plant-green-neon shadow-[0_0_15px_rgba(76,175,80,0.5)]': store.dragState?.isDragging && store.dragState?.draggedPlantId === plantId
            }"
          >
            <img
              :src="getPlantImage(plantId)"
              class="w-6 h-6 rounded border border-gray-600 pointer-events-none"
            />
            <span class="text-gray-300 font-medium pointer-events-none">
              {{ getPlantName(plantId) }}
              <!-- 如果有重复，显示序号 -->
              <span v-if="countPlantOccurrences(player, plantId) > 1" class="text-xs text-gray-500">
                (#{{ index + 1 }})
              </span>
            </span>
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
              v-for="(plantId, index) in getPicks(selectingPlayer)"
              :key="`${selectingPlayer}-${plantId}-${index}`"
              @click="placePlant(plantId, index)"
              class="group relative flex flex-col items-center gap-2 p-2 rounded-xl border border-transparent hover:bg-gray-800 transition-all duration-200"
            >
              <div class="relative w-16 h-16 group-hover:scale-110 transition-transform duration-200">
                <img
                  :src="getPlantImage(plantId)"
                  class="w-full h-full object-cover rounded-lg border-2 shadow-lg"
                  :class="{
                    'border-gray-600': !isPlantUsed(selectingPlayer, plantId, index),
                    'border-green-500': isPlantUsed(selectingPlayer, plantId, index)
                  }"
                />
                <!-- 如果重复，显示序号 -->
                <div v-if="countPlantOccurrences(selectingPlayer, plantId) > 1"
                     class="absolute -top-1 -left-1 bg-plant-green text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                  {{ index + 1 }}
                </div>
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
import { getPlantImage, getPlantName } from '@/data/customPlants'

const store = useGameStore()

const showPlantSelector = ref(false)
const selectingPlayer = ref(null)
const selectingPosition = ref(null)

// 拖拽状态管理
// 注意：draggedPlantId, draggedFromPlayer, isDragging 已改用 store.dragState
const dropTarget = ref(null)             // 当前悬停的目标位置 { player, position }

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
  const plant = plants[position - 1]

  // 向后兼容：如果是字符串，转换为新格式
  if (typeof plant === 'string') {
    return { plantId: plant, instanceId: null, sourceIndex: -1 }
  }

  return plant || null
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

const placePlant = (plantId, sourceIndex = null) => {
  const player = selectingPlayer.value
  const position = selectingPosition.value

  if (!store.currentRound.positions[player].plants) {
    store.currentRound.positions[player].plants = []
  }

  const plants = store.currentRound.positions[player].plants

  // 如果未指定sourceIndex，自动选择第一个可用的
  let finalSourceIndex = sourceIndex
  if (finalSourceIndex === null) {
    const availableInstances = store.getAvailablePlantInstances(player, plantId)
    if (availableInstances.length === 0) {
      alert('该植物的所有实例都已布置')
      return
    }
    finalSourceIndex = availableInstances[0].sourceIndex
  }

  // 查找是否已存在该sourceIndex的实例
  const existingIndex = plants.findIndex(p =>
    p && p.plantId === plantId && p.sourceIndex === finalSourceIndex
  )

  if (existingIndex !== -1) {
    plants[existingIndex] = null
  }

  // 放置到新位置
  plants[position - 1] = {
    plantId: plantId,
    instanceId: store.generatePlantInstanceId(player, plantId, finalSourceIndex),
    sourceIndex: finalSourceIndex
  }

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

// 辅助函数：统计植物出现次数
const countPlantOccurrences = (player, plantId) => {
  return getPicks(player).filter(id => id === plantId).length
}

// 辅助函数：检查特定实例是否已使用
const isPlantUsed = (player, plantId, sourceIndex) => {
  const plants = store.currentRound?.positions?.[player]?.plants || []
  return plants.some(p => p && p.plantId === plantId && p.sourceIndex === sourceIndex)
}

// ========== 拖拽事件处理函数 ==========

// 从战场位置开始拖拽
const handleDragStartFromPosition = (event, player, position) => {
  const plant = getPlantAtPosition(player, position)
  if (!plant) return

  // 更新全局拖拽状态
  store.setDragState({
    isDragging: true,
    draggedPlantId: plant.plantId,
    draggedFromPlayer: player,
    draggedFromType: 'battlefield',
    draggedFromPosition: position,
    draggedSourceIndex: plant.sourceIndex
  })

  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', JSON.stringify({
    plantId: plant.plantId,
    sourceIndex: plant.sourceIndex,
    source: 'battlefield',
    player,
    position
  }))
}

// 从可选列表开始拖拽
const handleDragStart = (event, plantId, player, sourceIndex = null) => {
  // 更新全局拖拽状态
  store.setDragState({
    isDragging: true,
    draggedPlantId: plantId,
    draggedFromPlayer: player,
    draggedFromType: 'availableList',
    draggedFromPosition: null,
    draggedSourceIndex: sourceIndex
  })

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', JSON.stringify({
    plantId,
    sourceIndex,
    source: 'availableList',
    player
  }))
}

// 拖拽结束清理
const handleDragEnd = () => {
  store.clearDragState()
  dropTarget.value = null
}

// 拖拽悬停
const handleDragOver = (event, player, position) => {
  event.preventDefault()

  const dragState = store.dragState
  if (!dragState?.isDragging) return

  if (canDropAt(player, position, dragState)) {
    dropTarget.value = { player, position }
    event.dataTransfer.dropEffect = dragState.draggedFromType === 'battlefield'
      ? 'move'
      : 'copy'
  }
}

// 离开目标
const handleDragLeave = () => {
  dropTarget.value = null
}

// 放置植物
const handleDrop = (event, targetPlayer, targetPosition) => {
  event.preventDefault()

  const dragState = store.dragState
  if (!dragState?.isDragging || !canDropAt(targetPlayer, targetPosition, dragState)) {
    store.clearDragState()
    dropTarget.value = null
    return
  }

  const plantId = dragState.draggedPlantId
  const sourceIndex = dragState.draggedSourceIndex

  // 根据拖拽源类型执行不同逻辑
  if (dragState.draggedFromType === 'battlefield') {
    // 战场位置间移动
    movePlantBetweenPositions(
      dragState.draggedFromPlayer,
      dragState.draggedFromPosition,
      targetPlayer,
      targetPosition
    )
  } else {
    // 从 PickArea 或可选列表复制
    placePlantToPosition(targetPlayer, targetPosition, plantId, sourceIndex)
  }

  store.saveToLocalStorage()
  store.clearDragState()
  dropTarget.value = null
}

// 战场位置间移动植物
const movePlantBetweenPositions = (fromPlayer, fromPosition, toPlayer, toPosition) => {
  const plants = store.currentRound.positions[fromPlayer].plants

  // 移除原位置（保存整个对象）
  const plantInstance = plants[fromPosition - 1]
  plants[fromPosition - 1] = null

  // 放置到新位置
  plants[toPosition - 1] = plantInstance
}

// 从 PickArea/可选列表放置植物
const placePlantToPosition = (player, position, plantId, sourceIndex = null) => {
  if (!store.currentRound.positions[player].plants) {
    store.currentRound.positions[player].plants = []
  }

  const plants = store.currentRound.positions[player].plants

  // 如果未指定sourceIndex，自动选择
  let finalSourceIndex = sourceIndex
  if (finalSourceIndex === null) {
    const availableInstances = store.getAvailablePlantInstances(player, plantId)
    if (availableInstances.length === 0) return
    finalSourceIndex = availableInstances[0].sourceIndex
  }

  // 移除相同sourceIndex的旧位置
  const existingIndex = plants.findIndex(p =>
    p && p.plantId === plantId && p.sourceIndex === finalSourceIndex
  )

  if (existingIndex !== -1) {
    plants[existingIndex] = null
  }

  // 放置到新位置
  plants[position - 1] = {
    plantId: plantId,
    instanceId: store.generatePlantInstanceId(player, plantId, finalSourceIndex),
    sourceIndex: finalSourceIndex
  }
}

// 验证是否可放置
const canDropAt = (targetPlayer, targetPosition, dragState) => {
  // 1. 只能在同一玩家区域内拖拽
  if (dragState.draggedFromPlayer !== targetPlayer) return false

  // 2. 植物必须在该玩家的 picks 列表中
  const plantId = dragState.draggedPlantId
  const picks = store.currentRound?.picks?.[targetPlayer] || []
  if (!picks.includes(plantId)) return false

  // 3. 战场位置间拖拽时，不能拖到同一位置
  if (dragState.draggedFromType === 'battlefield' &&
      dragState.draggedFromPosition === targetPosition) {
    return false
  }

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

/* 正在被拖拽出的战场位置（源位置） */
.dragging-from {
  opacity: 0.3;
  border-style: dashed !important;
  border-color: #FFA726 !important;
  transform: scale(0.95);
  animation: pulse-source 1s infinite;
}

@keyframes pulse-source {
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 167, 38, 0.3);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 167, 38, 0.6);
  }
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

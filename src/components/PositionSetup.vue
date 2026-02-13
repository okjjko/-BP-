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
          ROAD: <span class="font-bold text-white">{{ getPlayerRoad(player) }}</span>
        </div>
      </div>

      <!-- 植物站位 -->
      <fieldset class="mb-6">
        <legend class="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Battlefield Positions (1-5)</legend>
        <div class="flex flex-wrap gap-4" role="list">
          <button
            v-for="index in 5"
            :key="index"
            @click="openPlantSelector(player, index)"
            class="relative w-20 h-20 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer transition-all duration-200 group hover:border-plant-green-neon hover:shadow-[0_0_15px_rgba(76,175,80,0.3)] hover:scale-105 active:scale-95"
            :class="{
              'border-solid border-gray-500 bg-gray-800': getPlantAtPosition(player, index),
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
          </button>
        </div>
      </fieldset>

      <!-- 当前已选植物列表 (备选池) -->
      <div class="bg-black/20 rounded-lg p-4 border border-white/5">
        <div class="text-xs text-gray-400 mb-3 uppercase tracking-wider">Available Plants</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="plantId in getPicks(player)"
            :key="plantId"
            class="flex items-center gap-2 bg-gray-800/80 px-3 py-1.5 rounded-lg border border-gray-700 text-sm hover:border-gray-500 transition-colors"
          >
            <img
              :src="getPlantImage(plantId)"
              class="w-6 h-6 rounded border border-gray-600"
            />
            <span class="text-gray-300 font-medium">{{ getPlantName(plantId) }}</span>
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
</script>

<template>
  <div class="space-y-6">
    <div
      v-for="player in ['player1', 'player2']"
      :key="player"
      class="bg-gray-800 rounded-xl p-6"
    >
      <h2 class="text-xl font-bold mb-2 text-center">
        {{ getPlayerName(player) }} 站位设置
      </h2>
      <p class="text-sm text-center text-blue-400 mb-4">
        当前道路：{{ getPlayerRoad(player) }}
      </p>

      <!-- 植物站位 -->
      <fieldset class="mb-4">
        <legend class="block text-sm font-semibold mb-2">植物站位（1-5号位）：</legend>
        <div class="flex flex-wrap gap-2" role="list" :aria-label="`${getPlayerName(player)}的植物站位`">
          <button
            v-for="index in 5"
            :key="index"
            @click="openPlantSelector(player, index)"
            :disabled="!true"
            :aria-label="`位置${index}：${getPlantAtPosition(player, index) ? getPlantName(getPlantAtPosition(player, index)) : '未设置'}，点击设置植物`"
            class="relative w-16 h-16 bg-gray-700 rounded-lg border-2 border-gray-600 flex items-center justify-center cursor-pointer hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
            :class="{
              'border-gray-500 hover:border-gray-500': true,
              'border-gray-600': !true
            }"
            role="listitem"
          >
            <template v-if="getPlantAtPosition(player, index)">
              <img
                :src="getPlantImage(getPlantAtPosition(player, index))"
                :alt="getPlantName(getPlantAtPosition(player, index))"
                class="w-full h-full rounded"
              />
            </template>
            <template v-else>
              <span class="text-gray-400 text-sm">#{{ index }}</span>
            </template>
            <div class="absolute -top-2 -right-2 w-6 h-6 bg-plant-green rounded-full text-white text-xs flex items-center justify-center font-bold" aria-hidden="true">
              {{ index }}
            </div>
          </button>
        </div>
      </fieldset>

      <!-- 当前已选植物列表 -->
      <div class="bg-gray-700 rounded-lg p-3" role="region" :aria-label="`${getPlayerName(player)}已选植物`">
        <div class="text-sm text-gray-400 mb-2">已选植物：</div>
        <div class="flex flex-wrap gap-2" role="list">
          <div
            v-for="plantId in getPicks(player)"
            :key="plantId"
            class="flex items-center gap-1 bg-gray-600 px-2 py-1 rounded text-sm"
            role="listitem"
          >
            <img
              :src="getPlantImage(plantId)"
              :alt="getPlantName(plantId)"
              class="w-6 h-6 rounded"
            />
            <span>{{ getPlantName(plantId) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 植物选择模态框 -->
    <div
      v-if="showPlantSelector"
      class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`plant-selector-title-${selectingPosition}`"
    >
      <div class="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4">
        <h3 :id="`plant-selector-title-${selectingPosition}`" class="text-xl font-bold mb-4">
          选择植物放入 {{ selectingPosition }} 号位
        </h3>
        <div
          class="grid grid-cols-6 gap-2 max-h-[400px] overflow-y-auto mb-4"
          role="listbox"
          :aria-label="`选择植物放入${selectingPosition}号位`"
        >
          <button
            v-for="plantId in getPicks(selectingPlayer)"
            :key="plantId"
            @click="placePlant(plantId)"
            :disabled="!true"
            :aria-label="`选择${getPlantName(plantId)}放入${selectingPosition}号位`"
            class="cursor-pointer hover:scale-105 transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            role="option"
          >
            <img
              :src="getPlantImage(plantId)"
              :alt="getPlantName(plantId)"
              class="w-full rounded"
            />
            <div class="text-xs text-center mt-1">{{ getPlantName(plantId) }}</div>
          </button>
        </div>
        <div class="flex gap-3">
          <button
            @click="clearPosition"
            :disabled="!true"
            :aria-label="`清空${selectingPosition}号位`"
            class="flex-1 py-2 bg-ban-red hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-bold transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            清空该位
          </button>
          <button
            @click="closePlantSelector"
            class="flex-1 py-2 bg-gray-600 hover:bg-gray-500 rounded font-bold transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          >
            取消
          </button>
        </div>
      </div>
    </div>
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

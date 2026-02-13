<template>
  <div id="app" class="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-purple-900">
    <!-- 角色选择器 - 始终可见 -->
    <RoleSelector @role-changed="(role) => store.setRole(role)" />

    <!-- 游戏设置界面 -->
    <GameSetup v-if="gameStatus === 'setup'" />

    <!-- BP主界面 -->
    <div v-else class="container mx-auto px-4 py-4 max-w-7xl">
      <!-- 顶部：选手信息 + 阶段指示器（单行紧凑） -->
      <div class="flex items-center justify-center gap-3 mb-3">
        <div class="flex items-center gap-2">
          <PlayerInfo player="player1" />
          <BanArea player="player1" />
        </div>
        <StageIndicator />
        <div class="flex items-center gap-2">
          <BanArea player="player2" />
          <PlayerInfo player="player2" />
        </div>
      </div>

      <!-- 永久禁用区域 + 已使用植物（更紧凑） -->
      <div v-if="gameStatus === 'banning' || gameStatus === 'positioning'" class="flex items-center justify-center gap-3 mb-4">
        <UsedPlants player="player1" />

        <!-- 本局永久禁用植物 -->
        <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg px-3 py-1.5 shadow-md border border-gray-700 flex-shrink-0">
          <h3 class="text-xs font-bold mb-1.5 text-center text-ban-red flex items-center justify-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-ban-red"></span>
            永久禁用
          </h3>
          <div class="flex justify-center gap-1.5">
            <div
              v-for="plantId in globalBans"
              :key="plantId"
              class="relative group w-12 flex-shrink-0"
            >
              <img
                :src="getPlantImage(plantId)"
                :alt="`永久禁用植物：${getPlantName(plantId)}`"
                class="w-full rounded border border-ban-red opacity-50"
              />
              <div class="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded" role="tooltip">
                <span class="text-xs text-center px-1">{{ getPlantName(plantId) }}</span>
              </div>
            </div>
          </div>
        </div>

        <UsedPlants player="player2" />
      </div>

      <!-- 主体区域：更紧凑的三列布局 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <!-- 左侧选择区域 -->
        <div class="lg:col-span-3">
          <PickArea player="player1" />
        </div>

        <!-- 中间操作区域 -->
        <div class="lg:col-span-6">
          <PlantSelector v-if="gameStatus === 'banning'" />
          <PositionSetup v-if="gameStatus === 'positioning'" />
        </div>

        <!-- 右侧选择区域 -->
        <div class="lg:col-span-3">
          <PickArea player="player2" />
        </div>
      </div>

      <!-- 底部控制按钮 -->
      <div class="mt-4 flex justify-center gap-3">
        <button
          v-if="gameStatus === 'positioning'"
          @click="finishRound"
          class="px-8 py-2.5 bg-plant-green hover:bg-green-600 rounded-lg font-bold text-base transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          完成本小分
        </button>

        <button
          @click="resetGame"
          class="px-8 py-2.5 bg-ban-red hover:bg-red-600 rounded-lg font-bold text-base transition focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          重置游戏
        </button>
      </div>
    </div>

    <!-- 小分结算界面 -->
    <RoundResult v-if="gameStatus === 'result'" />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useGameStore } from './store/gameStore'
import { getPlantById } from './data/plants'
import GameSetup from './components/GameSetup.vue'
import PlayerInfo from './components/PlayerInfo.vue'
import StageIndicator from './components/StageIndicator.vue'
import BanArea from './components/BanArea.vue'
import PickArea from './components/PickArea.vue'
import UsedPlants from './components/UsedPlants.vue'
import PlantSelector from './components/PlantSelector.vue'
import PositionSetup from './components/PositionSetup.vue'
import RoundResult from './components/RoundResult.vue'

const store = useGameStore()

// 页面加载时尝试从localStorage恢复进度
onMounted(() => {
  store.loadFromLocalStorage()
})

const gameStatus = computed(() => store.gameStatus)
const globalBans = computed(() => store.globalBans)

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}

const finishRound = () => {
  store.finishRound()
}

const resetGame = () => {
  if (confirm('确定要重置游戏吗？所有进度将丢失。')) {
    store.resetGame()
  }
}
</script>

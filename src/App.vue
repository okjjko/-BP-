<template>
  <div id="app" class="min-h-screen text-gray-100 overflow-x-hidden selection:bg-plant-green selection:text-white">
    <!-- 背景动画元素 -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px] animate-float"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-900/20 rounded-full blur-[100px] animate-float" style="animation-delay: -1.5s;"></div>
    </div>

    <div class="relative z-10 min-h-screen flex flex-col">
      <!-- 顶部通知/状态栏 (可选) -->
      
      <!-- 游戏设置界面 -->
      <transition name="fade" mode="out-in">
        <GameSetup v-if="gameStatus === 'setup'" />
        
        <!-- BP主界面 -->
        <div v-else class="container mx-auto px-4 py-6 max-w-[1600px] flex-1 flex flex-col">
          <!-- 头部：信息概览 -->
          <div class="glass-panel rounded-2xl p-4 mb-6 animate-slide-up">
            <div class="flex flex-col md:flex-row items-center justify-between gap-4">
              <!-- 选手1区域 -->
              <div class="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
                <PlayerInfo player="player1" />
                <BanArea player="player1" />
              </div>

              <!-- 中央阶段指示器 -->
              <div class="flex-shrink-0">
                <StageIndicator />
              </div>

              <!-- 选手2区域 -->
              <div class="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
                <BanArea player="player2" />
                <PlayerInfo player="player2" />
              </div>
            </div>
          </div>

          <!-- 全局状态栏：永久禁用 + 已使用植物 -->
          <transition name="fade">
            <div v-if="gameStatus === 'banning' || gameStatus === 'positioning'" class="glass-panel rounded-xl p-3 mb-6 flex flex-wrap items-center justify-center gap-6 animate-slide-up" style="animation-delay: 0.1s;">
              <UsedPlants player="player1" />

              <!-- 本局永久禁用植物 -->
              <div class="bg-black/40 rounded-lg px-4 py-2 border border-ban-red/30 shadow-[0_0_15px_rgba(244,67,54,0.1)]">
                <h3 class="text-xs font-bold mb-2 text-center text-ban-red-neon uppercase tracking-wider flex items-center justify-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-ban-red animate-pulse"></span>
                  永久禁用
                  <span class="w-2 h-2 rounded-full bg-ban-red animate-pulse"></span>
                </h3>
                <div class="flex justify-center gap-2">
                  <div
                    v-for="plantId in globalBans"
                    :key="plantId"
                    class="relative group w-10 h-10"
                  >
                    <img
                      :src="getPlantImage(plantId)"
                      :alt="`永久禁用植物：${getPlantName(plantId)}`"
                      class="w-full h-full rounded border border-ban-red/50 opacity-60 grayscale hover:grayscale-0 transition-all duration-300 transform hover:scale-110"
                    />
                    <!-- Tooltip -->
                    <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-black/90 text-white rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
                      {{ getPlantName(plantId) }}
                    </div>
                  </div>
                </div>
              </div>

              <UsedPlants player="player2" />
            </div>
          </transition>

          <!-- 主体操作区域 -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 animate-slide-up" style="animation-delay: 0.2s;">
            <!-- 左侧 Pick 区域 -->
            <div class="lg:col-span-3">
              <PickArea player="player1" />
            </div>

            <!-- 中间核心操作区域 -->
            <div class="lg:col-span-6 flex flex-col">
              <PlantSelector v-if="gameStatus === 'banning'" class="flex-1" />
              <PositionSetup v-if="gameStatus === 'positioning'" class="flex-1" />
            </div>

            <!-- 右侧 Pick 区域 -->
            <div class="lg:col-span-3">
              <PickArea player="player2" />
            </div>
          </div>

          <!-- 底部控制栏 -->
          <div class="mt-6 flex justify-center gap-4 animate-slide-up" style="animation-delay: 0.3s;">
            <button
              v-if="gameStatus === 'positioning'"
              @click="finishRound"
              class="group relative px-8 py-3 bg-plant-green hover:bg-plant-green-neon text-white font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-green-500/30 overflow-hidden"
            >
              <span class="relative z-10 flex items-center gap-2">
                <span class="text-xl">⚔️</span> 完成本小分
              </span>
              <div class="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
            </button>

            <button
              @click="resetGame"
              class="px-8 py-3 bg-gray-700 hover:bg-ban-red text-gray-300 hover:text-white font-bold rounded-lg transition-all duration-300 border border-gray-600 hover:border-ban-red shadow-lg hover:shadow-red-500/20"
            >
              ↺ 重置游戏
            </button>
          </div>
        </div>
      </transition>

      <!-- 小分结算模态框 -->
      <transition name="fade">
        <RoundResult v-if="gameStatus === 'result'" />
      </transition>
    </div>
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

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-card rounded-2xl p-8 max-w-lg w-full relative overflow-hidden animate-slide-up">
      <!-- 装饰背景 -->
      <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 class="text-5xl font-extrabold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-plant-green-neon to-pick-blue-neon drop-shadow-lg tracking-wider">
        PvZ B/P 对战
      </h1>

      <form @submit.prevent="startGame" class="space-y-8">
        <!-- 选手 1 -->
        <div class="space-y-2">
          <label for="player1-input" class="block text-sm font-bold text-gray-300 uppercase tracking-wide">选手 1 (蓝色方)</label>
          <div class="relative group">
            <input
              id="player1-input"
              v-model="player1Name"
              @input="onPlayer1Input"
              type="text"
              placeholder="输入 ID..."
              required
              autocomplete="off"
              class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:border-pick-blue-neon focus:ring-1 focus:ring-pick-blue-neon focus:outline-none transition-all placeholder-gray-500"
            />
            <div class="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-pick-blue-neon to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500"></div>
          </div>
          
          <!-- 选手1选路 -->
          <div v-if="player1Name" class="flex gap-4 mt-2 animate-fade-in">
            <button
              type="button"
              @click="togglePlayer1Road(2)"
              :disabled="player2Road === 2"
              class="flex-1 py-2 px-4 rounded border transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
              :class="player1Road === 2
                ? 'bg-pick-blue/20 border-pick-blue-neon text-pick-blue-neon shadow-[0_0_10px_rgba(33,150,243,0.3)]'
                : player2Road === 2
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player1Road === 2 ? 'bg-pick-blue-neon' : 'bg-gray-600'"></span>
              2路
            </button>
            <button
              type="button"
              @click="togglePlayer1Road(4)"
              :disabled="player2Road === 4"
              class="flex-1 py-2 px-4 rounded border transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
              :class="player1Road === 4
                ? 'bg-pick-blue/20 border-pick-blue-neon text-pick-blue-neon shadow-[0_0_10px_rgba(33,150,243,0.3)]'
                : player2Road === 4
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player1Road === 4 ? 'bg-pick-blue-neon' : 'bg-gray-600'"></span>
              4路
            </button>
          </div>
        </div>

        <!-- 选手 2 -->
        <div class="space-y-2">
          <label for="player2-input" class="block text-sm font-bold text-gray-300 uppercase tracking-wide">选手 2 (红色方)</label>
          <div class="relative group">
            <input
              id="player2-input"
              v-model="player2Name"
              @input="onPlayer2Input"
              type="text"
              placeholder="输入 ID..."
              required
              autocomplete="off"
              class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:border-ban-red-neon focus:ring-1 focus:ring-ban-red-neon focus:outline-none transition-all placeholder-gray-500"
            />
            <div class="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-ban-red-neon to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500"></div>
          </div>
          
          <!-- 选手2选路 -->
          <div v-if="player2Name" class="flex gap-4 mt-2 animate-fade-in">
            <button
              type="button"
              @click="togglePlayer2Road(2)"
              :disabled="player1Road === 2"
              class="flex-1 py-2 px-4 rounded border transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
              :class="player2Road === 2
                ? 'bg-ban-red/20 border-ban-red-neon text-ban-red-neon shadow-[0_0_10px_rgba(244,67,54,0.3)]'
                : player1Road === 2
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player2Road === 2 ? 'bg-ban-red-neon' : 'bg-gray-600'"></span>
              2路
            </button>
            <button
              type="button"
              @click="togglePlayer2Road(4)"
              :disabled="player1Road === 4"
              class="flex-1 py-2 px-4 rounded border transition-all duration-200 text-sm font-bold flex items-center justify-center gap-2"
              :class="player2Road === 4
                ? 'bg-ban-red/20 border-ban-red-neon text-ban-red-neon shadow-[0_0_10px_rgba(244,67,54,0.3)]'
                : player1Road === 4
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player2Road === 4 ? 'bg-ban-red-neon' : 'bg-gray-600'"></span>
              4路
            </button>
          </div>
        </div>

        <button
          type="submit"
          :disabled="!player1Name || !player2Name || !player1Road || !player2Road"
          class="w-full py-4 bg-gradient-to-r from-plant-green-dark to-plant-green hover:from-plant-green hover:to-plant-green-neon disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-lg font-bold text-xl text-white transition-all duration-300 transform active:scale-95 shadow-lg overflow-hidden relative group"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            开始对战 <span class="group-hover:translate-x-1 transition-transform">→</span>
          </span>
          <div class="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 rounded-lg"></div>
        </button>
      </form>

      <!-- 植物管理按钮 -->
      <div class="mt-6 mb-6 flex justify-center">
        <button
          type="button"
          @click="showPlantManager = true"
          class="px-6 py-2.5 bg-purple-600/80 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all duration-300 border border-purple-400/50 hover:border-purple-300 shadow-lg hover:shadow-purple-500/20 flex items-center gap-2"
        >
          <span>🌱</span>
          <span>植物管理</span>
        </button>
      </div>

      <div class="text-center" role="note">
        <p class="text-xs text-gray-500 font-mono tracking-widest">本系统由@okjjko制作，GitHub仓库地址：https://github.com/okjjko/-BP-/tree/master</p>
      </div>
    </div>

    <!-- 植物管理模态框 -->
    <PlantManager v-model:show="showPlantManager" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById, PLANTS } from '@/data/plants'
import { getPlantImage, getPlantName } from '@/data/customPlants'
import PlantManager from '@/components/PlantManager/index.vue'

const store = useGameStore()

const player1Name = ref('')
const player2Name = ref('')
const globalBans = ref([])
const firstPlayer = ref('player1') // 记录谁先输入ID
const player1Road = ref(null)
const player2Road = ref(null)
const showPlantManager = ref(false) // 植物管理模态框状态

const startGame = () => {
  if (!player1Name.value || !player2Name.value) {
    alert('请输入两名选手的ID')
    return
  }

  // 检查两名选手是否都选了路
  if (!player1Road.value || !player2Road.value) {
    alert('请两名选手都选择开局道路（2路或4路）')
    return
  }

  store.initGame(
    player1Name.value,
    player2Name.value,
    firstPlayer.value,
    player1Road.value,
    player2Road.value
  )
}

// 切换选手1的道路选择（取消/选择）
const togglePlayer1Road = (road) => {
  if (player1Road.value === road) {
    player1Road.value = null // 取消选择
  } else {
    player1Road.value = road
  }
}

// 切换选手2的道路选择（取消/选择）
const togglePlayer2Road = (road) => {
  if (player2Road.value === road) {
    player2Road.value = null // 取消选择
  } else {
    player2Road.value = road
  }
}

const onPlayer1Input = () => {
  if (!firstPlayer.value && player1Name.value) {
    firstPlayer.value = 'player1'
  }
}

const onPlayer2Input = () => {
  if (!firstPlayer.value && player2Name.value) {
    firstPlayer.value = 'player2'
  }
}

onMounted(() => {
  // 预览随机禁用的植物
  const shuffled = [...PLANTS].sort(() => Math.random() - 0.5)
  globalBans.value = shuffled.slice(0, 5).map(p => p.id)
})
</script>

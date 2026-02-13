<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full">
      <h1 class="text-4xl font-bold text-center mb-8 text-plant-green">
        植物大战僵尸 BP对战
      </h1>

      <form @submit.prevent="startGame" class="space-y-6">
        <div>
          <label for="player1-input" class="block text-lg font-semibold mb-2">选手1 ID</label>
          <input
            id="player1-input"
            v-model="player1Name"
            @input="onPlayer1Input"
            type="text"
            placeholder="输入选手1名称"
            required
            autocomplete="off"
            class="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border-2 border-gray-600 focus:border-plant-green focus:outline-none focus-visible:ring-4 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          />
          <!-- 选手1选路 -->
          <fieldset v-if="player1Name" class="mt-3">
            <legend class="block text-sm font-semibold mb-2">选择开局道路：</legend>
            <div class="flex gap-3" role="group" aria-label="选手1道路选择">
              <button
                type="button"
                @click="togglePlayer1Road(2)"
                :aria-pressed="player1Road === 2"
                :disabled="player2Road === 2 || !true"
                class="flex-1 py-2 rounded-lg font-bold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                :class="player1Road === 2
                  ? 'bg-blue-600 text-white'
                  : player2Road === 2 || !true
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                2路
              </button>
              <button
                type="button"
                @click="togglePlayer1Road(4)"
                :aria-pressed="player1Road === 4"
                :disabled="player2Road === 4 || !true"
                class="flex-1 py-2 rounded-lg font-bold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                :class="player1Road === 4
                  ? 'bg-blue-600 text-white'
                  : player2Road === 4 || !true
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                4路
              </button>
            </div>
          </fieldset>
        </div>

        <div>
          <label for="player2-input" class="block text-lg font-semibold mb-2">选手2 ID</label>
          <input
            id="player2-input"
            v-model="player2Name"
            @input="onPlayer2Input"
            type="text"
            placeholder="输入选手2名称"
            required
            autocomplete="off"
            class="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border-2 border-gray-600 focus:border-plant-green focus:outline-none focus-visible:ring-4 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
          />
          <!-- 选手2选路 -->
          <fieldset v-if="player2Name" class="mt-3">
            <legend class="block text-sm font-semibold mb-2">选择开局道路：</legend>
            <div class="flex gap-3" role="group" aria-label="选手2道路选择">
              <button
                type="button"
                @click="togglePlayer2Road(2)"
                :aria-pressed="player2Road === 2"
                :disabled="player1Road === 2 || !true"
                class="flex-1 py-2 rounded-lg font-bold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                :class="player2Road === 2
                  ? 'bg-blue-600 text-white'
                  : player1Road === 2 || !true
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                2路
              </button>
              <button
                type="button"
                @click="togglePlayer2Road(4)"
                :aria-pressed="player2Road === 4"
                :disabled="player1Road === 4 || !true"
                class="flex-1 py-2 rounded-lg font-bold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
                :class="player2Road === 4
                  ? 'bg-blue-600 text-white'
                  : player1Road === 4 || !true
                    ? 'bg-gray-800 text-gray-500'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
              >
                4路
              </button>
            </div>
          </fieldset>
        </div>

        <div v-if="globalBans.length > 0" class="mt-6" role="region" aria-label="本局永久禁用植物">
          <h3 class="text-lg font-semibold mb-3 text-ban-red">
            本局永久禁用植物：
          </h3>
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="plantId in globalBans"
              :key="plantId"
              class="relative group"
            >
              <img
                :src="getPlantImage(plantId)"
                :alt="`禁用植物：${getPlantName(plantId)}`"
                class="w-full rounded-lg opacity-75 border-2 border-ban-red"
              />
              <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg" role="tooltip">
                <span class="text-xs text-center px-1">{{ getPlantName(plantId) }}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="!player1Name || !player2Name || !true"
          class="w-full py-4 bg-plant-green hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-xl transition mt-6 focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
        >
          开始游戏
        </button>
      </form>

      <div class="mt-6 text-center text-gray-400 text-sm" role="note">
        <p>率先夺得5分的选手胜利</p>
        <p>每个植物每名选手最多使用2次</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById, PLANTS } from '@/data/plants'

const store = useGameStore()

const player1Name = ref('')
const player2Name = ref('')
const globalBans = ref([])
const firstPlayer = ref('player1') // 记录谁先输入ID
const player1Road = ref(null)
const player2Road = ref(null)

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}

const startGame = () => {
  if (!player1Name.value || !player2Name.value) {
    alert('请输入两名选手的ID')
    return
  }

  // 如果都没有选路，提示至少选一个
  if (!player1Road.value && !player2Road.value) {
    alert('请至少一名选手选择开局道路')
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

<template>
  <div class="min-h-screen flex items-center justify-center p-4">

    <!-- 房间设置界面 -->
    <RoomSetup
      v-if="showRoomSetup"
      @startGame="handleRoomStart"
      @cancel="handleRoomCancel"
    />

    <!-- 游戏设置界面 -->
    <div v-else class="glass-card rounded-2xl p-8 max-w-lg w-full relative overflow-hidden animate-slide-up">
      <!-- 返回按钮 -->
      <button
        @click="goBack"
        class="absolute top-4 left-4 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-all duration-200 border border-gray-600 hover:border-gray-500 flex items-center gap-1.5 z-10"
      >
        <span>←</span>
        <span>返回</span>
      </button>

      <!-- 装饰背景 -->
      <div class="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 class="text-5xl font-extrabold text-center mb-10 text-transparent bg-clip-text bg-gradient-to-r from-plant-green to-pick-blue tracking-wider">
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
          <div v-if="player1Name && showPlayer1RoadPicker" class="flex gap-4 mt-2 animate-fade-in">
            <button
              type="button"
              @click="togglePlayer1Road(2)"
              :disabled="player2Road === 2"
              :aria-pressed="player1Road === 2"
              class="flex-1 min-h-[44px] py-2 px-4 rounded-lg border transition-colors duration-200 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              :class="player1Road === 2
                ? 'bg-pick-blue/20 border-pick-blue text-pick-blue'
                : player2Road === 2
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player1Road === 2 ? 'bg-pick-blue' : 'bg-gray-600'"></span>
              {{ store.sideName(2) }}
            </button>
            <button
              type="button"
              @click="togglePlayer1Road(4)"
              :disabled="player2Road === 4"
              :aria-pressed="player1Road === 4"
              class="flex-1 min-h-[44px] py-2 px-4 rounded-lg border transition-colors duration-200 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              :class="player1Road === 4
                ? 'bg-pick-blue/20 border-pick-blue text-pick-blue'
                : player2Road === 4
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player1Road === 4 ? 'bg-pick-blue' : 'bg-gray-600'"></span>
              {{ store.sideName(4) }}
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
          <div v-if="player2Name && showPlayer2RoadPicker" class="flex gap-4 mt-2 animate-fade-in">
            <button
              type="button"
              @click="togglePlayer2Road(2)"
              :disabled="player1Road === 2"
              :aria-pressed="player2Road === 2"
              class="flex-1 min-h-[44px] py-2 px-4 rounded-lg border transition-colors duration-200 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ban-red focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              :class="player2Road === 2
                ? 'bg-ban-red/20 border-ban-red text-ban-red'
                : player1Road === 2
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player2Road === 2 ? 'bg-ban-red' : 'bg-gray-600'"></span>
              {{ store.sideName(2) }}
            </button>
            <button
              type="button"
              @click="togglePlayer2Road(4)"
              :disabled="player1Road === 4"
              :aria-pressed="player2Road === 4"
              class="flex-1 min-h-[44px] py-2 px-4 rounded-lg border transition-colors duration-200 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ban-red focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              :class="player2Road === 4
                ? 'bg-ban-red/20 border-ban-red text-ban-red'
                : player1Road === 4
                  ? 'bg-gray-800/50 border-gray-700 text-gray-600'
                  : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'"
            >
              <span class="w-2 h-2 rounded-full" :class="player2Road === 4 ? 'bg-ban-red' : 'bg-gray-600'"></span>
              {{ store.sideName(4) }}
            </button>
          </div>
        </div>

        <!-- 大局获胜所需小局数 -->
        <div class="space-y-2">
          <label for="win-threshold-select" class="block text-sm font-bold text-gray-300 uppercase tracking-wide">大局获胜所需小局数</label>
          <select
            id="win-threshold-select"
            v-model.number="winThreshold"
            class="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:border-plant-green-neon focus:ring-1 focus:ring-plant-green-neon focus:outline-none transition-all"
          >
            <option v-for="n in 7" :key="n" :value="n">{{ n }} 胜（BO{{ n * 2 - 1 }}）</option>
          </select>
        </div>

        <!-- 规则配置区（Phase 0 骨架占位；子组件由并行开发者 A/B 填充） -->
        <div class="space-y-3">
          <SideRulesEditor />
          <BPRulesEditor />
        </div>

        <button
          type="submit"
          :disabled="!canStartGame"
          class="w-full py-4 bg-gradient-to-r from-plant-green-dark to-plant-green hover:from-plant-green hover:to-plant-green-dark disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-lg font-bold text-xl text-white transition-colors duration-300 transform active:scale-95 shadow-lg overflow-hidden relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            开始对战 <span class="group-hover:translate-x-1 transition-transform">→</span>
          </span>
          <div class="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 rounded-lg"></div>
        </button>
      </form>

      <!-- 植物管理按钮 -->
      <div class="mt-6 mb-6 flex justify-center">
        <BaseButton variant="secondary" @click="uiStore.setShowPlantManager(true)">
          <template #icon><Sprout :size="18" /></template>
          植物管理
        </BaseButton>
      </div>

      <div class="text-center" role="note">
        <p class="text-xs text-gray-500 font-mono tracking-widest">本系统由@okjjko制作，GitHub仓库地址：https://github.com/okjjko/-BP-/tree/master</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useToast } from '@/composables/useToast'
import { Sprout } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { getPlantById, PLANTS } from '@/data/plants'
import { getPlantImage, getPlantName, getAllPlantsSync, getHiddenPlants, blobToBase64 } from '@/data/customPlants'
import RoomSetup from '@/components/RoomSetup.vue'
import roomManager from '@/utils/roomManager'
import SideRulesEditor from '@/components/RulesEditor/SideRulesEditor.vue'
import BPRulesEditor from '@/components/RulesEditor/BPRulesEditor.vue'

const store = useGameStore()
const connStore = useConnectionStore()
const uiStore = useUIStore()
const toast = useToast()

const player1Name = ref('')
const player2Name = ref('')
const globalBans = ref([])
const firstPlayer = ref('player1') // 记录谁先输入ID
const player1Road = ref(null)
const player2Road = ref(null)
const winThreshold = ref(4) // 大局获胜所需小局数（开局可配置，默认4）
const showRoomSetup = ref(true) // 显示房间设置界面

// 功能3：按 ruleConfig.sideSelection.initialMode 决定选路 UI 可见性
const initialMode = computed(() => store.ruleConfig.sideSelection.initialMode)
const initialPicker = computed(() => store.ruleConfig.sideSelection.initialPicker)

// 双方互斥：两人都显示选路按钮
// 指定一方：仅 initialPicker 显示选路按钮
// 随机：都不显示（提交后由 store 随机分配）
const showPlayer1RoadPicker = computed(() => {
  if (initialMode.value === 'random') return false
  if (initialMode.value === 'assigned') return initialPicker.value === 'player1'
  return true // mutual
})
const showPlayer2RoadPicker = computed(() => {
  if (initialMode.value === 'random') return false
  if (initialMode.value === 'assigned') return initialPicker.value === 'player2'
  return true // mutual
})

// 开始对战按钮的禁用条件
const canStartGame = computed(() => {
  if (!player1Name.value || !player2Name.value) return false
  if (initialMode.value === 'mutual') {
    return !!(player1Road.value && player2Road.value)
  }
  if (initialMode.value === 'assigned') {
    const pickerRoad = initialPicker.value === 'player1' ? player1Road.value : player2Road.value
    return !!pickerRoad
  }
  // random：仅需两名选手 ID
  return true
})

// 处理房间设置开始游戏
const handleRoomStart = async (data) => {
  showRoomSetup.value = false

  if (data.mode === 'local') {
    // 本地模式，显示游戏设置界面
    return
  }

  // 多人模式，设置房间相关状态
  connStore.setRoomMode(data.mode, data.inviteCode)

  // 如果是主办方
  if (data.role === 'host') {
    // 获取已连接的选手名字
    const playerNames = roomManager.getConnectedPlayerNames()

    if (playerNames.length < 2) {
      toast.error('需要至少 2 名选手加入才能开始游戏')
      showRoomSetup.value = true
      return
    }

    // 自动使用已连接选手的ID开始游戏
    // 第一个连接的是 player1，第二个是 player2
    player1Name.value = playerNames[0]
    player2Name.value = playerNames[1]

    // 自动分配道路（第一个选手2路，第二个选手4路）
    player1Road.value = 2
    player2Road.value = 4

    // 直接开始游戏，不显示输入界面
    startGame()

    // 调试：检查 globalBans 是否已生成
    console.log('[GameSetup] startGame() 调用完成，roomMode:', connStore.roomMode, 'globalBans:', store.globalBans)

    // 广播自定义植物配置到所有已连接的客户端
    const allPlants = getAllPlantsSync()
    const customPlants = allPlants.filter(p => p.builtin === false)
    const hiddenBuiltinPlants = getHiddenPlants()

    if (customPlants.length > 0 || hiddenBuiltinPlants.length > 0) {
      // 将 Blob 图片转换为 Base64，以便通过 WebRTC 传输
      const plantsToBroadcast = await Promise.all(
        customPlants.map(async (plant) => ({
          ...plant,
          image: await blobToBase64(plant.imageData),
          imageData: undefined // 移除 Blob 字段，传输完成后在接收端重建
        }))
      )

      roomManager.broadcastCustomPlants({
        plants: plantsToBroadcast,
        hiddenBuiltinPlants: hiddenBuiltinPlants
      })

      console.log('[GameSetup] 已广播植物配置:', {
        customPlants: plantsToBroadcast.length,
        hiddenBuiltin: hiddenBuiltinPlants.length
      })
    }

    // 广播游戏开始消息给所有选手
    const globalBans = store.globalBans || []

    roomManager.broadcastGameStart(
      playerNames[0],  // player1Name
      playerNames[1],  // player2Name
      2,              // player1Road
      4,              // player2Road
      globalBans,     // 永久禁用植物列表
      hiddenBuiltinPlants  // 隐藏的内置植物列表
    )

  } else {
    // 选手/观众模式
    // 检查游戏是否已经开始
    // 修复：'idle' 不存在，应该检查 'setup'
    if (store.gameStatus !== 'setup') {
      // 游戏已经开始，直接隐藏房间设置界面
      return
    }
    // 游戏未开始，开始状态同步并等待
    connStore.startStateSync()
  }
}

// 处理房间设置取消
const handleRoomCancel = () => {
  showRoomSetup.value = true // 返回到模式选择页面
  // 清理房间模式状态
  connStore.setRoomMode('local', null)
  connStore.myRole = null
  connStore.myPlayerName = ''
  connStore.myPlayerId = null
  connStore.myAssignedPlayer = null
}

// 返回到模式选择页面
const goBack = () => {
  showRoomSetup.value = true
  // 清空已输入的数据
  player1Name.value = ''
  player2Name.value = ''
  player1Road.value = null
  player2Road.value = null
  firstPlayer.value = 'player1'
}

const startGame = () => {
  if (!player1Name.value || !player2Name.value) {
    toast.error('请输入两名选手的 ID')
    return
  }

  const mode = store.ruleConfig.sideSelection.initialMode

  // random 模式：无需手动选路，由 store 随机分配
  // assigned 模式：仅需指定一方（initialPicker）选路
  // mutual 模式：双方都需选路（互斥）
  if (mode === 'mutual') {
    if (!player1Road.value || !player2Road.value) {
      toast.error(`请两名选手都选择开局道路（${store.sideName(2)} 或 ${store.sideName(4)}）`)
      return
    }
  } else if (mode === 'assigned') {
    const picker = store.ruleConfig.sideSelection.initialPicker
    const pickerRoad = picker === 'player1' ? player1Road.value : player2Road.value
    if (!pickerRoad) {
      toast.error(`请指定 ${picker === 'player1' ? '选手 1' : '选手 2'} 选择开局道路`)
      return
    }
  }
  // random 模式：跳过选路校验

  store.initGame(
    player1Name.value,
    player2Name.value,
    firstPlayer.value,
    player1Road.value,
    player2Road.value,
    winThreshold.value
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

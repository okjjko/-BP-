import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import { PLANTS } from '@/data/plants'
import { getAllPlantsSync } from '@/data/customPlants'
import { getBPSequence, STAGE_NAMES } from '@/utils/bpRules'
import { canBan, canPick, validatePosition, isGameOver, isGrandFinal, isPumpkin } from '@/utils/validators'
import roomManager from '@/utils/roomManager'

// 暴露到 window 以便调试
if (typeof window !== 'undefined') {
  window.$roomManager = roomManager
  console.log('[DEBUG] roomManager 已暴露到 window.$roomManager')
}

export const useGameStore = defineStore('game', {
  state: () => ({

    // 选手信息
    player1: {
      id: '',
      score: 0,
      road: null // 2路或4路
    },
    player2: {
      id: '',
      score: 0,
      road: null
    },

    // 先输入ID的选手
    firstPlayer: null,

    // 多人房间模式
    roomMode: 'local', // 'local' | 'host' | 'player' | 'spectator'
    inviteCode: null, // 邀请码
    myRole: null, // 'host' | 'player' | 'spectator'
    connectionStatus: 'disconnected', // 'disconnected' | 'connected' | 'connecting'
    connectedUsers: [], // 已连接的用户列表
    stateVersion: 0, // 状态版本号（用于冲突解决）
    lastSyncTime: null, // 最后同步时间
    isViewOnly: false, // 是否为只读模式（观众）
    isSyncing: false, // 是否正在同步状态
    syncError: null, // 同步错误信息
    lastSyncVersion: 0, // 最后同步的版本号
    _plantCacheVersion: 0, // 植物缓存版本号（用于强制触发更新）
    _isSyncing: false, // 是否已设置事件监听器（防止重复设置）

    // 选手身份绑定（用于回合制权限控制）
    myPlayerId: null, // 'player1' | 'player2' （在多人模式下）
    myPlayerName: '', // 选手ID/昵称
    myAssignedPlayer: null, // 分配的实际player标识（与BP回合绑定，值为 'player1' 或 'player2'）

    // 当前局状态
    currentRound: {
      roundNumber: 1,
      stage: 1,
      step: 0,
      currentPlayer: null,
      action: null, // 'ban' 或 'pick'
      pickCount: 1, // 当前步骤需要选择的数量
      bans: {
        player1: [],
        player2: []
      },
      picks: {
        player1: [],
        player2: []
      },
      positions: {
        player1: { road: null, plants: [] },
        player2: { road: null, plants: [] }
      },
      selectedPlant: null, // 当前选中但未确认的植物
      bpSequence: [], // 当前局的动态BP序列
      extraPick: null, // 额外选择：{ player: 'player1'|'player2', remaining: number }
      pumpkinProtection: {}, // 南瓜保护追踪：key = `${player}_${plantIndex}`, value = { protectedBy: 'pumpkin', pumpkinIndex: number }
      lastPumpkinIndex: null // 最后选择的南瓜头索引（临时，用于关联保护）
    },

    // 全局记录
    globalBans: [], // 永久禁用的5个植物
    plantUsage: {}, // 每个植物每个选手的使用次数 { 'player1_plantId': count }
    pumpkinUsage: { // 南瓜头使用记录（单独追踪，因为南瓜头从picks中移除）
      player1: 0,
      player2: 0
    },

    // 游戏状态
    gameStatus: 'setup', // 'setup', 'banning', 'positioning', 'result', 'finished'
    roundWinner: null, // 当前小分的获胜者

    // 拖拽状态（临时UI状态，不保存到localStorage）
    dragState: {
      isDragging: false,
      draggedPlantId: null,
      draggedFromPlayer: null,         // 'player1' | 'player2'
      draggedFromType: null,           // 'pickArea' | 'availableList' | 'battlefield'
      draggedFromPosition: null,       // 战场位置拖拽时：1-5
      draggedSourceIndex: null         // 实例在picks数组中的索引
    }
  }),

  getters: {
    /**
     * 获取二路选手（选了2路的选手）
     */
    road2Player: (state) => {
      if (state.player1.road === 2) return 'player1'
      if (state.player2.road === 2) return 'player2'
      return null
    },

    /**
     * 获取四路选手（选了4路的选手）
     */
    road4Player: (state) => {
      if (state.player1.road === 4) return 'player1'
      if (state.player2.road === 4) return 'player2'
      return null
    },

    /**
     * 获取当前可选择的植物列表
     * 改进：选手可以在同一小分中选择同一植物多次（最多2次），但对手已选的植物不可选
     * 进一步改进：禁用阶段显示所有未被禁用的植物（包括对手已选的）
     */
    availablePlants: (state) => {
      // 触发响应式更新：当自定义植物同步时，_plantCacheVersion 会变化
      const _cacheVersion = state._plantCacheVersion

      const { currentRound, globalBans, plantUsage, pumpkinUsage } = state
      const { bans, picks, currentPlayer, action } = currentRound

      // 所有已禁用的植物
      const allBans = [...globalBans, ...bans.player1, ...bans.player2]

      // 禁用阶段：显示所有未被禁用的植物（包括对手已选的）
      if (action === 'ban') {
        return getAllPlantsSync().filter(plant => {
          return !allBans.includes(plant.id)
        })
      }

      // 选择阶段：使用原有的过滤逻辑
      const opponent = currentPlayer === 'player1' ? 'player2' : 'player1'
      const opponentPicks = [...picks[opponent]]
      const ownPicks = [...picks[currentPlayer]]

      return getAllPlantsSync().filter(plant => {
        const plantId = plant.id

        // 1. 已禁用的植物不可选
        if (allBans.includes(plantId)) return false

        // 2. 对手已选的植物不可选
        if (opponentPicks.includes(plantId)) return false

        // 3. 对手已选南瓜头不可选（新增）
        if (isPumpkin(plantId, getAllPlantsSync()) && (pumpkinUsage[opponent] || 0) > 0) {
          return false
        }

        // 4. 自己本局已选2次的植物不可选
        const ownPickCount = ownPicks.filter(id => id === plantId).length
        if (ownPickCount >= 2) return false

        // 5. 加上历史使用次数，总使用次数不能超过2次
        const historicalUsage = plantUsage[`${currentPlayer}_${plantId}`] || 0
        if (ownPickCount + historicalUsage >= 2) return false

        // 6. 南瓜头特殊检查：自己使用次数不能超过2次（新增）
        if (isPumpkin(plantId, getAllPlantsSync())) {
          const ownPumpkinUsage = pumpkinUsage[currentPlayer] || 0
          if (ownPumpkinUsage >= 2) return false
        }

        return true
      })
    },

    /**
     * 获取当前阶段名称
     */
    currentStageName: (state) => {
      return STAGE_NAMES[state.currentRound.stage]
    },

    /**
     * 获取某个选手某个植物的使用次数
     */
    getPlantUsageCount: (state) => (playerId, plantId) => {
      const key = `${playerId}_${plantId}`
      return state.plantUsage[key] || 0
    },

    /**
     * 检查植物是否为南瓜头（通过ID或名称）
     * @param {string} plantId - 植物ID
     * @returns {boolean}
     */
    isPumpkinPlant: (state) => (plantId) => {
      return isPumpkin(plantId, getAllPlantsSync())
    },

    /**
     * 判断是否为当前用户的回合（用于回合制权限控制）
     */
    isMyTurn: (state) => {
      // 本地模式：总是可以操作
      if (state.roomMode === 'local') return true

      // 观众：不能操作
      if (state.isViewOnly) return false

      // 主办方：可以操作（用于测试或特殊情况）
      if (state.myRole === 'host') return true

      // 选手：检查是否为当前回合
      if (!state.currentRound?.currentPlayer) return false
      if (!state.myAssignedPlayer) return false

      return state.currentRound.currentPlayer === state.myAssignedPlayer
    },

    /**
     * 获取当前用户的操作权限描述
     */
    myTurnDescription: (state) => {
      if (state.roomMode === 'local') return ''
      if (state.isViewOnly) return '观众模式'
      if (state.myRole === 'host') return '主办方'

      const currentPlayer = state.currentRound?.currentPlayer
      if (!currentPlayer) return '等待开始'

      if (state.isMyTurn) {
        const playerLabel = currentPlayer === 'player1' ? '选手1' : '选手2'
        return `当前回合：${playerLabel}`
      } else {
        const playerLabel = currentPlayer === 'player1' ? '选手1' : '选手2'
        return `对方回合：${playerLabel}`
      }
    }
  },

  actions: {
    /**
     * 生成植物实例的唯一ID
     * @param {string} player - 'player1' 或 'player2'
     * @param {string} plantId - 植物ID
     * @param {number} sourceIndex - 在picks数组中的索引
     * @returns {string} 实例ID
     */
    generatePlantInstanceId(player, plantId, sourceIndex) {
      return `${player}_${plantId}_${sourceIndex}_${Date.now()}`
    },

    /**
     * 获取植物在picks数组中的所有可用实例
     * @param {string} player - 'player1' 或 'player2'
     * @param {string} plantId - 植物ID
     * @returns {Array<{instanceId: string, sourceIndex: number}>}
     */
    getAvailablePlantInstances(player, plantId) {
      const picks = this.currentRound.picks[player] || []
      const positions = this.currentRound.positions[player].plants || []

      // 找出所有已使用的实例索引
      const usedSourceIndices = positions
        .filter(p => p && p.plantId === plantId)
        .map(p => p.sourceIndex)

      return picks
        .map((pid, index) => ({ plantId: pid, sourceIndex: index }))
        .filter(item => item.plantId === plantId && !usedSourceIndices.includes(item.sourceIndex))
        .map(item => ({
          instanceId: this.generatePlantInstanceId(player, plantId, item.sourceIndex),
          sourceIndex: item.sourceIndex
        }))
    },

    /**
     * 初始化游戏
     */
    initGame(player1Id, player2Id, firstPlayer, player1Road, player2Road) {
      this.player1.id = player1Id
      this.player2.id = player2Id
      this.player1.score = 0
      this.player2.score = 0
      this.player1.road = player1Road || null
      this.player2.road = player2Road || null
      this.firstPlayer = firstPlayer

      // 随机禁用5个植物（只有主办方或本地模式生成，选手端等待同步）
      if (this.roomMode === 'local' || this.roomMode === 'host') {
        this.randomBanPlants()
      } else {
        // 选手端：清空禁用列表，等待接收主办方的状态
        this.globalBans = []
      }

      // 初始化使用记录
      this.plantUsage = {}

      // 自动分配选手身份（多人模式）
      if (this.roomMode !== 'local' && this.myRole === 'player') {
        // 根据输入的ID匹配player1/player2
        if (this.myPlayerName === player1Id) {
          this.myAssignedPlayer = 'player1'
          console.log('[initGame] 自动分配为 player1')
        } else if (this.myPlayerName === player2Id) {
          this.myAssignedPlayer = 'player2'
          console.log('[initGame] 自动分配为 player2')
        } else {
          console.warn('[initGame] 无法自动分配身份，ID不匹配:', this.myPlayerName, player1Id, player2Id)
        }
      }

      // 主办方通知选手身份分配
      if (this.roomMode === 'host') {
        this.assignPlayerIdentity(player1Id, 'player1')
        this.assignPlayerIdentity(player2Id, 'player2')
      }

      // 开始第一局
      this.startRound(1)

      // 同步初始状态到所有客户端（多人模式）
      if (this.roomMode !== 'local') {
        this.syncState()
      }

      // 保存到localStorage
      this.saveToLocalStorage()
    },

    /**
     * 随机禁用5个植物
     */
    randomBanPlants() {
      const allPlants = getAllPlantsSync()
      const shuffled = [...allPlants].sort(() => Math.random() - 0.5)
      this.globalBans = shuffled.slice(0, 5).map(p => p.id)
    },

    /**
     * 开始新的一小分
     */
    startRound(roundNumber) {
      const road2 = this.player1.road === 2 ? 'player1' : this.player2.road === 2 ? 'player2' : null
      const road4 = this.player1.road === 4 ? 'player1' : this.player2.road === 4 ? 'player2' : null

      // 生成动态BP序列
      const bpSequence = getBPSequence(road2, road4)

      this.currentRound = {
        roundNumber,
        stage: 1,
        step: 0,
        currentPlayer: null,
        action: null,
        pickCount: 1,
        bans: {
          player1: [],
          player2: []
        },
        picks: {
          player1: [],
          player2: []
        },
        positions: {
          player1: { road: null, plants: [] },
          player2: { road: null, plants: [] }
        },
        selectedPlant: null,
        isRoundComplete: false,
        bpSequence, // 保存动态BP序列
        extraPick: null // 南瓜头额外选择：{player: 'player1'|'player2', remaining: number}
      }

      // 设置第一个操作选手
      this.updateCurrentStep()
      this.gameStatus = 'banning'
    },

    /**
     * 更新当前步骤
     */
    updateCurrentStep() {
      const { bpSequence, stage, step } = this.currentRound

      // 根据stage和step找到对应的BP操作
      let currentStepCount = 0
      let stepInfo = null

      for (const bpStage of bpSequence) {
        for (const bpStep of bpStage) {
          if (currentStepCount === step) {
            stepInfo = bpStep
            break
          }
          currentStepCount++
        }
        if (stepInfo) break
      }

      if (stepInfo) {
        // stepInfo.player 已经被 getBPSequence() 转换为 'player1' 或 'player2'
        this.currentRound.currentPlayer = stepInfo.player
        this.currentRound.action = stepInfo.action
        this.currentRound.pickCount = stepInfo.count || 1
        // 确保BP进行中gameStatus正确
        if (this.gameStatus !== 'banning') {
          this.gameStatus = 'banning'
        }
      } else {
        // BP流程结束，进入站位阶段
        this.gameStatus = 'positioning'
      }
    },

    /**
     * 确认选择（ban或pick）
     */
    confirmSelection() {
      // 回合制权限检查
      if (!this.isMyTurn) {
        alert(this.myTurnDescription || '现在不是你的回合！')
        return
      }

      if (!this.currentRound.selectedPlant) {
        alert('请先选择一个植物')
        return
      }

      const plantId = this.currentRound.selectedPlant
      const player = this.currentRound.currentPlayer
      const action = this.currentRound.action

      if (action === 'ban') {
        // 执行ban操作
        this.currentRound.bans[player].push(plantId)
        this.currentRound.selectedPlant = null
        this.moveToNextStep()
        this.saveToLocalStorage()
        this.syncState() // 同步状态到其他客户端
        return
      }

      if (action === 'pick') {
        // 验证是否可以pick
        const canPickResult = canPick(plantId, player, this.$state)
        if (!canPickResult.valid) {
          alert(canPickResult.reason)
          return
        }

        // 南瓜头特殊处理（检查ID或名称）
        if (this.isPumpkinPlant(plantId)) {
          // 步骤1: 暂时添加南瓜头到 picks（获取索引）
          const pumpkinIndex = this.currentRound.picks[player].length
          this.currentRound.picks[player].push(plantId)

          // 步骤2: 记录南瓜头使用次数（新增）
          this.pumpkinUsage[player] = (this.pumpkinUsage[player] || 0) + 1

          // 步骤3: 记录南瓜头索引（用于后续关联保护）
          this.currentRound.lastPumpkinIndex = pumpkinIndex

          // 步骤4: 设置额外选择标记
          this.currentRound.extraPick = {
            player: player,
            remaining: 1
          }

          this.currentRound.selectedPlant = null
          this.saveToLocalStorage()
          this.syncState() // 同步状态到其他客户端
          console.log('🎃 南瓜头已选择！记录使用次数:', this.pumpkinUsage[player])
          console.log('📍 [调试] 南瓜头信息:', {
            player,
            pumpkinIndex,
            lastPumpkinIndex: this.currentRound.lastPumpkinIndex,
            extraPick: this.currentRound.extraPick,
            currentStep: this.currentRound.step,
            currentStage: this.currentRound.stage
          })
          return
        }

        // 非南瓜头植物的正常处理
        this.currentRound.picks[player].push(plantId)
        const newPlantIndex = this.currentRound.picks[player].length - 1

        // 检查是否需要应用南瓜保护
        console.log('🔍 [调试] 检查南瓜保护条件:', {
          hasExtraPick: !!this.currentRound.extraPick,
          extraPickPlayer: this.currentRound.extraPick?.player,
          currentPlayer: player,
          hasLastPumpkinIndex: this.currentRound.lastPumpkinIndex !== undefined,
          lastPumpkinIndex: this.currentRound.lastPumpkinIndex,
          newPlantId: plantId,
          newPlantIndex: newPlantIndex,
          picksBeforeRemove: [...this.currentRound.picks[player]]
        })

        if (this.currentRound.extraPick &&
            this.currentRound.extraPick.player === player &&
            this.currentRound.lastPumpkinIndex !== undefined) {

          // 先从 picks 数组中移除南瓜头（这样后续植物索引会前移）
          const removedPlant = this.currentRound.picks[player][this.currentRound.lastPumpkinIndex]
          this.currentRound.picks[player].splice(this.currentRound.lastPumpkinIndex, 1)

          console.log('🗑️ [调试] 已移除植物:', removedPlant, '从索引:', this.currentRound.lastPumpkinIndex)

          // 计算移除南瓜后，新植物的实际索引
          // 如果南瓜在新植物前面，新植物索引会减1
          let actualIndex = newPlantIndex
          if (this.currentRound.lastPumpkinIndex < newPlantIndex) {
            actualIndex = newPlantIndex - 1
          }

          console.log('📍 [调试] 索引调整:', {
            原始索引: newPlantIndex,
            南瓜索引: this.currentRound.lastPumpkinIndex,
            调整后索引: actualIndex
          })

          // 初始化保护对象（如果不存在）
          if (!this.currentRound.pumpkinProtection) {
            this.currentRound.pumpkinProtection = {}
          }

          // 使用移除南瓜后的实际索引建立保护关系
          const protectionKey = `${player}_${actualIndex}`
          this.currentRound.pumpkinProtection[protectionKey] = {
            protectedBy: 'pumpkin',
            pumpkinIndex: this.currentRound.lastPumpkinIndex
          }

          console.log('✅ [调试] 保护关系已建立:', protectionKey, this.currentRound.pumpkinProtection[protectionKey])
          console.log('📋 [调试] 移除后的 picks:', this.currentRound.picks[player])

          // 清理临时标记
          delete this.currentRound.lastPumpkinIndex

          // 减少额外选择次数
          this.currentRound.extraPick.remaining--
          if (this.currentRound.extraPick.remaining <= 0) {
            this.currentRound.extraPick = null
            this.moveToNextStep()
          }

          this.currentRound.selectedPlant = null
          this.saveToLocalStorage()
          this.syncState() // 同步状态到其他客户端
          console.log('🛡️ 南瓜保护已激活！')
          return
        } else {
          console.log('❌ [调试] 南瓜保护条件不满足，跳过')
        }

        // 普通选择，无保护
        this.currentRound.selectedPlant = null
        this.moveToNextStep()
        this.saveToLocalStorage()
        this.syncState() // 同步状态到其他客户端
      }
    },

    /**
     * 移动到下一步
     */
    moveToNextStep() {
      const { bpSequence } = this.currentRound

      // 计算总步骤数
      let totalSteps = 0
      for (const bpStage of bpSequence) {
        totalSteps += bpStage.length
      }

      if (this.currentRound.step + 1 < totalSteps) {
        // 移动到下一步
        this.currentRound.step++

        // 更新stage
        let stepCount = 0
        for (let stageIdx = 0; stageIdx < bpSequence.length; stageIdx++) {
          const stageLength = bpSequence[stageIdx].length
          if (this.currentRound.step < stepCount + stageLength) {
            this.currentRound.stage = stageIdx + 1
            break
          }
          stepCount += stageLength
        }

        this.updateCurrentStep()
      } else {
        // BP流程结束，进入站位阶段
        this.gameStatus = 'positioning'
      }

      // 清理任何遗留的南瓜头索引（防御性编程）
      if (this.currentRound.lastPumpkinIndex !== undefined) {
        console.warn('⚠️ [清理] 推进步骤时检测到未处理的南瓜头索引，已清理')
        delete this.currentRound.lastPumpkinIndex
        this.saveToLocalStorage()
      }
    },

    /**
     * 设置站位
     */
    setPosition(player, road, plants) {
      const position = { road, plants }

      // 验证站位
      const validation = validatePosition(position)
      if (!validation.valid) {
        alert(validation.errors.join('\n'))
        return
      }

      // 保存站位（道路信息从player.road获取）
      this.currentRound.positions[player] = {
        road: this[player].road,
        plants
      }
      this.saveToLocalStorage()
    },

    /**
     * 完成本小分
     */
    finishRound() {
      // 显示结算界面
      this.gameStatus = 'result'
      this.roundWinner = null
      // 标记为对局完成（需要败者选路）
      this.currentRound.isRoundComplete = true

      // 同步状态到其他客户端
      if (this.roomMode !== 'local') {
        this.syncState()
      }
    },

    /**
     * 设置小分获胜者
     */
    setRoundWinner(winner) {
      this.roundWinner = winner

      // 更新分数
      if (winner === 'player1') {
        this.player1.score++
      } else if (winner === 'player2') {
        this.player2.score++
      }

      // 更新植物使用次数
      this.updatePlantUsage()

      // 检查游戏是否结束
      if (isGameOver(this.player1.score, this.player2.score)) {
        this.gameStatus = 'finished'
        this.saveToLocalStorage()
      } else if (isGrandFinal(this.player1.score, this.player2.score)) {
        alert('进入巅峰对决！（暂未实现）')
        this.gameStatus = 'finished'
        this.saveToLocalStorage()
      }

      // 同步状态到其他客户端
      if (this.roomMode !== 'local') {
        this.syncState()
      }
    },

    /**
     * 败方选择下一轮的路
     */
    selectRoad(loser, road) {
      if (loser === 'player1') {
        this.player1.road = road
      } else if (loser === 'player2') {
        this.player2.road = road
      }

      // 开始下一小分
      const nextRound = this.currentRound.roundNumber + 1
      this.startRound(nextRound)
      this.saveToLocalStorage()

      // 同步状态到其他客户端
      if (this.roomMode !== 'local') {
        this.syncState()
      }
    },

    /**
     * 更新植物使用次数
     */
    updatePlantUsage() {
      const { picks } = this.currentRound

      // 更新选手1的植物使用次数
      picks.player1.forEach(plantId => {
        const key = `player1_${plantId}`
        this.plantUsage[key] = (this.plantUsage[key] || 0) + 1
      })

      // 更新选手2的植物使用次数
      picks.player2.forEach(plantId => {
        const key = `player2_${plantId}`
        this.plantUsage[key] = (this.plantUsage[key] || 0) + 1
      })
    },

    /**
     * 设置当前用户角色
     */
    setRole(role) {
      this.currentRole = role
      localStorage.setItem('bp-tool-current-role', role)
    },

    /**
     * 重置游戏
     */
    resetGame() {
      this.$reset()
      localStorage.removeItem('bpGameState')
      this.clearMultiplayerSession() // 清除多人会话信息
      // 重置后需要重新初始化 pumpkinUsage（因为 $reset 会恢复默认值）
      this.pumpkinUsage = {
        player1: 0,
        player2: 0
      }
    },

    /**
     * 保存到localStorage
     */
    saveToLocalStorage() {
      const state = {
        player1: this.player1,
        player2: this.player2,
        globalBans: this.globalBans,
        plantUsage: this.plantUsage,
        pumpkinUsage: this.pumpkinUsage,
        currentRound: this.currentRound,
        gameStatus: this.gameStatus,
        firstPlayer: this.firstPlayer,
        roundWinner: this.roundWinner
      }
      localStorage.setItem('bpGameState', JSON.stringify(state))
    },

    /**
     * 保存多人房间信息到localStorage（用于自动重连）
     */
    saveMultiplayerSession() {
      if (this.roomMode === 'local') {
        localStorage.removeItem('bpMultiplayerSession')
        return
      }

      const session = {
        roomMode: this.roomMode,
        inviteCode: this.inviteCode,
        myRole: this.myRole,
        myPlayerName: this.myPlayerName,
        timestamp: Date.now()
      }
      localStorage.setItem('bpMultiplayerSession', JSON.stringify(session))
      console.log('[gameStore] 保存多人会话信息:', session)
    },

    /**
     * 从localStorage加载多人会话信息
     * @returns {Object|null} 会话信息
     */
    loadMultiplayerSession() {
      const saved = localStorage.getItem('bpMultiplayerSession')
      if (saved) {
        try {
          const session = JSON.parse(saved)
          // 检查会话是否过期（24小时）
          const sessionAge = Date.now() - session.timestamp
          const maxAge = 24 * 60 * 60 * 1000 // 24小时

          if (sessionAge > maxAge) {
            console.log('[gameStore] 会话已过期')
            localStorage.removeItem('bpMultiplayerSession')
            return null
          }

          console.log('[gameStore] 加载多人会话信息:', session)
          return session
        } catch (e) {
          console.error('加载会话信息失败', e)
          localStorage.removeItem('bpMultiplayerSession')
          return null
        }
      }
      return null
    },

    /**
     * 清除多人会话信息
     */
    clearMultiplayerSession() {
      localStorage.removeItem('bpMultiplayerSession')
      console.log('[gameStore] 清除多人会话信息')
    },

    /**
     * 从localStorage加载
     */
    loadFromLocalStorage() {
      const saved = localStorage.getItem('bpGameState')
      if (saved) {
        try {
          const state = JSON.parse(saved)
          this.player1 = state.player1
          this.player2 = state.player2
          this.globalBans = state.globalBans
          this.plantUsage = state.plantUsage
          this.pumpkinUsage = state.pumpkinUsage || {
            player1: 0,
            player2: 0
          }
          this.currentRound = state.currentRound
          this.gameStatus = state.gameStatus
          this.firstPlayer = state.firstPlayer || null
          this.roundWinner = state.roundWinner || null

          // 向后兼容：转换旧格式数据
          this.migrateLegacyPositions()
          this.migrateLegacyPumpkinProtection()

          return true
        } catch (e) {
          console.error('加载存档失败', e)
          return false
        }
      }
      return false
    },

    /**
     * 设置拖拽状态
     */
    setDragState(dragState) {
      this.dragState = { ...this.dragState, ...dragState }
    },

    /**
     * 清除拖拽状态
     */
    clearDragState() {
      this.dragState = {
        isDragging: false,
        draggedPlantId: null,
        draggedFromPlayer: null,
        draggedFromType: null,
        draggedFromPosition: null,
        draggedSourceIndex: null
      }
    },

    /**
     * 迁移旧格式的positions数据
     * 旧格式: plants: ['peashooter', null, 'sunflower']
     * 新格式: plants: [{plantId, instanceId, sourceIndex}, null, {...}]
     */
    migrateLegacyPositions() {
      ['player1', 'player2'].forEach(player => {
        const plants = this.currentRound?.positions?.[player]?.plants
        if (!plants || plants.length === 0) return

        // 检查是否需要迁移（如果第一个元素是字符串，说明是旧格式）
        const firstElement = plants.find(p => p !== null && p !== undefined)
        if (typeof firstElement === 'string') {
          const newPlants = plants.map((plantId, index) => {
            if (plantId === null || plantId === undefined) return null

            // 找到该植物在picks中的索引（考虑重复情况）
            const picks = this.currentRound.picks[player] || []
            const samePlantIds = plants.slice(0, index).filter(p => p === plantId)
            const sourceIndex = picks.findIndex((pid, i) =>
              pid === plantId && i >= samePlantIds.length
            )

            return {
              plantId: plantId,
              instanceId: this.generatePlantInstanceId(player, plantId, sourceIndex),
              sourceIndex: sourceIndex >= 0 ? sourceIndex : 0
            }
          })

          this.currentRound.positions[player].plants = newPlants
          this.saveToLocalStorage()
          console.log(`[迁移] 已转换 ${player} 的 positions 数据格式`)
        }
      })
    },

    /**
     * 迁移旧存档中的南瓜保护数据
     * 旧版本：picks 数组中可能包含南瓜头
     * 新版本：南瓜头从 picks 移除，使用 pumpkinProtection 追踪
     */
    migrateLegacyPumpkinProtection() {
      ['player1', 'player2'].forEach(player => {
        const picks = this.currentRound?.picks?.[player] || []

        // 检查是否有南瓜头在 picks 中
        const pumpkinIndices = []
        picks.forEach((plantId, index) => {
          if (this.isPumpkinPlant(plantId)) {
            pumpkinIndices.push(index)
          }
        })

        if (pumpkinIndices.length > 0) {
          console.warn(`[迁移] 检测到 ${player} 的 picks 中有 ${pumpkinIndices.length} 个南瓜头`)
          // 可选：自动移除南瓜头或保留标记
        }
      })
    },

    // ==================== 多人房间相关方法 ====================

    /**
     * 设置用户身份（用于回合制权限控制）
     * @param {string} role - 'host' | 'player' | 'spectator'
     * @param {string} playerName - 选手ID/昵称（选手必须提供）
     */
    setMyIdentity(role, playerName) {
      this.myRole = role
      this.myPlayerName = playerName || ''

      // 主办方设置
      if (role === 'host') {
        this.myPlayerId = 'host'
        // 保存会话信息用于自动重连
        this.saveMultiplayerSession()
        return
      }

      // 选手/观众：等待主办方分配player1/player2身份
      // 这将在initGame或游戏开始时根据输入的ID匹配
      this.myPlayerId = null
      this.myAssignedPlayer = null

      // 保存会话信息用于自动重连
      this.saveMultiplayerSession()
    },

    /**
     * 根据选手ID分配player1/player2身份（主办方调用）
     * @param {string} playerName - 选手输入的ID
     * @param {string} playerNumber - 'player1' | 'player2'
     */
    assignPlayerIdentity(playerName, playerNumber) {
      if (playerNumber !== 'player1' && playerNumber !== 'player2') {
        console.error('[assignPlayerIdentity] 无效的player编号:', playerNumber)
        return
      }

      // 如果当前用户是主办方，分配给连接的选手
      if (this.roomMode === 'host') {
        // 找到对应的连接并发送身份分配消息
        const connections = roomManager.connections
        connections.forEach((conn, peerId) => {
          if (conn.metadata?.playerName === playerName && conn.open) {
            conn.send({
              type: 'identityAssigned',
              playerNumber,
              playerName
            })
            console.log(`[assignPlayerIdentity] 分配 ${playerName} 为 ${playerNumber}`)
          }
        })
      }
    },

    /**
     * 接收身份分配（选手/观众接收后调用）
     * @param {string} playerNumber - 'player1' | 'player2'
     */
    receiveIdentityAssignment(playerNumber) {
      this.myAssignedPlayer = playerNumber
      console.log(`[receiveIdentityAssignment] 被分配为 ${playerNumber}`)
    },

    /**
     * 设置房间模式
     * @param {string} mode - 'local' | 'host' | 'player' | 'spectator'
     * @param {string} inviteCode - 邀请码（可选）
     */
    setRoomMode(mode, inviteCode = null) {
      this.roomMode = mode
      this.inviteCode = inviteCode
      // myRole 应该由 setMyIdentity() 设置，而不是在这里设置
      // 这行代码会导致多人模式下 myRole='multiplayer' 而不是 'host' 或 'player'
      // this.myRole = mode === 'local' ? null : mode
      this.isViewOnly = mode === 'spectator'

      if (mode === 'local') {
        this.connectionStatus = 'disconnected'
        this.clearMultiplayerSession()
      } else {
        // 多人模式，保存会话信息（注意：此时 myRole 可能还没设置）
        // 这里会在 setMyIdentity() 中再次保存
        this.saveMultiplayerSession()
      }
    },

    /**
     * 开始状态同步（在加入房间后调用）
     */
    startStateSync() {
      if (this.roomMode === 'local') {
        return // 本地模式不需要监听同步
      }

      // 暴露到 window 以便调试
      if (typeof window !== 'undefined') {
        window.$debugStore = this
        console.log('[DEBUG] gameStore 已暴露到 window.$debugStore')
        console.log('[DEBUG] roomManager 已暴露到 window.$roomManager')
        console.log('[DEBUG] 当前状态:', {
          roomMode: this.roomMode,
          myRole: this.myRole,
          stateVersion: this.stateVersion,
          _isSyncing: this._isSyncing
        })
      }

      // 避免重复设置监听器
      if (this._isSyncing) {
        console.log('[gameStore] 状态同步已在运行，跳过重复设置')
        return
      }

      this._isSyncing = true
      console.log('[gameStore] 开始状态同步, 角色:', this.myRole)

      // 选手、观众、主办方都需要监听状态更新
      // 主办方监听是为了在选手操作后看到界面变化
      roomManager.on('stateUpdate', this.handleStateUpdate)

      // 监听自定义植物同步
      roomManager.on('customPlants', this.handleCustomPlantsSync)

      // 监听身份分配（选手需要接收此消息）
      roomManager.on('identityAssigned', (data) => {
        console.log('[gameStore] 收到身份分配消息:', data)
        if (data.playerName === this.myPlayerName) {
          this.receiveIdentityAssignment(data.playerNumber)
        }
      })
    },

    /**
     * 停止状态同步
     */
    stopStateSync() {
      roomManager.off('stateUpdate', this.handleStateUpdate)
      roomManager.off('customPlants', this.handleCustomPlantsSync)
      this._isSyncing = false // 重置监听器标志
      // 注意：identityAssigned 的匿名函数监听器无法移除，但影响不大
    },

    /**
     * 处理状态更新（接收）
     * @param {Object} message - 状态更新消息
     */
    handleStateUpdate(message) {
      try {
        const { senderId, senderRole, timestamp, version, gameState } = message

        console.log(`[gameStore] 收到状态更新 v${version}，来自 ${senderRole}`)

        // 版本号检查：拒绝旧版本
        if (version <= this.stateVersion) {
          console.log('[gameStore] 拒绝旧版本状态')
          return
        }

        // 开始同步
        this.isSyncing = true
        this.syncError = null

        // 接受更新
        this.stateVersion = version
        this.lastSyncTime = timestamp
        this.lastSyncVersion = version

        // 使用对象替换确保 Vue 响应式系统能检测到变化
        // （避免使用 $patch，因为它可能无法检测深层对象的变化）
        this.player1 = { ...gameState.player1 }
        this.player2 = { ...gameState.player2 }
        this.firstPlayer = gameState.firstPlayer
        this.currentRound = { ...gameState.currentRound }
        this.globalBans = [...gameState.globalBans]
        this.plantUsage = { ...gameState.plantUsage }
        this.pumpkinUsage = { ...gameState.pumpkinUsage }
        this.gameStatus = gameState.gameStatus
        this.roundWinner = gameState.roundWinner

        // 重置同步状态
        nextTick(() => {
          this.isSyncing = false
        })

        // 主办方收到选手操作后立即转发给其他所有连接
        if (this.myRole === 'host' && senderRole !== 'host') {
          console.log(`[gameStore] 准备转发状态 - myRole: ${this.myRole}, senderRole: ${senderRole}, senderId: ${senderId}`)
          // 使用 nextTick 确保 DOM 更新后再转发
          nextTick(() => {
            console.log(`[gameStore] 执行转发状态 v${version}，排除 ${senderId}`)
            roomManager.broadcastToOthers(gameState, version, senderId)
          })
        } else {
          console.log(`[gameStore] 不转发状态 - myRole: ${this.myRole}, senderRole: ${senderRole}`)
        }
      } catch (error) {
        console.error('[gameStore] 状态更新失败:', error)
        this.syncError = error.message
        this.isSyncing = false
      }
    },

    /**
     * 同步状态到其他客户端（发送）
     * 在重要操作后调用
     */
    syncState() {
      if (this.roomMode === 'local') {
        return // 本地模式不需要同步
      }

      // 增加版本号
      this.stateVersion++

      const gameState = {
        player1: this.player1,
        player2: this.player2,
        firstPlayer: this.firstPlayer,
        currentRound: this.currentRound,
        globalBans: this.globalBans,
        plantUsage: this.plantUsage,
        pumpkinUsage: this.pumpkinUsage,
        gameStatus: this.gameStatus,
        roundWinner: this.roundWinner
      }

      if (this.roomMode === 'host') {
        // 主办方广播到所有连接
        roomManager.broadcastState(gameState, this.stateVersion)
      } else {
        // 选手/观众发送到主办方
        roomManager.sendStateUpdate(gameState, this.stateVersion)
      }

      console.log(`[gameStore] 已同步状态 v${this.stateVersion}`)
    },

    /**
     * 处理自定义植物同步
     * @param {Object} message - 自定义植物消息
     */
    async handleCustomPlantsSync(message) {
      const { plants, hiddenBuiltinPlants } = message

      console.log('[gameStore] 收到植物同步:', {
        customPlants: plants.length,
        hiddenBuiltin: hiddenBuiltinPlants?.length || 0
      })

      try {
        // 导入自定义植物管理模块
        const { importCustomPlant, clearAllCustomPlants, updateCache } = await import('@/data/customPlants')

        // 1. 清空现有自定义植物
        await clearAllCustomPlants()

        // 2. 导入收到的自定义植物（保留原始ID）
        for (const plant of plants) {
          await importCustomPlant(plant)
        }

        // 3. 更新隐藏的内置植物设置
        if (hiddenBuiltinPlants && hiddenBuiltinPlants.length > 0) {
          localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(hiddenBuiltinPlants))
          console.log('[gameStore] 已恢复', hiddenBuiltinPlants.length, '个隐藏的内置植物')
        }

        // 4. 更新内存缓存（关键：触发响应式更新）
        await updateCache()

        // 5. 强制触发依赖植物列表的 computed 更新
        this._plantCacheVersion = Date.now()

        console.log('[gameStore] 植物配置同步完成')
      } catch (error) {
        console.error('[gameStore] 同步植物配置失败:', error)
        this.syncError = '植物同步失败: ' + error.message
      }
    },

    /**
     * 导出比赛历史
     */
    async exportMatchHistory() {
      const history = {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        roomId: this.inviteCode,
        mode: this.roomMode,
        players: {
          player1: { ...this.player1 },
          player2: { ...this.player2 }
        },
        globalBans: this.globalBans,
        plantUsage: this.plantUsage,
        pumpkinUsage: this.pumpkinUsage,
        currentRound: this.currentRound,
        customPlants: [] // TODO: 添加自定义植物快照
      }

      // 获取自定义植物
      try {
        const customPlants = getAllPlantsSync().filter(p => p.isCustom)
        history.customPlants = customPlants
      } catch (error) {
        console.error('导出自定义植物失败:', error)
      }

      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `match-${this.inviteCode || 'local'}-${Date.now()}.json`
      a.click()

      URL.revokeObjectURL(url)
    },

    /**
     * 断开房间连接
     */
    disconnectRoom() {
      this.stopStateSync()
      roomManager.disconnect()

      // 重置房间状态
      this.roomMode = 'local'
      this.inviteCode = null
      this.myRole = null
      this.connectionStatus = 'disconnected'
      this.connectedUsers = []
      this.isViewOnly = false
    }
  }
})

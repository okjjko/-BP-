/**
 * 游戏核心状态 Store
 * 负责玩家信息、BP流程、计分、小局管理
 *
 * 注意：与 connectionStore 的交叉引用是安全的，
 * 因为 Pinia store 在 action 被调用时已完全初始化
 */
import { defineStore } from 'pinia'
import { getAllPlantsSync } from '@/data/customPlants'
import { getBPSequence, STAGE_NAMES } from '@/utils/bpRules'
import { canPick, validatePosition, isGameOver, isGrandFinal, isPumpkin } from '@/utils/validators'
import { useConnectionStore } from './connectionStore'
import { useToast } from '@/composables/useToast'
import defaultRules from '@/config/defaultRules'

export const useGameStore = defineStore('game', {
  state: () => ({
    // 选手信息
    player1: { id: '', score: 0, road: null },
    player2: { id: '', score: 0, road: null },
    firstPlayer: null,

    // 当前局状态
    currentRound: {
      roundNumber: 1,
      stage: 1,
      step: 0,
      currentPlayer: null,
      action: null,
      pickCount: 1,
      bans: { player1: [], player2: [] },
      picks: { player1: [], player2: [] },
      positions: {
        player1: { road: null, plants: [] },
        player2: { road: null, plants: [] }
      },
      selectedPlant: null,
      bpSequence: [],
      extraPick: null,
      pumpkinProtection: {},
      lastPumpkinIndex: null,
      pumpkinUsedThisRound: { player1: false, player2: false }
    },

    // 全局记录
    globalBans: [],
    plantUsage: {},
    pumpkinUsage: { player1: 0, player2: 0 },

    // 游戏状态
    gameStatus: 'setup',
    roundWinner: null,

    // 大局获胜所需小局数（开局可配置，1~7，默认4）
    winThreshold: 4,

    // 规则配置（开局可自定义）：阵营名 / 选边方式 / BP 顺序模板 / 使用上限。
    // 集中存放，整体持久化与多人同步；默认值见 src/config/defaultRules.js。
    ruleConfig: JSON.parse(JSON.stringify(defaultRules)),

    // 植物缓存版本号（用于触发响应式更新）
    _plantCacheVersion: 0,
  }),

  getters: {
    road2Player: (state) => {
      if (state.player1.road === 2) return 'player1'
      if (state.player2.road === 2) return 'player2'
      return null
    },

    road4Player: (state) => {
      if (state.player1.road === 4) return 'player1'
      if (state.player2.road === 4) return 'player2'
      return null
    },

    // B-ANCHOR: 阵营显示名 getter（功能1：阵营名称自定义）
    // road 值（2/4）→ 显示文案；仅影响显示，不影响 BP 模板逻辑。
    sideName: (state) => (road) => {
      if (road === 2) return state.ruleConfig.sideNames.road2
      if (road === 4) return state.ruleConfig.sideNames.road4
      return ''
    },

    availablePlants: (state) => {
      const _cacheVersion = state._plantCacheVersion
      const { currentRound, globalBans, plantUsage, pumpkinUsage } = state
      const { bans, picks, currentPlayer, action, extraPick, pumpkinUsedThisRound } = currentRound
      // 植物使用上限可配（功能4），默认 2
      const maxUsage = state.ruleConfig?.limits?.maxPlantUsage ?? 2

      const allBans = [...globalBans, ...bans.player1, ...bans.player2]

      if (action === 'ban') {
        return getAllPlantsSync().filter(plant => !allBans.includes(plant.id))
      }

      const opponent = currentPlayer === 'player1' ? 'player2' : 'player1'
      const opponentPicks = [...picks[opponent]]
      const ownPicks = [...picks[currentPlayer]]

      return getAllPlantsSync().filter(plant => {
        const plantId = plant.id
        if (allBans.includes(plantId)) return false
        if (opponentPicks.includes(plantId)) return false

        const ownPickCount = ownPicks.filter(id => id === plantId).length
        if (ownPickCount >= maxUsage) return false

        const historicalUsage = plantUsage[`${currentPlayer}_${plantId}`] || 0
        if (ownPickCount + historicalUsage >= maxUsage) return false

        // 南瓜头特殊规则
        if (isPumpkin(plantId, getAllPlantsSync())) {
          // 对手已在本轮使用过南瓜，不可选（空值安全）
          const usedMap = pumpkinUsedThisRound || {}
          if (usedMap[opponent]) return false
          // 自己的南瓜使用次数上限（跨小局累计，沿用可配上限值）
          const ownPumpkinUsage = pumpkinUsage[currentPlayer] || 0
          if (ownPumpkinUsage >= maxUsage) return false
        }

        return true
      })
    },

    currentStageName: (state) => STAGE_NAMES[state.currentRound.stage],

    getPlantUsageCount: (state) => (playerId, plantId) => {
      return state.plantUsage[`${playerId}_${plantId}`] || 0
    },

    // A-ANCHOR: 开发者 A 负责的 getter（功能4 / 功能2）
    maxPlantUsage: (state) => state.ruleConfig?.limits?.maxPlantUsage ?? 2,
    currentBPTemplate: (state) => state.ruleConfig?.bpSequence,

    isPumpkinPlant: () => (plantId) => {
      return isPumpkin(plantId, getAllPlantsSync())
    },
  },

  actions: {
    // ========== 植物实例管理 ==========

    generatePlantInstanceId(player, plantId, sourceIndex) {
      return `${player}_${plantId}_${sourceIndex}_${Date.now()}`
    },

    getAvailablePlantInstances(player, plantId) {
      const picks = this.currentRound.picks[player] || []
      const positions = this.currentRound.positions[player].plants || []
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

    // ========== 游戏生命周期 ==========

    initGame(player1Id, player2Id, firstPlayer, player1Road, player2Road, winThreshold = 4) {
      this.player1.id = player1Id
      this.player2.id = player2Id
      this.player1.score = 0
      this.player2.score = 0
      this.firstPlayer = firstPlayer
      this.winThreshold = winThreshold

      // 按 ruleConfig.sideSelection.initialMode 分配初始道路（功能3：选边方式自定义）
      const mode = this.ruleConfig.sideSelection.initialMode
      if (mode === 'random') {
        // 随机分配：忽略 UI 传入值，系统决定谁 2 路 / 4 路
        const player1GetsRoad2 = Math.random() < 0.5
        this.player1.road = player1GetsRoad2 ? 2 : 4
        this.player2.road = player1GetsRoad2 ? 4 : 2
      } else if (mode === 'assigned') {
        // 指定一方选路：initialPicker 选路，对手取相反
        const picker = this.ruleConfig.sideSelection.initialPicker
        const pickerRoad = (picker === 'player1' ? player1Road : player2Road) || 2
        const otherRoad = pickerRoad === 2 ? 4 : 2
        if (picker === 'player1') {
          this.player1.road = pickerRoad
          this.player2.road = otherRoad
        } else {
          this.player2.road = pickerRoad
          this.player1.road = otherRoad
        }
      } else {
        // 'mutual'：现状逻辑，使用 UI 传入的双方互斥选路
        this.player1.road = player1Road || null
        this.player2.road = player2Road || null
      }

      // 延迟导入避免循环依赖
      const connStore = useConnectionStore()

      // 随机禁用植物
      if (connStore.roomMode === 'local' || connStore.roomMode === 'host') {
        this.randomBanPlants()
      } else {
        this.globalBans = []
      }

      this.plantUsage = {}

      // 多人模式：自动分配选手身份
      connStore.assignPlayerIdentityOnInit(player1Id, player2Id)

      this.startRound(1)
      connStore.syncState()
      this.saveToLocalStorage()
    },

    randomBanPlants() {
      const allPlants = getAllPlantsSync()
      const shuffled = [...allPlants].sort(() => Math.random() - 0.5)
      this.globalBans = shuffled.slice(0, 5).map(p => p.id)
    },

    startRound(roundNumber) {
      const road2 = this.player1.road === 2 ? 'player1' : this.player2.road === 2 ? 'player2' : null
      const road4 = this.player1.road === 4 ? 'player1' : this.player2.road === 4 ? 'player2' : null
      const bpSequence = getBPSequence(this.ruleConfig.bpSequence, road2, road4)

      this.currentRound = {
        roundNumber,
        stage: 1,
        step: 0,
        currentPlayer: null,
        action: null,
        pickCount: 1,
        bans: { player1: [], player2: [] },
        picks: { player1: [], player2: [] },
        positions: {
          player1: { road: null, plants: [] },
          player2: { road: null, plants: [] }
        },
        selectedPlant: null,
        isRoundComplete: false,
        bpSequence,
        extraPick: null,
        pumpkinUsedThisRound: { player1: false, player2: false }
      }

      this.updateCurrentStep()
      this.gameStatus = 'banning'
    },

    // ========== BP 流程控制 ==========

    updateCurrentStep() {
      const { bpSequence, step } = this.currentRound
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
        this.currentRound.currentPlayer = stepInfo.player
        this.currentRound.action = stepInfo.action
        this.currentRound.pickCount = stepInfo.count || 1
        if (this.gameStatus !== 'banning') {
          this.gameStatus = 'banning'
        }
      } else {
        this.gameStatus = 'positioning'
      }
    },

    confirmSelection() {
      const connStore = useConnectionStore()
      if (!connStore.isMyTurn) {
        useToast().warning(connStore.myTurnDescription || '现在不是你的回合！')
        return
      }

      if (!this.currentRound.selectedPlant) {
        useToast().warning('请先选择一个植物')
        return
      }

      const plantId = this.currentRound.selectedPlant
      const player = this.currentRound.currentPlayer
      const action = this.currentRound.action

      if (action === 'ban') {
        this.currentRound.bans[player].push(plantId)
        this.currentRound.selectedPlant = null
        this.moveToNextStep()
        this.saveToLocalStorage()
        connStore.syncState()
        return
      }

      if (action === 'pick') {
        const canPickResult = canPick(plantId, player, this.$state)
        if (!canPickResult.valid) {
          useToast().warning(canPickResult.reason)
          return
        }

        if (this.isPumpkinPlant(plantId)) {
          this._handlePumpkinPick(player, plantId)
          return
        }

        this._handleNormalPick(player, plantId)
      }
    },

    _handlePumpkinPick(player, plantId) {
      const connStore = useConnectionStore()
      const pumpkinIndex = this.currentRound.picks[player].length
      this.currentRound.picks[player].push(plantId)
      this.pumpkinUsage[player] = (this.pumpkinUsage[player] || 0) + 1

      // 累积 extraPick：每选一个南瓜增加 1 次额外选择
      const currentRemaining = this.currentRound.extraPick?.remaining || 0
      this.currentRound.extraPick = { player, remaining: currentRemaining + 1 }

      // 记录所有南瓜索引（数组），用于逐一匹配保护关系
      if (!this.currentRound.lastPumpkinIndices) {
        this.currentRound.lastPumpkinIndices = []
      }
      this.currentRound.lastPumpkinIndices.push(pumpkinIndex)

      // 标记该玩家本轮已使用南瓜
      this.currentRound.pumpkinUsedThisRound[player] = true
      this.currentRound.selectedPlant = null
      this.saveToLocalStorage()
      connStore.syncState()
    },

    _handleNormalPick(player, plantId) {
      const connStore = useConnectionStore()
      this.currentRound.picks[player].push(plantId)
      const newPlantIndex = this.currentRound.picks[player].length - 1

      // 处理南瓜保护：extraPick 激活且有待匹配的南瓜
      if (this.currentRound.extraPick &&
          this.currentRound.extraPick.player === player &&
          this.currentRound.lastPumpkinIndices &&
          this.currentRound.lastPumpkinIndices.length > 0) {

        // 取出第一个待匹配的南瓜索引
        const pumpkinIdx = this.currentRound.lastPumpkinIndices.shift()

        // 从 picks 中移除南瓜头
        this.currentRound.picks[player].splice(pumpkinIdx, 1)

        // 计算被保护植物的实际索引
        let actualIndex = newPlantIndex - 1 // 减1因为南瓜刚被移除
        if (pumpkinIdx < newPlantIndex) {
          actualIndex = newPlantIndex - 1
        }

        if (!this.currentRound.pumpkinProtection) {
          this.currentRound.pumpkinProtection = {}
        }

        const protectionKey = `${player}_${actualIndex}`
        this.currentRound.pumpkinProtection[protectionKey] = {
          protectedBy: 'pumpkin',
          pumpkinIndex: pumpkinIdx
        }

        // 减少剩余额外选择次数
        this.currentRound.extraPick.remaining--

        if (this.currentRound.extraPick.remaining <= 0) {
          // 所有南瓜都已匹配保护植物，推进步骤
          this.currentRound.extraPick = null
          delete this.currentRound.lastPumpkinIndices
          this.moveToNextStep()
        }

        this.currentRound.selectedPlant = null
        this.saveToLocalStorage()
        connStore.syncState()
        return
      }

      this.currentRound.selectedPlant = null
      this.moveToNextStep()
      this.saveToLocalStorage()
      connStore.syncState()
    },

    moveToNextStep() {
      const { bpSequence } = this.currentRound
      let totalSteps = 0
      for (const bpStage of bpSequence) {
        totalSteps += bpStage.length
      }

      if (this.currentRound.step + 1 < totalSteps) {
        this.currentRound.step++

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
        this.gameStatus = 'positioning'
      }

      if (this.currentRound.lastPumpkinIndex !== undefined) {
        delete this.currentRound.lastPumpkinIndex
        this.saveToLocalStorage()
      }
    },

    // ========== 站位与结算 ==========

    setPosition(player, road, plants) {
      const position = { road, plants }
      const validation = validatePosition(position)
      if (!validation.valid) {
        useToast().warning(validation.errors.join('；'))
        return
      }
      this.currentRound.positions[player] = { road: this[player].road, plants }
      this.saveToLocalStorage()
    },

    finishRound() {
      this.gameStatus = 'result'
      this.roundWinner = null
      this.currentRound.isRoundComplete = true
      useConnectionStore().syncState()
    },

    setRoundWinner(winner) {
      this.roundWinner = winner
      if (winner === 'player1') this.player1.score++
      else if (winner === 'player2') this.player2.score++

      this.updatePlantUsage()

      if (isGameOver(this.player1.score, this.player2.score, this.winThreshold)) {
        this.gameStatus = 'finished'
        this.saveToLocalStorage()
      }
      // 巅峰对决（isGrandFinal）暂未启用：函数保留，但不再在此触发强行结束

      useConnectionStore().syncState()
    },

    selectRoad(loser, road) {
      if (loser === 'player1') this.player1.road = road
      else if (loser === 'player2') this.player2.road = road

      const nextRound = this.currentRound.roundNumber + 1
      this.startRound(nextRound)
      this.saveToLocalStorage()

      useConnectionStore().syncState()
    },

    /**
     * 应用下一小局的选边结果（功能3：败者/胜者/不换边选边方式自定义）。
     *
     * 关键约束（CLAUDE.md「选边卡死修复」）：必须**先同时更新败者+胜者双方 road，
     * 再 startRound**；否则 getBPSequence 因缺一条 road 报错并生成空 BP 序列，
     * 导致下一小局 BanPickView 永不挂载、卡在背景。
     *
     * @param {Object} param
     * @param {string} param.loser  败者 'player1' | 'player2'
     * @param {string} param.winner 胜者 'player1' | 'player2'
     * @param {number} [param.pickerRoad] 选边方所选道路（2 或 4）；loserPickMode='keep' 时忽略
     */
    applyNextRoundSideSelection({ loser, winner, pickerRoad }) {
      const mode = this.ruleConfig.sideSelection.loserPickMode

      if (mode === 'keep') {
        // 不换边：双方 road 保持现状，直接进入下一小局
        // （无需更新 road，双方仍持有上一局的道路）
      } else {
        // 'loser' / 'winner'：选边方选路，对手取相反道路
        const finalRoad = pickerRoad === 4 ? 4 : 2
        const otherRoad = finalRoad === 2 ? 4 : 2
        const picker = mode === 'winner' ? winner : loser
        const opponent = picker === 'player1' ? 'player2' : 'player1'
        // 同时更新双方 road（先全部赋值，再 startRound，避免空序列卡死）
        this[picker].road = finalRoad
        this[opponent].road = otherRoad
      }

      const nextRound = this.currentRound.roundNumber + 1
      this.startRound(nextRound)
      this.saveToLocalStorage()
      useConnectionStore().syncState()
    },

    updatePlantUsage() {
      const { picks } = this.currentRound
      // 遍历 picks 时跳过南瓜头（南瓜头的使用次数由 pumpkinUsage 单独追踪）
      picks.player1.forEach(plantId => {
        if (isPumpkin(plantId, getAllPlantsSync())) return
        const key = `player1_${plantId}`
        this.plantUsage[key] = (this.plantUsage[key] || 0) + 1
      })
      picks.player2.forEach(plantId => {
        if (isPumpkin(plantId, getAllPlantsSync())) return
        const key = `player2_${plantId}`
        this.plantUsage[key] = (this.plantUsage[key] || 0) + 1
      })
    },

    // ========== 持久化 ==========

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
        roundWinner: this.roundWinner,
        winThreshold: this.winThreshold,
        ruleConfig: this.ruleConfig
      }
      localStorage.setItem('bpGameState', JSON.stringify(state))
    },

    loadFromLocalStorage() {
      const saved = localStorage.getItem('bpGameState')
      if (saved) {
        try {
          const state = JSON.parse(saved)
          this.player1 = state.player1
          this.player2 = state.player2
          this.globalBans = state.globalBans
          this.plantUsage = state.plantUsage
          this.pumpkinUsage = state.pumpkinUsage || { player1: 0, player2: 0 }
          this.currentRound = state.currentRound
          this.gameStatus = state.gameStatus
          this.firstPlayer = state.firstPlayer || null
          this.roundWinner = state.roundWinner || null
          this.winThreshold = state.winThreshold || 4
          // ruleConfig 整体合并默认值（向后兼容旧存档，并自动补全新增配置字段）
          this.ruleConfig = { ...defaultRules, ...(state.ruleConfig || {}) }
          // 向后兼容：补全新增字段
          if (!this.currentRound.pumpkinUsedThisRound) {
            this.currentRound.pumpkinUsedThisRound = { player1: false, player2: false }
          }
          if (this.currentRound.lastPumpkinIndex !== undefined && !this.currentRound.lastPumpkinIndices) {
            // 旧数据用 lastPumpkinIndex，迁移到 lastPumpkinIndices
            this.currentRound.lastPumpkinIndices = [this.currentRound.lastPumpkinIndex]
            delete this.currentRound.lastPumpkinIndex
          }
          this.migrateLegacyPositions()
          this.migrateLegacyPumpkinProtection()
          // 恢复后重新计算当前步骤的 currentPlayer 和 action
          if (this.gameStatus === 'banning') {
            this.updateCurrentStep()
          }
          return true
        } catch (e) {
          console.error('加载存档失败', e)
          return false
        }
      }
      return false
    },

    resetGame() {
      this.$reset()
      localStorage.removeItem('bpGameState')
      useConnectionStore().clearMultiplayerSession()
      this.pumpkinUsage = { player1: 0, player2: 0 }
    },

    // ========== 数据迁移 ==========

    migrateLegacyPositions() {
      ['player1', 'player2'].forEach(player => {
        const plants = this.currentRound?.positions?.[player]?.plants
        if (!plants || plants.length === 0) return
        const firstElement = plants.find(p => p !== null && p !== undefined)
        if (typeof firstElement === 'string') {
          const newPlants = plants.map((plantId, index) => {
            if (plantId === null || plantId === undefined) return null
            const picks = this.currentRound.picks[player] || []
            const samePlantIds = plants.slice(0, index).filter(p => p === plantId)
            const sourceIndex = picks.findIndex((pid, i) =>
              pid === plantId && i >= samePlantIds.length
            )
            return {
              plantId,
              instanceId: this.generatePlantInstanceId(player, plantId, sourceIndex),
              sourceIndex: sourceIndex >= 0 ? sourceIndex : 0
            }
          })
          this.currentRound.positions[player].plants = newPlants
          this.saveToLocalStorage()
        }
      })
    },

    migrateLegacyPumpkinProtection() {
      ['player1', 'player2'].forEach(player => {
        const picks = this.currentRound?.picks?.[player] || []
        const pumpkinIndices = []
        picks.forEach((plantId, index) => {
          if (this.isPumpkinPlant(plantId)) {
            pumpkinIndices.push(index)
          }
        })
        if (pumpkinIndices.length > 0) {
          console.warn(`[迁移] 检测到 ${player} 的 picks 中有 ${pumpkinIndices.length} 个南瓜头`)
        }
      })
    },

    // ========== 导出 ==========

    async exportMatchHistory() {
      const connStore = useConnectionStore()
      const history = {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        roomId: connStore.inviteCode,
        mode: connStore.roomMode,
        players: { player1: { ...this.player1 }, player2: { ...this.player2 } },
        globalBans: this.globalBans,
        plantUsage: this.plantUsage,
        pumpkinUsage: this.pumpkinUsage,
        currentRound: this.currentRound,
        customPlants: []
      }

      try {
        history.customPlants = getAllPlantsSync().filter(p => p.isCustom)
      } catch (error) {
        console.error('导出自定义植物失败:', error)
      }

      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `match-${connStore.inviteCode || 'local'}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    },

    // ========== 联机同步接口 ==========

    applySyncState(gameState) {
      this.player1 = { ...gameState.player1 }
      this.player2 = { ...gameState.player2 }
      this.firstPlayer = gameState.firstPlayer
      this.currentRound = { ...gameState.currentRound }
      this.globalBans = [...gameState.globalBans]
      this.plantUsage = { ...gameState.plantUsage }
      this.pumpkinUsage = { ...gameState.pumpkinUsage }
      this.gameStatus = gameState.gameStatus
      this.roundWinner = gameState.roundWinner
      this.winThreshold = gameState.winThreshold || 4
      this.ruleConfig = { ...defaultRules, ...(gameState.ruleConfig || {}) }
    },

    getSyncPayload() {
      return {
        player1: this.player1,
        player2: this.player2,
        firstPlayer: this.firstPlayer,
        currentRound: this.currentRound,
        globalBans: this.globalBans,
        plantUsage: this.plantUsage,
        pumpkinUsage: this.pumpkinUsage,
        gameStatus: this.gameStatus,
        roundWinner: this.roundWinner,
        winThreshold: this.winThreshold,
        ruleConfig: this.ruleConfig
      }
    },

    triggerPlantCacheUpdate() {
      this._plantCacheVersion = Date.now()
    }
  }
})

import { defineStore } from 'pinia'
import { PLANTS } from '@/data/plants'
import { getAllPlantsSync } from '@/data/customPlants'
import { getBPSequence, STAGE_NAMES } from '@/utils/bpRules'
import { canBan, canPick, validatePosition, isGameOver, isGrandFinal } from '@/utils/validators'

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
      bpSequence: [] // 当前局的动态BP序列
    },

    // 全局记录
    globalBans: [], // 永久禁用的5个植物
    plantUsage: {}, // 每个植物每个选手的使用次数 { 'player1_plantId': count }

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
      const { currentRound, globalBans, plantUsage } = state
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

        // 3. 自己本局已选2次的植物不可选
        const ownPickCount = ownPicks.filter(id => id === plantId).length
        if (ownPickCount >= 2) return false

        // 4. 加上历史使用次数，总使用次数不能超过2次
        const historicalUsage = plantUsage[`${currentPlayer}_${plantId}`] || 0
        if (ownPickCount + historicalUsage >= 2) return false

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

      // 随机禁用5个植物
      this.randomBanPlants()

      // 初始化使用记录
      this.plantUsage = {}

      // 开始第一局
      this.startRound(1)

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
        return
      }

      if (action === 'pick') {
        // 验证是否可以pick
        const canPickResult = canPick(plantId, player, this.$state)
        if (!canPickResult.valid) {
          alert(canPickResult.reason)
          return
        }

        // 执行pick操作
        this.currentRound.picks[player].push(plantId)
        this.currentRound.selectedPlant = null

        // 南瓜头特殊规则：选南瓜后获得一次额外选择机会
        if (plantId === 'pumpkin') {
          // 设置额外选择标记（但不推进步骤）
          this.currentRound.extraPick = {
            player: player,
            remaining: 1
          }
          this.saveToLocalStorage()
          console.log('🎃 南瓜头已选择！当前玩家可以额外再选择一个植物')
        } else if (this.currentRound.extraPick && this.currentRound.extraPick.player === player) {
          // 正在使用额外选择
          this.currentRound.extraPick.remaining--
          if (this.currentRound.extraPick.remaining <= 0) {
            // 额外选择用完，清除标记并推进步骤
            this.currentRound.extraPick = null
            this.moveToNextStep()
          }
          this.saveToLocalStorage()
        } else {
          // 普通选择，正常推进步骤
          this.moveToNextStep()
          this.saveToLocalStorage()
        }
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
        currentRound: this.currentRound,
        gameStatus: this.gameStatus,
        firstPlayer: this.firstPlayer,
        roundWinner: this.roundWinner
      }
      localStorage.setItem('bpGameState', JSON.stringify(state))
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
          this.currentRound = state.currentRound
          this.gameStatus = state.gameStatus
          this.firstPlayer = state.firstPlayer || null
          this.roundWinner = state.roundWinner || null

          // 向后兼容：转换旧格式数据
          this.migrateLegacyPositions()

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
    }
  }
})

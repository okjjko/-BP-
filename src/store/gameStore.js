import { defineStore } from 'pinia'
import { PLANTS } from '@/data/plants'
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
    roundWinner: null // 当前小分的获胜者
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
     */
    availablePlants: (state) => {
      const { currentRound, globalBans } = state
      const { bans, picks, currentPlayer, action } = currentRound

      // 获取所有已禁用和已选的植物
      const allBans = [...globalBans, ...bans.player1, ...bans.player2]
      const allPicks = [...picks.player1, ...picks.player2]
      const unavailable = [...allBans, ...allPicks]

      // 过滤掉不可用的植物
      return PLANTS.filter(plant => !unavailable.includes(plant.id))
    },

    /**
     * 获取当前阶段名称
     */
    currentStageName: (state) => {
      return STAGE_NAMES[state.currentRound.stage]
    },

    /**
     * 获取植物信息
     */
    getPlantById: () => (id) => {
      return PLANTS.find(p => p.id === id)
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
      const shuffled = [...PLANTS].sort(() => Math.random() - 0.5)
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
        bpSequence // 保存动态BP序列
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
      } else if (action === 'pick') {
        // 验证是否可以pick
        const canPickResult = canPick(plantId, player, this.$state)
        if (!canPickResult.valid) {
          alert(canPickResult.reason)
          return
        }

        // 执行pick操作
        this.currentRound.picks[player].push(plantId)
      }

      // 清空选中
      this.currentRound.selectedPlant = null

      // 移动到下一步
      this.moveToNextStep()
      this.saveToLocalStorage()
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
          return true
        } catch (e) {
          console.error('加载存档失败', e)
          return false
        }
      }
      return false
    }
  }
})

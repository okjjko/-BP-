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
    // 最近一次「局内手动抽取」的永 ban 植物 id（历史字段，原供 undoLastManualGlobalBan 撤销）。
    // 注：通用撤销（undoLastAction）上线后该字段不再被写入，保留仅为旧存档/混版本向后兼容。
    lastManualGlobalBan: null,

    // 通用撤销栈：每个快照对应一次「可撤销操作」（confirmSelection / drawRandomGlobalBan）前的完整状态。
    // 生命周期：startRound 清空；上限 30。自动步骤（_processAutoSteps）与 randomBanPlants 不单独压栈。
    undoStack: [],
    // 最近一次「可撤销操作」的执行者：'player1' | 'player2' | 'system' | null。
    // 用于精确判定选手撤销权（选手仅能撤销自己刚做的操作）；见 undoLastAction。
    lastActor: null,

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
      // 南瓜特殊规则开关（默认开启）
      const pumpkinEnabled = state.ruleConfig?.pumpkinRule?.enabled ?? true

      const allBans = [...globalBans, ...bans.player1, ...bans.player2]

      // 自动步骤：系统抽取全局禁用，选手无需选择，返回空避免误触
      if (action === 'globalBan') {
        return []
      }

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

        // 南瓜头特殊规则（开关关闭时回落到上方通用上限检查，南瓜当普通植物）
        if (pumpkinEnabled && isPumpkin(plantId, getAllPlantsSync())) {
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

    isPumpkinPlant: (state) => (plantId) => {
      // 南瓜特殊规则开关关闭时，南瓜当作普通植物（不触发保护机制）
      if (!(state.ruleConfig?.pumpkinRule?.enabled ?? true)) return false
      return isPumpkin(plantId, getAllPlantsSync())
    },

    // MP-ANCHOR: 多人自定义规则可编辑性（开发者C）
    // 单机（local）模式恒可编辑（赛前赛后都能改，保持现状）；
    // 多人模式仅赛前（gameStatus === 'setup'）可改，对局进行中全员锁定（含 host）。
    // 与 A-ANCHOR / B-ANCHOR 隔离，勿在此处改动其它 getter。
    isRuleEditable: (state) => {
      const connStore = useConnectionStore()
      if (connStore.roomMode === 'local') return true
      return state.gameStatus === 'setup'
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
      const cfg = this.ruleConfig?.randomBan ?? {}
      if (cfg.enabled === false) { this.globalBans = []; return } // 严格假才跳过；默认/旧存档照抽
      const raw = Number(cfg.count)                                // 仅 NaN/缺省兜底 5（0 是合法值：抽 0 个）
      const count = Math.max(0, Number.isNaN(raw) ? 5 : raw)
      const allPlants = getAllPlantsSync()
      const shuffled = [...allPlants].sort(() => Math.random() - 0.5)
      this.globalBans = shuffled.slice(0, count).map(p => p.id)   // 池不足时 slice 自动抽满
    },

    startRound(roundNumber) {
      // 进入新小局，清空撤销栈与 lastActor（撤销仅限当前小局）
      this.undoStack = []
      this.lastActor = null
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
      // 首步可能是 globalBan（自动步骤），由权威方抽取并推进
      this._processAutoSteps()
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

      // pick 前置校验提前：避免压栈后校验失败而在栈中留下无效快照
      if (action === 'pick') {
        const canPickResult = canPick(plantId, player, this.$state)
        if (!canPickResult.valid) {
          useToast().warning(canPickResult.reason)
          return
        }
      }

      // 所有可能失败的校验已通过：压入操作前快照并记录操作者（供通用撤销，选手可撤自己刚做的操作）
      this._pushUndoSnapshot()
      this.lastActor = player

      if (action === 'ban') {
        this.currentRound.bans[player].push(plantId)
        this.currentRound.selectedPlant = null
        this.moveToNextStep()
        this.saveToLocalStorage()
        connStore.syncState()
        return
      }

      if (action === 'pick') {
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

        // ① 取出本次要消耗的南瓜索引（splice 前的索引空间）
        const pumpkinIdx = this.currentRound.lastPumpkinIndices.shift()

        // ② splice 前：pumpkinProtection 中 index > pumpkinIdx 的 key 前移 1
        //   （splice 会删除索引 pumpkinIdx，其后元素全部前移；仅影响当前 player）
        const oldProtection = this.currentRound.pumpkinProtection || {}
        const remappedProtection = {}
        for (const [key, value] of Object.entries(oldProtection)) {
          const m = key.match(/^(player[12])_(\d+)$/)
          if (!m) { remappedProtection[key] = value; continue }
          const p = m[1], idx = Number(m[2])
          const newIdx = (p === player && idx > pumpkinIdx) ? idx - 1 : idx
          remappedProtection[`${p}_${newIdx}`] = value
        }
        this.currentRound.pumpkinProtection = remappedProtection

        // ③ 为被保护植物建立保护记录（splice 后该植物索引 = newPlantIndex - 1，恒成立）
        const actualIndex = newPlantIndex - 1
        this.currentRound.pumpkinProtection[`${player}_${actualIndex}`] = {
          protectedBy: 'pumpkin',
          pumpkinIndex: pumpkinIdx
        }

        // ④ splice 移除南瓜
        this.currentRound.picks[player].splice(pumpkinIdx, 1)

        // ⑤ lastPumpkinIndices 中所有 > pumpkinIdx 的元素 -1（与 picks 同步前移）
        this.currentRound.lastPumpkinIndices =
          this.currentRound.lastPumpkinIndices.map(i => i > pumpkinIdx ? i - 1 : i)

        // ⑥ 消耗名额，归零则推进步骤
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
      this._advanceOneStep()
      // 推进后若落在自动步骤（globalBan），由权威方抽取并继续推进
      this._processAutoSteps()
    },

    // 推进到下一个 BP 步骤（step++、更新 stage、updateCurrentStep；到末尾则进入 positioning）
    _advanceOneStep() {
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
    },

    /**
     * 处理自动步骤（globalBan）：当前步为「全局永久禁用」时，由权威方（local/host）
     * 从未禁用池随机抽取 count 个植物并入 globalBans，再推进；循环直至落在手动步骤
     * 或流程结束。非权威方（player/spectator）no-op——状态由 host 的 syncState 被动同步。
     *
     * 多人一致性：globalBan 步骤不属于任何选手（player='system'），无选手点击确认，
     * 故必须由 host 单方抽取并广播，避免各端随机数不一致。沿用 randomBanPlants 的权威方模式。
     */
    _processAutoSteps() {
      const connStore = useConnectionStore()
      const isAuthority = connStore.roomMode === 'local' || connStore.roomMode === 'host'
      if (!isAuthority) return

      let processed = false
      let guard = 0
      while (this.gameStatus !== 'positioning'
        && this.currentRound.action === 'globalBan'
        && guard++ < 1000) {
        const count = this.currentRound.pickCount || 1
        this._drawGlobalBans(count)
        this._advanceOneStep()
        processed = true
      }

      // 仅在确实处理过自动步骤时才落盘 + 同步（避免普通推进多一次 I/O）
      if (processed) {
        this.saveToLocalStorage()
        connStore.syncState()
      }
    },

    /**
     * 从当前未禁用的植物池中随机抽取 count 个，加入 globalBans（全局永久禁用）。
     * 池不足时抽满为止；已 in globalBans 或当小局 bans 的不会重复抽取。
     * @returns {string[]} 实际抽到的 plantId 数组（供手动抽取复用，状态机调用不接收返回值）
     */
    _drawGlobalBans(count) {
      const allBans = [
        ...this.globalBans,
        ...this.currentRound.bans.player1,
        ...this.currentRound.bans.player2
      ]
      const pool = getAllPlantsSync().filter(p => !allBans.includes(p.id))
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      const drawn = shuffled.slice(0, Math.min(count, pool.length)).map(p => p.id)
      this.globalBans = [...this.globalBans, ...drawn]
      return drawn
    },

    /**
     * 局内临时抽取「一个」全局永久禁用植物（手动触发，每次 1 个）。
     * 与赛前预设的 globalBan 步骤互补：无需赛前配置，临时起意时由裁判/host 触发。
     *
     * 权威方语义：仅 local/host 执行抽取并 syncState 广播；player/spectator 返回失败（UI 守卫兜底）。
     * 返回值供 UI 做 toast 反馈。
     *
     * @returns {{ ok:boolean, plantId?:string, reason?:string }}
     *   ok=true 携带 plantId；ok=false 携带 reason：'not-authority' | 'no-round' | 'empty'
     */
    drawRandomGlobalBan() {
      const connStore = useConnectionStore()
      const isAuthority = connStore.roomMode === 'local' || connStore.roomMode === 'host'
      if (!isAuthority) return { ok: false, reason: 'not-authority' }
      if (!this.currentRound) return { ok: false, reason: 'no-round' }

      // 压入操作前快照（host 抽取，选手无权撤，故 lastActor='system'）。
      // 若抽取失败（池空），回滚刚压入的快照与 lastActor，避免留下无效撤销点。
      const prevLastActor = this.lastActor
      this._pushUndoSnapshot()
      this.lastActor = 'system'

      const drawn = this._drawGlobalBans(1)
      if (drawn.length === 0) {
        this.undoStack.pop()
        this.lastActor = prevLastActor
        return { ok: false, reason: 'empty' }
      }

      this.saveToLocalStorage()
      connStore.syncState()
      return { ok: true, plantId: drawn[0] }
    },

    /**
     * 通用撤销：弹出最近一个操作前快照，整体恢复状态。
     *
     * 权限：观众拒绝；裁判（local/host）永真；选手仅当 lastActor===myAssignedPlayer
     * （即撤销的是自己刚做的操作）。撤销后回合回退给被撤销步的原操作者，由其重做。
     *
     * 不触发 _processAutoSteps（仅调用 updateCurrentStep 重算指针），避免撤销回 globalBan
     * 自动步骤时被自动重抽破坏快照恢复。范围：仅当前小局（startRound 已清栈）。
     *
     * @returns {{ ok:boolean, undone?:object, reason?:string }}
     *   ok=true 携带 undone（供 UI toast）；ok=false 携带 reason：
     *   'not-allowed' | 'wrong-phase' | 'empty'
     */
    undoLastAction() {
      const connStore = useConnectionStore()
      if (connStore.isViewOnly) return { ok: false, reason: 'not-allowed' }
      const isAuthority = connStore.roomMode === 'local' || connStore.myRole === 'host'
      if (!isAuthority && this.lastActor !== connStore.myAssignedPlayer) {
        return { ok: false, reason: 'not-allowed' }
      }
      if (this.gameStatus !== 'banning') return { ok: false, reason: 'wrong-phase' }
      if (this.undoStack.length === 0) return { ok: false, reason: 'empty' }

      // 记录撤销前状态，供 _describeUndone 解析「撤了什么」
      const before = {
        action: this.currentRound.action,
        currentPlayer: this.currentRound.currentPlayer,
        picks: {
          player1: [...this.currentRound.picks.player1],
          player2: [...this.currentRound.picks.player2]
        },
        bans: {
          player1: [...this.currentRound.bans.player1],
          player2: [...this.currentRound.bans.player2]
        },
        globalBans: [...this.globalBans],
      }

      const snapshot = this.undoStack.pop()
      this.currentRound = JSON.parse(JSON.stringify(snapshot.currentRound))
      this.globalBans = [...snapshot.globalBans]
      this.plantUsage = { ...snapshot.plantUsage }
      this.pumpkinUsage = { ...snapshot.pumpkinUsage }
      this.gameStatus = snapshot.gameStatus
      // 回到干净待选状态；lastActor 清空（撤销后无「刚操作的选手」，选手需重做后才能再撤）
      this.currentRound.selectedPlant = null
      this.lastActor = null
      // 仅据 step 重算 currentPlayer/action，不推进、不触发自动步骤
      this.updateCurrentStep()

      const undone = this._describeUndone(before)
      this.saveToLocalStorage()
      connStore.syncState()
      return { ok: true, undone }
    },

    /**
     * 构造操作前快照（仅含会被可撤销操作修改的字段；深拷贝避开响应式代理与后续 mutation）。
     */
    _buildUndoSnapshot() {
      return {
        currentRound: JSON.parse(JSON.stringify(this.currentRound)),
        globalBans: [...this.globalBans],
        plantUsage: { ...this.plantUsage },
        pumpkinUsage: { ...this.pumpkinUsage },
        gameStatus: this.gameStatus,
      }
    },

    /**
     * 压入操作前快照到 undoStack；上限 30，超出则丢弃最旧。
     */
    _pushUndoSnapshot() {
      if (!this.currentRound) return
      this.undoStack.push(this._buildUndoSnapshot())
      if (this.undoStack.length > 30) this.undoStack.shift()
    },

    /**
     * 对比撤销前后状态，描述「撤了什么」供 UI toast。
     * @returns {{ action:string, player?:string, plantId?:string, manualBan?:boolean }}
     */
    _describeUndone(before) {
      const cr = this.currentRound
      // 1. globalBans 变短 → 撤的是手动抽取永禁（自动步骤不单独压栈，故此处只能是手动）
      if (before.globalBans.length > this.globalBans.length) {
        const removed = before.globalBans.find(id => !this.globalBans.includes(id))
        return { action: 'globalBan', plantId: removed, manualBan: true }
      }
      // 2. picks 变短 → 撤的是 pick（含南瓜：快照整体恢复后 picks 长度回退）
      for (const p of ['player1', 'player2']) {
        if (before.picks[p].length > cr.picks[p].length) {
          const removed = before.picks[p][before.picks[p].length - 1]
          return { action: 'pick', player: p, plantId: removed }
        }
      }
      // 3. bans 变短 → 撤的是 ban
      for (const p of ['player1', 'player2']) {
        if (before.bans[p].length > cr.bans[p].length) {
          const removed = before.bans[p][before.bans[p].length - 1]
          return { action: 'ban', player: p, plantId: removed }
        }
      }
      // 4. fallback
      return { action: cr.action, player: cr.currentPlayer }
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
      // 南瓜特殊规则开启时，南瓜头使用次数由 pumpkinUsage 单独追踪，此处跳过；
      // 开关关闭时南瓜当作普通植物，正常计入 plantUsage。
      const pumpkinEnabled = this.ruleConfig?.pumpkinRule?.enabled ?? true
      const skipPumpkin = (plantId) => pumpkinEnabled && isPumpkin(plantId, getAllPlantsSync())
      picks.player1.forEach(plantId => {
        if (skipPumpkin(plantId)) return
        const key = `player1_${plantId}`
        this.plantUsage[key] = (this.plantUsage[key] || 0) + 1
      })
      picks.player2.forEach(plantId => {
        if (skipPumpkin(plantId)) return
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
        lastManualGlobalBan: this.lastManualGlobalBan,
        undoStack: this.undoStack,
        lastActor: this.lastActor,
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
          this.lastManualGlobalBan = state.lastManualGlobalBan || null
          this.undoStack = Array.isArray(state.undoStack) ? state.undoStack : []
          this.lastActor = state.lastActor ?? null
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
      // 重置前保留当前对局应用的 BP/规则。store.ruleConfig 与比赛预设脱钩（加载预设后各自独立、
      // 赛前 BPRulesDialog 改的也只进 store），是「当前应用的 BP」的权威来源。$reset() 会把
      // ruleConfig 重置回 defaultRules（默认预设的标准 20 步），导致重置后 BP 流程变回默认预设
      // 而非用户当前应用的 BP——故在此显式保留。深拷贝避免与重置后的 state 共享引用。
      const keepRuleConfig = this.ruleConfig
        ? JSON.parse(JSON.stringify(this.ruleConfig))
        : null
      this.$reset()
      useConnectionStore().clearMultiplayerSession()
      this.pumpkinUsage = { player1: 0, player2: 0 }
      if (keepRuleConfig) {
        this.ruleConfig = keepRuleConfig
      }
      // 用「新对局起点」（初始 setup + 保留的 ruleConfig）覆盖旧存档，保证刷新后仍以同一套
      // BP 开始，而非回退到默认预设（原 removeItem 会让刷新后 ruleConfig 丢失变默认）。
      this.saveToLocalStorage()
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

    // 清理 buggy 旧存档：picks 中残留的南瓜头。
    // 正常 pending 状态下南瓜头会临时放在 picks 末尾连续段（待匹配被保护植物）；
    // 旧版本（连续选南瓜索引失效 bug）会在普通植物之间留下穿插的南瓜残留。
    // 这里保留末尾连续南瓜（重建 pending），清理穿插残留，并重映射 pumpkinProtection 的 key。
    migrateLegacyPumpkinProtection() {
      if (!this.currentRound) return

      ;['player1', 'player2'].forEach(player => {
        const picks = this.currentRound?.picks?.[player] || []
        const isPumpkinAt = picks.map(id => this.isPumpkinPlant(id))
        const pumpkinCount = isPumpkinAt.filter(Boolean).length
        if (pumpkinCount === 0) return

        // 末尾连续南瓜数 = 正常 pending；其余穿插南瓜 = buggy 残留
        let trailingCount = 0
        for (let i = isPumpkinAt.length - 1; i >= 0 && isPumpkinAt[i]; i--) trailingCount++
        const strayCount = pumpkinCount - trailingCount
        if (strayCount > 0) {
          console.warn(`[迁移] 检测到 ${player} 的 picks 中有 ${strayCount} 个穿插南瓜头（buggy 残留），正在清理`)
        }

        // 重建 picks（删除穿插南瓜）并建立 oldIdx → newIdx 映射
        const indexMap = {}
        const cleanPicks = []
        picks.forEach((plantId, oldIdx) => {
          const isStray = isPumpkinAt[oldIdx] && oldIdx < picks.length - trailingCount
          if (isStray) return
          indexMap[oldIdx] = cleanPicks.length
          cleanPicks.push(plantId)
        })
        this.currentRound.picks[player] = cleanPicks

        // 重映射 pumpkinProtection 的 key（指向已删除穿插南瓜的 key 丢弃）
        const oldProtection = this.currentRound.pumpkinProtection || {}
        const newProtection = {}
        for (const [key, value] of Object.entries(oldProtection)) {
          const m = key.match(/^(player[12])_(\d+)$/)
          if (!m || m[1] !== player) { newProtection[key] = value; continue }
          const oldIdx = Number(m[2])
          if (oldIdx in indexMap) {
            newProtection[`${player}_${indexMap[oldIdx]}`] = value
          }
        }
        this.currentRound.pumpkinProtection = newProtection

        // 基于末尾连续南瓜重建 pending 状态
        if (trailingCount > 0) {
          const start = cleanPicks.length - trailingCount
          this.currentRound.lastPumpkinIndices =
            Array.from({ length: trailingCount }, (_, i) => start + i)
          this.currentRound.extraPick = { player, remaining: trailingCount }
        }
      })

      // 清理后已无南瓜却仍残留 pending（无法可靠恢复），重置
      const hasPumpkin = ['player1', 'player2'].some(p =>
        (this.currentRound?.picks?.[p] || []).some(id => this.isPumpkinPlant(id)))
      if (!hasPumpkin && this.currentRound?.extraPick) {
        this.currentRound.extraPick = null
        delete this.currentRound.lastPumpkinIndices
      }
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
        lastManualGlobalBan: this.lastManualGlobalBan,
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
      this.lastManualGlobalBan = gameState.lastManualGlobalBan || null
      this.undoStack = Array.isArray(gameState.undoStack) ? gameState.undoStack : []
      this.lastActor = gameState.lastActor ?? null
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
        lastManualGlobalBan: this.lastManualGlobalBan,
        undoStack: this.undoStack,
        lastActor: this.lastActor,
        gameStatus: this.gameStatus,
        roundWinner: this.roundWinner,
        winThreshold: this.winThreshold,
        ruleConfig: this.ruleConfig
      }
    },

    triggerPlantCacheUpdate() {
      // 递增计数器（而非 Date.now()）：保证每次 bump 严格不同，
      // 避免同毫秒内连续触发（如自动化/测试/批量操作）碰撞导致依赖该版本号的 computed 不重算
      this._plantCacheVersion++
    },

    // 从配置预设恢复 ruleConfig（整体合并默认值，与 loadFromLocalStorage/applySyncState 同范式）。
    // 由 ConfigManager 加载配置时调用：写入 bpGameState 后随页面 reload 生效。
    applyRuleConfig(ruleConfig) {
      this.ruleConfig = { ...defaultRules, ...(ruleConfig || {}) }
      this.saveToLocalStorage()
    }
  }
})

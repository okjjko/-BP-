/**
 * 联机连接状态 Store
 * 负责房间管理、角色身份、状态同步、WebRTC 通信
 */
import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import { getHiddenPlants, importCustomPlant, clearAllCustomPlants, updateCache } from '@/data/customPlants'
import roomManager from '@/utils/roomManager'
import { useGameStore } from './gameStore'

export const useConnectionStore = defineStore('connection', {
  state: () => ({
    // 房间模式
    roomMode: 'local', // 'local' | 'host' | 'player' | 'spectator'
    inviteCode: null,
    myRole: null, // 'host' | 'player' | 'spectator'
    connectionStatus: 'disconnected', // 'disconnected' | 'connected' | 'connecting'
    connectedUsers: [],
    isViewOnly: false,

    // 同步状态
    stateVersion: 0,
    lastSyncTime: null,
    isSyncing: false,
    syncError: null,
    lastSyncVersion: 0,
    _isSyncing: false, // 防止重复设置监听器

    // 选手身份
    myPlayerId: null,
    myPlayerName: '',
    myAssignedPlayer: null, // 'player1' | 'player2'

    // 公共房间（lobby）状态（仅 host 用，供刷新重连时恢复"公开"状态）
    wasPublicRoom: false,
    hostName: null, // 房主显示名（lobby 展示用）
  }),

  getters: {
    isMyTurn: (state) => {
      const gameStore = useGameStore()
      if (state.roomMode === 'local') return true
      if (state.isViewOnly) return false
      if (state.myRole === 'host') {
        // 选手 host（兼选手）：按自己选手身份的回合判定；纯裁判 host：恒 true（向后兼容）
        if (state.myAssignedPlayer) {
          const cp = gameStore.currentRound?.currentPlayer
          return !!cp && cp === state.myAssignedPlayer
        }
        return true
      }

      if (!gameStore.currentRound?.currentPlayer) return false
      if (!state.myAssignedPlayer) return false

      return gameStore.currentRound.currentPlayer === state.myAssignedPlayer
    },

    myTurnDescription: (state) => {
      const gameStore = useGameStore()
      if (state.roomMode === 'local') return ''
      if (state.isViewOnly) return '观众模式'
      // 纯裁判 host 显示「主办方」；选手 host（myAssignedPlayer 非空）走下方回合文案
      if (state.myRole === 'host' && !state.myAssignedPlayer) return '主办方'

      const currentPlayer = gameStore.currentRound?.currentPlayer
      if (!currentPlayer) return '等待开始'

      if (state.isMyTurn) {
        const playerLabel = currentPlayer === 'player1' ? '选手1' : '选手2'
        return `当前回合：${playerLabel}`
      } else {
        const playerLabel = currentPlayer === 'player1' ? '选手1' : '选手2'
        return `对方回合：${playerLabel}`
      }
    },
  },

  actions: {
    // ========== 身份管理 ==========

    setMyIdentity(role, playerName) {
      this.myRole = role
      this.myPlayerName = playerName || ''
      // 统一重置 myAssignedPlayer：setMyIdentity 在创建/重连时会先执行，清掉残留身份，
      // 再由 assignPlayerIdentityOnInit（开局）或 rederiveMyIdentity（重连）重新设置。
      // 避免选手 host 重连后残留 'player1'，使「不参赛 host」误走回合制。
      this.myAssignedPlayer = null

      if (role === 'host') {
        this.myPlayerId = 'host'
      } else {
        this.myPlayerId = null
      }

      this.saveMultiplayerSession()
    },

    assignPlayerIdentityOnInit(player1Id, player2Id) {
      if (this.roomMode !== 'local' && this.myRole === 'player') {
        if (this.myPlayerName === player1Id) {
          this.myAssignedPlayer = 'player1'
        } else if (this.myPlayerName === player2Id) {
          this.myAssignedPlayer = 'player2'
        }
      }

      if (this.roomMode === 'host') {
        // 选手 host（兼选手）：本地自分配 player1，且不为 host 自己发 identityAssigned
        // （避免服务器按 playerName 在 roster 找到 host 连接后回投）；player2 仍定向单投远端
        const hostIsPlayer1 = !!(this.myPlayerName && this.myPlayerName === player1Id)
        if (hostIsPlayer1) this.myAssignedPlayer = 'player1'
        this._sendIdentityAssignment(player2Id, 'player2')
        if (!hostIsPlayer1) this._sendIdentityAssignment(player1Id, 'player1')
      }
    },

    _sendIdentityAssignment(playerName, playerNumber) {
      roomManager.sendIdentityAssignment(playerName, playerNumber)
    },

    receiveIdentityAssignment(playerNumber) {
      this.myAssignedPlayer = playerNumber
    },

    // ========== 房间管理 ==========

    setRoomMode(mode, inviteCode = null) {
      this.roomMode = mode
      this.inviteCode = inviteCode
      this.isViewOnly = mode === 'spectator'

      if (mode === 'local') {
        this.connectionStatus = 'disconnected'
        this.clearMultiplayerSession()
      } else {
        this.saveMultiplayerSession()
      }
    },

    disconnectRoom() {
      this.stopStateSync()
      roomManager.disconnect()

      this.roomMode = 'local'
      this.inviteCode = null
      this.myRole = null
      this.connectionStatus = 'disconnected'
      this.connectedUsers = []
      this.isViewOnly = false
    },

    // ========== 状态同步 ==========

    startStateSync() {
      if (this.roomMode === 'local') return
      if (this._isSyncing) return

      this._isSyncing = true

      // 暴露到 window 以便调试
      if (typeof window !== 'undefined') {
        window.$debugStore = useGameStore()
        window.$roomManager = roomManager
      }

      roomManager.on('stateUpdate', this.handleStateUpdate)
      roomManager.on('customPlants', this.handleCustomPlantsSync)
      roomManager.on('roster', this.handleRoster)
      roomManager.on('identityAssigned', (data) => {
        if (data.playerName === this.myPlayerName) {
          this.receiveIdentityAssignment(data.playerNumber)
        }
      })
    },

    stopStateSync() {
      roomManager.off('stateUpdate', this.handleStateUpdate)
      roomManager.off('customPlants', this.handleCustomPlantsSync)
      roomManager.off('roster', this.handleRoster)
      this._isSyncing = false
    },

    syncState() {
      if (this.roomMode === 'local') return

      this.stateVersion++
      const gameStore = useGameStore()
      const gameState = gameStore.getSyncPayload()

      if (this.roomMode === 'host') {
        roomManager.broadcastState(gameState, this.stateVersion)
      } else {
        roomManager.sendStateUpdate(gameState, this.stateVersion)
      }
    },

    handleStateUpdate(message) {
      try {
        const { senderId, senderRole, timestamp, version, gameState } = message

        if (version <= this.stateVersion) return

        this.isSyncing = true
        this.syncError = null
        this.stateVersion = version
        this.lastSyncTime = timestamp
        this.lastSyncVersion = version

        const gameStore = useGameStore()
        gameStore.applySyncState(gameState)

        // 身份自愈：重连/重新加入后 myAssignedPlayer 可能丢失，从刚恢复的 player1/player2.id 本地推导
        this.rederiveMyIdentity()

        nextTick(() => {
          this.isSyncing = false
        })

        // 主办方转发
        if (this.myRole === 'host' && senderRole !== 'host') {
          nextTick(() => {
            roomManager.broadcastToOthers(gameState, version, senderId)
          })
        }
      } catch (error) {
        console.error('[connectionStore] 状态更新失败:', error)
        this.syncError = error.message
        this.isSyncing = false
      }
    },

    async handleCustomPlantsSync(message) {
      const { plants, hiddenBuiltinPlants } = message

      try {
        await clearAllCustomPlants()

        for (const plant of plants) {
          await importCustomPlant(plant)
        }

        if (hiddenBuiltinPlants && hiddenBuiltinPlants.length > 0) {
          localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(hiddenBuiltinPlants))
        }

        await updateCache()

        const gameStore = useGameStore()
        gameStore.triggerPlantCacheUpdate()
      } catch (error) {
        console.error('[connectionStore] 同步植物配置失败:', error)
        this.syncError = '植物同步失败: ' + error.message
      }
    },

    // ========== 身份自愈与重连补发 ==========

    // 从已恢复的游戏状态本地重推导 myAssignedPlayer（幂等：已有身份不覆盖）。
    // 动机：myAssignedPlayer 不持久化，页面刷新重连/重新加入后内存丢失；
    // 而 player1.id/player2.id（= 选手名字）随每次状态同步下发，可纯本地推导，无需 host 重发。
    // 修复重连后 isMyTurn / 撤销权（lastActor===myAssignedPlayer）失效问题。
    rederiveMyIdentity() {
      if (this.roomMode === 'local') return
      if (this.myAssignedPlayer) return
      // player 或选手 host（host 带参赛名）可本地推导；纯裁判 host（无参赛名）跳过
      const isPlayerLike = this.myRole === 'player'
        || (this.myRole === 'host' && !!this.myPlayerName)
      if (!isPlayerLike) return
      const gameStore = useGameStore()
      if (gameStore.player1?.id && gameStore.player1.id === this.myPlayerName) {
        this.myAssignedPlayer = 'player1'
      } else if (gameStore.player2?.id && gameStore.player2.id === this.myPlayerName) {
        this.myAssignedPlayer = 'player2'
      }
      // 都不匹配则保持 null → 降级只读（安全失败，不会误判成对方）
    },

    // host 侧：成员名册变动时，若游戏已开始，为（重新）加入的选手补发身份 + 推送当前状态。
    // 覆盖「host 刷新重连（新邀请码）后选手重新加入」等无 gameStart 的场景，让重连者无缝续上。
    // 服务器 identityAssigned 按 playerName 定向单投，重复补发幂等；syncState 带版本号，在线者去重。
    handleRoster(message) {
      if (this.myRole !== 'host') return
      const gameStore = useGameStore()
      // 赛前正常走 gameStart 流程，无需补发
      if (!gameStore.gameStatus || gameStore.gameStatus === 'setup') return

      const members = Array.isArray(message?.members) ? message.members : []
      let touched = false
      for (const m of members) {
        if (m.role !== 'player' || m.connected === false || !m.playerName) continue
        if (m.playerName === gameStore.player1?.id) {
          this._sendIdentityAssignment(m.playerName, 'player1'); touched = true
        } else if (m.playerName === gameStore.player2?.id) {
          this._sendIdentityAssignment(m.playerName, 'player2'); touched = true
        }
      }
      // 推一次当前状态，让重新加入者立刻拿到进度
      if (touched) this.syncState()
    },

    // ========== 会话持久化 ==========

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
        wasPublicRoom: this.wasPublicRoom || false, // 供 host 重连时恢复"公开"状态
        hostName: this.hostName || null,
        timestamp: Date.now()
      }
      localStorage.setItem('bpMultiplayerSession', JSON.stringify(session))
    },

    loadMultiplayerSession() {
      const saved = localStorage.getItem('bpMultiplayerSession')
      if (saved) {
        try {
          const session = JSON.parse(saved)
          const sessionAge = Date.now() - session.timestamp
          if (sessionAge > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('bpMultiplayerSession')
            return null
          }
          return session
        } catch (e) {
          localStorage.removeItem('bpMultiplayerSession')
          return null
        }
      }
      return null
    },

    clearMultiplayerSession() {
      localStorage.removeItem('bpMultiplayerSession')
    },

    // ========== 旧接口兼容（供 RoomSetup 等组件使用） ==========

    setRole(role) {
      localStorage.setItem('bp-tool-current-role', role)
    }
  }
})

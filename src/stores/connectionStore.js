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
      if (state.myRole === 'host') return true

      if (!gameStore.currentRound?.currentPlayer) return false
      if (!state.myAssignedPlayer) return false

      return gameStore.currentRound.currentPlayer === state.myAssignedPlayer
    },

    myTurnDescription: (state) => {
      const gameStore = useGameStore()
      if (state.roomMode === 'local') return ''
      if (state.isViewOnly) return '观众模式'
      if (state.myRole === 'host') return '主办方'

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

      if (role === 'host') {
        this.myPlayerId = 'host'
      } else {
        this.myPlayerId = null
        this.myAssignedPlayer = null
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
        this._sendIdentityAssignment(player1Id, 'player1')
        this._sendIdentityAssignment(player2Id, 'player2')
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
      roomManager.on('identityAssigned', (data) => {
        if (data.playerName === this.myPlayerName) {
          this.receiveIdentityAssignment(data.playerNumber)
        }
      })
    },

    stopStateSync() {
      roomManager.off('stateUpdate', this.handleStateUpdate)
      roomManager.off('customPlants', this.handleCustomPlantsSync)
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

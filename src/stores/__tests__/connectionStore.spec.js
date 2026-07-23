/**
 * connectionStore 单元测试
 *
 * 覆盖：
 * - isMyTurn：local 永真 / spectator 永假 / host 永真 / player 自回合 vs 对回合
 * - 版本号去重（旧/重复 version 被 handleStateUpdate 忽略）
 * - handleStateUpdate 应用远端状态（调用 gameStore.applySyncState）
 *
 * roomManager 被 mock（vi.mock），gameStore 用真实实例 + 手动设 state。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock roomManager：factory 内构造 mock 对象（不引用外部变量，避免 hoisting 报错）
vi.mock('@/utils/roomManager', () => {
  const mock = {
    on: vi.fn(),
    off: vi.fn(),
    broadcastState: vi.fn(),
    sendStateUpdate: vi.fn(),
    broadcastToOthers: vi.fn(),
    broadcastGameStart: vi.fn(),
    broadcastCustomPlants: vi.fn(),
    sendIdentityAssignment: vi.fn(),
    disconnect: vi.fn(),
    connections: new Map(),
    getConnectedPlayerNames: vi.fn(() => [])
  }
  return { default: mock, RoomManager: function () { return mock } }
})

vi.mock('@/data/customPlants', () => ({
  getHiddenPlants: vi.fn(() => []),
  importCustomPlant: vi.fn(async () => {}),
  clearAllCustomPlants: vi.fn(async () => {}),
  updateCache: vi.fn(async () => {})
}))

import roomManager from '@/utils/roomManager'

import { useConnectionStore } from '@/stores/connectionStore'
import { useGameStore } from '@/stores/gameStore'

describe('connectionStore', () => {
  let pinia
  let store
  let gameStore

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useConnectionStore()
    gameStore = useGameStore()
    // 重置 mock 调用记录
    vi.clearAllMocks()
  })

  describe('isMyTurn', () => {
    it('local 模式永远返回 true', () => {
      store.roomMode = 'local'
      expect(store.isMyTurn).toBe(true)
    })

    it('spectator（isViewOnly）永远返回 false', () => {
      store.roomMode = 'player'
      store.myRole = 'spectator'
      store.isViewOnly = true
      expect(store.isMyTurn).toBe(false)
    })

    it('host 永远返回 true', () => {
      store.roomMode = 'host'
      store.myRole = 'host'
      store.isViewOnly = false
      expect(store.isMyTurn).toBe(true)
    })

    it('player 当前回合 = myAssignedPlayer → true（自回合）', () => {
      store.roomMode = 'player'
      store.myRole = 'player'
      store.isViewOnly = false
      store.myAssignedPlayer = 'player1'
      gameStore.currentRound = { currentPlayer: 'player1' }
      expect(store.isMyTurn).toBe(true)
    })

    it('player 当前回合 ≠ myAssignedPlayer → false（对回合）', () => {
      store.roomMode = 'player'
      store.myRole = 'player'
      store.isViewOnly = false
      store.myAssignedPlayer = 'player1'
      gameStore.currentRound = { currentPlayer: 'player2' }
      expect(store.isMyTurn).toBe(false)
    })

    it('player 未分配身份 → false', () => {
      store.roomMode = 'player'
      store.myRole = 'player'
      store.isViewOnly = false
      store.myAssignedPlayer = null
      gameStore.currentRound = { currentPlayer: 'player1' }
      expect(store.isMyTurn).toBe(false)
    })

    it('player 无 currentPlayer → false', () => {
      store.roomMode = 'player'
      store.myRole = 'player'
      store.isViewOnly = false
      store.myAssignedPlayer = 'player1'
      gameStore.currentRound = { currentPlayer: null }
      expect(store.isMyTurn).toBe(false)
    })
  })

  describe('handleStateUpdate 版本去重', () => {
    it('旧版本被忽略（version <= stateVersion）', () => {
      store.stateVersion = 5
      const spy = vi.spyOn(gameStore, 'applySyncState')
      store.handleStateUpdate({
        senderId: 'x', senderRole: 'player',
        timestamp: Date.now(), version: 3, gameState: { a: 1 }
      })
      expect(spy).not.toHaveBeenCalled()
    })

    it('相同版本被忽略（回声去重，契约 §8）', () => {
      store.stateVersion = 5
      const spy = vi.spyOn(gameStore, 'applySyncState')
      store.handleStateUpdate({
        senderId: 'x', senderRole: 'player',
        timestamp: Date.now(), version: 5, gameState: { a: 1 }
      })
      expect(spy).not.toHaveBeenCalled()
    })

    it('新版本被应用（applySyncState 调用 + stateVersion 更新）', () => {
      store.stateVersion = 5
      const spy = vi.spyOn(gameStore, 'applySyncState').mockImplementation(() => {})
      store.handleStateUpdate({
        senderId: 'x', senderRole: 'player',
        timestamp: 12345, version: 8, gameState: { step: 1 }
      })
      expect(spy).toHaveBeenCalledWith({ step: 1 })
      expect(store.stateVersion).toBe(8)
      expect(store.lastSyncVersion).toBe(8)
      expect(store.lastSyncTime).toBe(12345)
    })

    it('host 收到 client 状态后会转发（broadcastToOthers）', async () => {
      store.stateVersion = 0
      store.myRole = 'host'
      // mock applySyncState 避免 gameStore 完整 state 校验干扰
      vi.spyOn(gameStore, 'applySyncState').mockImplementation(() => {})
      store.handleStateUpdate({
        senderId: 'cli-1', senderRole: 'player',
        timestamp: 1, version: 2, gameState: { x: 1 }
      })
      // nextTick 内的转发
      await new Promise((r) => setTimeout(r, 0))
      expect(roomManager.broadcastToOthers).toHaveBeenCalledWith({ x: 1 }, 2, 'cli-1')
    })

    it('host 收到自己的状态不转发（senderRole === host）', async () => {
      store.stateVersion = 0
      store.myRole = 'host'
      vi.spyOn(gameStore, 'applySyncState').mockImplementation(() => {})
      store.handleStateUpdate({
        senderId: 'me', senderRole: 'host',
        timestamp: 1, version: 2, gameState: { x: 1 }
      })
      await new Promise((r) => setTimeout(r, 0))
      expect(roomManager.broadcastToOthers).not.toHaveBeenCalled()
    })
  })

  describe('_sendIdentityAssignment（B6 改造）', () => {
    it('调用 roomManager.sendIdentityAssignment 而非直接遍历 connections', () => {
      store._sendIdentityAssignment('alice', 'player1')
      expect(roomManager.sendIdentityAssignment).toHaveBeenCalledWith('alice', 'player1')
      expect(roomManager.sendIdentityAssignment).toHaveBeenCalledTimes(1)
    })
  })

  describe('syncState', () => {
    it('host 模式调 broadcastState', () => {
      store.roomMode = 'host'
      store.stateVersion = 0
      vi.spyOn(gameStore, 'getSyncPayload').mockReturnValue({ s: 1 })
      store.syncState()
      expect(roomManager.broadcastState).toHaveBeenCalledWith({ s: 1 }, 1)
    })

    it('player 模式调 sendStateUpdate', () => {
      store.roomMode = 'player'
      store.stateVersion = 0
      vi.spyOn(gameStore, 'getSyncPayload').mockReturnValue({ s: 2 })
      store.syncState()
      expect(roomManager.sendStateUpdate).toHaveBeenCalledWith({ s: 2 }, 1)
    })

    it('local 模式不发送', () => {
      store.roomMode = 'local'
      store.syncState()
      expect(roomManager.broadcastState).not.toHaveBeenCalled()
      expect(roomManager.sendStateUpdate).not.toHaveBeenCalled()
    })
  })

  describe('identityAssigned 监听（startStateSync 注册）', () => {
    it('注册监听器：收到匹配 playerName 的 identityAssigned → receiveIdentityAssignment', () => {
      store.roomMode = 'player'
      store.myPlayerName = 'alice'
      store.startStateSync()

      // 取 identityAssigned 回调（第三个 on 调用）
      const calls = roomManager.on.mock.calls
      const identityCall = calls.find((c) => c[0] === 'identityAssigned')
      expect(identityCall).toBeTruthy()
      const handler = identityCall[1]

      handler({ playerName: 'alice', playerNumber: 'player1' })
      expect(store.myAssignedPlayer).toBe('player1')
    })

    it('非匹配 playerName 不生效', () => {
      store.roomMode = 'player'
      store.myPlayerName = 'alice'
      store.startStateSync()
      const calls = roomManager.on.mock.calls
      const handler = calls.find((c) => c[0] === 'identityAssigned')[1]
      handler({ playerName: 'bob', playerNumber: 'player2' })
      expect(store.myAssignedPlayer).toBeNull()
    })
  })

  describe('rederiveMyIdentity 身份自愈（重连后本地推导）', () => {
    beforeEach(() => {
      store.roomMode = 'player'
      store.myRole = 'player'
      store.isViewOnly = false
      store.myAssignedPlayer = null
    })

    it('myPlayerName 匹配 player1.id → player1', () => {
      store.myPlayerName = 'alice'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBe('player1')
    })

    it('myPlayerName 匹配 player2.id → player2', () => {
      store.myPlayerName = 'bob'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBe('player2')
    })

    it('已有身份不覆盖（幂等）', () => {
      store.myPlayerName = 'alice'
      store.myAssignedPlayer = 'player2' // 故意设"错"，验证不被覆盖
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBe('player2')
    })

    it('名字都不匹配 → 保持 null（安全失败，降级只读）', () => {
      store.myPlayerName = 'carol'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBeNull()
    })

    it('local / spectator / host 不推导', () => {
      store.myPlayerName = 'alice'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }

      store.roomMode = 'local'
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBeNull()

      store.roomMode = 'player'
      store.myRole = 'spectator'
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBeNull()

      store.myRole = 'host'
      store.rederiveMyIdentity()
      expect(store.myAssignedPlayer).toBeNull()
    })

    it('端到端：setMyIdentity 重置 null → handleStateUpdate 后身份自愈 → isMyTurn 正确', () => {
      store.myPlayerName = 'alice'
      gameStore.currentRound = { currentPlayer: 'player1' }
      // 重连：joinRoom 触发 setMyIdentity，把 myAssignedPlayer 清成 null（bug 复现）
      store.setMyIdentity('player', 'alice')
      expect(store.myAssignedPlayer).toBeNull()
      expect(store.isMyTurn).toBe(false) // 即便轮到自己也无法操作

      // 收到 host 推送的状态 → 真实 applySyncState 恢复 player1/player2.id → rederive 自愈
      store.stateVersion = 0
      store.handleStateUpdate({
        senderId: 'host', senderRole: 'host',
        timestamp: Date.now(), version: 1,
        gameState: {
          player1: { id: 'alice', score: 0, road: 2 },
          player2: { id: 'bob', score: 0, road: 4 },
          firstPlayer: 'player1',
          currentRound: { currentPlayer: 'player1' },
          globalBans: [],
          plantUsage: {},
          pumpkinUsage: { player1: 0, player2: 0 },
          gameStatus: 'banning'
        }
      })

      expect(store.myAssignedPlayer).toBe('player1')
      expect(store.isMyTurn).toBe(true) // 修复后：轮到自己能操作
    })
  })

  describe('handleRoster host 补发身份（重新加入场景）', () => {
    beforeEach(() => {
      store.roomMode = 'host'
      store.myRole = 'host'
      vi.clearAllMocks()
    })

    it('游戏进行中 + members 含匹配 player → 补发 identityAssigned + syncState', () => {
      gameStore.gameStatus = 'banning'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }
      vi.spyOn(gameStore, 'getSyncPayload').mockReturnValue({ s: 1 })

      store.handleRoster({
        members: [
          { clientId: 'c1', role: 'player', playerName: 'alice', connected: true },
          { clientId: 'c2', role: 'player', playerName: 'bob', connected: true },
          { clientId: 'c3', role: 'spectator', playerName: 'eve', connected: true }
        ]
      })

      expect(roomManager.sendIdentityAssignment).toHaveBeenCalledWith('alice', 'player1')
      expect(roomManager.sendIdentityAssignment).toHaveBeenCalledWith('bob', 'player2')
      expect(roomManager.broadcastState).toHaveBeenCalled() // syncState → host 走 broadcastState
    })

    it('赛前（gameStatus=setup）不补发', () => {
      gameStore.gameStatus = 'setup'
      gameStore.player1 = { id: 'alice', score: 0, road: null }
      gameStore.player2 = { id: 'bob', score: 0, road: null }

      store.handleRoster({
        members: [{ clientId: 'c1', role: 'player', playerName: 'alice', connected: true }]
      })

      expect(roomManager.sendIdentityAssignment).not.toHaveBeenCalled()
      expect(roomManager.broadcastState).not.toHaveBeenCalled()
    })

    it('非 host 不补发', () => {
      store.myRole = 'player'
      store.roomMode = 'player'
      gameStore.gameStatus = 'banning'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }

      store.handleRoster({
        members: [{ clientId: 'c1', role: 'player', playerName: 'alice', connected: true }]
      })

      expect(roomManager.sendIdentityAssignment).not.toHaveBeenCalled()
    })

    it('members 无匹配 player → 不补发、不推状态', () => {
      gameStore.gameStatus = 'banning'
      gameStore.player1 = { id: 'alice', score: 0, road: 2 }
      gameStore.player2 = { id: 'bob', score: 0, road: 4 }

      store.handleRoster({
        members: [{ clientId: 'c3', role: 'spectator', playerName: 'eve', connected: true }]
      })

      expect(roomManager.sendIdentityAssignment).not.toHaveBeenCalled()
      expect(roomManager.broadcastState).not.toHaveBeenCalled()
    })

    it('已注册到 startStateSync（roster 事件）', () => {
      store.startStateSync()
      const calls = roomManager.on.mock.calls
      const rosterCall = calls.find((c) => c[0] === 'roster')
      expect(rosterCall).toBeTruthy()
      expect(rosterCall[1]).toBe(store.handleRoster)
    })
  })
})

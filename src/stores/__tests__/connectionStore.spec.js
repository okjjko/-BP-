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
})

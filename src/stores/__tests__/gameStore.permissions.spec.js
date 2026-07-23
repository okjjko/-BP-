/**
 * gameStore action 权限校验单元测试（§4.1 双层防御）
 *
 * 验证 finishRound/setRoundWinner/resetGame/returnToPositioning/applyNextRoundSideSelection/
 * setPositionAt/clearPositionAt/movePosition 在 spectator/player(非归属) 下返回
 * { ok:false, reason:'not-allowed' } 且不改状态；local/host/归属者正常执行。
 * 聚焦权限拒绝路径（action 头部守卫），避免触发 startRound 等下游复杂逻辑。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/roomManager', () => {
  const mock = {
    on: vi.fn(), off: vi.fn(), broadcastState: vi.fn(), sendStateUpdate: vi.fn(),
    broadcastToOthers: vi.fn(), broadcastGameStart: vi.fn(), broadcastCustomPlants: vi.fn(),
    sendIdentityAssignment: vi.fn(), disconnect: vi.fn(),
    connections: new Map(), getConnectedPlayerNames: vi.fn(() => [])
  }
  return { default: mock, RoomManager: function () { return mock } }
})

vi.mock('@/data/customPlants', () => ({
  getAllPlantsSync: vi.fn(() => [{ id: 'peashooter', name: '豌豆射手' }, { id: 'sunflower', name: '向日葵' }]),
  getHiddenPlants: vi.fn(() => []),
  getPlantImage: vi.fn(() => ''),
  getPlantName: vi.fn(() => ''),
  importCustomPlant: vi.fn(async () => {}),
  clearAllCustomPlants: vi.fn(async () => {}),
  updateCache: vi.fn(async () => {})
}))

vi.mock('@/utils/validators', () => ({
  canPick: vi.fn(() => ({ valid: true })),
  isPumpkin: vi.fn(() => false),
  validatePosition: vi.fn(() => ({ valid: true })),
  isGameOver: vi.fn(() => false),
  isGrandFinal: vi.fn(() => false)
}))

import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

describe('gameStore action 权限校验（双层防御）', () => {
  let game, conn

  beforeEach(() => {
    setActivePinia(createPinia())
    conn = useConnectionStore()
    game = useGameStore()
    game.gameStatus = 'banning'
    game.player1 = { id: '甲', road: 2, score: 0 }
    game.player2 = { id: '乙', road: 4, score: 0 }
    game.currentRound = {
      roundNumber: 1, stage: 1, step: 0, currentPlayer: 'player1', action: 'ban',
      bans: { player1: [], player2: [] },
      picks: { player1: ['peashooter'], player2: ['sunflower'] },
      positions: { player1: { road: 2, plants: [null, null, null, null, null] }, player2: { road: 4, plants: [null, null, null, null, null] } },
      isRoundComplete: false,
    }
    game.ruleConfig = { sideSelection: { loserPickMode: 'loser' } }
  })

  const deny = (r) => expect(r).toEqual({ ok: false, reason: 'not-allowed' })

  describe('finishRound', () => {
    it('spectator 被拒且不改状态', () => {
      conn.roomMode = 'spectator'; conn.myRole = 'spectator'; conn.isViewOnly = true
      const before = game.gameStatus
      deny(game.finishRound())
      expect(game.gameStatus).toBe(before)
    })
    it('host 通过并进入结算', () => {
      conn.roomMode = 'host'; conn.myRole = 'host'
      expect(game.finishRound()).toEqual({ ok: true })
      expect(game.gameStatus).toBe('result')
    })
  })

  describe('setRoundWinner', () => {
    it('spectator 被拒且不加分', () => {
      conn.roomMode = 'spectator'; conn.myRole = 'spectator'; conn.isViewOnly = true
      deny(game.setRoundWinner('player1'))
      expect(game.player1.score).toBe(0)
    })
    it('host 通过并加分', () => {
      conn.roomMode = 'host'; conn.myRole = 'host'
      expect(game.setRoundWinner('player1')).toEqual({ ok: true })
      expect(game.player1.score).toBe(1)
    })
  })

  describe('resetGame', () => {
    it('spectator 被拒', () => {
      conn.roomMode = 'spectator'; conn.myRole = 'spectator'; conn.isViewOnly = true
      expect(game.resetGame().ok).toBe(false)
    })
    it('local 通过', () => {
      conn.roomMode = 'local'
      expect(game.resetGame()).toEqual({ ok: true })
    })
  })

  describe('returnToPositioning', () => {
    it('player 被拒', () => {
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player1'
      deny(game.returnToPositioning())
    })
    it('host 通过', () => {
      conn.roomMode = 'host'; conn.myRole = 'host'
      expect(game.returnToPositioning()).toEqual({ ok: true })
      expect(game.gameStatus).toBe('positioning')
    })
  })

  describe('applyNextRoundSideSelection', () => {
    beforeEach(() => { game.roundWinner = 'player1' }) // player2 为败者/归属选路方

    it('非归属选手被拒且不换边', () => {
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player1' // 胜者，非归属
      const before = game.player1.road
      deny(game.applyNextRoundSideSelection({ loser: 'player2', winner: 'player1', pickerRoad: 2 }))
      expect(game.player1.road).toBe(before)
    })
    it('keep 模式下选手被拒（无人选）', () => {
      game.ruleConfig.sideSelection.loserPickMode = 'keep'
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player2'
      deny(game.applyNextRoundSideSelection({ loser: 'player2', winner: 'player1', pickerRoad: null }))
    })
  })

  describe('站位 action（setPositionAt / clearPositionAt / movePosition）', () => {
    it('setPositionAt：对方选手被拒', () => {
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player1'
      deny(game.setPositionAt('player2', 1, { plantId: 'sunflower' }))
    })
    it('setPositionAt：spectator 被拒', () => {
      conn.roomMode = 'spectator'; conn.myRole = 'spectator'; conn.isViewOnly = true
      deny(game.setPositionAt('player1', 1, { plantId: 'peashooter' }))
    })
    it('setPositionAt：自己方通过', () => {
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player1'
      const r = game.setPositionAt('player1', 1, { plantId: 'peashooter', sourceIndex: 0 })
      expect(r.ok).toBe(true)
      expect(game.currentRound.positions.player1.plants[0]).toBeTruthy()
    })
    it('clearPositionAt：spectator 被拒', () => {
      conn.roomMode = 'spectator'; conn.myRole = 'spectator'; conn.isViewOnly = true
      deny(game.clearPositionAt('player1', 1))
    })
    it('movePosition：非归属方被拒', () => {
      conn.roomMode = 'player'; conn.myRole = 'player'; conn.myAssignedPlayer = 'player1'
      deny(game.movePosition('player2', 1, 2))
    })
  })
})

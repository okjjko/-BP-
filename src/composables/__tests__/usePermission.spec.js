/**
 * usePermission composable 单元测试（§4.1 多人对战按钮级权限）
 *
 * 覆盖各权限原语在 local/host/player(回合内/外)/spectator 四身份下的值、
 * canSetPosition 归属判定、canSelectSide 三种 loserPickMode、canUndo 的 lastActor 模型、
 * canManageConfig 的赛前锁定。
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
  getAllPlantsSync: vi.fn(() => []),
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
import { usePermission } from '@/composables/usePermission'

describe('usePermission 权限矩阵', () => {
  let conn, game

  beforeEach(() => {
    setActivePinia(createPinia())
    conn = useConnectionStore()
    game = useGameStore()
    // 默认处于 BP 阶段、player1 回合
    game.gameStatus = 'banning'
    game.currentRound = {
      roundNumber: 1, currentPlayer: 'player1', action: 'ban',
      positions: { player1: { road: 2, plants: [] }, player2: { road: 4, plants: [] } },
    }
    game.ruleConfig = { sideSelection: { loserPickMode: 'loser', initialMode: 'mutual', initialPicker: null } }
    game.roundWinner = null
    game.undoStack = []
    game.lastActor = null
  })

  // 设置当前身份
  const as = (opts) => {
    conn.roomMode = opts.roomMode ?? 'local'
    conn.myRole = opts.myRole ?? null
    conn.myAssignedPlayer = opts.myAssignedPlayer ?? null
    conn.isViewOnly = opts.isViewOnly ?? false
  }

  describe('isAuthority', () => {
    it('local 与 host 为裁判权威', () => {
      as({ roomMode: 'local' })
      expect(usePermission().isAuthority.value).toBe(true)
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().isAuthority.value).toBe(true)
    })
    it('player/spectator 非权威', () => {
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().isAuthority.value).toBe(false)
      as({ roomMode: 'spectator', myRole: 'spectator', isViewOnly: true })
      expect(usePermission().isAuthority.value).toBe(false)
    })
  })

  describe('canBP（ban/pick 选植物）', () => {
    it('local/host 永可；spectator 永不可', () => {
      as({ roomMode: 'local' })
      expect(usePermission().canBP.value).toBe(true)
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canBP.value).toBe(true)
      as({ roomMode: 'spectator', myRole: 'spectator', isViewOnly: true })
      expect(usePermission().canBP.value).toBe(false)
    })
    it('player 仅本人回合可（currentPlayer=player1）', () => {
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().canBP.value).toBe(true) // 自己回合
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player2' })
      expect(usePermission().canBP.value).toBe(false) // 对方回合
    })
  })

  describe('canSetPosition（站位：选手摆自己，host 代双方）', () => {
    it('host 可摆双方', () => {
      as({ roomMode: 'host', myRole: 'host' })
      const { canSetPosition } = usePermission()
      expect(canSetPosition('player1')).toBe(true)
      expect(canSetPosition('player2')).toBe(true)
    })
    it('player 仅摆自己方', () => {
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      const { canSetPosition } = usePermission()
      expect(canSetPosition('player1')).toBe(true)
      expect(canSetPosition('player2')).toBe(false)
    })
    it('spectator 都不可', () => {
      as({ roomMode: 'spectator', myRole: 'spectator', isViewOnly: true })
      const { canSetPosition } = usePermission()
      expect(canSetPosition('player1')).toBe(false)
      expect(canSetPosition('player2')).toBe(false)
    })
  })

  describe('canControlMatch（流程控制：仅裁判）', () => {
    it('local/host 可；player/spectator 不可', () => {
      as({ roomMode: 'local' })
      expect(usePermission().canControlMatch.value).toBe(true)
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canControlMatch.value).toBe(true)
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().canControlMatch.value).toBe(false)
      as({ roomMode: 'spectator', myRole: 'spectator', isViewOnly: true })
      expect(usePermission().canControlMatch.value).toBe(false)
    })
  })

  describe('canSelectSide（选路权：按 loserPickMode 归属者 + host 代操）', () => {
    beforeEach(() => { game.roundWinner = 'player1' }) // player1 胜 → player2 败

    it('host 永可代操', () => {
      game.ruleConfig.sideSelection.loserPickMode = 'loser'
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canSelectSide.value).toBe(true)
    })
    it('loser 模式：败者(player2)可，胜者(player1)不可', () => {
      game.ruleConfig.sideSelection.loserPickMode = 'loser'
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player2' })
      expect(usePermission().canSelectSide.value).toBe(true)
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().canSelectSide.value).toBe(false)
    })
    it('winner 模式：胜者(player1)可，败者(player2)不可', () => {
      game.ruleConfig.sideSelection.loserPickMode = 'winner'
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().canSelectSide.value).toBe(true)
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player2' })
      expect(usePermission().canSelectSide.value).toBe(false)
    })
    it('keep 模式：选手不可（仅 host）', () => {
      game.ruleConfig.sideSelection.loserPickMode = 'keep'
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player2' })
      expect(usePermission().canSelectSide.value).toBe(false)
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canSelectSide.value).toBe(true)
    })
    it('无 roundWinner 时选手不可', () => {
      game.roundWinner = null
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player2' })
      expect(usePermission().canSelectSide.value).toBe(false)
    })
  })

  describe('canUndo（lastActor 模型）', () => {
    beforeEach(() => {
      game.gameStatus = 'banning'
      game.undoStack = [{ currentRound: {}, globalBans: [], plantUsage: {} }]
    })
    it('观众不可', () => {
      as({ roomMode: 'spectator', myRole: 'spectator', isViewOnly: true })
      expect(usePermission().canUndo.value).toBe(false)
    })
    it('裁判永可', () => {
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canUndo.value).toBe(true)
    })
    it('选手仅当 lastActor===自己', () => {
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      game.lastActor = 'player1'
      expect(usePermission().canUndo.value).toBe(true)
      game.lastActor = 'player2'
      expect(usePermission().canUndo.value).toBe(false)
    })
    it('空栈或非 banning 阶段不可', () => {
      as({ roomMode: 'host', myRole: 'host' })
      game.undoStack = []
      expect(usePermission().canUndo.value).toBe(false)
      game.undoStack = [{}]
      game.gameStatus = 'positioning'
      expect(usePermission().canUndo.value).toBe(false)
    })
  })

  describe('canManageConfig（裁判 + 仅赛前）', () => {
    it('裁判赛前可', () => {
      game.gameStatus = 'setup'
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canManageConfig.value).toBe(true)
    })
    it('赛中锁定（裁判也不可改规则）', () => {
      game.gameStatus = 'banning'
      as({ roomMode: 'host', myRole: 'host' })
      expect(usePermission().canManageConfig.value).toBe(false)
    })
    it('选手不可', () => {
      game.gameStatus = 'setup'
      as({ roomMode: 'player', myRole: 'player', myAssignedPlayer: 'player1' })
      expect(usePermission().canManageConfig.value).toBe(false)
    })
  })
})

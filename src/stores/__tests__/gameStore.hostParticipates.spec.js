/**
 * initGame host 兼选手道路分配回归测试（R3）
 *
 * 守护：host 参赛时固定 player1=2路、player2=4路，忽略 ruleConfig.sideSelection.initialMode，
 * 且必须在 startRound 生成 BP 序列前确定（否则 road 与 BP 序列映射错乱）。
 * 判定：connStore.roomMode==='host' && connStore.myPlayerName === player1Id
 *
 * 回归点：
 * - host 参赛（myPlayerName===player1Id）：random/assigned/mutual 均强制 2/4
 * - host 未参赛（myPlayerName 空）：走原 mutual 逻辑（用传入 road），3 人模式不变
 * - local 模式：不触发 host 参赛分支
 * - host 参赛后 road2Player/road4Player 映射正确，BP 序列正常生成
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock roomManager：connectionStore 依赖它
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
  getPlantDesc: vi.fn(() => ''),
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

describe('initGame host 兼选手道路分配（R3）', () => {
  let gameStore
  let connStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    connStore = useConnectionStore()
  })

  it('host 参赛 + initialMode=random → 强制 player1=2路/player2=4路（不被随机覆盖）', () => {
    connStore.roomMode = 'host'
    connStore.myRole = 'host'
    connStore.myPlayerName = 'hostAlice' // = player1Id
    gameStore.ruleConfig.sideSelection.initialMode = 'random'

    gameStore.initGame('hostAlice', 'remoteBob', 'player1', null, null, 4)

    expect(gameStore.player1.road).toBe(2)
    expect(gameStore.player2.road).toBe(4)
  })

  it('host 参赛 + initialMode=assigned → 仍强制 2/4（忽略 assigned）', () => {
    connStore.roomMode = 'host'
    connStore.myRole = 'host'
    connStore.myPlayerName = 'hostAlice'
    gameStore.ruleConfig.sideSelection.initialMode = 'assigned'
    gameStore.ruleConfig.sideSelection.initialPicker = 'player2'

    gameStore.initGame('hostAlice', 'remoteBob', 'player1', null, null, 4)

    expect(gameStore.player1.road).toBe(2)
    expect(gameStore.player2.road).toBe(4)
  })

  it('host 未参赛（myPlayerName 空）+ mutual → 用 host 下发的传入 road（不强制 2/4）', () => {
    connStore.roomMode = 'host'
    connStore.myRole = 'host'
    connStore.myPlayerName = '' // 纯裁判，不参赛
    gameStore.ruleConfig.sideSelection.initialMode = 'mutual'

    // 传入 alice=4路、bob=2路，验证用传入值而非强制 2/4
    gameStore.initGame('alice', 'bob', 'player1', 4, 2, 4)

    expect(gameStore.player1.road).toBe(4)
    expect(gameStore.player2.road).toBe(2)
  })

  it('多人 host 不参赛 + random 配置 → 用 host 下发的传入 road（不本地随机）', () => {
    connStore.roomMode = 'host'
    connStore.myRole = 'host'
    connStore.myPlayerName = '' // 纯裁判，不参赛
    gameStore.ruleConfig.sideSelection.initialMode = 'random'

    // 即使配置 random，多人模式下也用 host 下发的 2/4，避免两端不一致
    gameStore.initGame('alice', 'bob', 'player1', 2, 4, 4)

    expect(gameStore.player1.road).toBe(2)
    expect(gameStore.player2.road).toBe(4)
  })

  it('选手端（roomMode=player）+ random 配置 → 用传入 road（不本地随机）', () => {
    connStore.roomMode = 'player'
    connStore.myRole = 'player'
    gameStore.ruleConfig.sideSelection.initialMode = 'random'

    gameStore.initGame('alice', 'bob', 'player1', 2, 4, 4)

    expect(gameStore.player1.road).toBe(2)
    expect(gameStore.player2.road).toBe(4)
  })

  it('local 模式不触发 host 参赛分支（走 mutual，用传入 road）', () => {
    connStore.roomMode = 'local'
    connStore.myPlayerName = 'alice'
    gameStore.ruleConfig.sideSelection.initialMode = 'mutual'

    gameStore.initGame('alice', 'bob', 'player1', 2, 4, 4)

    expect(gameStore.player1.road).toBe(2)
    expect(gameStore.player2.road).toBe(4)
  })

  it('host 参赛后 road2Player/road4Player 映射正确，BP 序列正常生成（road 与序列一致）', () => {
    connStore.roomMode = 'host'
    connStore.myRole = 'host'
    connStore.myPlayerName = 'hostAlice'
    gameStore.ruleConfig.sideSelection.initialMode = 'random'

    gameStore.initGame('hostAlice', 'remoteBob', 'player1', null, null, 4)

    // host=player1=2路 → road2Player=player1；远端=player2=4路 → road4Player=player2
    expect(gameStore.road2Player).toBe('player1')
    expect(gameStore.road4Player).toBe('player2')
    // startRound 已基于正确 road 生成 BP 序列（未因 road 错乱报错或生成空序列）
    expect(gameStore.currentRound.bpSequence).toBeDefined()
    expect(gameStore.currentRound.bpSequence.length).toBeGreaterThan(0)
  })
})

/**
 * 南瓜头 pick 逻辑单元测试
 *
 * 回归主力：毫秒级、离线可跑，直接覆盖 _handlePumpkinPick / _handleNormalPick 的索引同步逻辑。
 *
 * 核心回归场景（曾有的 bug）：连续选多个南瓜头时，splice 移除南瓜后索引失效，
 * 导致普通植物被误删、南瓜残留在 picks、pumpkinProtection 关系错乱。
 *
 * 规则回顾：
 * - 选南瓜不消耗 BP 步骤，累积一个"保护名额"（extraPick.remaining++）
 * - 下一个 pick 的普通植物被标记为受南瓜保护（pumpkinProtection），南瓜从 picks 移除
 * - 名额用尽（remaining 归零）才推进 BP 步骤
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock roomManager：connectionStore 依赖它（local 模式 syncState 实际 no-op）
vi.mock('@/utils/roomManager', () => {
  const mock = {
    on: vi.fn(), off: vi.fn(), broadcastState: vi.fn(), sendStateUpdate: vi.fn(),
    broadcastToOthers: vi.fn(), broadcastGameStart: vi.fn(), broadcastCustomPlants: vi.fn(),
    sendIdentityAssignment: vi.fn(), disconnect: vi.fn(),
    connections: new Map(), getConnectedPlayerNames: vi.fn(() => [])
  }
  return { default: mock, RoomManager: function () { return mock } }
})

const PLANTS = [
  { id: 'pumpkin', name: '南瓜头' },
  { id: 'peashooter', name: '豌豆射手' },
  { id: 'sunflower', name: '向日葵' },
  { id: 'wallnut', name: '坚果墙' },
  { id: 'cherry', name: '樱桃炸弹' },
  { id: 'potato', name: '土豆地雷' },
]
vi.mock('@/data/customPlants', () => ({
  getAllPlantsSync: vi.fn(() => PLANTS),
  getHiddenPlants: vi.fn(() => []),
  getPlantImage: vi.fn(() => ''),
  getPlantName: vi.fn(() => ''),
  getPlantDesc: vi.fn(() => ''),
  importCustomPlant: vi.fn(async () => {}),
  clearAllCustomPlants: vi.fn(async () => {}),
  updateCache: vi.fn(async () => {})
}))

import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

describe('南瓜头 pick 索引同步逻辑', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    useConnectionStore().roomMode = 'local'
    gameStore.player1.road = 2
    gameStore.player2.road = 4
    // 手动构造一个处于 pick 阶段的 currentRound；bpSequence 留空（moveToNextStep 走 else 分支无害）
    gameStore.currentRound = {
      roundNumber: 1,
      stage: 2,
      step: 4,
      currentPlayer: 'player1',
      action: 'pick',
      pickCount: 1,
      bans: { player1: [], player2: [] },
      picks: { player1: [], player2: [] },
      positions: { player1: { road: 2, plants: [] }, player2: { road: 4, plants: [] } },
      selectedPlant: null,
      bpSequence: [],
      extraPick: null,
      pumpkinUsedThisRound: { player1: false, player2: false }
    }
    gameStore.pumpkinUsage = { player1: 0, player2: 0 }
  })

  const p1Picks = () => gameStore.currentRound.picks.player1
  const p1ProtectionCount = () =>
    Object.keys(gameStore.currentRound.pumpkinProtection || {})
      .filter(k => k.startsWith('player1_')).length

  it('单个南瓜 + 单个普通植物：南瓜移除、植物被保护、pending 清空', () => {
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    expect(p1Picks()).toEqual(['pumpkin'])
    expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0])
    expect(gameStore.currentRound.extraPick.remaining).toBe(1)

    gameStore._handleNormalPick('player1', 'peashooter')
    expect(p1Picks()).toEqual(['peashooter'])
    expect(p1Picks().some(id => id === 'pumpkin')).toBe(false)
    expect(gameStore.currentRound.pumpkinProtection['player1_0'].protectedBy).toBe('pumpkin')
    expect(gameStore.currentRound.extraPick).toBe(null)
  })

  it('连续选 2 南瓜 + 2 植物：无南瓜残留、两植物各被保护（核心 bug 场景）', () => {
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    expect(p1Picks()).toEqual(['pumpkin', 'pumpkin'])
    expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0, 1])
    expect(gameStore.currentRound.extraPick.remaining).toBe(2)

    // 选第 1 个被保护植物：第一个南瓜被移除，第二个南瓜索引前移 1→0
    gameStore._handleNormalPick('player1', 'peashooter')
    expect(p1Picks()).toEqual(['pumpkin', 'peashooter'])
    expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0])

    // 选第 2 个被保护植物：第二个南瓜被移除
    gameStore._handleNormalPick('player1', 'sunflower')
    expect(p1Picks()).toEqual(['peashooter', 'sunflower'])
    expect(p1Picks().some(id => id === 'pumpkin')).toBe(false)
    expect(p1ProtectionCount()).toBe(2)
    expect(gameStore.currentRound.pumpkinProtection['player1_0'].protectedBy).toBe('pumpkin')
    expect(gameStore.currentRound.pumpkinProtection['player1_1'].protectedBy).toBe('pumpkin')
    expect(gameStore.currentRound.extraPick).toBe(null)
  })

  it('连续选 3 南瓜 + 3 植物：全部正确绑定', () => {
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    gameStore._handlePumpkinPick('player1', 'pumpkin')

    const plants = ['peashooter', 'sunflower', 'wallnut']
    plants.forEach(p => gameStore._handleNormalPick('player1', p))

    expect(p1Picks()).toEqual(plants)
    expect(p1Picks().some(id => id === 'pumpkin')).toBe(false)
    expect(p1ProtectionCount()).toBe(3)
    expect(gameStore.currentRound.extraPick).toBe(null)
  })

  it('protection key 在多次 splice 后与 picks 真实索引对齐', () => {
    // 连续 2 南瓜 + 2 植物，最终 protection 的 key 必须等于 picks 的真实索引
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    gameStore._handleNormalPick('player1', 'peashooter')
    gameStore._handleNormalPick('player1', 'sunflower')

    // picks = ['peashooter'(0), 'sunflower'(1)]，两个都应被保护
    const protection = gameStore.currentRound.pumpkinProtection
    expect(protection['player1_0']).toBeTruthy()
    expect(protection['player1_1']).toBeTruthy()
    // 不应有越界的 key 残留
    expect(protection['player1_2']).toBeFalsy()
  })

  it('选南瓜累积 pumpkinUsage 计数', () => {
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    expect(gameStore.pumpkinUsage.player1).toBe(1)
    gameStore._handlePumpkinPick('player1', 'pumpkin')
    expect(gameStore.pumpkinUsage.player1).toBe(2)
  })
})

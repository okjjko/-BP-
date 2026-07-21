/**
 * randomBanPlants（开局随机永久禁用植物）可配置逻辑单元测试
 *
 * 回归主力：覆盖 ruleConfig.randomBan { enabled, count } 的开局抽取语义。
 *
 * 规则回顾：
 * - enabled（默认 true）：false → 开局不禁用（globalBans 为空）
 * - count（默认 5）：enabled=true 时抽取数量；池不足抽满；NaN/负数兜底 5
 * - 仅权威方（local/host）在 initGame 内抽取；player/spectator 走 globalBans=[] 等同步
 * - 与 BP 流程内可插入的 globalBan 预设步骤互补：本配置只控开局那一次性抽取
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
  { id: 'peashooter', name: '豌豆射手' },
  { id: 'sunflower', name: '向日葵' },
  { id: 'wallnut', name: '坚果墙' },
  { id: 'cherry', name: '樱桃炸弹' },
  { id: 'potato', name: '土豆地雷' },
  { id: 'snowpea', name: '寒冰射手' }
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

describe('randomBanPlants 开局随机禁用（直接调用）', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    useConnectionStore().roomMode = 'local'
    gameStore.globalBans = []
  })

  it('默认配置（enabled=true, count=5）：抽取 5 个且不重复', () => {
    gameStore.randomBanPlants()
    expect(gameStore.globalBans.length).toBe(5)
    expect(new Set(gameStore.globalBans).size).toBe(5)
  })

  it('enabled=false：不禁用，globalBans 为空', () => {
    gameStore.ruleConfig.randomBan = { enabled: false, count: 5 }
    gameStore.randomBanPlants()
    expect(gameStore.globalBans).toEqual([])
  })

  it('count=N：抽取指定数量', () => {
    gameStore.ruleConfig.randomBan = { enabled: true, count: 3 }
    gameStore.randomBanPlants()
    expect(gameStore.globalBans.length).toBe(3)
  })

  it('count 超过植物池：抽满可用池不报错', () => {
    gameStore.ruleConfig.randomBan = { enabled: true, count: 100 }
    gameStore.randomBanPlants()
    expect(gameStore.globalBans.length).toBe(PLANTS.length)
    expect(new Set(gameStore.globalBans).size).toBe(PLANTS.length)
  })

  it('count=0：抽 0 个（globalBans 为空）', () => {
    gameStore.ruleConfig.randomBan = { enabled: true, count: 0 }
    gameStore.randomBanPlants()
    expect(gameStore.globalBans).toEqual([])
  })

  it('旧存档兼容：ruleConfig 无 randomBan 字段时默认抽 5', () => {
    delete gameStore.ruleConfig.randomBan
    gameStore.randomBanPlants()
    expect(gameStore.globalBans.length).toBe(5)
  })

  it('count 非法（NaN）：兜底抽 5', () => {
    gameStore.ruleConfig.randomBan = { enabled: true, count: 'abc' }
    gameStore.randomBanPlants()
    expect(gameStore.globalBans.length).toBe(5) // Number('abc') || 5 → 5
  })
})

describe('initGame 开局禁用权威方语义', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    gameStore.player1.road = 2
    gameStore.player2.road = 4
  })

  it('local（权威方）：initGame 按配置 count 抽取', () => {
    useConnectionStore().roomMode = 'local'
    gameStore.ruleConfig.randomBan = { enabled: true, count: 3 }
    gameStore.initGame('p1', 'p2', 'player1', 2, 4, 4)
    expect(gameStore.globalBans.length).toBe(3)
  })

  it('host（权威方）：initGame 抽取并通过 syncState 广播', () => {
    const connStore = useConnectionStore()
    connStore.roomMode = 'host'
    const spy = vi.spyOn(connStore, 'syncState')
    gameStore.ruleConfig.randomBan = { enabled: true, count: 4 }
    gameStore.initGame('p1', 'p2', 'player1', 2, 4, 4)
    expect(gameStore.globalBans.length).toBe(4)
    expect(spy).toHaveBeenCalled()
  })

  it('player（非权威方）：initGame 不抽取，globalBans 为空', () => {
    useConnectionStore().roomMode = 'player'
    gameStore.ruleConfig.randomBan = { enabled: true, count: 5 }
    gameStore.initGame('p1', 'p2', 'player1', 2, 4, 4)
    expect(gameStore.globalBans).toEqual([])
  })

  it('enabled=false：即使权威方也不禁用', () => {
    useConnectionStore().roomMode = 'local'
    gameStore.ruleConfig.randomBan = { enabled: false, count: 5 }
    gameStore.initGame('p1', 'p2', 'player1', 2, 4, 4)
    expect(gameStore.globalBans).toEqual([])
  })
})

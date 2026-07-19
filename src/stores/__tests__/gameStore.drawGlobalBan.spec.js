/**
 * 局内临时抽取「一个」全局永久禁用植物（手动触发）的单元测试
 *
 * 覆盖 drawRandomGlobalBan 的权限守卫与抽取语义（撤销语义见 gameStore.undo.spec.js）。
 *
 * 规则回顾：
 * - 裁判/host（含单机 local）从未禁用池随机抽 1 个并入 globalBans（跨小局永久生效）
 * - 抽取结果由通用 undoLastAction 统一撤销（见 gameStore.undo.spec.js），不再单独记录
 * - 非权威方（player/spectator）返回 not-authority，不抽取
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

describe('局内抽取永 ban —— drawRandomGlobalBan', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    useConnectionStore().roomMode = 'local'
    gameStore.globalBans = []
    gameStore.lastManualGlobalBan = null
    // drawRandomGlobalBan 仅访问 currentRound.bans；手动构造最小 currentRound
    gameStore.currentRound = {
      bans: { player1: [], player2: [] },
      picks: { player1: [], player2: [] }
    }
  })

  it('抽取 1 个：globalBans+1、返回 ok+plantId、压栈并记 lastActor=system', () => {
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(true)
    expect(r.plantId).toBeTruthy()
    expect(gameStore.globalBans).toContain(r.plantId)
    expect(gameStore.globalBans.length).toBe(1)
    expect(gameStore.undoStack.length).toBe(1)
    expect(gameStore.lastActor).toBe('system')
    expect(gameStore.lastManualGlobalBan).toBe(null) // 通用 undo 取代后不再写入
  })

  it('池为空（全部已永久禁用）：返回 empty，globalBans 不变、不压栈', () => {
    gameStore.globalBans = PLANTS.map(p => p.id)
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('empty')
    expect(gameStore.globalBans.length).toBe(PLANTS.length)
    expect(gameStore.undoStack.length).toBe(0)
    expect(gameStore.lastManualGlobalBan).toBe(null)
  })

  it('排除当小局已 ban 的植物（不抽 roundBans 里的）', () => {
    gameStore.currentRound.bans.player1 = ['peashooter']
    const drawn = new Set()
    for (let i = 0; i < 6; i++) {
      gameStore.globalBans = []
      gameStore.lastManualGlobalBan = null
      const r = gameStore.drawRandomGlobalBan()
      drawn.add(r.plantId)
    }
    expect(drawn.has('peashooter')).toBe(false)
  })

  it('player（非权威方）：返回 not-authority，不抽取', () => {
    useConnectionStore().roomMode = 'player'
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('not-authority')
    expect(gameStore.globalBans.length).toBe(0)
    expect(gameStore.lastManualGlobalBan).toBe(null)
  })

  it('host（权威方）：抽取并通过 syncState 广播', () => {
    const connStore = useConnectionStore()
    connStore.roomMode = 'host'
    const spy = vi.spyOn(connStore, 'syncState')
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(true)
    expect(spy).toHaveBeenCalled()
  })

  it('currentRound 缺失时返回 no-round（防御性兜底）', () => {
    gameStore.currentRound = null
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no-round')
  })
})

// 撤销手动抽取永禁的测试已迁移至 gameStore.undo.spec.js（通用 undoLastAction 覆盖）。

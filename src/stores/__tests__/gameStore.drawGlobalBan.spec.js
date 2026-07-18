/**
 * 局内临时抽取「一个」全局永久禁用植物（手动触发）的单元测试
 *
 * 覆盖 drawRandomGlobalBan / undoLastManualGlobalBan 的权限守卫、抽取、撤销语义。
 *
 * 规则回顾：
 * - 裁判/host（含单机 local）从未禁用池随机抽 1 个并入 globalBans（跨小局永久生效）
 * - 记录 lastManualGlobalBan，供 undoLastManualGlobalBan 仅回滚最近一次手动抽取
 *   （不影响开局 randomBanPlants / 预设 globalBan 步骤的结果）
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

  it('抽取 1 个：globalBans+1、返回 ok+plantId、记录 lastManualGlobalBan', () => {
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(true)
    expect(r.plantId).toBeTruthy()
    expect(gameStore.globalBans).toContain(r.plantId)
    expect(gameStore.globalBans.length).toBe(1)
    expect(gameStore.lastManualGlobalBan).toBe(r.plantId)
  })

  it('池为空（全部已永久禁用）：返回 empty，globalBans 不变', () => {
    gameStore.globalBans = PLANTS.map(p => p.id)
    const r = gameStore.drawRandomGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('empty')
    expect(gameStore.globalBans.length).toBe(PLANTS.length)
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

describe('撤销局内抽取 —— undoLastManualGlobalBan', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    useConnectionStore().roomMode = 'local'
    gameStore.globalBans = []
    gameStore.lastManualGlobalBan = null
    gameStore.currentRound = {
      bans: { player1: [], player2: [] },
      picks: { player1: [], player2: [] }
    }
  })

  it('撤销最近一次手动抽取：移除 id、清空标记', () => {
    const r = gameStore.drawRandomGlobalBan()
    const drawn = r.plantId

    const undo = gameStore.undoLastManualGlobalBan()
    expect(undo.ok).toBe(true)
    expect(undo.plantId).toBe(drawn)
    expect(gameStore.globalBans).not.toContain(drawn)
    expect(gameStore.lastManualGlobalBan).toBe(null)
  })

  it('无可撤销：返回 nothing-to-undo', () => {
    const r = gameStore.undoLastManualGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('nothing-to-undo')
  })

  it('撤销不影响其他来源的 globalBans（开局/预设抽的仍在）', () => {
    // 模拟其他来源（开局 randomBanPlants / 预设 globalBan 步骤）已抽的
    gameStore.globalBans = ['peashooter', 'sunflower']
    const r = gameStore.drawRandomGlobalBan() // 手动抽 1 个
    const manual = r.plantId
    expect(gameStore.globalBans.length).toBe(3)

    const undo = gameStore.undoLastManualGlobalBan()
    expect(undo.ok).toBe(true)
    expect(gameStore.globalBans.length).toBe(2)
    expect(gameStore.globalBans).not.toContain(manual)
    expect(gameStore.globalBans).toContain('peashooter')
    expect(gameStore.globalBans).toContain('sunflower')
  })

  it('player（非权威方）撤销：返回 not-authority', () => {
    useConnectionStore().roomMode = 'player'
    const r = gameStore.undoLastManualGlobalBan()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('not-authority')
  })

  it('连抽两次再撤销，仅回滚最近一次', () => {
    const r1 = gameStore.drawRandomGlobalBan()
    const r2 = gameStore.drawRandomGlobalBan()
    expect(gameStore.globalBans.length).toBe(2)
    expect(gameStore.lastManualGlobalBan).toBe(r2.plantId)

    const undo = gameStore.undoLastManualGlobalBan()
    expect(undo.plantId).toBe(r2.plantId)
    expect(gameStore.globalBans.length).toBe(1)
    expect(gameStore.globalBans).toContain(r1.plantId)
    expect(gameStore.globalBans).not.toContain(r2.plantId)
    // 撤销后标记清空，第一次抽取不可再撤销（仅记最近一次）
    expect(gameStore.lastManualGlobalBan).toBe(null)
  })
})

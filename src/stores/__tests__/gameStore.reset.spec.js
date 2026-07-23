/**
 * resetGame 回归测试
 *
 * 守护 bug：「点击重置游戏后，当前应用的 BP 流程预设变回默认预设（标准 20 步）」。
 * 根因：resetGame() 调 this.$reset() 会把 ruleConfig 重置为 defaultRules。
 * 修复：$reset() 前缓存 ruleConfig，$reset() 后恢复，并用 saveToLocalStorage 覆盖旧存档，
 *       使重置后保持「当前应用的 BP」且刷新后仍保留。
 *
 * 关键断言：
 * - ruleConfig（bpSequence / sideNames / limits / randomBan）跨重置保留
 * - 游戏进度（gameStatus / player / globalBans / plantUsage / undoStack / winThreshold）真清空
 * - 重置后存档写入，模拟刷新（新 store + loadFromLocalStorage）仍能恢复保留的 ruleConfig
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock roomManager：connectionStore 依赖它（local 模式 syncState no-op）
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
import defaultRules from '@/config/defaultRules'

// 构造一个明显区别于默认的 ruleConfig（覆盖 bpSequence / sideNames / limits / randomBan 四个维度）
const applyCustomRules = (store) => {
  store.ruleConfig = {
    ...defaultRules,
    sideNames: { road2: '左边', road4: '右边' },
    limits: { ...defaultRules.limits, maxPlantUsage: 5 },
    bpSequence: [[{ player: 'road2', action: 'pick', count: 1 }]],
    randomBan: { ...defaultRules.randomBan, enabled: false, count: 0 }
  }
}

describe('resetGame 保留当前应用的 BP 规则', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    const connStore = useConnectionStore()
    connStore.roomMode = 'local'
  })

  it('重置后保留当前 ruleConfig（bpSequence / sideNames / limits / randomBan 四维度）', () => {
    applyCustomRules(gameStore)
    gameStore.resetGame()

    expect(gameStore.ruleConfig.sideNames).toEqual({ road2: '左边', road4: '右边' })
    expect(gameStore.ruleConfig.limits.maxPlantUsage).toBe(5)
    expect(gameStore.ruleConfig.bpSequence).toEqual([[
      { player: 'road2', action: 'pick', count: 1 }
    ]])
    expect(gameStore.ruleConfig.randomBan.enabled).toBe(false)
    expect(gameStore.ruleConfig.randomBan.count).toBe(0)
  })

  it('重置后游戏进度真清空（仅保留 ruleConfig，其余回到初始）', () => {
    applyCustomRules(gameStore)
    // 模拟对局进行中的脏数据
    gameStore.gameStatus = 'banning'
    gameStore.player1 = { id: 'A', score: 3, road: 2 }
    gameStore.player2 = { id: 'B', score: 2, road: 4 }
    gameStore.globalBans = ['x', 'y']
    gameStore.plantUsage = { player1_peashooter: 2 }
    gameStore.undoStack = [{ currentRound: {}, globalBans: [] }]
    gameStore.lastActor = 'player1'
    gameStore.winThreshold = 6

    gameStore.resetGame()

    expect(gameStore.gameStatus).toBe('setup')
    expect(gameStore.player1).toEqual({ id: '', score: 0, road: null })
    expect(gameStore.player2).toEqual({ id: '', score: 0, road: null })
    expect(gameStore.globalBans).toEqual([])
    expect(gameStore.plantUsage).toEqual({})
    expect(gameStore.undoStack).toEqual([])
    expect(gameStore.lastActor).toBeNull()
    expect(gameStore.winThreshold).toBe(4)
  })

  it('重置后写入存档，模拟刷新（新 store + loadFromLocalStorage）仍保留 ruleConfig', () => {
    applyCustomRules(gameStore)
    gameStore.resetGame()

    // 存档已写入（覆盖旧对局存档为「新对局起点」）
    expect(localStorage.getItem('bpGameState')).not.toBeNull()

    // 模拟页面刷新：新 pinia + 新 store 从存档恢复
    setActivePinia(createPinia())
    const fresh = useGameStore()
    useConnectionStore().roomMode = 'local'
    fresh.loadFromLocalStorage()

    expect(fresh.ruleConfig.sideNames).toEqual({ road2: '左边', road4: '右边' })
    expect(fresh.ruleConfig.limits.maxPlantUsage).toBe(5)
    expect(fresh.ruleConfig.bpSequence).toEqual([[
      { player: 'road2', action: 'pick', count: 1 }
    ]])
    expect(fresh.ruleConfig.randomBan.enabled).toBe(false)
    // 刷新后停留在 setup（新对局起点），不会误进对局
    expect(fresh.gameStatus).toBe('setup')
  })

  it('默认 ruleConfig（未自定义）时重置不出错且保持默认', () => {
    // 不 applyCustomRules，ruleConfig 为初始 defaultRules
    gameStore.resetGame()

    expect(gameStore.ruleConfig).toEqual(defaultRules)
    expect(gameStore.gameStatus).toBe('setup')
    // 默认 BP 模板（标准 20 步）仍在
    expect(gameStore.ruleConfig.bpSequence).toEqual(defaultRules.bpSequence)
  })
})

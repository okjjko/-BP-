/**
 * applyRuleConfig 单元测试
 *
 * 配置预设加载时，由 ConfigManager.handleLoad 调用，把保存的 ruleConfig
 * 合并默认值后写回 bpGameState，使自定义 BP 流程 / 上限 / 南瓜 / 阵营名 / 选边方式
 * 能跨页面 reload 恢复。
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

const PLANTS = [{ id: 'peashooter', name: '豌豆射手' }]
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
import defaultRules from '@/config/defaultRules'

describe('applyRuleConfig（配置预设恢复 ruleConfig）', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    store = useGameStore()
  })

  it('合并默认值：未传字段用默认，传入字段覆盖', () => {
    store.applyRuleConfig({
      limits: { maxPlantUsage: 5 },
      pumpkinRule: { enabled: false }
    })
    expect(store.ruleConfig.limits.maxPlantUsage).toBe(5)
    expect(store.ruleConfig.pumpkinRule.enabled).toBe(false)
    // 未传字段补默认（整体合并，向后兼容 + 自动补全新字段）
    expect(store.ruleConfig.bpSequence).toEqual(defaultRules.bpSequence)
    expect(store.ruleConfig.sideNames).toEqual(defaultRules.sideNames)
  })

  it('持久化到 bpGameState，且新 store reload 后能恢复', () => {
    store.applyRuleConfig({ limits: { maxPlantUsage: 4 } })

    // 写入 bpGameState
    const persisted = JSON.parse(localStorage.getItem('bpGameState'))
    expect(persisted.ruleConfig.limits.maxPlantUsage).toBe(4)

    // 模拟页面 reload：新 pinia + 新 store 从 localStorage 恢复
    setActivePinia(createPinia())
    const reloaded = useGameStore()
    reloaded.loadFromLocalStorage()
    expect(reloaded.ruleConfig.limits.maxPlantUsage).toBe(4)
  })

  it('传入 null 时回落到完整默认值', () => {
    store.applyRuleConfig(null)
    expect(store.ruleConfig.bpSequence).toEqual(defaultRules.bpSequence)
    expect(store.ruleConfig.limits).toEqual(defaultRules.limits)
  })
})

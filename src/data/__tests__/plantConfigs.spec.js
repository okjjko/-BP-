/**
 * plantConfigs 配置预设 - ruleConfig 透传测试
 *
 * 验证"保存当前配置"会把自定义比赛规则（BP 流程 / 上限 / 南瓜 / 阵营名 / 选边方式）
 * 一起存进配置文件，且加载 / 导入 / 持久化能完整 round-trip。
 *
 * 这是对用户诉求"自定义 BP 流程后不能保存进配置文件"的回归保护。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock customPlants 的 IndexedDB 操作（测试不依赖真实 IndexedDB）
vi.mock('@/data/customPlants', () => ({
  loadCustomPlants: vi.fn(async () => []),
  addCustomPlant: vi.fn(async (p) => p),
  deleteCustomPlant: vi.fn(async () => true),
  clearAllCustomPlants: vi.fn(async () => true),
  blobToBase64: vi.fn(async () => 'data:image/png;base64,xxxx'),
  base64ToBlob: vi.fn(async () => new Blob(['x'], { type: 'image/png' }))
}))

import { saveConfig, loadConfig, getConfigById, importConfig, deleteConfig, getAllConfigs, getActiveConfig, updateConfigRuleConfig } from '@/data/plantConfigs'

describe('plantConfigs 配置预设 - ruleConfig 透传', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveConfig 把 ruleConfig 深拷贝存入配置', async () => {
    const ruleConfig = {
      bpSequence: [[{ player: 'road2', action: 'pick', count: 2 }]],
      limits: { maxPlantUsage: 3 },
      pumpkinRule: { enabled: false },
      sideNames: { road2: '甲', road4: '乙' },
      sideSelection: { initialMode: 'random', initialPicker: null, loserPickMode: 'winner' }
    }
    const config = await saveConfig('含规则', '描述', ruleConfig)

    expect(config.ruleConfig).toBeTruthy()
    expect(config.ruleConfig.limits.maxPlantUsage).toBe(3)
    expect(config.ruleConfig.pumpkinRule.enabled).toBe(false)
    expect(config.ruleConfig.sideNames.road2).toBe('甲')
    // 深拷贝：修改原对象不影响已存配置
    ruleConfig.limits.maxPlantUsage = 99
    expect(config.ruleConfig.limits.maxPlantUsage).toBe(3)
  })

  it('saveConfig 不传 ruleConfig 时为 null（向后兼容旧调用方）', async () => {
    const config = await saveConfig('旧式', '')
    expect(config.ruleConfig).toBeNull()
  })

  it('getConfigById 持久化后仍含 ruleConfig', async () => {
    const ruleConfig = { bpSequence: [[{ player: 'road4', action: 'ban', count: 1 }]] }
    const saved = await saveConfig('持久化', '', ruleConfig)
    const persisted = await getConfigById(saved.id)
    expect(persisted.ruleConfig).toBeTruthy()
    expect(persisted.ruleConfig.bpSequence).toEqual(ruleConfig.bpSequence)
  })

  it('loadConfig 返回的配置含 ruleConfig（供 ConfigManager 调 applyRuleConfig）', async () => {
    const ruleConfig = { limits: { maxPlantUsage: 5 }, pumpkinRule: { enabled: false } }
    const saved = await saveConfig('加载测试', '', ruleConfig)
    const loaded = await loadConfig(saved.id)
    expect(loaded.ruleConfig).toBeTruthy()
    expect(loaded.ruleConfig.limits.maxPlantUsage).toBe(5)
    expect(loaded.ruleConfig.pumpkinRule.enabled).toBe(false)
  })

  it('importConfig 透传 ruleConfig（跨设备 round-trip）', async () => {
    const ruleConfig = { limits: { maxPlantUsage: 2 }, sideNames: { road2: '红', road4: '蓝' } }
    const saved = await saveConfig('导入源', '', ruleConfig)
    // 清空再导入，模拟在另一台设备上导入配置文件
    localStorage.clear()
    const imported = await importConfig({ version: '1.0', type: 'plantConfig', config: saved })
    expect(imported.ruleConfig).toBeTruthy()
    expect(imported.ruleConfig.sideNames.road2).toBe('红')
    expect(imported.ruleConfig.limits.maxPlantUsage).toBe(2)
  })

  it('deleteConfig 删除最后一个活动配置后，列表为空且无活动配置', async () => {
    // 回归：用户要求"只保存了一个配置时也能删除"
    const saved = await saveConfig('唯一配置', '')
    // saveConfig 首个配置自动设为活动
    expect((await getActiveConfig())?.id).toBe(saved.id)

    await deleteConfig(saved.id)

    expect(await getAllConfigs()).toHaveLength(0)
    expect(await getActiveConfig()).toBeNull()
  })

  it('updateConfigRuleConfig 把新 ruleConfig 深拷贝写回预设', async () => {
    const saved = await saveConfig('编辑测试', '', { limits: { maxPlantUsage: 2 } })
    const newRule = {
      limits: { maxPlantUsage: 5 },
      bpSequence: [[{ player: 'road2', action: 'ban', count: 1 }]]
    }
    await updateConfigRuleConfig(saved.id, newRule)

    const persisted = await getConfigById(saved.id)
    expect(persisted.ruleConfig.limits.maxPlantUsage).toBe(5)
    expect(persisted.ruleConfig.bpSequence).toEqual(newRule.bpSequence)
    // 深拷贝：修改原对象不影响已存配置
    newRule.limits.maxPlantUsage = 99
    expect(persisted.ruleConfig.limits.maxPlantUsage).toBe(5)
  })
})

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

import { saveConfig, loadConfig, getConfigById, importConfig, deleteConfig, getAllConfigs, getActiveConfig, updateConfigRuleConfig, updateConfigPlants, ensureDefaultPreset, duplicateConfig, renameConfig, DEFAULT_CONFIG_ID } from '@/data/plantConfigs'

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

  it('updateConfigPlants 把 plants + hiddenBuiltinPlants 深拷贝写回预设（不动 ruleConfig）', async () => {
    const saved = await saveConfig('植物编辑', '', { limits: { maxPlantUsage: 2 } })
    const newPlants = [
      { id: 'custom_a', name: 'A', description: 'a', type: '副C', image: 'data:image/png;base64,xxx', builtin: false }
    ]
    const newHidden = ['scaredyshroom']
    await updateConfigPlants(saved.id, newPlants, newHidden)

    const persisted = await getConfigById(saved.id)
    expect(persisted.plants).toHaveLength(1)
    expect(persisted.plants[0].name).toBe('A')
    expect(persisted.hiddenBuiltinPlants).toEqual(['scaredyshroom'])
    // 深拷贝：修改原数组不影响已存配置
    newPlants[0].name = 'changed'
    newHidden.push('sunflower')
    expect(persisted.plants[0].name).toBe('A')
    expect(persisted.hiddenBuiltinPlants).toEqual(['scaredyshroom'])
    // ruleConfig 不受影响（plants 与 ruleConfig 双写分离）
    expect(persisted.ruleConfig.limits.maxPlantUsage).toBe(2)
  })
})

describe('默认预设（不可改/不可删）+ 复制', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('ensureDefaultPreset：空列表注入默认预设（id=config_default, isDefault=true）', async () => {
    await ensureDefaultPreset()
    const all = await getAllConfigs()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(DEFAULT_CONFIG_ID)
    expect(all[0].isDefault).toBe(true)
    expect(all[0].plants).toEqual([])
    expect(all[0].ruleConfig).toBeTruthy()
  })

  it('ensureDefaultPreset：已存在默认预设时不重复注入', async () => {
    await ensureDefaultPreset()
    await ensureDefaultPreset()
    const all = await getAllConfigs()
    expect(all.filter(c => c.id === DEFAULT_CONFIG_ID)).toHaveLength(1)
  })

  it('deleteConfig 拒绝删除默认预设', async () => {
    await ensureDefaultPreset()
    await expect(deleteConfig(DEFAULT_CONFIG_ID)).rejects.toThrow()
    expect(await getAllConfigs()).toHaveLength(1)
  })

  it('renameConfig 拒绝重命名默认预设', async () => {
    await ensureDefaultPreset()
    await expect(renameConfig(DEFAULT_CONFIG_ID, '新名')).rejects.toThrow()
  })

  it('updateConfigRuleConfig 拒绝修改默认预设规则', async () => {
    await ensureDefaultPreset()
    await expect(updateConfigRuleConfig(DEFAULT_CONFIG_ID, { limits: { maxPlantUsage: 9 } })).rejects.toThrow()
  })

  it('duplicateConfig：生成新 id + isDefault:false + 深拷贝', async () => {
    await ensureDefaultPreset()
    const copy = await duplicateConfig(DEFAULT_CONFIG_ID)
    expect(copy.id).not.toBe(DEFAULT_CONFIG_ID)
    expect(copy.isDefault).toBe(false)
    expect(copy.name).toBe('默认预设 副本')
    expect(copy.ruleConfig).toBeTruthy()
    const all = await getAllConfigs()
    expect(all).toHaveLength(2)
    expect(all.some(c => c.id === copy.id)).toBe(true)
  })
})

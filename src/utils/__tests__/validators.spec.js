/**
 * validators 单元测试
 *
 * canPick / canBan 是「可否选择」的单一事实来源（availablePlants getter 与
 * confirmSelection 均委托此处），此 spec 覆盖全部分支，含南瓜特殊规则与空值兼容。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/data/customPlants', () => ({
  getAllPlantsSync: () => [
    { id: 'peashooter', name: '豌豆射手' },
    { id: 'sunflower', name: '向日葵' },
    { id: 'pumpkin', name: '南瓜头' },
    { id: 'custom_p', name: '南瓜头' }  // 名称同名自定义南瓜（id 非 pumpkin 也应命中）
  ]
}))

import { isBanned, canBan, canPick, isGameOver, isGrandFinal, isPumpkin } from '../validators'

/** 构造最小 gameState（对齐 store.$state 相关字段的空值安全形态） */
function makeState(overrides = {}) {
  return {
    globalBans: [],
    plantUsage: {},
    pumpkinUsage: { player1: 0, player2: 0 },
    currentRound: {
      bans: { player1: [], player2: [] },
      picks: { player1: [], player2: [] },
      pumpkinUsedThisRound: { player1: false, player2: false },
      ...(overrides.currentRound || {})
    },
    ruleConfig: {
      limits: { maxPlantUsage: 2 },
      pumpkinRule: { enabled: true },
      ...(overrides.ruleConfig || {})
    },
    ...(({ currentRound, ruleConfig, ...rest }) => rest)(overrides)
  }
}

describe('isBanned', () => {
  it('全局禁用与当局禁用都算禁用', () => {
    expect(isBanned('peashooter', ['peashooter'], [])).toBe(true)
    expect(isBanned('peashooter', [], ['sunflower', 'peashooter'])).toBe(true)
    expect(isBanned('peashooter', [], [])).toBe(false)
  })
})

describe('canBan', () => {
  it('唯一限制：未被禁用即可 ban（已选/达上限不拦）', () => {
    const state = makeState({
      currentRound: { picks: { player1: ['peashooter'], player2: [] } },
      plantUsage: { 'player1_peashooter': 99 }
    })
    expect(canBan('peashooter', state).valid).toBe(true)
  })

  it('已被禁用（全局或当局）不可 ban', () => {
    expect(canBan('peashooter', makeState({ globalBans: ['peashooter'] })).valid).toBe(false)
    const roundBanned = makeState({
      currentRound: { bans: { player1: ['sunflower'], player2: [] } }
    })
    expect(canBan('sunflower', roundBanned).valid).toBe(false)
  })
})

describe('canPick', () => {
  it('被禁用 → 拒绝', () => {
    const r = canPick('peashooter', 'player1', makeState({ globalBans: ['peashooter'] }))
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('禁用')
  })

  it('对手已选 → 拒绝', () => {
    const state = makeState({
      currentRound: { picks: { player1: [], player2: ['peashooter'] } }
    })
    const r = canPick('peashooter', 'player1', state)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('对方已选')
  })

  it('同小局重复 pick 未达上限 → 允许（默认 2 次）', () => {
    const state = makeState({
      currentRound: { picks: { player1: ['peashooter'], player2: [] } }
    })
    expect(canPick('peashooter', 'player1', state).valid).toBe(true)
  })

  it('本局 + 历史使用合计达上限 → 拒绝', () => {
    // 本局 1 次 + 历史 1 次 = 2，达默认上限
    const state = makeState({
      plantUsage: { 'player1_peashooter': 1 },
      currentRound: { picks: { player1: ['peashooter'], player2: [] } }
    })
    const r = canPick('peashooter', 'player1', state)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('上限')
  })

  it('纯历史使用达上限也拒绝（本局未选）', () => {
    const state = makeState({ plantUsage: { 'player2_sunflower': 2 } })
    expect(canPick('sunflower', 'player2', state).valid).toBe(false)
  })

  it('上限可配：maxPlantUsage=3 时 2 次仍可再选', () => {
    const state = makeState({
      plantUsage: { 'player1_peashooter': 1 },
      currentRound: { picks: { player1: ['peashooter'], player2: [] } },
      ruleConfig: { limits: { maxPlantUsage: 3 }, pumpkinRule: { enabled: true } }
    })
    expect(canPick('peashooter', 'player1', state).valid).toBe(true)
  })

  it('正常情况 → 允许', () => {
    expect(canPick('peashooter', 'player1', makeState()).valid).toBe(true)
  })
})

describe('canPick 南瓜特殊规则', () => {
  it('对手本轮已用南瓜 → 拒绝（开关开启时）', () => {
    const state = makeState({
      currentRound: {
        pumpkinUsedThisRound: { player1: false, player2: true }
      }
    })
    const r = canPick('pumpkin', 'player1', state)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('南瓜头')
  })

  it('名称为「南瓜头」的自定义植物（id 非 pumpkin）同样命中互斥', () => {
    const state = makeState({
      currentRound: {
        pumpkinUsedThisRound: { player1: false, player2: true }
      }
    })
    expect(canPick('custom_p', 'player1', state).valid).toBe(false)
  })

  it('自己跨小局南瓜用量达上限 → 拒绝（沿用 maxPlantUsage）', () => {
    const state = makeState({ pumpkinUsage: { player1: 2, player2: 0 } })
    const r = canPick('pumpkin', 'player1', state)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('南瓜头')
  })

  it('开关关闭：南瓜当普通植物，对手用过也不拦', () => {
    const state = makeState({
      pumpkinUsage: { player1: 2, player2: 0 },
      currentRound: {
        pumpkinUsedThisRound: { player1: false, player2: true }
      },
      ruleConfig: { limits: { maxPlantUsage: 2 }, pumpkinRule: { enabled: false } }
    })
    expect(canPick('pumpkin', 'player1', state).valid).toBe(true)
  })

  it('旧存档空值安全：缺 pumpkinUsedThisRound / pumpkinUsage 不抛错', () => {
    const state = makeState()
    delete state.pumpkinUsage
    delete state.currentRound.pumpkinUsedThisRound
    expect(() => canPick('pumpkin', 'player1', state)).not.toThrow()
    expect(canPick('pumpkin', 'player1', state).valid).toBe(true)
  })
})

describe('对局结束判定', () => {
  it('isGameOver：任一方达到阈值', () => {
    expect(isGameOver(4, 0, 4)).toBe(true)
    expect(isGameOver(3, 4, 4)).toBe(true)
    expect(isGameOver(3, 3, 4)).toBe(false)
    expect(isGameOver(1, 0, 1)).toBe(true)  // 阈值可配为 1
  })

  it('isGrandFinal：3:3 判定（保留未启用）', () => {
    expect(isGrandFinal(3, 3)).toBe(true)
    expect(isGrandFinal(3, 2)).toBe(false)
  })
})

describe('isPumpkin', () => {
  it('按 id 或按名称识别', () => {
    expect(isPumpkin('pumpkin')).toBe(true)
    expect(isPumpkin('x', [{ id: 'x', name: '南瓜头' }])).toBe(true)
    expect(isPumpkin('peashooter', [{ id: 'peashooter', name: '豌豆射手' }])).toBe(false)
    expect(isPumpkin('x', [])).toBe(false)  // 空植物表：名称检查跳过
  })
})

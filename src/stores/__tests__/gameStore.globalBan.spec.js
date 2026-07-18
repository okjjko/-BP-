/**
 * globalBan（预设全局永久禁用植物）自动抽取逻辑单元测试
 *
 * 回归主力：覆盖 _drawGlobalBans / _processAutoSteps / _advanceOneStep 的状态机。
 *
 * 规则回顾：
 * - BP 模板步骤 action 可为 'globalBan'，player 占位 'system'（不归属任何阵营）
 * - 流程进行到 globalBan 步骤时，由权威方（local/host）从未禁用池随机抽取 count 个
 *   植物并入 globalBans，自动推进，无需选手点击；连续多个 globalBan 逐步执行
 * - 非权威方（player/spectator）不抽取、不推进，等 host 的 syncState 被动同步
 * - availablePlants 在 globalBan 步骤返回空（选手无需选择，避免误触）
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
import { getBPSequence } from '@/utils/bpRules'

describe('getBPSequence 透传 system 玩家', () => {
  it("globalBan 步骤的 'system' 不被替换为实际选手", () => {
    const seq = getBPSequence(
      [[
        { player: 'road2', action: 'pick', count: 1 },
        { player: 'system', action: 'globalBan', count: 2 },
        { player: 'road4', action: 'ban' }
      ]],
      'player1', 'player2'
    )
    expect(seq[0][0].player).toBe('player1') // road2 → player1
    expect(seq[0][1].player).toBe('system')  // system 原样透传
    expect(seq[0][1].action).toBe('globalBan')
    expect(seq[0][2].player).toBe('player2') // road4 → player2
  })
})

describe('globalBan 自动抽取步骤', () => {
  let gameStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    useConnectionStore().roomMode = 'local'
    gameStore.player1.road = 2
    gameStore.player2.road = 4
    gameStore.pumpkinUsage = { player1: 0, player2: 0 }
  })

  // 工具：设置模板并开始小局（startRound 末尾会触发 _processAutoSteps 处理首步 globalBan）
  const setupSequence = (template) => {
    gameStore.ruleConfig.bpSequence = template
    gameStore.globalBans = []
    gameStore.startRound(1)
  }

  it('首步 globalBan：抽取指定数量并自动推进到下一步', () => {
    setupSequence([
      [
        { player: 'system', action: 'globalBan', count: 2 },
        { player: 'road2', action: 'pick', count: 1 }
      ]
    ])
    expect(gameStore.globalBans.length).toBe(2)
    expect(gameStore.currentRound.step).toBe(1)
    expect(gameStore.currentRound.action).toBe('pick')
    expect(gameStore.currentRound.currentPlayer).toBe('player1') // road2 → player1
  })

  it('连续多个 globalBan 步骤全部执行并停在下一手动步骤', () => {
    setupSequence([
      [
        { player: 'system', action: 'globalBan', count: 1 },
        { player: 'system', action: 'globalBan', count: 2 },
        { player: 'road4', action: 'pick', count: 1 }
      ]
    ])
    expect(gameStore.globalBans.length).toBe(3)
    expect(gameStore.currentRound.step).toBe(2)
    expect(gameStore.currentRound.action).toBe('pick')
    expect(gameStore.currentRound.currentPlayer).toBe('player2') // road4 → player2
  })

  it('抽取数量超过可用池时抽满可用池（不重复、不报错）', () => {
    setupSequence([
      [{ player: 'system', action: 'globalBan', count: 100 }]
    ])
    expect(gameStore.globalBans.length).toBe(PLANTS.length) // 池共 6 个，全抽完
    // 唯一步处理完，流程结束 → positioning
    expect(gameStore.gameStatus).toBe('positioning')
  })

  it('已禁用的植物不会被重复抽取（与既有 globalBans 去重）', () => {
    gameStore.globalBans = ['peashooter', 'sunflower']
    // 不用 setupSequence（它会清空 globalBans），手动驱动
    gameStore.ruleConfig.bpSequence = [
      [{ player: 'system', action: 'globalBan', count: 100 }]
    ]
    gameStore.startRound(1)
    expect(gameStore.globalBans.length).toBe(PLANTS.length)
    expect(gameStore.globalBans).toContain('peashooter')
    expect(gameStore.globalBans).toContain('sunflower')
    // 无重复
    expect(new Set(gameStore.globalBans).size).toBe(gameStore.globalBans.length)
  })

  it('moveToNextStep 推进到 globalBan 步骤时自动抽取（ban 后衔接 globalBan）', () => {
    setupSequence([
      [
        { player: 'road2', action: 'ban' },
        { player: 'system', action: 'globalBan', count: 2 },
        { player: 'road4', action: 'pick', count: 1 }
      ]
    ])
    // 初始停在 step 0（ban），尚未抽取
    expect(gameStore.currentRound.action).toBe('ban')
    expect(gameStore.globalBans.length).toBe(0)

    // 模拟选手完成 ban（player1=road2，local 模式 isMyTurn=true）
    gameStore.currentRound.selectedPlant = 'peashooter'
    gameStore.confirmSelection()

    // ban 推进 → 遇 globalBan 自动抽取 2 个（排除刚 ban 的 peashooter）→ 再推进到 pick
    expect(gameStore.globalBans.length).toBe(2)
    expect(gameStore.globalBans).not.toContain('peashooter')
    expect(gameStore.currentRound.action).toBe('pick')
    expect(gameStore.currentRound.currentPlayer).toBe('player2')
  })

  it('availablePlants 在 globalBan 步骤返回空（避免选手误触）', () => {
    // player 模式停在 globalBan 首步（非权威方不推进）
    useConnectionStore().roomMode = 'player'
    setupSequence([
      [
        { player: 'system', action: 'globalBan', count: 2 },
        { player: 'road2', action: 'pick', count: 1 }
      ]
    ])
    expect(gameStore.currentRound.action).toBe('globalBan')
    expect(gameStore.availablePlants).toEqual([])
  })

  describe('多人模式权威方语义', () => {
    it('player（非权威方）：不抽取、不推进，等 host 同步', () => {
      useConnectionStore().roomMode = 'player'
      setupSequence([
        [
          { player: 'system', action: 'globalBan', count: 2 },
          { player: 'road2', action: 'pick', count: 1 }
        ]
      ])
      expect(gameStore.globalBans.length).toBe(0)
      expect(gameStore.currentRound.step).toBe(0)
      expect(gameStore.currentRound.action).toBe('globalBan')
    })

    it('host（权威方）：抽取并通过 syncState 广播', () => {
      const connStore = useConnectionStore()
      connStore.roomMode = 'host'
      const broadcastSpy = vi.spyOn(connStore, 'syncState')
      setupSequence([
        [
          { player: 'system', action: 'globalBan', count: 2 },
          { player: 'road2', action: 'pick', count: 1 }
        ]
      ])
      expect(gameStore.globalBans.length).toBe(2)
      expect(broadcastSpy).toHaveBeenCalled()
    })
  })
})

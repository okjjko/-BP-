/**
 * 空 ban（skipBanStep）与重置本小局（resetCurrentRound）单元测试
 *
 * - skipBanStep：仅 ban 步、仅回合方；消耗步骤可撤销（lastActor=当前选手）
 * - resetCurrentRound：仅裁判；清本局但保留大局比分/历史 plantUsage/永久禁用
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// 隔离植物数据（固定小植物池，避开 IndexedDB/localStorage 依赖）
vi.mock('@/data/customPlants', () => ({
  getAllPlantsSync: () => [
    { id: 'peashooter', name: '豌豆射手' },
    { id: 'sunflower', name: '向日葵' },
    { id: 'pumpkin', name: '南瓜头' }
  ],
  getPlantByIdSync: (id) => ({ id, name: id }),
  getPlantImage: () => '',
  getPlantName: (id) => id,
  initializeCache: vi.fn(async () => {}),
}))

// 多人同步接口 no-op（单机语义测试）
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ warning: vi.fn(), success: vi.fn(), info: vi.fn(), error: vi.fn() })
}))

import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

// localStorage 桩（jsdom 真实 localStorage 也行，但显式清空更稳）
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('skipBanStep（空 ban）', () => {
  function setupLocalGame() {
    const store = useGameStore()
    const conn = useConnectionStore()
    conn.roomMode = 'local'
    store.ruleConfig.randomBan = { enabled: false, count: 0 }
    store.initGame('甲', '乙', null, 2, 4)
    return { store, conn }
  }

  it('ban 步：跳过消耗步骤，bans 保持为空，可撤销', () => {
    const { store } = setupLocalGame()
    // 默认模板 Stage1 首
    expect(store.currentRound.action).toBe('ban')

    const stepBefore = store.currentRound.step
    const r = store.skipBanStep()
    expect(r.ok).toBe(true)
    expect(store.currentRound.step).toBe(stepBefore + 1)
    expect(store.currentRound.bans.player1).toEqual([])
    expect(store.currentRound.bans.player2).toEqual([])
    // lastActor 已记录，裁判可撤销
    expect(store.lastActor).toBeTruthy()

    const undoR = store.undoLastAction()
    expect(undoR.ok).toBe(true)
    expect(store.currentRound.step).toBe(stepBefore)
    expect(store.currentRound.action).toBe('ban')
  })

  it('pick 步：拒绝（wrong-action）', () => {
    const { store } = setupLocalGame()
    // 跳过 4 个 ban 步到第一个 pick
    for (let i = 0; i < 4; i++) store.skipBanStep()
    expect(store.currentRound.action).toBe('pick')

    const r = store.skipBanStep()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('wrong-action')
  })

  it('positioning 阶段：拒绝（wrong-phase）', () => {
    const { store } = setupLocalGame()
    store.gameStatus = 'positioning'
    const r = store.skipBanStep()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('wrong-phase')
  })

  it('多人选手端非本人回合：拒绝（not-your-turn）', () => {
    const { store, conn } = setupLocalGame()
    // 模拟选手端：player2 视角，当前是 player1（二路）先手
    conn.roomMode = 'player'
    conn.myRole = 'player'
    conn.myAssignedPlayer = 'player2'
    // currentPlayer = road2 = player1
    expect(store.currentRound.currentPlayer).toBe('player1')

    const r = store.skipBanStep()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('not-your-turn')
  })
})

describe('resetCurrentRound（重置本小局）', () => {
  function setupWithProgress() {
    const store = useGameStore()
    const conn = useConnectionStore()
    conn.roomMode = 'local'
    store.ruleConfig.randomBan = { enabled: false, count: 0 }
    store.initGame('甲', '乙', null, 2, 4)
    // player1 ban 一步（第 0 步：road2=player1 ban）
    store.currentRound.selectedPlant = 'sunflower'
    store.confirmSelection()
    return { store, conn }
  }

  it('裁判：清本局 ban/pick 回起点，保留比分与已抽永久禁用', () => {
    const { store } = setupWithProgress()
    expect(store.currentRound.bans.player1.length).toBe(1)

    // 造一点「对局内已抽取的永久禁用」与比分，验证保留
    store.globalBans = ['peashooter']
    store.player1.score = 2

    const r = store.resetCurrentRound()
    expect(r.ok).toBe(true)
    expect(store.currentRound.step).toBe(0)
    expect(store.currentRound.bans.player1).toEqual([])
    expect(store.currentRound.bans.player2).toEqual([])
    expect(store.currentRound.picks.player1).toEqual([])
    expect(store.gameStatus).toBe('banning')
    // 保留项
    expect(store.player1.score).toBe(2)
    expect(store.globalBans).toEqual(['peashooter'])
    // 撤销栈随 startRound 清空
    expect(store.undoStack.length).toBe(0)
  })

  it('选手/观众端：拒绝（not-allowed）', () => {
    const { store, conn } = setupWithProgress()
    conn.roomMode = 'player'
    conn.myRole = 'player'
    conn.myAssignedPlayer = 'player1'
    expect(store.resetCurrentRound().ok).toBe(false)

    conn.roomMode = 'spectator'
    conn.myRole = 'spectator'
    expect(store.resetCurrentRound().ok).toBe(false)
  })

  it('result 阶段：拒绝（wrong-phase）', () => {
    const { store } = setupWithProgress()
    store.gameStatus = 'result'
    const r = store.resetCurrentRound()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('wrong-phase')
  })
})

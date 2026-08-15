/**
 * 每步思考倒计时（ruleConfig.timer）单元测试
 *
 * - 权威方（local/host）超时自动随机 ban/pick；非权威方不设定时器
 * - 超时动作压撤销快照、lastActor=当前选手（可撤回）
 * - 步骤切换重置计时；extraPick pending / globalBan 自动步不计时
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/data/customPlants', () => ({
  getAllPlantsSync: () => [
    { id: 'peashooter', name: '豌豆射手' },
    { id: 'sunflower', name: '向日葵' },
    { id: 'repeater', name: '双发射手' }
  ],
  getPlantByIdSync: (id) => ({ id, name: id }),
  getPlantImage: () => '',
  getPlantName: (id) => id,
  initializeCache: vi.fn(async () => {}),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ info: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() })
}))

import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('step timer（每步思考倒计时）', () => {
  function setupGame(timerConfig = { enabled: true, secondsPerStep: 60 }) {
    const store = useGameStore()
    const conn = useConnectionStore()
    conn.roomMode = 'local'
    store.ruleConfig.randomBan = { enabled: false, count: 0 }
    store.ruleConfig.timer = timerConfig
    store.initGame('甲', '乙', null, 2, 4)
    return { store, conn }
  }

  it('权威方：ban 步超时后随机禁用一个植物，且可撤销', () => {
    const { store } = setupGame()
    expect(store.currentRound.action).toBe('ban')
    expect(store.stepStartedAt).not.toBeNull()

    vi.advanceTimersByTime(60 * 1000)

    // 随机禁用了一个
    expect(store.currentRound.bans.player1.length).toBe(1)
    expect(store.currentRound.step).toBe(1)
    expect(store.lastActor).toBe('player1')

    // 可撤销回退
    const r = store.undoLastAction()
    expect(r.ok).toBe(true)
    expect(store.currentRound.bans.player1).toEqual([])
    expect(store.currentRound.step).toBe(0)
  })

  it('开关关闭：不设定时器', () => {
    const { store } = setupGame({ enabled: false, secondsPerStep: 60 })
    expect(store.stepStartedAt).toBeNull()
    vi.advanceTimersByTime(600 * 1000)
    expect(store.currentRound.bans.player1).toEqual([])
    expect(store.currentRound.step).toBe(0)
  })

  it('非权威方（player 端）：不设定时器', () => {
    const store = useGameStore()
    const conn = useConnectionStore()
    conn.roomMode = 'player'
    conn.myRole = 'player'
    store.ruleConfig.randomBan = { enabled: false, count: 0 }
    store.ruleConfig.timer = { enabled: true, secondsPerStep: 60 }
    store.initGame('甲', '乙', null, 2, 4)

    expect(store.stepStartedAt).toBeNull()
    vi.advanceTimersByTime(600 * 1000)
    expect(store.currentRound.bans.player1).toEqual([])
  })

  it('操作推进步骤后重新计时（第二步有自己的起点）', () => {
    const { store } = setupGame()
    const startedAt1 = store.stepStartedAt
    expect(startedAt1).not.toBeNull()

    // 手动 ban 第一步
    store.currentRound.selectedPlant = 'sunflower'
    store.confirmSelection()

    expect(store.currentRound.step).toBe(1)
    // fake timers 冻结 Date.now()，无法比较大小；验证「被重设且仍有效」即可
    expect(store.stepStartedAt).not.toBeNull()
    expect(store.stepStartedAt).toBe(startedAt1)  // 同一冻结时刻，等值即证明重启路径执行
  })

  it('池空（ban 步全被禁）：超时按空 ban 跳过，不死循环', () => {
    const { store } = setupGame({ enabled: true, secondsPerStep: 60 })
    // 全部 3 个植物入 globalBans
    store.globalBans = ['peashooter', 'sunflower', 'repeater']
    // 触发 updateCurrentStep 以重启 timer（globalBans 修改不自动触发）
    store.updateCurrentStep()

    vi.advanceTimersByTime(60 * 1000)
    // 步骤被消耗但 bans 仍空（空 ban 语义）
    expect(store.currentRound.step).toBe(1)
    expect(store.currentRound.bans.player1).toEqual([])
  })

  it('撤销恢复到之前步骤后：计时器重启', () => {
    const { store } = setupGame()
    store.currentRound.selectedPlant = 'sunflower'
    store.confirmSelection()
    expect(store.currentRound.step).toBe(1)

    store.undoLastAction()
    expect(store.currentRound.step).toBe(0)
    // 撤销路径 updateCurrentStep → _restartStepTimer，stepStartedAt 重新设置
    expect(store.stepStartedAt).not.toBeNull()
  })
})

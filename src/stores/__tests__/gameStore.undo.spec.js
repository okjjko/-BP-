/**
 * 通用撤销（Undo Stack）单元测试
 *
 * 回归主力：覆盖 undoLastAction 的快照压栈/弹出恢复、南瓜保护状态回退、
 * lastActor 权限模型、栈生命周期（仅当前小局）、与 _processAutoSteps 的交互、
 * 以及持久化/同步四函数对 undoStack 的处理。
 *
 * 设计要点：
 * - 采用「操作前快照压栈 + 撤销时整体 pop 恢复」，撤销不重新随机，故选手也能安全撤销
 * - 权限：观众拒；裁判(local/host)永真；选手仅当 lastActor===myAssignedPlayer（撤销自己刚做的）
 * - 范围：仅当前小局（startRound 清栈）
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
  { id: 'pumpkin', name: '南瓜头' },
  { id: 'peashooter', name: '豌豆射手' },
  { id: 'sunflower', name: '向日葵' },
  { id: 'wallnut', name: '坚果墙' },
  { id: 'cherry', name: '樱桃炸弹' },
  { id: 'potato', name: '土豆地雷' },
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

// mock validators：撤销测试聚焦状态机，不依赖 canPick/isPumpkin 的真实分支
vi.mock('@/utils/validators', () => ({
  canPick: vi.fn(() => ({ valid: true })),
  isPumpkin: vi.fn((id) => id === 'pumpkin'),
  validatePosition: vi.fn(() => ({ valid: true })),
  isGameOver: vi.fn(() => false),
  isGrandFinal: vi.fn(() => false)
}))

import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

// 构造一个处于 BP 阶段、bpSequence 含 4 步（ban/ban/pick/pick）的 currentRound
const makeRound = (overrides = {}) => ({
  roundNumber: 1,
  stage: 1,
  step: 0,
  currentPlayer: 'player1',
  action: 'ban',
  pickCount: 1,
  bans: { player1: [], player2: [] },
  picks: { player1: [], player2: [] },
  positions: { player1: { road: 2, plants: [] }, player2: { road: 4, plants: [] } },
  selectedPlant: null,
  bpSequence: [[
    { player: 'player1', action: 'ban', count: 1 },
    { player: 'player2', action: 'ban', count: 1 },
    { player: 'player1', action: 'pick', count: 1 },
    { player: 'player2', action: 'pick', count: 1 }
  ]],
  extraPick: null,
  pumpkinProtection: {},
  lastPumpkinIndices: [],
  pumpkinUsedThisRound: { player1: false, player2: false },
  ...overrides
})

describe('通用撤销 undoLastAction', () => {
  let gameStore
  let connStore

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    gameStore = useGameStore()
    connStore = useConnectionStore()
    connStore.roomMode = 'local'
    connStore.myRole = null
    connStore.myAssignedPlayer = null
    connStore.isViewOnly = false
    gameStore.player1.road = 2
    gameStore.player2.road = 4
    gameStore.currentRound = makeRound()
    gameStore.globalBans = []
    gameStore.undoStack = []
    gameStore.lastActor = null
    gameStore.pumpkinUsage = { player1: 0, player2: 0 }
    gameStore.gameStatus = 'banning'
  })

  // 跳到指定 step 并重算 currentPlayer/action
  const gotoStep = (step) => {
    gameStore.currentRound.step = step
    gameStore.updateCurrentStep()
  }

  describe('基础压栈与撤销', () => {
    it('ban 后撤销：bans 清空、step 回退、selectedPlant=null、lastActor=null', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      expect(gameStore.currentRound.bans.player1).toEqual(['peashooter'])
      expect(gameStore.undoStack.length).toBe(1)
      expect(gameStore.lastActor).toBe('player1')

      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(gameStore.currentRound.bans.player1).toEqual([])
      expect(gameStore.currentRound.step).toBe(0)
      expect(gameStore.currentRound.currentPlayer).toBe('player1')
      expect(gameStore.currentRound.selectedPlant).toBe(null)
      expect(gameStore.lastActor).toBe(null)
      expect(gameStore.undoStack.length).toBe(0)
      expect(r.undone.action).toBe('ban')
      expect(r.undone.player).toBe('player1')
      expect(r.undone.plantId).toBe('peashooter')
    })

    it('pick 后撤销：picks 清空、step 回退', () => {
      gotoStep(2) // player1 pick
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      expect(gameStore.currentRound.picks.player1).toEqual(['peashooter'])

      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(gameStore.currentRound.picks.player1).toEqual([])
      expect(gameStore.currentRound.step).toBe(2)
      expect(r.undone.action).toBe('pick')
      expect(r.undone.plantId).toBe('peashooter')
    })

    it('连续多步撤销：逐步回到初始', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection() // p1 ban
      gameStore.currentRound.selectedPlant = 'sunflower'
      gameStore.confirmSelection() // p2 ban
      expect(gameStore.undoStack.length).toBe(2)

      gameStore.undoLastAction()
      expect(gameStore.currentRound.bans.player2).toEqual([])
      expect(gameStore.currentRound.bans.player1).toEqual(['peashooter'])
      expect(gameStore.currentRound.step).toBe(1) // 回到 p2 ban 操作前
      expect(gameStore.undoStack.length).toBe(1)

      gameStore.undoLastAction()
      expect(gameStore.currentRound.bans.player1).toEqual([])
      expect(gameStore.currentRound.step).toBe(0) // 回到 p1 ban 操作前
      expect(gameStore.undoStack.length).toBe(0)
    })

    it('空栈撤销返回 empty', () => {
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('empty')
    })
  })

  describe('南瓜 pick 撤销（核心回归）', () => {
    it('撤销单个南瓜 pick：pumpkinUsage/extraPick/lastPumpkinIndices/picks 全部回退', () => {
      gotoStep(2) // player1 pick
      gameStore.currentRound.selectedPlant = 'pumpkin'
      gameStore.confirmSelection()
      expect(gameStore.currentRound.picks.player1).toEqual(['pumpkin'])
      expect(gameStore.pumpkinUsage.player1).toBe(1)
      expect(gameStore.currentRound.extraPick.remaining).toBe(1)
      expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0])

      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(gameStore.currentRound.picks.player1).toEqual([])
      expect(gameStore.pumpkinUsage.player1).toBe(0)
      expect(gameStore.currentRound.extraPick).toBe(null)
      expect(gameStore.currentRound.lastPumpkinIndices).toEqual([])
      expect(gameStore.undoStack.length).toBe(0)
    })

    it('撤销「南瓜+普通植物」组合的普通步：南瓜重现、保护关系清空、extraPick 恢复', () => {
      gotoStep(2)
      gameStore.currentRound.selectedPlant = 'pumpkin'
      gameStore.confirmSelection()
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection() // 被南瓜保护
      expect(gameStore.currentRound.picks.player1).toEqual(['peashooter'])
      expect(Object.keys(gameStore.currentRound.pumpkinProtection).length).toBe(1)
      expect(gameStore.currentRound.extraPick).toBe(null)

      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      // 回到「刚选完南瓜」状态
      expect(gameStore.currentRound.picks.player1).toEqual(['pumpkin'])
      expect(Object.keys(gameStore.currentRound.pumpkinProtection).length).toBe(0)
      expect(gameStore.currentRound.extraPick.remaining).toBe(1)
      expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0])
    })

    it('连续 2 南瓜 + 2 植物后逐步撤销：状态精确还原', () => {
      gotoStep(2)
      gameStore.currentRound.selectedPlant = 'pumpkin'
      gameStore.confirmSelection()
      gameStore.currentRound.selectedPlant = 'pumpkin'
      gameStore.confirmSelection()
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      gameStore.currentRound.selectedPlant = 'sunflower'
      gameStore.confirmSelection()
      expect(gameStore.currentRound.picks.player1).toEqual(['peashooter', 'sunflower'])
      expect(gameStore.undoStack.length).toBe(4)

      // 撤销 sunflower 步 → 回到「1 南瓜 + peashooter 保护」
      gameStore.undoLastAction()
      expect(gameStore.currentRound.picks.player1).toEqual(['pumpkin', 'peashooter'])
      expect(gameStore.currentRound.extraPick.remaining).toBe(1)

      // 撤销 peashooter 步 → 回到「2 南瓜待匹配」
      gameStore.undoLastAction()
      expect(gameStore.currentRound.picks.player1).toEqual(['pumpkin', 'pumpkin'])
      expect(gameStore.currentRound.extraPick.remaining).toBe(2)
      expect(gameStore.currentRound.lastPumpkinIndices).toEqual([0, 1])
    })
  })

  describe('撤销手动抽取永禁', () => {
    it('drawRandomGlobalBan 后撤销：globalBans 回退、lastActor=system→null', () => {
      const r1 = gameStore.drawRandomGlobalBan()
      expect(r1.ok).toBe(true)
      expect(gameStore.globalBans.length).toBe(1)
      expect(gameStore.undoStack.length).toBe(1)
      expect(gameStore.lastActor).toBe('system')

      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(gameStore.globalBans.length).toBe(0)
      expect(gameStore.lastActor).toBe(null)
      expect(gameStore.undoStack.length).toBe(0)
      expect(r.undone.action).toBe('globalBan')
      expect(r.undone.manualBan).toBe(true)
    })

    it('drawRandomGlobalBan 不再写 lastManualGlobalBan（通用 undo 取代）', () => {
      gameStore.drawRandomGlobalBan()
      expect(gameStore.lastManualGlobalBan).toBe(null)
    })

    it('抽取失败（池空）：不压栈、lastActor 不变', () => {
      gameStore.globalBans = PLANTS.map(p => p.id) // 占满池
      gameStore.lastActor = 'player1' // 预设值
      const r = gameStore.drawRandomGlobalBan()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('empty')
      expect(gameStore.undoStack.length).toBe(0)
      expect(gameStore.lastActor).toBe('player1') // 未被改成 system
    })
  })

  describe('权限（lastActor 模型）', () => {
    it('spectator 撤销返回 not-allowed', () => {
      // 先用 local 压一个栈
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      connStore.roomMode = 'spectator'
      connStore.isViewOnly = true
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('not-allowed')
    })

    it('player 撤销别人的操作返回 not-allowed', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection() // lastActor='player1'
      connStore.roomMode = 'player'
      connStore.myRole = 'player'
      connStore.myAssignedPlayer = 'player2'
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('not-allowed')
    })

    it('player 撤销自己刚做的操作：成功', () => {
      connStore.roomMode = 'player'
      connStore.myRole = 'player'
      connStore.myAssignedPlayer = 'player1'
      // player1 ban 步 currentPlayer=player1 === myAssignedPlayer → isMyTurn=true
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      expect(gameStore.lastActor).toBe('player1')
      // 推进后 currentPlayer=player2，但 lastActor=player1 === myAssignedPlayer → 可撤
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(gameStore.currentRound.bans.player1).toEqual([])
      expect(gameStore.currentRound.currentPlayer).toBe('player1') // 回合回退给原操作者
    })

    it('host 撤销任意操作：成功', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      connStore.roomMode = 'host'
      connStore.myRole = 'host'
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
    })

    it('local 撤销：成功', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
    })
  })

  describe('栈生命周期', () => {
    it('startRound 清空 undoStack 与 lastActor', () => {
      gameStore._pushUndoSnapshot()
      gameStore.lastActor = 'player1'
      expect(gameStore.undoStack.length).toBe(1)
      gameStore.startRound(2)
      expect(gameStore.undoStack.length).toBe(0)
      expect(gameStore.lastActor).toBe(null)
    })

    it('positioning 阶段撤销返回 wrong-phase', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      gameStore.gameStatus = 'positioning'
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(false)
      expect(r.reason).toBe('wrong-phase')
    })

    it('栈上限 30：超出丢弃最旧', () => {
      for (let i = 0; i < 32; i++) gameStore._pushUndoSnapshot()
      expect(gameStore.undoStack.length).toBe(30)
    })
  })

  describe('与 _processAutoSteps 的交互', () => {
    it('撤销不触发自动重抽（_drawGlobalBans 未被调用）', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      const spy = vi.spyOn(gameStore, '_drawGlobalBans')
      const r = gameStore.undoLastAction()
      expect(r.ok).toBe(true)
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('撤销跨过手动抽取：globalBans 完整回退、不丢失其他来源', () => {
      // 模拟开局/自动步骤已抽的 globalBans
      gameStore.globalBans = ['wallnut', 'cherry']
      // p1 ban（压栈，快照含 globalBans=['wallnut','cherry']）
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      // 手动抽永禁
      const drawn = gameStore.drawRandomGlobalBan()
      expect(gameStore.globalBans.length).toBe(3)

      // 撤销手动抽取
      gameStore.undoLastAction()
      expect(gameStore.globalBans.length).toBe(2)
      expect(gameStore.globalBans).toEqual(expect.arrayContaining(['wallnut', 'cherry']))
      expect(gameStore.globalBans).not.toContain(drawn.plantId)

      // 再撤销 ban：globalBans 仍为 ['wallnut','cherry']（ban 快照里的值，不被重抽）
      gameStore.undoLastAction()
      expect(gameStore.globalBans.length).toBe(2)
      expect(gameStore.globalBans).toEqual(expect.arrayContaining(['wallnut', 'cherry']))
    })
  })

  describe('持久化与同步', () => {
    it('save/load 往返：undoStack 与 lastActor 完整恢复', () => {
      gameStore.currentRound.selectedPlant = 'peashooter'
      gameStore.confirmSelection()
      expect(gameStore.undoStack.length).toBe(1)
      gameStore.saveToLocalStorage()

      setActivePinia(createPinia())
      const s2 = useGameStore()
      const ok = s2.loadFromLocalStorage()
      expect(ok).toBe(true)
      expect(s2.undoStack.length).toBe(1)
      expect(s2.lastActor).toBe('player1')
    })

    it('applySyncState：含 undoStack/lastActor 的 payload 覆盖本地', () => {
      const payload = {
        player1: { id: '', score: 0, road: 2 },
        player2: { id: '', score: 0, road: 4 },
        firstPlayer: null,
        currentRound: makeRound(),
        globalBans: ['peashooter'],
        plantUsage: {},
        pumpkinUsage: { player1: 0, player2: 0 },
        lastManualGlobalBan: null,
        undoStack: [{
          currentRound: makeRound(),
          globalBans: [],
          plantUsage: {},
          pumpkinUsage: { player1: 0, player2: 0 },
          gameStatus: 'banning'
        }],
        lastActor: 'system',
        gameStatus: 'banning',
        roundWinner: null,
        winThreshold: 4,
        ruleConfig: {}
      }
      gameStore.applySyncState(payload)
      expect(gameStore.undoStack.length).toBe(1)
      expect(gameStore.lastActor).toBe('system')
      expect(gameStore.globalBans).toEqual(['peashooter'])
    })

    it('旧 payload 无 undoStack 字段：降级为空数组、lastActor 为 null', () => {
      const payload = {
        player1: { id: '', score: 0, road: 2 },
        player2: { id: '', score: 0, road: 4 },
        firstPlayer: null,
        currentRound: makeRound(),
        globalBans: [],
        plantUsage: {},
        pumpkinUsage: { player1: 0, player2: 0 },
        lastManualGlobalBan: null,
        gameStatus: 'banning',
        roundWinner: null,
        winThreshold: 4,
        ruleConfig: {}
      }
      gameStore.applySyncState(payload)
      expect(gameStore.undoStack).toEqual([])
      expect(gameStore.lastActor).toBe(null)
    })
  })
})

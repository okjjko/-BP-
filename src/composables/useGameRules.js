/**
 * 游戏规则 Composable
 * 封装游戏规则校验和状态判断
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { isGameOver as _isGameOver, isGrandFinal as _isGrandFinal } from '@/utils/validators'

export function useGameRules() {
  const gameStore = useGameStore()

  /**
   * 当前是否大局结束（有人达到4分）
   */
  const gameOver = computed(() =>
    _isGameOver(gameStore.player1.score, gameStore.player2.score)
  )

  /**
   * 当前是否进入巅峰对决（3:3）
   */
  const grandFinal = computed(() =>
    _isGrandFinal(gameStore.player1.score, gameStore.player2.score)
  )

  /**
   * 获取领先者
   */
  const leader = computed(() => {
    if (gameStore.player1.score > gameStore.player2.score) return 'player1'
    if (gameStore.player2.score > gameStore.player1.score) return 'player2'
    return null
  })

  /**
   * 获取落后者
   */
  const loser = computed(() => {
    if (gameStore.player1.score < gameStore.player2.score) return 'player1'
    if (gameStore.player2.score < gameStore.player1.score) return 'player2'
    return null
  })

  /**
   * 当前 BP 总步骤数
   */
  const totalBPSteps = computed(() => {
    const { bpSequence } = gameStore.currentRound
    if (!bpSequence) return 0
    return bpSequence.reduce((total, stage) => total + stage.length, 0)
  })

  /**
   * BP 是否已全部完成
   */
  const bpComplete = computed(() => {
    return gameStore.currentRound.step >= totalBPSteps.value
  })

  /**
   * 获取某个玩家某个植物的累计使用次数（本局 + 历史）
   */
  function getTotalUsage(player, plantId) {
    const currentPicks = (gameStore.currentRound.picks[player] || [])
      .filter(id => id === plantId).length
    const historical = gameStore.plantUsage[`${player}_${plantId}`] || 0
    return currentPicks + historical
  }

  /**
   * 检查植物是否已被全局禁用
   */
  function isGlobalBanned(plantId) {
    return gameStore.globalBans.includes(plantId)
  }

  /**
   * 检查植物是否被某个玩家在本局禁用
   */
  function isBannedBy(plantId, player) {
    return (gameStore.currentRound.bans[player] || []).includes(plantId)
  }

  /**
   * 检查植物是否被任何玩家禁用
   */
  function isBanned(plantId) {
    return isBannedBy(plantId, 'player1') || isBannedBy(plantId, 'player2')
  }

  /**
   * 检查植物是否已被某个玩家选择
   */
  function isPickedBy(plantId, player) {
    return (gameStore.currentRound.picks[player] || []).includes(plantId)
  }

  return {
    // 响应式状态
    gameOver,
    grandFinal,
    leader,
    loser,
    totalBPSteps,
    bpComplete,

    // 方法
    getTotalUsage,
    isGlobalBanned,
    isBannedBy,
    isBanned,
    isPickedBy
  }
}

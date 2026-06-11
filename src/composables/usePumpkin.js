/**
 * 南瓜头特殊规则 Composable
 * 封装南瓜头的选择、保护、索引管理等复杂逻辑
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { isPumpkin } from '@/utils/validators'
import { getAllPlantsSync } from '@/data/customPlants'

export function usePumpkin() {
  const gameStore = useGameStore()
  const connStore = useConnectionStore()

  /**
   * 检查当前是否处于南瓜头额外选择状态
   */
  const isInPumpkinExtraPick = computed(() => {
    const extra = gameStore.currentRound.extraPick
    return extra !== null && extra.remaining > 0
  })

  /**
   * 获取当前南瓜头额外选择的玩家
   */
  const pumpkinExtraPickPlayer = computed(() => {
    return gameStore.currentRound.extraPick?.player || null
  })

  /**
   * 检查植物是否为南瓜头
   */
  function checkIsPumpkin(plantId) {
    return isPumpkin(plantId, getAllPlantsSync())
  }

  /**
   * 获取某个玩家的南瓜头使用次数
   */
  function getPumpkinUsage(player) {
    return gameStore.pumpkinUsage[player] || 0
  }

  /**
   * 检查玩家是否还能使用南瓜头
   */
  function canUsePumpkin(player) {
    return getPumpkinUsage(player) < 2
  }

  /**
   * 获取某个玩家某个植物的保护信息
   */
  function getProtection(player, plantIndex) {
    const key = `${player}_${plantIndex}`
    return gameStore.currentRound.pumpkinProtection?.[key] || null
  }

  /**
   * 检查某个植物实例是否被南瓜保护
   */
  function isProtected(player, plantIndex) {
    return getProtection(player, plantIndex) !== null
  }

  return {
    isInPumpkinExtraPick,
    pumpkinExtraPickPlayer,
    checkIsPumpkin,
    getPumpkinUsage,
    canUsePumpkin,
    getProtection,
    isProtected
  }
}

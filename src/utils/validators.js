/**
 * 验证逻辑
 * 用于检查BP操作是否符合规则
 */

/**
 * 检查植物是否被禁用（永久禁用或临时禁用）
 * @param {string} plantId - 植物ID
 * @param {Array} globalBans - 全局永久禁用的植物
 * @param {Array} roundBans - 当前局禁用的植物
 */
export const isBanned = (plantId, globalBans, roundBans) => {
  return [...globalBans, ...roundBans].includes(plantId)
}

/**
 * 检查植物是否已被选择
 * @param {string} plantId - 植物ID
 * @param {Array} player1Picks - 选手1的已选植物
 * @param {Array} player2Picks - 选手2的已选植物
 */
export const isPicked = (plantId, player1Picks, player2Picks) => {
  return [...player1Picks, ...player2Picks].includes(plantId)
}

/**
 * 检查植物使用次数是否已达到上限
 * @param {string} plantId - 植物ID
 * @param {string} playerId - 选手ID
 * @param {Object} plantUsage - 植物使用次数记录
 * @param {number} maxUsage - 最大使用次数（默认2次）
 */
export const checkUsageLimit = (plantId, playerId, plantUsage, maxUsage = 2) => {
  const key = `${playerId}_${plantId}`
  const usage = plantUsage[key] || 0
  return usage < maxUsage
}

/**
 * 检查是否可以选择对方已选的植物
 * 规则：选手不能选择对方已经确定选择的植物
 * @param {string} plantId - 植物ID
 * @param {string} currentPlayer - 当前选手
 * @param {Array} player1Picks - 选手1的已选植物
 * @param {Array} player2Picks - 选手2的已选植物
 */
export const canPickOpponentPlant = (plantId, currentPlayer, player1Picks, player2Picks) => {
  const opponentPicks = currentPlayer === 'player1' ? player2Picks : player1Picks
  return !opponentPicks.includes(plantId)
}

/**
 * 检查站位是否符合规则
 * @param {Object} position - 站位配置
 * @param {string} position.road - 选的路（2或4）
 * @param {Array} position.plants - 植物列表
 */
export const validatePosition = (position) => {
  const errors = []

  // 检查是否选路
  if (!position.road || (position.road !== 2 && position.road !== 4)) {
    errors.push('必须选择2路或4路')
  }

  // 检查是否有植物
  if (!position.plants || position.plants.length === 0) {
    errors.push('至少需要一个植物')
  }

  // 检查站位数量（最多5个）
  if (position.plants && position.plants.length > 5) {
    errors.push('最多只能有5个植物')
  }

  // 检查是否有副C/大C
  // 这里需要根据实际规则定义什么是副C/大C
  // 暂时跳过此验证，等待用户提供具体规则

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 检查南瓜套规则
 * 摆阵时不得更换套的植物
 * @param {Object} position - 站位配置
 * @param {string} pumpkinId - 南瓜头植物ID
 */
export const validatePumpkin = (position, pumpkinId) => {
  // 这里需要实现南瓜套的验证逻辑
  // 暂时返回true
  return {
    valid: true,
    errors: []
  }
}

/**
 * 综合验证：检查是否可以进行ban操作
 * @param {string} plantId - 植物ID
 * @param {Object} gameState - 游戏状态
 */
export const canBan = (plantId, gameState) => {
  const {
    globalBans,
    currentRound
  } = gameState

  const { bans } = currentRound
  const allBans = [...bans.player1, ...bans.player2]

  // 检查是否已被禁用
  if (isBanned(plantId, globalBans, allBans)) {
    return {
      valid: false,
      reason: '该植物已被禁用'
    }
  }

  // 检查是否已被选择
  if (isPicked(plantId, currentRound.picks.player1, currentRound.picks.player2)) {
    return {
      valid: false,
      reason: '该植物已被选择'
    }
  }

  return {
    valid: true
  }
}

/**
 * 综合验证：检查是否可以进行pick操作
 * @param {string} plantId - 植物ID
 * @param {string} playerId - 选手ID
 * @param {Object} gameState - 游戏状态
 */
export const canPick = (plantId, playerId, gameState) => {
  const {
    globalBans,
    currentRound,
    plantUsage
  } = gameState

  const { bans, picks } = currentRound
  const allBans = [...bans.player1, ...bans.player2]

  // 检查是否已被禁用
  if (isBanned(plantId, globalBans, allBans)) {
    return {
      valid: false,
      reason: '该植物已被禁用'
    }
  }

  // 检查是否已被选择（包括双方）
  if (isPicked(plantId, picks.player1, picks.player2)) {
    return {
      valid: false,
      reason: '该植物已被选择'
    }
  }

  // 检查使用次数
  if (!checkUsageLimit(plantId, playerId, plantUsage)) {
    return {
      valid: false,
      reason: '该植物使用次数已达上限（2次）'
    }
  }

  // 检查是否选择对方已选的植物
  if (!canPickOpponentPlant(plantId, playerId, picks.player1, picks.player2)) {
    return {
      valid: false,
      reason: '不能选择对方已选的植物'
    }
  }

  return {
    valid: true
  }
}

/**
 * 检查游戏是否结束
 * @param {number} score1 - 选手1得分
 * @param {number} score2 - 选手2得分
 * @param {number} maxScore - 最高分（默认5分）
 */
export const isGameOver = (score1, score2, maxScore = 5) => {
  return score1 >= maxScore || score2 >= maxScore
}

/**
 * 检查是否进入巅峰对决（4:4平局）
 */
export const isGrandFinal = (score1, score2) => {
  return score1 === 4 && score2 === 4
}

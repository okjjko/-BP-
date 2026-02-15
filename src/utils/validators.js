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

  // 唯一限制：植物不能已经被禁用
  if (isBanned(plantId, globalBans, allBans)) {
    return {
      valid: false,
      reason: '该植物已被禁用'
    }
  }

  // 移除原有逻辑：不再检查植物是否已被选择或使用次数
  // 允许禁用任何未被禁用的植物（包括已被选择或已达使用上限的植物）

  return {
    valid: true
  }
}

/**
 * 综合验证：检查是否可以进行pick操作
 * 改进：允许选手在同一小分中选择同一植物多次（最多2次）
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

  // 检查对手是否已选择该植物
  const opponent = playerId === 'player1' ? 'player2' : 'player1'
  const opponentPicks = picks[opponent] || []
  if (opponentPicks.includes(plantId)) {
    return {
      valid: false,
      reason: '不能选择对方已选的植物'
    }
  }

  // 检查自己本局已选次数 + 历史使用次数
  const ownPicks = picks[playerId] || []
  const ownPickCount = ownPicks.filter(id => id === plantId).length
  const historicalUsage = plantUsage[`${playerId}_${plantId}`] || 0
  const totalUsage = ownPickCount + historicalUsage

  if (totalUsage >= 2) {
    return {
      valid: false,
      reason: `该植物已使用${totalUsage}次，达到上限（2次）`
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
 * @param {number} maxScore - 最高分（默认4分）
 */
export const isGameOver = (score1, score2, maxScore = 4) => {
  return score1 >= maxScore || score2 >= maxScore
}

/**
 * 检查是否进入巅峰对决（3:3平局）
 */
export const isGrandFinal = (score1, score2) => {
  return score1 === 3 && score2 === 3
}

/**
 * 判断植物是否为南瓜头
 * @param {string} plantId - 植物ID
 * @param {Array} allPlants - 所有植物列表（可选，用于按名称判断）
 * @returns {boolean}
 */
export const isPumpkin = (plantId, allPlants = null) => {
  // 检查1: ID 为 'pumpkin'
  if (plantId === 'pumpkin') {
    return true
  }

  // 检查2: 植物名称为 '南瓜头'
  if (allPlants && allPlants.length > 0) {
    const plant = allPlants.find(p => p.id === plantId)
    if (plant && plant.name === '南瓜头') {
      return true
    }
  }

  return false
}

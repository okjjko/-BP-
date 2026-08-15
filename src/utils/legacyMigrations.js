/**
 * 旧存档数据迁移（从 gameStore 抽取的纯函数，行为不变）
 *
 * 均在 loadFromLocalStorage 内调用，用于把历史版本的存档结构升级到当前结构。
 * 函数直接 mutate 传入的 currentRound 对象；依赖 isPumpkinPlant 判定时由调用方
 * 注入（保持本模块对 store 的零依赖）。
 */

/**
 * 站位 plants 从旧「字符串 plantId 数组」迁移为「{plantId, instanceId, sourceIndex} 数组」。
 */
export function migrateLegacyPositions(currentRound, generatePlantInstanceId) {
  ['player1', 'player2'].forEach(player => {
    const plants = currentRound?.positions?.[player]?.plants
    if (!plants || plants.length === 0) return
    const firstElement = plants.find(p => p !== null && p !== undefined)
    if (typeof firstElement === 'string') {
      const newPlants = plants.map((plantId, index) => {
        if (plantId === null || plantId === undefined) return null
        const picks = currentRound.picks[player] || []
        const samePlantIds = plants.slice(0, index).filter(p => p === plantId)
        const sourceIndex = picks.findIndex((pid, i) =>
          pid === plantId && i >= samePlantIds.length
        )
        return {
          plantId,
          instanceId: generatePlantInstanceId(player, plantId, sourceIndex),
          sourceIndex: sourceIndex >= 0 ? sourceIndex : 0
        }
      })
      currentRound.positions[player].plants = newPlants
    }
  })
}

/**
 * 清理 buggy 旧存档：picks 中残留的南瓜头。
 * 正常 pending 状态下南瓜头会临时放在 picks 末尾连续段（待匹配被保护植物）；
 * 旧版本（连续选南瓜索引失效 bug）会在普通植物之间留下穿插的南瓜残留。
 * 这里保留末尾连续南瓜（重建 pending），清理穿插残留，并重映射 pumpkinProtection 的 key。
 */
export function migrateLegacyPumpkinProtection(currentRound, isPumpkinPlant) {
  if (!currentRound) return

  ;['player1', 'player2'].forEach(player => {
    const picks = currentRound?.picks?.[player] || []
    const isPumpkinAt = picks.map(id => isPumpkinPlant(id))
    const pumpkinCount = isPumpkinAt.filter(Boolean).length
    if (pumpkinCount === 0) return

    // 末尾连续南瓜数 = 正常 pending；其余穿插南瓜 = buggy 残留
    let trailingCount = 0
    for (let i = isPumpkinAt.length - 1; i >= 0 && isPumpkinAt[i]; i--) trailingCount++
    const strayCount = pumpkinCount - trailingCount
    if (strayCount > 0) {
      console.warn(`[迁移] 检测到 ${player} 的 picks 中有 ${strayCount} 个穿插南瓜头（buggy 残留），正在清理`)
    }

    // 重建 picks（删除穿插南瓜）并建立 oldIdx → newIdx 映射
    const indexMap = {}
    const cleanPicks = []
    picks.forEach((plantId, oldIdx) => {
      const isStray = isPumpkinAt[oldIdx] && oldIdx < picks.length - trailingCount
      if (isStray) return
      indexMap[oldIdx] = cleanPicks.length
      cleanPicks.push(plantId)
    })
    currentRound.picks[player] = cleanPicks

    // 重映射 pumpkinProtection 的 key（指向已删除穿插南瓜的 key 丢弃）
    const oldProtection = currentRound.pumpkinProtection || {}
    const newProtection = {}
    for (const [key, value] of Object.entries(oldProtection)) {
      const m = key.match(/^(player[12])_(\d+)$/)
      if (!m || m[1] !== player) { newProtection[key] = value; continue }
      const oldIdx = Number(m[2])
      if (oldIdx in indexMap) {
        newProtection[`${player}_${indexMap[oldIdx]}`] = value
      }
    }
    currentRound.pumpkinProtection = newProtection

    // 基于末尾连续南瓜重建 pending 状态
    if (trailingCount > 0) {
      const start = cleanPicks.length - trailingCount
      currentRound.lastPumpkinIndices =
        Array.from({ length: trailingCount }, (_, i) => start + i)
      currentRound.extraPick = { player, remaining: trailingCount }
    }
  })

  // 清理后已无南瓜却仍残留 pending（无法可靠恢复），重置
  const hasPumpkin = ['player1', 'player2'].some(p =>
    (currentRound?.picks?.[p] || []).some(id => isPumpkinPlant(id)))
  if (!hasPumpkin && currentRound?.extraPick) {
    currentRound.extraPick = null
    delete currentRound.lastPumpkinIndices
  }
}

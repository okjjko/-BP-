import { computed } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import { useGameStore } from '@/stores/gameStore'

/**
 * 多人对战按钮级权限（§4.1）
 *
 * 收敛散落各处的权限判断（`roomMode==='local'||myRole==='host'` 等 11+ 处重复），
 * 按身份（local/host/player/spectator）统一控制按钮可用性。与 gameStore 各 action
 * 的内部权限校验配合，形成 UI（v-if/disabled）+ action 双层防御。
 *
 * 权限矩阵详见 docs/TODO.md §4.1 / 实施计划。
 *
 * 用法：
 *   const { canBP, canControlMatch, canSelectSide, canUndo } = usePermission()
 *   <button :disabled="!canControlMatch" />
 *   <button :disabled="!canSetPosition(player)" />   // 带参：普通函数，模板内调用响应式重算
 */
export function usePermission() {
  const conn = useConnectionStore()
  const game = useGameStore()

  // 裁判/单机：可做一切裁判操作（重置/选胜者/抽取永禁/代摆站位/代选路...）
  const isAuthority = computed(() => conn.roomMode === 'local' || conn.myRole === 'host')

  // ban/pick 选植物：观众禁；单机/裁判永可；选手仅本人回合
  const canBP = computed(() => !conn.isViewOnly && (conn.roomMode === 'local' || conn.isMyTurn))

  // 站位：选手摆自己（myAssignedPlayer），裁判/单机可代摆双方。带参函数。
  const canSetPosition = (player) => isAuthority.value || conn.myAssignedPlayer === player

  // 比赛流程控制：完成本小局 / 返回站位 / 选胜者 / 下一小局 / 重置游戏 —— 仅裁判/单机
  const canControlMatch = computed(() => isAuthority.value)

  // 局内抽取永禁 —— 仅裁判/单机
  const canDrawGlobalBan = computed(() => isAuthority.value)

  // 配置/规则编辑 —— 裁判/单机 且 仅赛前（gameStatus==='setup'）
  const canManageConfig = computed(() => isAuthority.value && game.isRuleEditable)

  // 选路权：keep 模式无人选（系统自动）；否则归属者（败者/胜者按 loserPickMode）或裁判代操
  const canSelectSide = computed(() => {
    if (isAuthority.value) return true
    const mode = game.ruleConfig?.sideSelection?.loserPickMode
    if (mode === 'keep' || !game.roundWinner) return false
    const winner = game.roundWinner
    const loser = winner === 'player1' ? 'player2' : 'player1'
    const picker = mode === 'winner' ? winner : loser
    return conn.myAssignedPlayer === picker
  })

  // 撤销：观众禁；裁判/单机永可；选手仅当 lastActor===自己（撤销自己刚做的操作）
  const canUndo = computed(() => {
    if (game.gameStatus !== 'banning' || game.undoStack.length === 0) return false
    if (conn.isViewOnly) return false
    if (isAuthority.value) return true
    return game.lastActor === conn.myAssignedPlayer
  })

  return {
    isAuthority,
    canBP,
    canSetPosition,
    canControlMatch,
    canDrawGlobalBan,
    canManageConfig,
    canSelectSide,
    canUndo,
  }
}

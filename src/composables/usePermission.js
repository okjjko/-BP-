/**
 * 按钮级权限统一判定（TODO §4.1）
 *
 * 收敛此前散落各组件的 `connStore.roomMode === 'local' || connStore.myRole === 'host'`
 * 式判定。单机 local 任何按钮都可点（保持现状语义）；多人按角色细分。
 *
 * 语义（与既有各处手写判定一一对应，勿擅自扩大/缩小）：
 * - isReferee   裁判元操作：抽取永禁 / 重置本小局 / 重置游戏 / 广播开局 / 随机禁用 / 规则编辑
 * - isActor     回合内操作：ban / pick / 空 ban / 站位 / 选边（走 connStore.isMyTurn）
 * - isViewer    观众只读（isViewOnly）
 * - canUndo     通用撤销（lastActor 模型，见 gameStore.undoLastAction）
 */
import { computed } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import { useGameStore } from '@/stores/gameStore'

export function usePermission() {
  const connStore = useConnectionStore()
  const gameStore = useGameStore()

  /** 裁判权限：单机恒真；多人 = host（含选手 host 的元操作） */
  const isReferee = computed(() =>
    connStore.roomMode === 'local' || connStore.myRole === 'host'
  )

  /** 回合操作权限：委托 connStore.isMyTurn（local 恒真、观众 false、选手按回合） */
  const isActor = computed(() => connStore.isMyTurn)

  /** 观众只读 */
  const isViewer = computed(() => connStore.isViewOnly)

  /** 通用撤销权：观众不可；裁判永可；选手仅当 lastActor===自己（撤自己刚做的） */
  const canUndo = computed(() => {
    if (gameStore.gameStatus !== 'banning') return false
    if (gameStore.undoStack.length === 0) return false
    if (connStore.isViewOnly) return false
    if (connStore.roomMode === 'local' || connStore.myRole === 'host') return true
    return gameStore.lastActor === connStore.myAssignedPlayer
  })

  return { isReferee, isActor, isViewer, canUndo }
}

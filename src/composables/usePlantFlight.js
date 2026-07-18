/**
 * 植物飞行编排 composable（跨组件 ban/pick 飞行动画）
 *
 * 职责：在 store.confirmSelection() 之前采集起点/终点视口坐标，
 * 触发 uiStore.startFlight，由 PlantFlightOverlay 渲染克隆体播放 0.4s 飞行。
 *
 * 关键时序约束（见 plan D2）：必须在 commit 前读取坐标——
 * commit 后 BanArea 占位符消失 / PickArea 列表位移，终点不再稳定。
 */
import { useUIStore } from '@/stores/uiStore'

export function usePlantFlight() {
  const uiStore = useUIStore()

  /**
   * 触发一次植物从选择器飞到结果区的动画。
   * @param {Object} params
   * @param {string} params.plantId  被操作植物 ID（querySelector 起点）
   * @param {'ban'|'pick'} params.action  操作类型（决定终点选择器）
   * @param {'player1'|'player2'} params.player  目标结果区所属选手
   * @returns {void} 命中降级条件（reduced-motion / 元素缺失）时静默 return
   */
  const flyToResult = ({ plantId, action, player }) => {
    // 系统级降级：开启「减少动态效果」则不飞、不延迟
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const startEl = document.querySelector(`[data-plant-id="${plantId}"]`)
    const slotAttr = action === 'ban' ? 'data-ban-slot' : 'data-pick-slot'
    const endEl = document.querySelector(`[${slotAttr}="${player}"]`)

    // 起点或终点缺失（布局未就绪）→ 降级为纯进入动画，不报错
    if (!startEl || !endEl) return

    uiStore.startFlight({
      key: Date.now() + Math.random(),
      plantId,
      action,
      fromRect: startEl.getBoundingClientRect(),
      toRect: endEl.getBoundingClientRect()
    })

    // 与飞行过渡时长对齐：540ms 后清理克隆体（飞行 .5s + 余量）
    setTimeout(() => uiStore.endFlight(), 540)
  }

  return { flyToResult }
}

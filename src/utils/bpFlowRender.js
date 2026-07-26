/**
 * BP 流程只读展示的纯渲染映射。
 *
 * 把规则模板（store.ruleConfig.bpSequence）里的占位符 player / action
 * 映射成可读文案 + 主题色 class，供 BPFlowPreview.vue 复用。
 *
 * 数据源是「规则定义」（player 仍为 road2/road4/system 占位符），
 * 不是当前小局实例；故 player→阵营名 的桥接由调用方传入当前
 * sideName(2)/sideName(4)（sideNames = { road2, road4 }）。
 *
 * 与 src/utils/bpRules.js 互补：bpRules 负责「模板→实例」的占位符替换，
 * 本文件只负责「占位符→人话文案 + 颜色」的纯展示映射。
 */

/**
 * player 占位符 → { label, textClass }
 * @param {string} player - 'road2' | 'road4' | 'system'（或未知值）
 * @param {{ road2?: string, road4?: string }} [sideNames] - 当前阵营显示名
 * @returns {{ label: string, textClass: string }}
 */
export const resolvePlayer = (player, sideNames = {}) => {
  if (player === 'road2') {
    return { label: sideNames.road2 || '二路', textClass: 'text-pick-blue' }
  }
  if (player === 'road4') {
    return { label: sideNames.road4 || '四路', textClass: 'text-ban-red' }
  }
  // system / globalBan 步骤的占位，或未知值 → 安全降级为「系统」（灰）
  return { label: '系统', textClass: 'text-gray-400' }
}

/**
 * action → { label, textClass }
 * @param {string} action - 'ban' | 'pick' | 'globalBan'（或未知值）
 * @returns {{ label: string, textClass: string }}
 */
export const resolveAction = (action) => {
  switch (action) {
    case 'pick':
      return { label: '选用', textClass: 'text-pick-blue' }
    case 'globalBan':
      return { label: '全局禁用', textClass: 'text-ban-red' }
    case 'ban':
    default:
      // 未知 action 安全降级为「禁用」（ban-red）
      return { label: '禁用', textClass: 'text-ban-red' }
  }
}

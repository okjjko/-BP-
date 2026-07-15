/**
 * BP顺序规则
 * 根据用户提供的BP规则定义每个阶段的操作顺序
 * 使用'road2'和'road4'代替固定的player，让系统动态确定选手
 */

// 阶段一：禁用顺序（二路→四路→二路→四路）
const STAGE_1_TEMPLATE = [
  { player: 'road2', action: 'ban' },
  { player: 'road4', action: 'ban' },
  { player: 'road2', action: 'ban' },
  { player: 'road4', action: 'ban' }
]

// 阶段二：选择顺序（二路→四路四路→二路二路→四路）
const STAGE_2_TEMPLATE = [
  { player: 'road2', action: 'pick', count: 1 },
  { player: 'road4', action: 'pick', count: 1 },
  { player: 'road4', action: 'pick', count: 1 },
  { player: 'road2', action: 'pick', count: 1 },
  { player: 'road2', action: 'pick', count: 1 },
  { player: 'road4', action: 'pick', count: 1 }
]

// 阶段三：禁用顺序（四路→二路→四路→二路→四路→二路）
const STAGE_3_TEMPLATE = [
  { player: 'road4', action: 'ban' },
  { player: 'road2', action: 'ban' },
  { player: 'road4', action: 'ban' },
  { player: 'road2', action: 'ban' },
  { player: 'road4', action: 'ban' },
  { player: 'road2', action: 'ban' }
]

// 阶段四：选择顺序（四路→二路二路→四路）
const STAGE_4_TEMPLATE = [
  { player: 'road4', action: 'pick', count: 1 },
  { player: 'road2', action: 'pick', count: 1 },
  { player: 'road2', action: 'pick', count: 1 },
  { player: 'road4', action: 'pick', count: 1 }
]

// 内置默认模板（4 阶段，现状）
const BUILTIN_TEMPLATE = [
  STAGE_1_TEMPLATE,
  STAGE_2_TEMPLATE,
  STAGE_3_TEMPLATE,
  STAGE_4_TEMPLATE
]

// 阶段名称（内置默认，4 阶段；向后兼容命名导出）
export const STAGE_NAMES = {
  1: '阶段一：禁用',
  2: '阶段二：选择',
  3: '阶段三：禁用',
  4: '阶段四：选择'
}

// 中文数字映射，用于动态生成「阶段一/阶段二/...」
const CHINESE_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

/**
 * 根据模板的阶段数动态生成阶段名称映射。
 * 每个阶段名按其主要 action 后缀「禁用/选择」（该阶段首步 action 决定）。
 * @param {Array} template - BP 模板 2D 数组（不传或传 null/falsy 时回退到内置 STAGE_NAMES）
 * @returns {Object} { 1: '阶段一：禁用', 2: '...', ... }
 */
export const getStageNames = (template) => {
  if (!template || !Array.isArray(template) || template.length === 0) {
    return STAGE_NAMES
  }
  const names = {}
  template.forEach((stage, idx) => {
    const num = CHINESE_NUM[idx] || String(idx + 1)
    const firstAction = (stage && stage[0] && stage[0].action) || 'ban'
    const suffix = firstAction === 'pick' ? '选择' : '禁用'
    names[idx + 1] = `阶段${num}：${suffix}`
  })
  return names
}

/**
 * 根据二路和四路选手动态生成BP序列
 * @param {Array} [template] - 可选，自定义 BP 模板（2D 数组，步用 'road2'/'road4' 占位符）。
 *                             不传或传 null/空时使用内置 4 阶段模板（保持向后兼容）。
 * @param {string} road2Player - 二路选手的player key ('player1' 或 'player2')
 * @param {string} road4Player - 四路选手的player key ('player1' 或 'player2')
 * @returns {Array} 完整的BP序列（2D 数组，每步 player 已替换为实际选手 key）
 */
export const getBPSequence = (template, road2Player, road4Player) => {
  // 兼容旧调用形式：getBPSequence(road2Player, road4Player)
  // 当第一个参数是字符串时，视为旧式调用（未传 template）
  let tpl = template
  let r2 = road2Player
  let r4 = road4Player
  if (typeof template === 'string') {
    tpl = null
    r2 = template
    r4 = road2Player
  }

  if (!r2 || !r4) {
    console.error('无法生成BP序列：缺少道路信息')
    // 返回与模板同结构的空数组（避免上层硬编码 4 阶段时越界）
    const stageCount = (tpl && tpl.length) || 4
    return Array.from({ length: stageCount }, () => [])
  }

  const useTemplate = (tpl && Array.isArray(tpl) && tpl.length > 0) ? tpl : BUILTIN_TEMPLATE

  // 转换函数：将模板中的'road2'/'road4'替换为实际选手
  const convertTemplate = (stageTemplate) => {
    return stageTemplate.map(step => ({
      player: step.player === 'road2' ? r2 : r4,
      action: step.action,
      count: step.count || 1
    }))
  }

  return useTemplate.map(stage => convertTemplate(stage || []))
}

/**
 * 获取阶段总步骤数
 * @param {Array} stage - 阶段数组
 */
export const getStageStepCount = (stage) => {
  return stage?.length || 0
}

/**
 * 获取BP流程的总步骤数
 * @param {Array} bpSequence - 完整的BP序列
 */
export const getTotalSteps = (bpSequence) => {
  return bpSequence.reduce((total, stage) => total + stage.length, 0)
}

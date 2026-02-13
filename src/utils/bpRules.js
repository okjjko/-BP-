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

// 阶段名称
export const STAGE_NAMES = {
  1: '阶段一：禁用',
  2: '阶段二：选择',
  3: '阶段三：禁用',
  4: '阶段四：选择'
}

/**
 * 根据二路和四路选手动态生成BP序列
 * @param {string} road2Player - 二路选手的player key ('player1' 或 'player2')
 * @param {string} road4Player - 四路选手的player key ('player1' 或 'player2')
 * @returns {Array} 完整的BP序列，包含4个阶段
 */
export const getBPSequence = (road2Player, road4Player) => {
  if (!road2Player || !road4Player) {
    console.error('无法生成BP序列：缺少道路信息')
    return [[], [], [], []]
  }

  // 转换函数：将模板中的'road2'/'road4'替换为实际选手
  const convertTemplate = (template) => {
    return template.map(step => ({
      player: step.player === 'road2' ? road2Player : road4Player,
      action: step.action,
      count: step.count || 1
    }))
  }

  return [
    convertTemplate(STAGE_1_TEMPLATE),
    convertTemplate(STAGE_2_TEMPLATE),
    convertTemplate(STAGE_3_TEMPLATE),
    convertTemplate(STAGE_4_TEMPLATE)
  ]
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

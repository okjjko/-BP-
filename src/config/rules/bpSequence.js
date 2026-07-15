/**
 * BP 顺序模板默认值（功能2：BP 流程顺序自定义）
 * 负责人：开发者 A
 *
 * 数据结构：2D 数组，每个内层数组是一个阶段(stage)。
 * 每步：{ player: 'road2'|'road4', action: 'ban'|'pick', count?: number }
 * 模板始终使用 'road2'/'road4' 占位符，由 getBPSequence 在生成时替换为实际选手 key。
 * 默认值与 src/utils/bpRules.js 内置的 STAGE_x_TEMPLATE 保持一致（4 阶段、共 20 步）。
 */
export default [
  // 阶段一：禁用（二路→四路→二路→四路）
  [
    { player: 'road2', action: 'ban' },
    { player: 'road4', action: 'ban' },
    { player: 'road2', action: 'ban' },
    { player: 'road4', action: 'ban' }
  ],
  // 阶段二：选择（二路→四路→四路→二路→二路→四路）
  [
    { player: 'road2', action: 'pick', count: 1 },
    { player: 'road4', action: 'pick', count: 1 },
    { player: 'road4', action: 'pick', count: 1 },
    { player: 'road2', action: 'pick', count: 1 },
    { player: 'road2', action: 'pick', count: 1 },
    { player: 'road4', action: 'pick', count: 1 }
  ],
  // 阶段三：禁用（四路→二路→四路→二路→四路→二路）
  [
    { player: 'road4', action: 'ban' },
    { player: 'road2', action: 'ban' },
    { player: 'road4', action: 'ban' },
    { player: 'road2', action: 'ban' },
    { player: 'road4', action: 'ban' },
    { player: 'road2', action: 'ban' }
  ],
  // 阶段四：选择（四路→二路→二路→四路）
  [
    { player: 'road4', action: 'pick', count: 1 },
    { player: 'road2', action: 'pick', count: 1 },
    { player: 'road2', action: 'pick', count: 1 },
    { player: 'road4', action: 'pick', count: 1 }
  ]
]

/**
 * 选边方式默认值（功能3：选边方式自定义）
 * 负责人：开发者 B
 *
 * initialMode —— 开局初始选边方式：
 *   - 'mutual'   双方互斥手动选路（现状）
 *   - 'assigned' 由 initialPicker 指定的一方单方选路
 *   - 'random'   系统随机分配
 * initialPicker —— initialMode='assigned' 时生效：'player1' | 'player2'
 * loserPickMode —— 每小局结束后的选边权归属：
 *   - 'loser'  败者选（现状）
 *   - 'winner' 胜者选
 *   - 'keep'   不换边，保持当前路进入下一局
 */
export default {
  initialMode: 'mutual',
  initialPicker: 'player1',
  loserPickMode: 'loser'
}

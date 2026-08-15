/**
 * Fisher-Yates 均匀洗牌
 *
 * 不用 [...arr].sort(() => Math.random() - 0.5)：该写法违反比较函数的
 * 一致性/传递性，排序结果依赖元素初始位置与引擎算法（V8 TimSort 实测
 * 首尾元素黏在原位概率远高于 1/n），分布有偏。Fisher-Yates 是 O(n)
 * 教科书算法，数学上可证均匀分布。
 */

/**
 * 返回洗匀后的新数组，不修改原数组（调用方多处以原数组作后续参照）。
 * @param {Array} arr 待洗牌数组
 * @returns {Array} 洗匀后的副本
 */
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

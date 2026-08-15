/**
 * shuffle（Fisher-Yates）单元测试
 *
 * 回归背景：原三处用 [...arr].sort(() => Math.random() - 0.5) 洗牌，分布有偏
 * （比较函数违反一致性/传递性，V8 TimSort 下首尾元素黏原位概率远高于 1/n）。
 * 此 spec 守住：守恒、不改原数组、每个元素出现在每个位置的概率在宽松区间内。
 */
import { describe, it, expect } from 'vitest'
import { shuffle } from '../shuffle'

describe('shuffle (Fisher-Yates)', () => {
  it('元素守恒：洗牌后是原数组的一个置换', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i)
    for (let round = 0; round < 100; round++) {
      const shuffled = shuffle(arr)
      expect([...shuffled].sort((a, b) => a - b)).toEqual(arr)
    }
  })

  it('不修改原数组（返回新数组）', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const before = [...arr]
    const shuffled = shuffle(arr)
    expect(arr).toEqual(before)      // 原数组保持不变
    expect(shuffled).not.toBe(arr)   // 返回的是副本
  })

  it('边界：空数组与单元素', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle([42])).toEqual([42])
  })

  it('分布宽松界：每个元素出现在每个位置的频率在理论值的 ±40% 内', () => {
    const N = 8
    const ROUNDS = 2000
    const arr = Array.from({ length: N }, (_, i) => i)
    // counts[pos][element]
    const counts = Array.from({ length: N }, () => new Array(N).fill(0))
    for (let r = 0; r < ROUNDS; r++) {
      const shuffled = shuffle(arr)
      shuffled.forEach((el, pos) => { counts[pos][el]++ })
    }
    const expected = ROUNDS / N  // 均匀分布下每个 (pos, el) 的期望次数
    const tolerance = expected * 0.4
    for (let pos = 0; pos < N; pos++) {
      for (let el = 0; el < N; el++) {
        // 宽松界：只挡「系统性偏差」（如 sort 洗牌首尾黏住那种量级），不挡随机噪声
        expect(Math.abs(counts[pos][el] - expected)).toBeLessThanOrEqual(tolerance)
      }
    }
  })
})

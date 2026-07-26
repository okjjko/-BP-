/**
 * BP 流程只读渲染映射的纯函数单测（bpFlowRender）。
 *
 * 验证 ruleConfig.bpSequence 占位符（road2/road4/system）与
 * action（ban/pick/globalBan）→ 文案 + 主题色 class 的映射，
 * 覆盖 BPFlowPreview.vue 的展示逻辑（含 globalBan / system 等边界）。
 */
import { describe, it, expect } from 'vitest'
import { resolvePlayer, resolveAction } from '@/utils/bpFlowRender'

describe('bpFlowRender 纯映射', () => {
  describe('resolvePlayer', () => {
    it('road2 → 阵营名 + pick-blue', () => {
      const m = resolvePlayer('road2', { road2: '二路', road4: '四路' })
      expect(m.label).toBe('二路')
      expect(m.textClass).toBe('text-pick-blue')
    })

    it('road4 → 阵营名 + ban-red', () => {
      const m = resolvePlayer('road4', { road2: '二路', road4: '四路' })
      expect(m.label).toBe('四路')
      expect(m.textClass).toBe('text-ban-red')
    })

    it('system → 系统 + 灰色（globalBan 步骤无阵营归属）', () => {
      const m = resolvePlayer('system', { road2: '二路', road4: '四路' })
      expect(m.label).toBe('系统')
      expect(m.textClass).toBe('text-gray-400')
    })

    it('自定义阵营名透传（功能1：阵营名称自定义）', () => {
      expect(resolvePlayer('road2', { road2: '蓝方', road4: '红方' }).label).toBe('蓝方')
      expect(resolvePlayer('road4', { road2: '蓝方', road4: '红方' }).label).toBe('红方')
    })

    it('sideNames 缺省时回落默认文案', () => {
      expect(resolvePlayer('road2').label).toBe('二路')
      expect(resolvePlayer('road4').label).toBe('四路')
    })

    it('未知 player → 安全降级为「系统」+ 灰色', () => {
      const m = resolvePlayer('??', { road2: '二路', road4: '四路' })
      expect(m.label).toBe('系统')
      expect(m.textClass).toBe('text-gray-400')
    })
  })

  describe('resolveAction', () => {
    it('ban → 禁用 + ban-red', () => {
      const m = resolveAction('ban')
      expect(m.label).toBe('禁用')
      expect(m.textClass).toBe('text-ban-red')
    })

    it('pick → 选用 + pick-blue', () => {
      const m = resolveAction('pick')
      expect(m.label).toBe('选用')
      expect(m.textClass).toBe('text-pick-blue')
    })

    it('globalBan → 全局禁用 + ban-red', () => {
      const m = resolveAction('globalBan')
      expect(m.label).toBe('全局禁用')
      expect(m.textClass).toBe('text-ban-red')
    })

    it('未知 action → 安全降级为「禁用」+ ban-red', () => {
      const m = resolveAction('??')
      expect(m.label).toBe('禁用')
      expect(m.textClass).toBe('text-ban-red')
    })
  })
})

import { reactive } from 'vue'

/**
 * 应用内确认框（Phase 0 基座，替代 confirm）
 * 模块级单例：同一时间仅一个确认框，由 <ConfirmDialog /> 渲染。
 *
 * 用法：
 *   const { confirm } = useConfirm()
 *   if (await confirm('确定要重置游戏吗？所有进度将丢失。')) { ... }
 *   // 或带配置：
 *   await confirm({ title: '重置', message: '...', confirmText: '重置', variant: 'danger' })
 */
const state = reactive({
  open: false,
  title: '请确认',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  variant: 'danger', // danger | primary
  resolve: null,
})

export function useConfirm() {
  function confirm(options) {
    const opts = typeof options === 'string' ? { message: options } : options || {}
    state.title = opts.title || '请确认'
    state.message = opts.message || ''
    state.confirmText = opts.confirmText || '确认'
    state.cancelText = opts.cancelText || '取消'
    state.variant = opts.variant === 'primary' ? 'primary' : 'danger'
    state.open = true
    return new Promise((resolve) => {
      state.resolve = resolve
    })
  }

  function resolve(value) {
    if (typeof state.resolve === 'function') state.resolve(value)
    state.resolve = null
    state.open = false
  }

  return { state, confirm, resolve }
}

import { reactive } from 'vue'

/**
 * 轻量 Toast（Phase 0 基座，替代 alert）
 * 模块级单例：整个应用共享一份队列，由 <ToastContainer /> 渲染。
 *
 * 用法：
 *   const toast = useToast()
 *   toast.error('请先选择一个植物')
 *   toast.success('保存成功')
 *   toast.warning('已达上限')
 *   toast.info('同步中…', { duration: 5000 })
 */
const toasts = reactive([])
let _seq = 0

const VARIANT_ICON = {
  success: 'CheckCircle',
  error: 'CircleX',
  warning: 'TriangleAlert',
  info: 'Info',
}

function push(variant, message, options = {}) {
  const id = ++_seq
  const duration = options.duration ?? 3200
  toasts.push({
    id,
    variant,
    message,
    icon: (VARIANT_ICON[variant] || VARIANT_ICON.info),
  })
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

function clear() {
  toasts.splice(0, toasts.length)
}

export function useToast() {
  return {
    toasts,
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    warning: (m, o) => push('warning', m, o),
    info: (m, o) => push('info', m, o),
    dismiss,
    clear,
  }
}

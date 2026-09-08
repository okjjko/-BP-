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
 *
 * 自动消失时长按类型分级：error 6s / warning 4.5s / 其余 3.2s（duration: 0 不自动消失）。
 * 悬停暂停：ToastContainer mouseenter → pause(id)、mouseleave → resume(id)，
 * 记录剩余时长，恢复后按剩余时间继续倒计时。
 */
const toasts = reactive([])
let _seq = 0

// 定时器簿记：id -> { timeoutId, startedAt, remaining }；暂停时冻结 remaining
const timers = new Map()

const VARIANT_ICON = {
  success: 'CheckCircle',
  error: 'CircleX',
  warning: 'TriangleAlert',
  info: 'Info',
}

const DEFAULT_DURATION = {
  error: 6000,
  warning: 4500,
  success: 3200,
  info: 3200,
}

function arm(id, remaining) {
  timers.set(id, {
    timeoutId: setTimeout(() => dismiss(id), remaining),
    startedAt: Date.now(),
    remaining,
  })
}

function push(variant, message, options = {}) {
  const id = ++_seq
  const duration = options.duration ?? (DEFAULT_DURATION[variant] || 3200)
  toasts.push({
    id,
    variant,
    message,
    icon: (VARIANT_ICON[variant] || VARIANT_ICON.info),
  })
  if (duration > 0) arm(id, duration)
  return id
}

function pause(id) {
  const entry = timers.get(id)
  if (!entry || !entry.timeoutId) return
  clearTimeout(entry.timeoutId)
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt))
  entry.timeoutId = null
}

function resume(id) {
  const entry = timers.get(id)
  if (!entry || entry.timeoutId) return
  if (entry.remaining <= 0) {
    dismiss(id)
    return
  }
  arm(id, entry.remaining)
}

function dismiss(id) {
  const entry = timers.get(id)
  if (entry) {
    clearTimeout(entry.timeoutId)
    timers.delete(id)
  }
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

function clear() {
  timers.forEach((entry) => clearTimeout(entry.timeoutId))
  timers.clear()
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
    pause,
    resume,
  }
}

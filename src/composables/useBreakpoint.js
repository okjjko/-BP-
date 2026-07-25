import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * 响应式断点检测 composable。
 *
 * 用于无法用纯 Tailwind class 表达的响应式需求——例如 BaseButton 的 `size` 是 prop
 * 而非 class，无法写 `size="sm" md:size="lg"`，需在 JS 侧按断点切换。
 *
 * 默认 768px = Tailwind `md` 断点：<768 视为手机。
 * 客户端 SPA（Vite）setup 期 window 即可用，初始值同步取自 matchMedia，无首屏闪烁。
 *
 * @param {number} breakpoint 视口宽度阈值（px），默认 768
 * @returns {import('vue').Ref<boolean>} isMobile —— 视口窄于阈值时为 true
 */
export function useIsMobile(breakpoint = 768) {
  const query = typeof window !== 'undefined'
    ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    : null
  const isMobile = ref(query ? query.matches : false)

  const update = (event) => {
    isMobile.value = event.matches
  }

  onMounted(() => {
    if (!query) return
    // 挂载时再同步一次（处理 setup 到 mount 之间的尺寸变化）
    isMobile.value = query.matches
    query.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    if (!query) return
    query.removeEventListener('change', update)
  })

  return isMobile
}

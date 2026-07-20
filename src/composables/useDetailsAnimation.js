import { ref } from 'vue'

/**
 * useDetailsAnimation —— details 折叠面板丝滑展开/收起动画
 *
 * 为什么用 JS + height 而非纯 CSS：
 *   `grid-template-rows: 0fr → 1fr` 过渡在 Chrome 145 实测**完全不插值**
 *   （0fr 被解析为无单位 0，与 1fr 无法插值，浏览器直接跳变）。
 *   改用确定 px 的 height 过渡，所有浏览器可靠插值、绝不突变。
 *
 * 用法：
 *   <details ref="detailsRef" :open="isOpen" @toggle.prevent>
 *     <summary @click.prevent="toggle">标题</summary>
 *     <div ref="contentRef" class="details-content">内容</div>
 *   </details>
 *
 *   const { isOpen, detailsRef, contentRef, toggle } = useDetailsAnimation()
 *
 *   收起时阻止原生 toggle，先动画到 height:0 再 open=false（避免内容瞬间消失）。
 *   展开时先 open=true 再从 height:0 过渡到 scrollHeight，结束后释放为 auto。
 */
export function useDetailsAnimation(options = {}) {
  const duration = options.duration ?? 300
  // easeOutQuint cubic-bezier(0.16, 1, 0.3, 1)：比 ease-out 对比更强烈——
  // 开头极陡(约80%距离在前30%时间走完)，末尾长尾缓慢收住，「先快后慢」落差大、更带劲。
  const easing = options.easing ?? 'cubic-bezier(0.16, 1, 0.3, 1)'

  // initialOpen: 初始展开（默认 false 收起）。设 true 时首屏直接呈现展开态、
  // 不播放展开动画（details 初始带 open 属性，CSS :not([open]) 不命中，内容正常显示）。
  const isOpen = ref(options.initialOpen ?? false)
  let rafId = null
  let timeoutId = null

  const cleanupInlineStyle = (contentEl) => {
    contentEl.style.height = ''
    contentEl.style.overflow = ''
  }

  const toggle = () => {
    const detailsEl = options.getDetails?.()
    const contentEl = options.getContent?.()
    if (!detailsEl || !contentEl) {
      // 拿不到元素时退化为原生切换，至少保证功能可用
      isOpen.value = !isOpen.value
      return
    }

    if (timeoutId) clearTimeout(timeoutId)
    if (rafId) cancelAnimationFrame(rafId)

    if (!isOpen.value) {
      // ===== 展开 =====
      // 先同步设 open=true（确保 display 从 none 变 block），再在下一帧读 scrollHeight。
      // 不能同步读：display:none 时 scrollHeight=0；Vue 的 :open 更新也是异步的。
      isOpen.value = true
      detailsEl.open = true
      contentEl.style.overflow = 'hidden'
      contentEl.style.height = '0px'
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          // 此时 open 已生效、display 已是 block，scrollHeight 为真实内容高度
          const targetHeight = contentEl.scrollHeight
          contentEl.style.transition = `height ${duration}ms ${easing}`
          contentEl.style.height = `${targetHeight}px`
        })
      })
      timeoutId = setTimeout(() => {
        cleanupInlineStyle(contentEl)
        contentEl.style.transition = ''
        timeoutId = null
      }, duration + 20)
    } else {
      // ===== 收起 =====
      // 关键：收起期间必须保持 details.open=true，否则 :open="isOpen" 一旦变 false，
      // Vue 会移除 open 属性，原生 details 立即隐藏内容，与 height 过渡打架 → 跳变。
      // 所以这里不立即改 isOpen，先固定高度过渡到 0，动画结束才让 open=false（此时内容已高度0，无感知）。
      const currentHeight = contentEl.scrollHeight
      contentEl.style.overflow = 'hidden'
      contentEl.style.height = `${currentHeight}px`
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          contentEl.style.transition = `height ${duration}ms ${easing}`
          contentEl.style.height = '0px'
        })
      })
      timeoutId = setTimeout(() => {
        // 过渡结束：内容已收缩到 0。此刻让 open=false，CSS(details:not([open])>内容{display:none})
        // 接管隐藏——因高度已是 0，display:none 无视觉跳变。
        isOpen.value = false
        detailsEl.open = false
        cleanupInlineStyle(contentEl)
        contentEl.style.transition = ''
        timeoutId = null
      }, duration + 20)
    }
  }

  return { isOpen, toggle }
}

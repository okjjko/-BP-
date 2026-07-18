<template>
  <!--
    ban/pick 植物飞行克隆体 overlay。
    Teleport 到 body，根为真实 <div>（是 BanPickView 子组件非路由根，不触路由 Transition 约束）。
    自身 pointer-events:none，不拦截点击。
  -->
  <Teleport to="body">
    <div class="plant-flight-layer" aria-hidden="true">
      <img
        v-if="clone.src"
        ref="cloneEl"
        :src="clone.src"
        class="plant-flight-clone"
        :style="cloneStyle"
        alt=""
      />
    </div>
  </Teleport>
</template>

<script setup>
/**
 * 飞行克隆体渲染层（plan D7）。
 * 监听 uiStore.flightState.key：key 变化 → 用 fromRect 初始化克隆体位置与尺寸，
 * 下一帧应用 translate+scale 触发 0.5s 飞行（强 ease-out：先快后慢，平稳停在目标）；
 * 380ms 时淡出克隆体，与真实项 TransitionGroup enter 的 opacity 0→1 + 盖章/弹跳无缝交接。
 */
import { reactive, ref, watch, nextTick } from 'vue'
import { useUIStore } from '@/stores/uiStore'
import { getPlantImage } from '@/data/customPlants'

const uiStore = useUIStore()
const cloneEl = ref(null)

// 当前渲染的克隆体（src 为空则不渲染）
const clone = reactive({ src: '' })

// 克隆体内联样式：初始定位在 fromRect，飞行阶段由 transform 驱动
const cloneStyle = reactive({
  left: '0px',
  top: '0px',
  width: '0px',
  height: '0px',
  transform: 'translate(0px, 0px) scale(0.9)',
  opacity: '1',
  transition: 'none'
})

// 清空克隆体（endFlight / 组件卸载时调用）
const reset = () => {
  clone.src = ''
  cloneStyle.transition = 'none'
  cloneStyle.transform = 'translate(0px, 0px) scale(0.9)'
  cloneStyle.opacity = '1'
  if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
}

let fadeTimer = null

watch(
  () => uiStore.flightState.key,
  async (key) => {
    if (!key) {
      reset()
      return
    }

    const { fromRect, toRect, plantId } = uiStore.flightState
    if (!fromRect || !toRect || !plantId) {
      reset()
      return
    }

    // 用起点 rect 初始化克隆体位置与尺寸
    clone.src = getPlantImage(plantId)
    cloneStyle.transition = 'none'
    cloneStyle.left = `${fromRect.left}px`
    cloneStyle.top = `${fromRect.top}px`
    cloneStyle.width = `${fromRect.width}px`
    cloneStyle.height = `${fromRect.height}px`
    cloneStyle.transform = 'translate(0px, 0px) scale(0.9)'
    cloneStyle.opacity = '1'

    // 等待 DOM 应用初始样式后，下一帧再开启过渡 + 位移到终点
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dx = toRect.left - fromRect.left
        const dy = toRect.top - fromRect.top
        cloneStyle.transition = 'transform .5s cubic-bezier(0.16, 1, 0.3, 1), opacity .12s ease'
        cloneStyle.transform = `translate(${dx}px, ${dy}px) scale(0.9)`

        // 380ms 时克隆体淡出（强 ease-out 下此时已非常接近目标；与真实项 enter 末段重叠，无缝交接）
        if (fadeTimer) clearTimeout(fadeTimer)
        fadeTimer = setTimeout(() => {
          cloneStyle.opacity = '0'
        }, 380)
      })
    })
  }
)
</script>

<style scoped>
.plant-flight-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}
</style>

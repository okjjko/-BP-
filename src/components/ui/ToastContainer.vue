<template>
  <Teleport to="body">
    <div
      class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]"
      role="region"
      aria-label="通知"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item flex items-start gap-2.5 px-4 py-3 border shadow-lg"
          :class="borderClass(t.variant)"
          role="status"
        >
          <component :is="iconFor(t.icon)" :size="18" class="flex-shrink-0 mt-0.5" :class="iconColor(t.variant)" />
          <p class="text-sm text-slate-100 leading-snug flex-1">{{ t.message }}</p>
          <button
            type="button"
            @click="dismiss(t.id)"
            class="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="关闭通知"
          >
            <X :size="16" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { CheckCircle2, CircleX, TriangleAlert, Info, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const ICONS = { CheckCircle: CheckCircle2, CircleX, TriangleAlert, Info }
const iconFor = (name) => ICONS[name] || Info

const BORDER = {
  success: 'border-emerald-500/40',
  error: 'border-red-500/50',
  warning: 'border-amber-500/50',
  info: 'border-sky-500/40',
}
const ICON_COLOR = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-sky-400',
}
const borderClass = (v) => BORDER[v] || BORDER.info
const iconColor = (v) => ICON_COLOR[v] || ICON_COLOR.info
</script>

<style scoped>
.toast-item {
  background: rgba(17, 24, 39, 0.95);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.toast-enter-active {
  transition: all 0.25s ease;
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>

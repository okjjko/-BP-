<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[90] flex items-center justify-center"
        :class="mobileFullscreen ? 'p-0 sm:p-4' : 'p-4'"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel || title || undefined"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="onBackdrop"></div>

        <!-- 面板（焦点陷阱作用域） -->
        <div
          ref="panelRef"
          tabindex="-1"
          class="relative z-10 outline-none"
          :class="[
            mobileFullscreen
              ? 'w-full max-w-full h-[100dvh] sm:w-auto sm:max-w-lg sm:h-auto sm:max-h-[90dvh]'
              : 'w-full',
            panelClass,
            { 'flex flex-col': bodyFlex }
          ]"
        >
          <div
            class="glass-panel rounded-2xl shadow-2xl"
            :class="{ 'h-full flex flex-col overflow-hidden': bodyFlex }"
          >
            <!-- 头部 -->
            <div
              v-if="title || $slots.header || closable"
              class="flex items-center justify-between px-6 py-4 border-b border-white/10"
            >
              <h2 class="text-lg font-bold text-slate-100">
                <slot name="header">{{ title }}</slot>
              </h2>
              <button
                v-if="closable"
                type="button"
                @click="close"
                class="text-slate-400 hover:text-white transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="关闭对话框"
              >
                <X :size="20" />
              </button>
            </div>

            <!-- 内容 -->
            <div :class="['text-slate-300', bodyFlex ? 'flex-1 overflow-hidden flex flex-col' : 'px-6 py-5']">
              <slot />
            </div>

            <!-- 底部操作 -->
            <div v-if="$slots.footer" class="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
/**
 * 统一模态原语（Phase 0 基座）
 * - Teleport 到 body，role=dialog + aria-modal
 * - 焦点陷阱：Tab 循环、打开时聚焦首个可聚焦元素、关闭后回焦
 * - Esc 关闭、点遮罩关闭（均可配置）
 */
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { registerBaseDialogOpen, unregisterBaseDialogOpen } from './baseDialogState'

// 本实例唯一标识，用于在 baseDialogState 中追踪打开状态
const instanceId = Symbol('base-dialog')

const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  panelClass: { type: String, default: 'max-w-lg' },
  closeOnBackdrop: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true },
  closable: { type: Boolean, default: true },
  // 内容区是否 flex 撑满（用于嵌入需自身滚动的面板，如 PlantLibrary）；需配合 panelClass 设固定高度
  bodyFlex: { type: Boolean, default: false },
  // 手机端近全屏（贴边、100dvh）；sm+ 回退为居中卡片。用于大型模态（配置管理 / BP 规则编辑器）
  mobileFullscreen: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'close'])

const panelRef = ref(null)
let previouslyFocused = null

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

function getFocusable() {
  if (!panelRef.value) return []
  return Array.from(panelRef.value.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  )
}

function onKeydown(e) {
  if (!props.modelValue) return
  if (e.key === 'Escape' && props.closeOnEsc) {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab') {
    const f = getFocusable()
    if (f.length === 0) {
      e.preventDefault()
      panelRef.value?.focus()
      return
    }
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function open() {
  previouslyFocused = document.activeElement
  document.addEventListener('keydown', onKeydown)
  // 滚动锁 + inert：模态打开时冻结背景（不可滚、不可 Tab、对读屏隐藏）
  document.body.style.overflow = 'hidden'
  const appRoot = document.getElementById('app')
  if (appRoot && 'inert' in appRoot) appRoot.inert = true
  nextTick(() => {
    const f = getFocusable()
    if (f.length > 0) f[0].focus()
    else panelRef.value?.focus()
  })
}

function teardown() {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  const appRoot = document.getElementById('app')
  if (appRoot) appRoot.inert = false
  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    previouslyFocused.focus()
  }
  previouslyFocused = null
}

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onBackdrop() {
  if (props.closeOnBackdrop) close()
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      registerBaseDialogOpen(instanceId)
      open()
    } else {
      unregisterBaseDialogOpen(instanceId)
      teardown()
    }
  }
)

onBeforeUnmount(() => {
  unregisterBaseDialogOpen(instanceId)
  teardown()
})
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="classes"
  >
    <Loader2 v-if="loading" :size="iconSize" class="animate-spin" />
    <slot v-else name="icon" />
    <span v-if="$slots.default" class="inline-flex items-center"><slot /></span>
  </button>
</template>

<script setup>
/**
 * 统一按钮原语（Phase 0 基座）
 * @prop variant  primary | blue | danger | secondary | ghost
 * @prop size     sm | md | lg
 * @prop loading  true 时显示 spinner 并禁用
 * @slot default  按钮文字
 * @slot icon     前置图标（建议 lucide，size 跟随 size prop）
 */
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps({
  variant: { type: String, default: 'secondary' },
  size: { type: String, default: 'md' },
  type: { type: String, default: 'button' },
  disabled: Boolean,
  loading: Boolean,
})

const VARIANTS = {
  primary:   'bg-plant-green hover:bg-plant-green-dark text-white focus-visible:ring-plant-green',
  blue:      'bg-pick-blue hover:bg-pick-blue-dark text-white focus-visible:ring-pick-blue',
  danger:    'bg-ban-red hover:bg-ban-red-dark text-white focus-visible:ring-ban-red',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 focus-visible:ring-slate-400',
  ghost:     'bg-transparent hover:bg-white/10 text-slate-200 border border-white/15 focus-visible:ring-slate-400',
}

const SIZES = {
  sm: 'text-sm px-3 py-2 gap-1.5 min-h-[40px]',
  md: 'text-base px-5 py-2.5 gap-2 min-h-[44px]',
  lg: 'text-lg px-7 py-3.5 gap-2.5 min-h-[48px]',
}

const isDisabled = computed(() => props.disabled || props.loading)
const iconSize = computed(() => (props.size === 'lg' ? 20 : props.size === 'sm' ? 16 : 18))

const classes = computed(() => [
  'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 active:scale-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
  VARIANTS[props.variant] || VARIANTS.secondary,
  SIZES[props.size] || SIZES.md,
  isDisabled.value ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
])
</script>

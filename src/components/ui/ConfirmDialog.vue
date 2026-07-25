<template>
  <BaseDialog
    :model-value="state.open"
    :title="state.title"
    :closable="false"
    :close-on-backdrop="false"
    panel-class="sm:max-w-md"
    aria-label="确认操作"
    @update:model-value="onUpdate"
  >
    <p class="text-slate-300 leading-relaxed">{{ state.message }}</p>
    <template #footer>
      <BaseButton variant="ghost" @click="choose(false)">{{ state.cancelText }}</BaseButton>
      <BaseButton :variant="state.variant === 'primary' ? 'primary' : 'danger'" @click="choose(true)">
        {{ state.confirmText }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<script setup>
import BaseDialog from './BaseDialog.vue'
import BaseButton from './BaseButton.vue'
import { useConfirm } from '@/composables/useConfirm'

const { state, resolve } = useConfirm()

function choose(value) {
  resolve(value)
}

// Esc 触发 BaseDialog 关闭（closeOnEsc 默认 true）→ 视为取消
function onUpdate(value) {
  if (!value) resolve(false)
}
</script>

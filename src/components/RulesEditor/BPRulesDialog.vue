<template>
  <!--
    BP 规则编辑弹窗（全局，赛前快速入口）。
    用 BPRulesEditor「原模式」（不传 presetRuleConfig）→ 直接改当前对局 store.ruleConfig，
    不写入预设。入口在 GameSetup / RoomSetup 赛前页；多人对局中受 isRuleEditable 锁定。

    注意：store.ruleConfig 与比赛预设脱钩——加载预设时复制进 store，之后各自独立。
    故此处修改只影响当前对局；想永久改预设用「编辑预设」。header 标注当前加载来源
    （activeConfigId 指向的预设名）仅作提示，不代表当前规则与该预设仍完全一致。
  -->
  <BaseDialog
    :model-value="show"
    panel-class="sm:max-w-4xl sm:h-[85vh]"
    mobile-fullscreen
    body-flex
    aria-label="BP 流程与规则"
    @update:model-value="$emit('update:show', $event)"
  >
    <template #header>
      <div class="flex flex-col gap-0.5">
        <span class="flex items-center gap-2">
          <SlidersHorizontal :size="20" /> BP 流程与规则
        </span>
        <span class="text-[11px] font-normal text-amber-300 pl-7 flex items-center gap-1 flex-wrap">
          <TriangleAlert :size="12" class="text-amber-400 flex-shrink-0" />
          <span>此处修改仅作用于当前对局，不会保存到比赛预设</span>
          <span v-if="activePresetName" class="text-gray-400">· 当前加载自「<span class="text-gray-300">{{ activePresetName }}</span>」</span>
        </span>
      </div>
    </template>

    <div class="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
      <BPRulesEditor />
    </div>
  </BaseDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { SlidersHorizontal, TriangleAlert } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BPRulesEditor from '@/components/RulesEditor/BPRulesEditor.vue'
import { getActiveConfig } from '@/data/plantConfigs'

const props = defineProps({ show: Boolean })
defineEmits(['update:show'])

// 当前对局规则加载自哪个比赛预设（activeConfigId 指向；加载后与预设脱钩，此名仅作来源标注）
const activePresetName = ref('')
const loadActiveName = async () => {
  const c = await getActiveConfig()
  activePresetName.value = c?.name || ''
}
watch(() => props.show, (v) => { if (v) loadActiveName() }, { immediate: true })
</script>

<template>
  <!--
    桌面端规则摘要竖排版本（嵌入全局状态栏，位于永久禁用左侧）。
    三个规则信息竖向排列，紧凑风格。
  -->
  <div
    class="rules-summary-desktop flex flex-col gap-1.5 text-[11px] leading-tight"
    role="group"
    aria-label="当前比赛规则摘要"
  >
    <!-- 小局后选边权 -->
    <span class="flex items-baseline gap-1.5">
      <span class="text-gray-500 text-[10px]">选边权</span>
      <span class="text-gray-200 font-semibold whitespace-nowrap">{{ loserPickModeLabel }}</span>
    </span>

    <!-- 复选同一植物上限 -->
    <span class="flex items-baseline gap-1.5">
      <span class="text-gray-500 text-[10px]">复选上限</span>
      <span class="text-gray-200 font-semibold whitespace-nowrap">{{ maxPlantUsage }} 次</span>
    </span>

    <!-- BP 流程概要（点击查看完整流程） -->
    <button
      type="button"
      class="flex items-baseline gap-1.5 group/flow cursor-pointer"
      :aria-label="`显示 BP 顺序（${stageCount} 阶段 · ${totalSteps} 步）`"
      @click="showFlow = true"
    >
      <span class="text-gray-500 text-[10px]">BP 流程</span>
      <span class="text-gray-200 font-semibold whitespace-nowrap group-hover/flow:text-blue-300 transition-colors">{{ stageCount }}阶段 · {{ totalSteps }}步</span>
      <ChevronRight :size="11" class="text-gray-500 group-hover/flow:text-blue-300 group-hover/flow:translate-x-0.5 transition-all" aria-hidden="true" />
    </button>

    <!-- 流程详情弹窗 -->
    <BaseDialog
      v-model="showFlow"
      title="BP 流程"
      panel-class="max-w-lg"
      mobile-fullscreen
      body-flex
      aria-label="BP 流程详情"
    >
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <BPFlowPreview />
      </div>
    </BaseDialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BPFlowPreview from '@/components/RulesEditor/BPFlowPreview.vue'

const store = useGameStore()

const showFlow = ref(false)

const loserPickModeLabel = computed(() => {
  switch (store.ruleConfig.sideSelection.loserPickMode) {
    case 'winner': return '胜者选边'
    case 'keep': return '不换边'
    default: return '败者选边'
  }
})

const maxPlantUsage = computed(() => store.ruleConfig.limits.maxPlantUsage)

const bpSequence = computed(() => store.ruleConfig.bpSequence || [])
const stageCount = computed(() => bpSequence.value.length)
const totalSteps = computed(() =>
  bpSequence.value.reduce((sum, stage) => sum + (Array.isArray(stage) ? stage.length : 0), 0)
)
</script>

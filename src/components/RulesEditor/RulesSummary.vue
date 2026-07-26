<script setup>
import { ref, computed } from 'vue'
import { ScrollText, ChevronRight } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BPFlowPreview from '@/components/RulesEditor/BPFlowPreview.vue'

const store = useGameStore()

// 流程详情弹窗显隐
const showFlow = ref(false)

// 小局结束后选边权文案
const loserPickModeLabel = computed(() => {
  switch (store.ruleConfig.sideSelection.loserPickMode) {
    case 'winner': return '胜者选边'
    case 'keep': return '不换边'
    default: return '败者选边'
  }
})

// 复选同一植物上限（每名选手独立计数）
const maxPlantUsage = computed(() => store.ruleConfig.limits.maxPlantUsage)

// BP 模板：阶段数与总步数（bpSequence 为 2D 数组，内层数组长度即阶段步数）
const bpSequence = computed(() => store.ruleConfig.bpSequence || [])
const stageCount = computed(() => bpSequence.value.length)
const totalSteps = computed(() =>
  bpSequence.value.reduce((sum, stage) => sum + (Array.isArray(stage) ? stage.length : 0), 0)
)
</script>

<style scoped>
/* 单行胶囊：分隔符弱化，label 极小灰字，value 主色加粗 */
.rules-summary .sep {
  color: #4b5563; /* gray-600 */
  user-select: none;
}

.rules-summary .chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  min-width: 0;
}

.rules-summary .lbl {
  font-size: 10px;
  color: #6b7280; /* gray-500 */
  letter-spacing: 0.02em;
}

/* 长标签（「复选同一植物上限」）：缩小字号以保持单行胶囊紧凑 */
.rules-summary .lbl--wide {
  font-size: 9px;
}

.rules-summary .val {
  font-size: 11px;
  font-weight: 600;
  color: #e5e7eb; /* gray-200 */
  white-space: nowrap;
}

/* 「流程」可点击 chip：reset 按钮默认样式 + hover/focus 交互反馈 */
.rules-summary .chip--link {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  border-radius: 4px;
  align-items: center; /* 图标与文字居中对齐（覆盖 .chip 的 baseline） */
  transition: color 0.15s ease;
}
.rules-summary .chip--link .link-icon {
  color: #6b7280; /* gray-500 */
  transition: transform 0.15s ease, color 0.15s ease;
}
.rules-summary .chip--link:hover .val,
.rules-summary .chip--link:hover .link-icon {
  color: #93c5fd; /* blue-300 */
}
.rules-summary .chip--link:hover .link-icon {
  transform: translateX(1px);
}
.rules-summary .chip--link:focus-visible {
  outline: 2px solid #93c5fd; /* blue-300 */
  outline-offset: 2px;
}
</style>

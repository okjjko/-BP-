<template>
  <!--
    规则只读摘要组件（多人模式 / 对局中通用）。
    纯展示 store.ruleConfig，无任何输入控件：
      - 阵营名（sideName(2) / sideName(4)）
      - 选边模式（initialMode / loserPickMode 中文文案）
      - BP 模板（阶段数 + 总步数）
      - 同种植物使用上限（maxPlantUsage）
    所有角色（host / 选手 / 观众）均可见，仅用于查看当前生效规则。
  -->
  <div
    class="rules-summary rounded-lg border border-gray-700/50 bg-gray-900/30 px-4 py-3 text-xs text-gray-300"
    role="group"
    aria-label="当前比赛规则摘要"
  >
    <div class="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
      <ScrollText :size="13" />
      规则
    </div>

    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
      <!-- 阵营 -->
      <div class="summary-item">
        <span class="label">阵营</span>
        <span class="value">
          <span class="text-pick-blue">{{ sideName2 }}</span>
          <span class="mx-1 text-gray-600">/</span>
          <span class="text-ban-red">{{ sideName4 }}</span>
        </span>
      </div>

      <!-- 初始选边 -->
      <div class="summary-item">
        <span class="label">初始选边</span>
        <span class="value">{{ initialModeLabel }}</span>
      </div>

      <!-- 小局后选边权 -->
      <div class="summary-item">
        <span class="label">小局后选边</span>
        <span class="value">{{ loserPickModeLabel }}</span>
      </div>

      <!-- 使用上限 -->
      <div class="summary-item">
        <span class="label">同种植物上限</span>
        <span class="value">{{ maxPlantUsage }} 次</span>
      </div>

      <!-- 南瓜特殊规则 -->
      <div class="summary-item">
        <span class="label">南瓜特殊规则</span>
        <span class="value" :class="pumpkinRuleEnabled ? 'text-pick-blue' : 'text-gray-500'">
          {{ pumpkinRuleEnabled ? '已启用' : '已禁用' }}
        </span>
      </div>
    </div>

    <!-- BP 模板概要 -->
    <div class="mt-2 border-t border-gray-700/40 pt-1.5 text-[11px] text-gray-500">
      BP 流程：{{ stageCount }} 阶段 · 共 {{ totalSteps }} 步
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ScrollText } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

// 阵营名：复用 store getter（road 数值 → 显示文案）
const sideName2 = computed(() => store.sideName(2))
const sideName4 = computed(() => store.sideName(4))

// 初始选边模式文案
const initialModeLabel = computed(() => {
  switch (store.ruleConfig.sideSelection.initialMode) {
    case 'random': return '随机分配'
    case 'assigned': return '指定一方'
    default: return '双方互斥'
  }
})

// 小局结束后选边权文案
const loserPickModeLabel = computed(() => {
  switch (store.ruleConfig.sideSelection.loserPickMode) {
    case 'winner': return '胜者选'
    case 'keep': return '不换边'
    default: return '败者选'
  }
})

// 同种植物使用上限
const maxPlantUsage = computed(() => store.ruleConfig.limits.maxPlantUsage)

// 南瓜特殊规则开关（默认开启）
const pumpkinRuleEnabled = computed(() => store.ruleConfig.pumpkinRule?.enabled ?? true)

// BP 模板：阶段数与总步数（bpSequence 为 2D 数组，内层数组长度即阶段步数）
const bpSequence = computed(() => store.ruleConfig.bpSequence || [])
const stageCount = computed(() => bpSequence.value.length)
const totalSteps = computed(() =>
  bpSequence.value.reduce((sum, stage) => sum + (Array.isArray(stage) ? stage.length : 0), 0)
)
</script>

<style scoped>
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.summary-item .label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-item .value {
  font-size: 12px;
  font-weight: 600;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

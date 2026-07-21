<template>
  <!--
    规则只读摘要组件（多人模式 / 对局中通用）。
    纯展示 store.ruleConfig，无任何输入控件：
      - 阵营名（sideName(2) / sideName(4)）
      - 选边模式（initialMode / loserPickMode 中文文案）
      - BP 模板（阶段数 + 总步数）
      - 同种植物使用上限（maxPlantUsage）
      - 南瓜特殊规则开关
    所有角色（host / 选手 / 观众）均可见，仅用于查看当前生效规则。

    形态：单行胶囊（2026-07 重构）。压成一行紧凑标签常驻 BP 头部，
    纵向占用从 ~100px（标题+grid 两行+BP 流程行）降到 ~28px，
    让 BP 界面不必下滑即可看清所有信息；窄屏自动 flex-wrap。
  -->
  <div
    class="rules-summary flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] leading-tight text-gray-400 mt-3 pt-2.5 border-t border-gray-700/30"
    role="group"
    aria-label="当前比赛规则摘要"
  >
    <span class="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-gray-500">
      <ScrollText :size="12" />
      规则
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- 阵营 -->
    <span class="chip">
      <span class="lbl">阵营</span>
      <span class="val">
        <span class="text-pick-blue">{{ sideName2 }}</span>
        <span class="mx-0.5 text-gray-600">/</span>
        <span class="text-ban-red">{{ sideName4 }}</span>
      </span>
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- 初始选边 -->
    <span class="chip">
      <span class="lbl">初始</span>
      <span class="val">{{ initialModeLabel }}</span>
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- 小局后选边权 -->
    <span class="chip">
      <span class="lbl">小局后</span>
      <span class="val">{{ loserPickModeLabel }}</span>
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- 使用上限 -->
    <span class="chip">
      <span class="lbl">上限</span>
      <span class="val">{{ maxPlantUsage }} 次</span>
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- 南瓜特殊规则 -->
    <span class="chip">
      <span class="lbl">南瓜</span>
      <span class="val" :class="pumpkinRuleEnabled ? 'text-pick-blue' : 'text-gray-600'">
        {{ pumpkinRuleEnabled ? '启用' : '禁用' }}
      </span>
    </span>

    <span class="sep" aria-hidden="true">·</span>

    <!-- BP 模板概要 -->
    <span class="chip">
      <span class="lbl">流程</span>
      <span class="val">{{ stageCount }} 阶段 · {{ totalSteps }} 步</span>
    </span>
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

.rules-summary .val {
  font-size: 11px;
  font-weight: 600;
  color: #e5e7eb; /* gray-200 */
  white-space: nowrap;
}
</style>

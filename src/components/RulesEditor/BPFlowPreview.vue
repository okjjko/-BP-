<template>
  <!--
    BP 流程只读预览（弹窗内）。
    纯展示 store.ruleConfig.bpSequence（规则模板，road2/road4/system 占位符），
    不做占位符→实际选手替换、不写 store、不参与多人同步。所有角色一致。

    数据源是「规则定义」本身：player 用 sideName(2)/(4) 桥接成阵营名，
    而非 getBPSequence() 替换后的当前小局实例。
    渲染映射逻辑（player/action → 文案 + 颜色）抽到 @/utils/bpFlowRender，
    由 bpFlowRender.spec.js 覆盖（含 globalBan/system 边界）。
  -->
  <div v-if="stages.length === 0" class="text-sm text-gray-500 italic py-4 text-center">
    （当前规则未配置 BP 流程）
  </div>

  <div v-else class="space-y-3">
    <!-- 概要：阶段数 + 总步数 -->
    <div class="text-xs text-gray-400 flex items-center gap-2">
      <Info :size="13" class="text-gray-500" />
      共 {{ stages.length }} 阶段 · {{ totalSteps }} 步
    </div>

    <!-- 各阶段卡片 -->
    <div
      v-for="(stage, idx) in stages"
      :key="idx"
      class="rounded-lg bg-black/20 border border-white/5 p-3"
    >
      <div class="text-xs font-bold text-gray-300 mb-2 flex items-center justify-between gap-2">
        <span>{{ stageNames[idx + 1] }}</span>
        <span class="text-[10px] font-normal text-gray-500">（{{ stage.length }} 步）</span>
      </div>

      <!-- 阶段内步骤（胶囊流式排列） -->
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="(step, sIdx) in stage"
          :key="sIdx"
          class="step inline-flex items-center gap-1 rounded-md bg-gray-800/60 border border-white/5 px-2 py-1 text-[11px] whitespace-nowrap"
        >
          <span :class="playerMeta(step.player).textClass">{{ playerMeta(step.player).label }}</span>
          <span :class="actionMeta(step.action).textClass">{{ actionMeta(step.action).label }}</span>
          <span class="text-gray-500">×{{ step.count || 1 }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Info } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { getStageNames } from '@/utils/bpRules'
import { resolvePlayer, resolveAction } from '@/utils/bpFlowRender'

const store = useGameStore()

// 规则模板 2D 数组（外层=阶段，内层=该阶段步骤；每步 { player, action, count }）
const stages = computed(() => store.ruleConfig.bpSequence || [])
// 阶段名：按各阶段首步 action 后缀「禁用/选择」动态生成（1-indexed）
const stageNames = computed(() => getStageNames(stages.value))
const totalSteps = computed(() =>
  stages.value.reduce((sum, stage) => sum + (Array.isArray(stage) ? stage.length : 0), 0)
)
// 当前阵营显示名（road 数值 → 文案），桥接占位符→阵营名
const sideNames = computed(() => ({ road2: store.sideName(2), road4: store.sideName(4) }))

// 占位符→文案+颜色（纯函数，见 bpFlowRender.js / 对应 spec）
const playerMeta = (player) => resolvePlayer(player, sideNames.value)
const actionMeta = (action) => resolveAction(action)
</script>

<style scoped>
/* 步骤胶囊内三段文字基线对齐：阵营名 / 动作 / 数量 */
.step {
  align-items: baseline;
}
</style>

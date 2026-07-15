<template>
  <!--
    空壳占位（Phase 0 骨架）。
    开发者 A 将在此填充「BP 顺序模板 + 使用上限」配置 UI（功能 2 / 功能 4）。
    数据入口：直接读写 useGameStore().ruleConfig.bpSequence / .limits
    勿改动 SideRulesEditor.vue（开发者 B 负责）。
  -->
  <details class="rounded-lg border border-gray-700/60 bg-gray-900/30">
    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-400 uppercase tracking-wide hover:text-gray-200">
      BP 流程与上限规则
    </summary>
    <div class="px-4 pb-4 pt-1 text-xs text-gray-500">
      （待实现）BP 顺序自定义（预设模板 + 可视化编辑器）· 同种植物使用上限
    </div>
  </details>
</template>

<script setup>
// import { useGameStore } from '@/stores/gameStore'
// const store = useGameStore()
// 读写：store.ruleConfig.bpSequence / store.ruleConfig.limits
</script>

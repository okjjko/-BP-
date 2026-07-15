<template>
  <!--
    空壳占位（Phase 0 骨架）。
    开发者 B 将在此填充「阵营名称 + 选边方式」配置 UI（功能 1 / 功能 3）。
    数据入口：直接读写 useGameStore().ruleConfig.sideNames / .sideSelection
    勿改动 BPRulesEditor.vue（开发者 A 负责）。
  -->
  <details class="rounded-lg border border-gray-700/60 bg-gray-900/30">
    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-400 uppercase tracking-wide hover:text-gray-200">
      阵营与选边规则
    </summary>
    <div class="px-4 pb-4 pt-1 text-xs text-gray-500">
      （待实现）阵营名称自定义 · 初始选边方式 · 败者选边方式
    </div>
  </details>
</template>

<script setup>
// import { useGameStore } from '@/stores/gameStore'
// const store = useGameStore()
// 读写：store.ruleConfig.sideNames / store.ruleConfig.sideSelection
</script>

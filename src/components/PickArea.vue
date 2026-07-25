<template>
  <!-- 手机端紧凑图标行（md 以下）：禁用拖拽，仅显示已选植物图标 -->
  <div
    class="md:hidden glass-panel rounded-xl p-2"
    :class="highlighted ? 'ring-2 ring-plant-green-neon/50' : ''"
    role="region"
    :aria-label="`${playerName}阵容（${picks.length}）`"
  >
    <div class="flex items-center gap-1.5 min-w-0">
      <span class="text-[10px] font-bold text-pick-blue-neon whitespace-nowrap flex-shrink-0 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-pick-blue" aria-hidden="true"></span>
        {{ playerName }}
        <span class="text-gray-500 font-normal">({{ picks.length }})</span>
      </span>
      <div class="flex flex-wrap items-center gap-1 min-w-0">
        <span v-if="picks.length === 0" class="text-gray-600 text-[10px] italic">等待选择...</span>
        <div
          v-for="(plantId, index) in picks"
          :key="`m-${player}-${plantId}-${index}`"
          class="relative w-9 h-9 flex-shrink-0"
          role="listitem"
          :aria-label="pickItemLabel(plantId)"
        >
          <img
            :src="getPlantImage(plantId)"
            :alt="getPlantName(plantId)"
            class="w-full h-full object-cover rounded border border-gray-600"
          />
          <!-- 使用次数标记 (>1) -->
          <div v-if="getUsageCount(plantId) > 1" class="absolute -top-1 -left-1 bg-yellow-600 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center rounded-full border border-gray-800">
            {{ getUsageCount(plantId) }}
          </div>
          <!-- 南瓜保护标记 -->
          <div v-if="isProtectedByPumpkin(index)" class="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full border border-orange-300" role="img" aria-label="被南瓜头保护">
            南
          </div>
        </div>
      </div>
    </div>
    <!-- 飞行终点锚点（零宽可见，承接 pick 飞行） -->
    <div :data-pick-slot="player" class="h-0 w-0" aria-hidden="true" />
  </div>

  <!-- 桌面端完整版（md 以上，原样） -->
  <div class="hidden md:flex glass-panel rounded-xl p-3 lg:p-4 h-full flex-col" :class="highlighted ? 'ring-2 ring-plant-green-neon/50 lg:ring-0' : ''" role="region" :aria-label="`${playerName}选择的植物`">
    <h3 class="text-lg font-bold mb-1 text-pick-blue-neon flex items-center gap-2 uppercase tracking-wider border-b border-gray-700/50 pb-2">
      <span class="w-2 h-2 rounded-full bg-pick-blue" aria-hidden="true"></span>
      {{ playerName }} 阵容
    </h3>
    <p class="mb-3 text-[11px] text-gray-500">拖拽到战场站位，或点击站位格选择</p>

    <div v-if="picks.length === 0" class="text-gray-500 text-sm py-8 text-center flex-1 flex items-center justify-center italic">
      等待选择...
    </div>

    <div class="space-y-2 lg:space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
      <transition-group name="list">
        <div
          v-for="(plantId, index) in picks"
          :key="`${player}-${plantId}-${index}`"
          draggable="true"
          @dragstart="handleDragStart($event, plantId, index)"
          @dragend="handleDragEnd"
          :class="{ 'dragging': isCurrentDragging(plantId) }"
          class="group flex items-center gap-2 p-1.5 lg:gap-3 lg:p-2 rounded-lg border border-gray-700 lg:hover:border-pick-blue/50 lg:hover:bg-gray-800/80 active:scale-[0.98] transition-all duration-300"
          role="listitem"
          aria-roledescription="可拖拽项"
          :aria-label="dragItemLabel(plantId)"
        >
          <span class="text-gray-500 text-xs font-mono w-4 text-center">#{{ index + 1 }}</span>
          <!-- 如果是重复植物，高亮显示序号 -->
          <span v-if="countPlantOccurrences(plantId) > 1"
                class="text-xs text-pick-blue ml-1">
            ({{ index + 1 }})
          </span>
          <div class="relative w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
            <img
              :src="getPlantImage(plantId)"
              :alt="getPlantName(plantId)"
              class="w-full h-full object-cover rounded border border-gray-600 lg:group-hover:border-pick-blue-neon transition-colors"
            />
            <!-- 使用次数标记 (如果>1) - 左上角 -->
             <div v-if="getUsageCount(plantId) > 1" class="absolute -top-1 -left-1 bg-yellow-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-gray-800 shadow">
               {{ getUsageCount(plantId) }}
             </div>
            <!-- 南瓜保护标记 - 右上角 -->
            <div v-if="isProtectedByPumpkin(index)"
                 class="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-orange-300 shadow-[0_0_6px_rgba(255,165,0,0.7)]"
                 role="img" aria-label="被南瓜头保护" title="被南瓜头保护">
              南
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-gray-200 lg:group-hover:text-pick-blue-neon transition-colors truncate">{{ getPlantName(plantId) }}</div>
            <div class="text-[10px] text-gray-500 truncate">{{ getPlantDesc(plantId) }}</div>
          </div>
        </div>
        <!-- 飞行终点锚点：零宽零高，定位在列表末尾，供飞行 overlay 读取落点坐标 -->
        <div :key="`pick-slot-${player}`" :data-pick-slot="player" class="h-0 w-0" aria-hidden="true" />
      </transition-group>
    </div>

    <!-- 底部状态 -->
    <div class="mt-4 pt-3 border-t border-gray-700/50 flex justify-between items-end">
      <div class="text-xs text-gray-400">
        已选: <span class="text-white font-bold">{{ picks.length }}</span>
      </div>
      <div class="flex gap-1" role="img" :aria-label="`已选 ${picks.length} / 10`">
        <!-- 小点指示器 -->
        <span
          v-for="i in 10"
          :key="i"
          class="w-1.5 h-1.5 rounded-full transition-colors"
          :class="i <= picks.length ? 'bg-pick-blue-neon' : 'bg-gray-700'"
          aria-hidden="true"
        ></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useUIStore } from '@/stores/uiStore'
import { getPlantImage, getPlantName, getPlantDesc } from '@/data/customPlants'

const props = defineProps({
  player: {
    type: String, // 'player1' or 'player2'
    required: true
  },
  // 高亮当前选手阵容（多人模式自分身份时）；桌面端 lg 起由 lg:ring-0 移除
  highlighted: {
    type: Boolean,
    default: false
  }
})

const store = useGameStore()
const uiStore = useUIStore()

// 本地拖拽状态（用于视觉反馈）
const localDraggingPlantId = ref(null)

const playerName = computed(() => {
  return store[props.player]?.id || (props.player === 'player1' ? '甲' : '乙')
})

const picks = computed(() => {
  return store.currentRound?.picks?.[props.player] || []
})

const getUsageCount = (plantId) => {
  // 历史使用次数
  const historicalUsage = store.getPlantUsageCount(props.player, plantId)

  // 当前小局中该植物的出现次数
  const currentRoundUsage = picks.value.filter(id => id === plantId).length

  return historicalUsage + currentRoundUsage
}

// ========== 拖拽事件处理函数 ==========

const handleDragStart = (event, plantId, sourceIndex) => {
  localDraggingPlantId.value = plantId

  // 更新全局拖拽状态
  uiStore.setDragState({
    isDragging: true,
    draggedPlantId: plantId,
    draggedFromPlayer: props.player,
    draggedFromType: 'pickArea',
    draggedFromPosition: null,
    draggedSourceIndex: sourceIndex
  })

  // 设置拖拽数据
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', JSON.stringify({
    plantId,
    sourceIndex,
    source: 'pickArea',
    player: props.player
  }))
}

const handleDragEnd = () => {
  localDraggingPlantId.value = null
  uiStore.clearDragState()
}

const isCurrentDragging = (plantId) => {
  return uiStore.dragState?.isDragging &&
         uiStore.dragState?.draggedPlantId === plantId &&
         uiStore.dragState?.draggedFromType === 'pickArea'
}

// 辅助函数：统计植物出现次数
const countPlantOccurrences = (plantId) => {
  return picks.value.filter(id => id === plantId).length
}

// 拖拽项的可读标签（供辅助技术识别）
const dragItemLabel = (plantId) => {
  const name = getPlantName(plantId)
  const usage = getUsageCount(plantId)
  const usageText = usage > 1 ? `，已使用${usage}次` : ''
  return `${name}${usageText}，可拖拽到战场站位`
}

// 手机端紧凑项的可读标签（无拖拽语义）
const pickItemLabel = (plantId) => {
  const name = getPlantName(plantId)
  const usage = getUsageCount(plantId)
  const usageText = usage > 1 ? `，已使用${usage}次` : ''
  return `${name}${usageText}`
}

// 检查植物是否被南瓜保护（新增）
const isProtectedByPumpkin = (index) => {
  const protectionKey = `${props.player}_${index}`
  const protection = store.currentRound?.pumpkinProtection?.[protectionKey]
  return protection && protection.protectedBy === 'pumpkin'
}
</script>

<style scoped>
/* 落定弹跳：复用全局 successPop keyframe，去掉 translateX 以免与飞行水平运动重复 */
.list-enter-active {
  animation: successPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-from {
  opacity: 0;
}
.list-leave-active {
  transition: all 0.3s ease;
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 拖拽样式 */
.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  box-shadow: 0 0 15px rgba(76, 175, 80, 0.6);
  border-color: #4CAF50 !important;
}

[draggable="true"] {
  cursor: grab;
}

[draggable="true"]:active {
  cursor: grabbing;
}
</style>

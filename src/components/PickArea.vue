<template>
  <div class="glass-panel rounded-xl p-4 h-full flex flex-col" role="region" :aria-label="`${playerName}选择的植物`">
    <h3 class="text-lg font-bold mb-4 text-pick-blue-neon flex items-center gap-2 uppercase tracking-wider border-b border-gray-700/50 pb-2">
      <span class="w-2 h-2 rounded-full bg-pick-blue shadow-[0_0_8px_rgba(33,150,243,0.8)]"></span>
      {{ playerName }} 阵容
    </h3>

    <div v-if="picks.length === 0" class="text-gray-500 text-sm py-8 text-center flex-1 flex items-center justify-center italic">
      等待选择...
    </div>

    <div class="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
      <transition-group name="list">
        <div
          v-for="(plantId, index) in picks"
          :key="plantId"
          class="group flex items-center gap-3 bg-gray-800/40 p-2 rounded-lg border border-gray-700 hover:border-pick-blue/50 hover:bg-gray-800/80 transition-all duration-300"
        >
          <span class="text-gray-500 text-xs font-mono w-4 text-center">#{{ index + 1 }}</span>
          <div class="relative w-12 h-12 flex-shrink-0">
            <img
              :src="getPlantImage(plantId)"
              :alt="getPlantName(plantId)"
              class="w-full h-full object-cover rounded border border-gray-600 group-hover:border-pick-blue-neon transition-colors"
            />
            <!-- 使用次数标记 (如果>1) -->
             <div v-if="getUsageCount(plantId) > 1" class="absolute -top-1 -right-1 bg-yellow-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-gray-800 shadow">
               {{ getUsageCount(plantId) }}
             </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-gray-200 group-hover:text-pick-blue-neon transition-colors truncate">{{ getPlantName(plantId) }}</div>
            <div class="text-[10px] text-gray-500 truncate">{{ getPlantDesc(plantId) }}</div>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- 底部状态 -->
    <div class="mt-4 pt-3 border-t border-gray-700/50 flex justify-between items-end">
      <div class="text-xs text-gray-400">
        已选: <span class="text-white font-bold">{{ picks.length }}</span>
      </div>
      <div class="flex gap-1">
        <!-- 小点指示器 -->
        <span 
          v-for="i in 10" 
          :key="i"
          class="w-1.5 h-1.5 rounded-full transition-colors"
          :class="i <= picks.length ? 'bg-pick-blue-neon' : 'bg-gray-700'"
        ></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/store/gameStore'
import { getPlantById } from '@/data/plants'

const props = defineProps({
  player: {
    type: String, // 'player1' or 'player2'
    required: true
  }
})

const store = useGameStore()

const playerName = computed(() => {
  return store[props.player]?.id || (props.player === 'player1' ? '甲' : '乙')
})

const picks = computed(() => {
  return store.currentRound?.picks?.[props.player] || []
})

const getPlantImage = (id) => {
  return getPlantById(id)?.image || ''
}

const getPlantName = (id) => {
  return getPlantById(id)?.name || ''
}

const getPlantDesc = (id) => {
  return getPlantById(id)?.description || ''
}

const getUsageCount = (plantId) => {
  return store.getPlantUsageCount(props.player, plantId)
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>

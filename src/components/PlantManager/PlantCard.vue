<template>
  <div
    class="relative group bg-gray-800/40 rounded-xl overflow-hidden border transition-all hover:scale-105 cursor-pointer"
    :class="plant.builtin !== false
      ? 'border-gray-600 hover:border-gray-500'
      : 'border-purple-600/50 hover:border-purple-400 hover:shadow-purple-500/20 hover:shadow-lg'"
    @click="$emit('edit', plant)"
  >
    <!-- 图片 -->
    <div class="aspect-square relative">
      <img
        :src="plantImage"
        :alt="plant.name"
        class="w-full h-full object-cover"
        @error="handleImageError"
      />
      <!-- 内置标识 -->
      <div v-if="plant.builtin !== false" class="absolute top-2 left-2 px-2 py-0.5 bg-blue-600/90 text-xs text-white rounded backdrop-blur">
        内置
      </div>
      <!-- 自定义标识 -->
      <div v-else class="absolute top-2 left-2 px-2 py-0.5 bg-purple-600/90 text-xs text-white rounded backdrop-blur">
        自定义
      </div>
    </div>

    <!-- 信息遮罩 -->
    <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
      <h4 class="font-bold text-white truncate">{{ plant.name }}</h4>
      <p class="text-xs text-gray-300 truncate">{{ plant.description }}</p>
    </div>

    <!-- 操作按钮（仅自定义植物） -->
    <div
      v-if="plant.builtin === false"
      class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      @click.stop
    >
      <button
        @click.stop="$emit('edit', plant)"
        class="p-1.5 bg-blue-600/90 hover:bg-blue-500 rounded backdrop-blur transition-colors"
        title="编辑"
      >
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        @click.stop="$emit('delete', plant)"
        class="p-1.5 bg-red-600/90 hover:bg-red-500 rounded backdrop-blur transition-colors"
        title="删除"
      >
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getPlantImage } from '@/data/customPlants'

const props = defineProps({
  plant: {
    type: Object,
    required: true
  }
})

defineEmits(['edit', 'delete'])

const plantImage = computed(() => getPlantImage(props.plant))

const handleImageError = (event) => {
  // 使用默认占位图
  event.target.src = 'https://placehold.co/100x100/9370DB/white?text=图片丢失'
}
</script>

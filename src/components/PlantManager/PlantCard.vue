<template>
  <div
    class="relative group bg-gray-800/40 rounded-xl overflow-hidden border transition-all hover:scale-105 cursor-pointer"
    :class="plantClass"
    @click="handleCardClick"
  >
    <!-- 批量选择复选框 -->
    <div
      v-if="batchMode"
      class="absolute top-2 left-2 z-20"
      @click.stop
    >
      <input
        type="checkbox"
        :checked="selected"
        @change="$emit('toggle-select', plant)"
        class="w-5 h-5 rounded cursor-pointer accent-purple-500"
      />
    </div>

    <!-- 图片 -->
    <div class="aspect-square relative">
      <img
        :src="plantImage"
        :alt="plant.name"
        class="w-full h-full object-cover"
        :class="{ 'opacity-50': isHidden }"
        @error="handleImageError"
      />

      <!-- 已隐藏标识 -->
      <div v-if="isHidden" class="absolute top-2 left-2 px-2 py-0.5 bg-gray-600/90 text-xs text-white rounded backdrop-blur" :class="{ 'ml-7': batchMode }">
        已隐藏
      </div>

      <!-- 内置标识 -->
      <div
        v-else-if="plant.builtin !== false"
        class="absolute top-2 left-2 px-2 py-0.5 text-xs text-white rounded backdrop-blur"
        :class="[isHidden ? 'bg-gray-600/90' : 'bg-blue-600/90', { 'ml-7': batchMode }]"
      >
        {{ isHidden ? '已隐藏' : '内置' }}
      </div>

      <!-- 自定义标识 -->
      <div v-else class="absolute top-2 left-2 px-2 py-0.5 bg-purple-600/90 text-xs text-white rounded backdrop-blur" :class="{ 'ml-7': batchMode }">
        自定义
      </div>
    </div>

    <!-- 手机常显名字条（桌面改用下方 hover 遮罩）；pointer-events-none 保证点击穿透卡片 -->
    <div class="lg:hidden absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-1.5 pt-5 pointer-events-none">
      <span class="block text-center text-[11px] font-bold text-white truncate drop-shadow-md">{{ plant.name }}</span>
    </div>

    <!-- 信息遮罩（桌面 hover / 键盘 focus-within 显示；触屏无 hover，名字由上方常显条承载） -->
    <div class="absolute inset-0 hidden lg:flex flex-col justify-end p-3 bg-gradient-to-t from-black via-black/50 to-transparent lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
      <h4 class="font-bold text-white truncate">{{ plant.name }}</h4>
      <p class="text-xs text-gray-300 truncate">{{ plant.description }}</p>
    </div>

    <!-- 操作按钮：触屏常显（hover 不可用且 opacity-0 仍可点击，会形成误触盲区）；桌面 hover / 键盘 focus 显示 -->
    <div
      v-if="!batchMode && (plant.builtin === false || (plant.builtin !== false && !isHidden))"
      class="absolute top-2 right-2 flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity"
      @click.stop
    >
      <!-- 内置植物：隐藏按钮 -->
      <button
        v-if="plant.builtin !== false && !isHidden"
        @click.stop="$emit('hide', plant)"
        class="p-2.5 bg-orange-600/90 hover:bg-orange-500 rounded backdrop-blur transition-colors"
        title="隐藏"
      >
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0 8.268 2.943 9.543 7a9.97 9.97 0 011.563 3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.995-1.858L5.732 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 002-2v5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <!-- 自定义植物：编辑按钮 -->
      <button
        v-if="plant.builtin === false"
        @click.stop="$emit('edit', plant)"
        class="p-2.5 bg-blue-600/90 hover:bg-blue-500 rounded backdrop-blur transition-colors"
        title="编辑"
      >
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      <!-- 自定义植物：删除按钮 -->
      <button
        v-if="plant.builtin === false"
        @click.stop="$emit('delete', plant)"
        class="p-2.5 bg-red-600/90 hover:bg-red-500 rounded backdrop-blur transition-colors"
        title="删除"
      >
        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5.732 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getPlantImage, isPlantHidden } from '@/data/customPlants'

const props = defineProps({
  plant: {
    type: Object,
    required: true
  },
  batchMode: {
    type: Boolean,
    default: false
  },
  selected: {
    type: Boolean,
    default: false
  },
  // 可选：父组件显式传入隐藏态（预设草稿模式基于副本判断）；不传则 fallback 全局 isPlantHidden
  hidden: {
    type: Boolean,
    default: null
  }
})

const emit = defineEmits(['edit', 'delete', 'hide', 'toggle-select'])

const plantImage = computed(() => {
  // 预设副本植物(image=Base64)/内置植物(image=路径)直接带 image 字段；
  // 全局自定义植物只有 imageData(Blob)，走 getPlantImage 转 ObjectURL
  if (props.plant.image) return props.plant.image
  return getPlantImage(props.plant.id)
})
const isHidden = computed(() => {
  if (props.hidden !== null && props.hidden !== undefined) return props.hidden
  return props.plant.builtin !== false && isPlantHidden(props.plant.id)
})

const plantClass = computed(() => {
  const baseClass = props.selected
    ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
    : props.plant.builtin !== false
      ? isHidden.value
        ? 'border-gray-700 opacity-60'
        : 'border-gray-600 hover:border-gray-500'
      : isHidden.value
        ? 'border-gray-700/50 hover:border-gray-500 opacity-60'
        : 'border-purple-600/50 hover:border-purple-400 hover:shadow-purple-500/20 hover:shadow-lg'

  return baseClass
})

const handleCardClick = () => {
  if (!props.batchMode) {
    emit('edit', props.plant)
  }
}

const handleImageError = (event) => {
  event.target.src = 'https://placehold.co/100x100/9370DB/white?text=图片丢失'
}
</script>

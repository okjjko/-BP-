<template>
  <div class="space-y-4">
    <!-- 预览区 -->
    <div class="relative aspect-square bg-gray-900/50 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center overflow-hidden">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="预览"
        class="w-full h-full object-contain"
      />
      <div v-else class="text-center text-gray-500">
        <svg class="w-16 h-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm">拖拽或点击上传图片</p>
        <p class="text-xs text-gray-600 mt-1">支持 PNG, JPG, WEBP</p>
      </div>

      <!-- 删除按钮 -->
      <button
        v-if="imageUrl"
        @click="removeImage"
        class="absolute top-2 right-2 p-2 bg-red-600/90 hover:bg-red-500 rounded-full backdrop-blur transition-colors"
      >
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- 文件输入 -->
      <input
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="handleFileSelect"
      />
    </div>

    <!-- 图片信息 -->
    <div v-if="imageSize" class="flex justify-between text-xs text-gray-400">
      <span>{{ imageSize }}</span>
      <span :class="isOversized ? 'text-red-400' : 'text-green-400'">
        {{ imageSizeKB }} KB
      </span>
    </div>

    <!-- 默认图片选择（可选） -->
    <div v-if="!imageUrl" class="space-y-2">
      <p class="text-xs text-gray-400">或使用默认模板：</p>
      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="(template, index) in defaultTemplates"
          :key="index"
          @click="useTemplate(template)"
          class="aspect-square rounded border border-gray-600 hover:border-purple-400 overflow-hidden transition-colors"
        >
          <img :src="template" class="w-full h-full object-cover" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  modelValue: Blob,
  imageType: String
})
const emit = defineEmits(['update:modelValue', 'update:imageType'])

const fileInput = ref(null)
const imageUrl = ref('')
const imageSize = ref('')

// 默认模板（使用占位图服务）
const defaultTemplates = [
  'https://placehold.co/100x100/4CAF50/white?text=射手',
  'https://placehold.co/100x100/FFD700/white?text=生产',
  'https://placehold.co/100x100/8B4513/white?text=防御',
  'https://placehold.co/100x100/DC143C/white?text=瞬间',
  'https://placehold.co/100x100/9370DB/white?text=辅助'
]

// 监听外部值变化（Blob -> URL）
watch(() => props.modelValue, (newBlob) => {
  if (newBlob instanceof Blob) {
    imageUrl.value = URL.createObjectURL(newBlob)
  } else if (!newBlob) {
    imageUrl.value = ''
  }
}, { immediate: true })

// 监听内部值变化（URL -> Blob）
// 注意：这里我们反向传递Blob给父组件

const imageSizeKB = computed(() => {
  if (!props.modelValue) return 0
  return Math.round(props.modelValue.size / 1024)
})

const isOversized = computed(() => imageSizeKB.value > 500)

const handleFileSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 验证文件类型
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    alert('仅支持 PNG、JPG、WEBP 格式')
    return
  }

  // 验证文件大小（原始大小限制2MB）
  if (file.size > 2 * 1024 * 1024) {
    alert('图片文件过大（超过2MB）')
    return
  }

  // 读取并压缩图片
  try {
    const { blob, width, height } = await compressImage(file)
    imageSize.value = `${width}×${height}`

    // 传递给父组件
    emit('update:modelValue', blob)
    emit('update:imageType', file.type)
  } catch (e) {
    console.error('图片处理失败', e)
    alert('图片处理失败，请重试')
  }

  // 清空input允许重复选择同一文件
  event.target.value = ''
}

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 计算压缩尺寸（最大100x100px）
        const maxSize = 100
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // 转换为Blob（用于IndexedDB存储）
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob failed'))
            return
          }

          // 检查压缩后大小
          if (blob.size > 500 * 1024) {
            alert('压缩后图片仍过大，请选择更简单的图片')
            reject(new Error('Image too large'))
            return
          }

          resolve({ blob, width, height })
        }, 'image/jpeg', 0.7)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const removeImage = () => {
  imageUrl.value = ''
  imageSize.value = ''
  emit('update:modelValue', null)
}

const useTemplate = async (template) => {
  try {
    // 将URL转换为Blob
    const response = await fetch(template)
    const blob = await response.blob()
    imageUrl.value = template
    emit('update:modelValue', blob)
    emit('update:imageType', 'image/jpeg')
  } catch (e) {
    console.error('使用模板失败', e)
    alert('使用模板失败')
  }
}
</script>

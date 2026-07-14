<template>
  <div class="space-y-4">
    <!-- 预览区 -->
    <div class="relative aspect-square bg-gray-900/50 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center overflow-hidden focus-within:ring-2 focus-within:ring-purple-400">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="预览"
        class="w-full h-full object-contain"
      />
      <div v-else class="text-center text-gray-500">
        <ImagePlus :size="64" class="mx-auto mb-2" />
        <p class="text-sm">拖拽或点击上传图片</p>
        <p class="text-xs text-gray-600 mt-1">支持 PNG, JPG, WEBP</p>
      </div>

      <!-- 删除按钮 -->
      <button
        v-if="imageUrl"
        @click="removeImage"
        class="absolute top-2 right-2 p-2 bg-red-600/90 hover:bg-red-500 rounded-full backdrop-blur transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        aria-label="移除图片"
      >
        <X :size="16" class="text-white" />
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
          class="aspect-square rounded border border-gray-600 hover:border-purple-400 overflow-hidden transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <img :src="template" class="w-full h-full object-cover" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ImagePlus, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const toast = useToast()

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
    toast.error('仅支持 PNG、JPG、WEBP 格式')
    return
  }

  // 验证文件大小（原始大小限制2MB）
  if (file.size > 2 * 1024 * 1024) {
    toast.error('图片文件过大（超过 2MB）')
    return
  }

  // 读取并压缩图片
  try {
    const { blob, width, height } = await compressImage(file)
    imageSize.value = `${width}×${height}`

    // 传递给父组件
    emit('update:modelValue', blob)
    emit('update:imageType', file.type)

    toast.success(`图片已上传 ${Math.round(blob.size / 1024)} KB`)
  } catch (e) {
    console.error('图片处理失败', e)
    toast.error(e.message || '图片处理失败，请重试')
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
            reject(new Error('图片处理失败，请重试'))
            return
          }

          // 检查压缩后大小
          if (blob.size > 500 * 1024) {
            reject(new Error('压缩后图片仍过大，请选择更简单的图片'))
            return
          }

          resolve({ blob, width, height })
        }, 'image/jpeg', 0.7)
      }
      img.onerror = () => reject(new Error('图片加载失败，请重试'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('图片读取失败，请重试'))
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
    toast.success('已应用模板')
  } catch (e) {
    console.error('使用模板失败', e)
    toast.error('使用模板失败')
  }
}
</script>

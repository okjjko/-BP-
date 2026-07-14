<template>
  <div class="space-y-6 animate-fade-in">
    <h3 class="text-2xl font-bold">{{ isEdit ? '编辑' : '新建' }}植物</h3>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- ID编辑（仅编辑模式显示） -->
      <div v-if="isEdit && formData.id">
        <label class="block text-sm font-bold text-gray-300 mb-2" for="plant-id">植物ID</label>
        <div class="relative">
          <input
            id="plant-id"
            v-model="formData.id"
            type="text"
            class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 pr-20 cursor-text"
            placeholder="custom_xxx"
            :class="{ 'border-yellow-500': idChanged }"
          />
          <span
            v-if="idChanged"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yellow-400 font-medium"
          >
            已修改
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          修改ID可能影响游戏中的引用，请谨慎操作
        </p>
      </div>

      <!-- 图片上传 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2">植物图片</label>
        <ImageUploader v-model="formData.imageData" :image-type="formData.imageType" />
      </div>

      <!-- 名称 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2" for="plant-name">植物名称 *</label>
        <input
          id="plant-name"
          v-model="formData.name"
          type="text"
          required
          maxlength="20"
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-text"
          placeholder="例如：超级豌豆射手"
        />
      </div>

      <!-- 类型 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2" for="plant-type">植物类型 *</label>
        <select
          id="plant-type"
          v-model="formData.type"
          required
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
        >
          <option value="副C">副C</option>
          <option value="大C">大C</option>
          <option value="辅助">辅助</option>
          <option value="前排">前排</option>
        </select>
      </div>

      <!-- 描述 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2" for="plant-desc">功能描述 *</label>
        <textarea
          id="plant-desc"
          v-model="formData.description"
          required
          maxlength="100"
          rows="3"
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 resize-none cursor-text"
          placeholder="简要描述植物的功能..."
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">{{ formData.description.length }}/100</p>
      </div>

      <!-- 按钮组 -->
      <div class="flex gap-3 pt-4">
        <button
          type="submit"
          class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          {{ isEdit ? '保存修改' : '创建植物' }}
        </button>
        <button
          type="button"
          @click="$emit('cancel')"
          class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          取消
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ImageUploader from './ImageUploader.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

const props = defineProps({
  plant: Object,
  isEdit: Boolean
})
const emit = defineEmits(['save', 'cancel'])

const toast = useToast()
const { confirm } = useConfirm()

const formData = ref({
  id: '',
  name: '',
  imageData: null,
  imageType: 'image/jpeg',
  description: '',
  type: '副C'
})

// 保存原始ID用于比较
const originalId = ref('')

// ID是否已修改
const idChanged = ref(false)

// 监听ID变化
watch(() => formData.value.id, (newId) => {
  if (originalId.value && newId !== originalId.value) {
    idChanged.value = true
  } else {
    idChanged.value = false
  }
})

// 监听传入的植物数据
watch(() => props.plant, (newPlant) => {
  if (newPlant) {
    originalId.value = newPlant.id || ''
    formData.value = {
      id: newPlant.id || '',
      name: newPlant.name || '',
      imageData: newPlant.imageData || null,
      imageType: newPlant.imageType || 'image/jpeg',
      description: newPlant.description || '',
      type: newPlant.type || 'shooter'
    }
    idChanged.value = false
  } else {
    // 重置为默认值
    originalId.value = ''
    formData.value = {
      id: '',
      name: '',
      imageData: null,
      imageType: 'image/jpeg',
      description: '',
      type: '副C'
    }
    idChanged.value = false
  }
}, { immediate: true })

const handleSubmit = async () => {
  // 验证
  if (!formData.value.name.trim()) {
    toast.error('请输入植物名称')
    return
  }
  if (!formData.value.description.trim()) {
    toast.error('请输入功能描述')
    return
  }
  if (!formData.value.imageData) {
    toast.error('请上传植物图片')
    return
  }

  // 编辑模式下的ID验证
  if (props.isEdit && idChanged.value) {
    const newId = formData.value.id.trim()
    if (!newId) {
      toast.error('植物ID不能为空')
      return
    }

    // 验证ID唯一性
    try {
      const { checkPlantIdExists } = await import('@/data/customPlants')
      const exists = await checkPlantIdExists(newId, originalId.value)
      if (exists) {
        toast.error(`植物ID "${newId}" 已存在，请使用其他 ID`)
        return
      }
    } catch (error) {
      console.error('ID验证失败:', error)
      toast.error('ID 验证失败，请重试')
      return
    }

    // 确认ID修改
    if (!await confirm({
      title: '修改植物 ID',
      message: `确定将植物 ID 从 "${originalId.value}" 修改为 "${newId}"？注意：如果该植物正在游戏中使用，ID 修改后可能导致引用错误。`,
      confirmText: '修改',
      variant: 'danger',
    })) {
      return
    }
  }

  emit('save', formData.value)
}
</script>

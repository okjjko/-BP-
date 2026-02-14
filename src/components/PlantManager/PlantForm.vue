<template>
  <div class="space-y-6 animate-fade-in">
    <h3 class="text-2xl font-bold">{{ isEdit ? '编辑' : '新建' }}植物</h3>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- 图片上传 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2">植物图片</label>
        <ImageUploader v-model="formData.imageData" :image-type="formData.imageType" />
      </div>

      <!-- 名称 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2">植物名称 *</label>
        <input
          v-model="formData.name"
          type="text"
          required
          maxlength="20"
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none"
          placeholder="例如：超级豌豆射手"
        />
      </div>

      <!-- 类型 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2">植物类型 *</label>
        <select
          v-model="formData.type"
          required
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none"
        >
          <option value="shooter">射击</option>
          <option value="producer">生产</option>
          <option value="defense">防御</option>
          <option value="instant">瞬间</option>
          <option value="melee">近战</option>
          <option value="support">辅助</option>
        </select>
      </div>

      <!-- 描述 -->
      <div>
        <label class="block text-sm font-bold text-gray-300 mb-2">功能描述 *</label>
        <textarea
          v-model="formData.description"
          required
          maxlength="100"
          rows="3"
          class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none resize-none"
          placeholder="简要描述植物的功能..."
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">{{ formData.description.length }}/100</p>
      </div>

      <!-- 按钮组 -->
      <div class="flex gap-3 pt-4">
        <button
          type="submit"
          class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
        >
          {{ isEdit ? '保存修改' : '创建植物' }}
        </button>
        <button
          type="button"
          @click="$emit('cancel')"
          class="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
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

const props = defineProps({
  plant: Object,
  isEdit: Boolean
})
const emit = defineEmits(['save', 'cancel'])

const formData = ref({
  name: '',
  imageData: null,
  imageType: 'image/jpeg',
  description: '',
  type: 'shooter'
})

// 监听传入的植物数据
watch(() => props.plant, (newPlant) => {
  if (newPlant) {
    formData.value = {
      name: newPlant.name || '',
      imageData: newPlant.imageData || null,
      imageType: newPlant.imageType || 'image/jpeg',
      description: newPlant.description || '',
      type: newPlant.type || 'shooter'
    }
  } else {
    // 重置为默认值
    formData.value = {
      name: '',
      imageData: null,
      imageType: 'image/jpeg',
      description: '',
      type: 'shooter'
    }
  }
}, { immediate: true })

const handleSubmit = () => {
  // 验证
  if (!formData.value.name.trim()) {
    alert('请输入植物名称')
    return
  }
  if (!formData.value.description.trim()) {
    alert('请输入功能描述')
    return
  }
  if (!formData.value.imageData) {
    alert('请上传植物图片')
    return
  }

  emit('save', formData.value)
}
</script>

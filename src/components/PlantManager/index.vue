<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- 背景遮罩 -->
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm"
          @click="close"
        ></div>

        <!-- 主容器 -->
        <div class="relative glass-card rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">
          <!-- 标题栏 -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700/50">
            <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-400">
              🌱 植物管理中心
            </h2>
            <button
              @click="close"
              class="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 主内容区域 -->
          <div class="flex-1 flex overflow-hidden">
            <!-- 左侧：植物列表 -->
            <div class="flex-1 overflow-y-auto p-6 border-r border-gray-700/50 custom-scrollbar">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold">植物列表</h3>
                <div class="flex gap-2">
                  <!-- 分类标签 -->
                  <button
                    v-for="type in plantTypes"
                    :key="type.value"
                    @click="selectedType = type.value"
                    class="px-3 py-1 rounded text-sm transition-colors"
                    :class="selectedType === type.value ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
                  >
                    {{ type.label }}
                  </button>
                </div>
              </div>

              <!-- 搜索框 -->
              <div class="mb-4">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索植物名称..."
                  class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none"
                />
              </div>

              <!-- 植物网格 -->
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <PlantCard
                  v-for="plant in filteredPlants"
                  :key="plant.id"
                  :plant="plant"
                  @edit="editPlant"
                  @delete="confirmDelete"
                />

                <!-- 新建按钮卡片 -->
                <button
                  @click="createNew"
                  class="aspect-square border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center hover:border-purple-400 hover:bg-purple-400/10 transition-all group"
                >
                  <svg class="w-12 h-12 text-gray-500 group-hover:text-purple-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span class="text-gray-500 group-hover:text-purple-400">新建植物</span>
                </button>
              </div>
            </div>

            <!-- 右侧：表单/预览区 -->
            <div class="w-[450px] p-6 overflow-y-auto">
              <Transition name="fade" mode="out-in">
                <PlantForm
                  v-if="editingPlant"
                  :plant="editingPlant"
                  :is-edit="isEditMode"
                  @save="handleSave"
                  @cancel="cancelEdit"
                />
                <div v-else class="h-full flex items-center justify-center text-gray-500">
                  <div class="text-center">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p>选择左侧植物进行编辑<br/>或点击新建按钮</p>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 底部工具栏 -->
          <div class="p-4 border-t border-gray-700/50 flex justify-between items-center">
            <div class="text-sm text-gray-400">
              内置: {{ builtinCount }} | 自定义: {{ customCount }}
            </div>
            <ImportExport @import="handleImport" @export="handleExport" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { getAllPlantsSync } from '@/data/customPlants'
import PlantCard from './PlantCard.vue'
import PlantForm from './PlantForm.vue'
import ImportExport from './ImportExport.vue'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['update:show'])

const selectedType = ref('all')
const searchQuery = ref('')
const editingPlant = ref(null)
const isEditMode = ref(false)

const plantTypes = [
  { value: 'all', label: '全部' },
  { value: 'shooter', label: '射击' },
  { value: 'producer', label: '生产' },
  { value: 'defense', label: '防御' },
  { value: 'instant', label: '瞬间' },
  { value: 'melee', label: '近战' },
  { value: 'support', label: '辅助' }
]

// 过滤植物列表
const filteredPlants = computed(() => {
  let plants = getAllPlantsSync()

  if (selectedType.value !== 'all') {
    plants = plants.filter(p => p.type === selectedType.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    plants = plants.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    )
  }

  return plants
})

// 统计
const builtinCount = computed(() => getAllPlantsSync().filter(p => p.builtin !== false).length)
const customCount = computed(() => getAllPlantsSync().filter(p => p.builtin === false).length)

// 操作方法
const close = () => emit('update:show', false)

const createNew = () => {
  editingPlant.value = {}  // 设置为空对象，让v-if="editingPlant"为true
  isEditMode.value = false
}

const editPlant = (plant) => {
  if (plant.builtin !== false) {
    alert('内置植物无法编辑')
    return
  }
  editingPlant.value = { ...plant }
  isEditMode.value = true
}

const confirmDelete = (plant) => {
  if (plant.builtin !== false) {
    alert('内置植物无法删除')
    return
  }
  if (confirm(`确定删除植物"${plant.name}"？`)) {
    handleDelete(plant.id)
  }
}

const handleDelete = async (id) => {
  try {
    const { deleteCustomPlant } = await import('@/data/customPlants')
    await deleteCustomPlant(id)
    // 强制刷新列表
    const currentType = selectedType.value
    selectedType.value = ''
    setTimeout(() => selectedType.value = currentType, 0)
  } catch (error) {
    console.error('删除植物失败:', error)
    alert('删除植物失败')
  }
}

const handleSave = async (plantData) => {
  try {
    const { addCustomPlant, updateCustomPlant } = await import('@/data/customPlants')

    if (isEditMode.value) {
      await updateCustomPlant(editingPlant.value.id, plantData)
    } else {
      await addCustomPlant(plantData)
    }

    cancelEdit()
    // 强制刷新列表（通过先清空再恢复触发响应式更新）
    const currentType = selectedType.value
    selectedType.value = ''
    setTimeout(() => selectedType.value = currentType, 0)
  } catch (error) {
    console.error('保存植物失败:', error)
    alert('保存植物失败')
  }
}

const cancelEdit = () => {
  editingPlant.value = null
  isEditMode.value = false
}

const handleExport = () => {
  // 导出逻辑（在ImportExport组件中实现）
  console.log('导出功能待实现')
}

const handleImport = () => {
  // 导入逻辑（在ImportExport组件中实现）
  console.log('导入功能待实现')
}
</script>

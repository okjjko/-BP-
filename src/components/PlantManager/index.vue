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
                  @hide="confirmHide"
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
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2m15 3.5.5.5 6.268-2.943 9.543 7a10.025 10.025 0 01-1.995-1.858L5.732 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1 1h-4a1 1 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <p>选择左侧植物进行编辑<br/>或点击新建按钮</p>
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <!-- 底部工具栏 -->
          <div class="p-4 border-t border-gray-700/50 flex justify-between items-center">
            <div class="flex items-center gap-4 text-sm text-gray-400">
              <span>内置: {{ builtinCount }} | 自定义: {{ customCount }}</span>
              <span v-if="hiddenCount > 0" class="text-orange-400">
                | 已隐藏: {{ hiddenCount }}
                <button
                  @click="showRecycleBin = true"
                  class="ml-2 px-2 py-1 bg-orange-600/20 hover:bg-orange-600/40 rounded transition-colors"
                >
                  查看回收站
                </button>
              </span>
            </div>
            <ImportExport @import="handleImport" @export="handleExport" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- 回收站弹窗 -->
    <Transition name="fade">
      <div v-if="showRecycleBin" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showRecycleBin = false"></div>
        <div class="relative glass-card rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <!-- 标题栏 -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700/50">
            <h2 class="text-2xl font-bold text-orange-400">♻️ 回收站（已隐藏的内置植物）</h2>
            <button @click="showRecycleBin = false" class="p-2 hover:bg-gray-700/50 rounded-lg">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 内容区域 -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="hiddenPlants.length === 0" class="text-center text-gray-500 py-12">
              <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4" />
              </svg>
              <p>回收站为空</p>
            </div>

            <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div
                v-for="plant in hiddenPlants"
                :key="plant.id"
                class="relative group bg-gray-800/60 rounded-xl overflow-hidden border border-orange-600/50 hover:border-orange-400 transition-all"
              >
                <img :src="getPlantImage(plant.id)" class="w-full aspect-square object-cover opacity-60" />
                <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent flex flex-col justify-end p-3">
                  <h4 class="font-bold text-white">{{ plant.name }}</h4>
                  <p class="text-xs text-gray-400 truncate">{{ plant.description }}</p>
                </div>
                <button
                  @click="restorePlant(plant)"
                  class="absolute top-2 right-2 p-2 bg-green-600/90 hover:bg-green-500 rounded backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
                  title="恢复"
                >
                  <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.586m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357 2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="p-4 border-t border-gray-700/50 flex justify-between items-center">
            <div class="text-sm text-gray-400">
              共 {{ hiddenPlants.length }} 个已隐藏植物
            </div>
            <button
              v-if="hiddenPlants.length > 0"
              @click="restoreAll"
              class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white font-medium transition-colors"
            >
              恢复全部
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getAllPlantsSync, getHiddenBuiltinPlants, hideBuiltinPlant, unhideBuiltinPlant, checkPlantInGame, getPlantImage } from '@/data/customPlants'
import { useGameStore } from '@/store/gameStore'
import PlantCard from './PlantCard.vue'
import PlantForm from './PlantForm.vue'
import ImportExport from './ImportExport.vue'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['update:show'])

const store = useGameStore()

const selectedType = ref('all')
const searchQuery = ref('')
const editingPlant = ref(null)
const isEditMode = ref(false)
const showRecycleBin = ref(false)

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
const hiddenCount = computed(() => getHiddenBuiltinPlants().length)
const hiddenPlants = computed(() => getHiddenBuiltinPlants())

// 操作方法
const close = () => emit('update:show', false)

const createNew = () => {
  editingPlant.value = {}
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
    alert('内置植物无法删除，请使用"隐藏"功能')
    return
  }
  if (confirm(`确定删除植物"${plant.name}"？`)) {
    handleDelete(plant.id)
  }
}

const confirmHide = (plant) => {
  // 检查用户是否已经确认过隐藏操作（全局标记）
  const CONFIRMED_ANY_HIDDEN_KEY = 'userConfirmedAnyHide'
  const hasConfirmedBefore = localStorage.getItem(CONFIRMED_ANY_HIDDEN_KEY) === 'true'

  if (hasConfirmedBefore) {
    // 用户已经确认过一次，之后所有隐藏都不再提示
    try {
      hideBuiltinPlant(plant.id)
      // 强制刷新列表
      const currentType = selectedType.value
      selectedType.value = ''
      setTimeout(() => selectedType.value = currentType, 0)
    } catch (error) {
      console.error('隐藏植物失败:', error)
      alert('隐藏植物失败')
    }
    return
  }

  // 检查是否在游戏中使用
  const checkResult = checkPlantInGame(plant.id, store)

  // 构造提示消息
  let message = `确定隐藏内置植物"${plant.name}"？\n\n隐藏后不会出现在植物列表中，但可以在回收站恢复。`
  if (checkResult.inUse) {
    message = `该植物正在被使用：\n${checkResult.locations.join('、')}\n\n${message}`
  }
  message += '\n\n（确认后，后续隐藏内置植物将不再提示）'

  // 首次隐藏，需要确认
  if (confirm(message)) {
    try {
      hideBuiltinPlant(plant.id)
      // 标记用户已经确认过隐藏操作（全局）
      localStorage.setItem(CONFIRMED_ANY_HIDDEN_KEY, 'true')
      // 强制刷新列表
      const currentType = selectedType.value
      selectedType.value = ''
      setTimeout(() => selectedType.value = currentType, 0)
    } catch (error) {
      console.error('隐藏植物失败:', error)
      alert('隐藏植物失败')
    }
  }
}

const restorePlant = async (plant) => {
  if (confirm(`确定恢复植物"${plant.name}"？`)) {
    try {
      unhideBuiltinPlant(plant.id)
      // 强制刷新列表
      const currentType = selectedType.value
      selectedType.value = ''
      setTimeout(() => selectedType.value = currentType, 0)
    } catch (error) {
      console.error('恢复植物失败:', error)
      alert('恢复植物失败')
    }
  }
}

const restoreAll = async () => {
  if (confirm('确定恢复所有已隐藏的内置植物？')) {
    try {
      // 导入 localStorage 清除函数
      const { unhideAllBuiltinPlants } = await import('@/data/customPlants')
      unhideAllBuiltinPlants()
      // 强制刷新列表
      const currentType = selectedType.value
      selectedType.value = ''
      setTimeout(() => selectedType.value = currentType, 0)
    } catch (error) {
      console.error('恢复所有植物失败:', error)
      alert('恢复所有植物失败')
    }
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
    const { addCustomPlant, updateCustomPlant, updateCustomPlantId } = await import('@/data/customPlants')

    if (isEditMode.value) {
      const oldId = editingPlant.value.id
      const newId = plantData.id

      // 检查ID是否改变
      if (oldId !== newId) {
        // 提取除了id之外的其他字段
        const { id, ...updates } = plantData
        await updateCustomPlantId(oldId, newId, updates)
      } else {
        // ID未变，使用普通更新
        const { id, ...updates } = plantData
        await updateCustomPlant(oldId, updates)
      }
    } else {
      await addCustomPlant(plantData)
    }

    cancelEdit()
    // 强制刷新列表
    const currentType = selectedType.value
    selectedType.value = ''
    setTimeout(() => selectedType.value = currentType, 0)
  } catch (error) {
    console.error('保存植物失败:', error)
    alert('保存植物失败: ' + error.message)
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

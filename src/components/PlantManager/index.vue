<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        ref="rootRef"
        tabindex="-1"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="配置管理"
      >
        <!-- 背景遮罩 -->
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm"
          @click="close"
        ></div>

        <!-- 主容器（焦点陷阱作用域） -->
        <div class="relative glass-card rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">
          <!-- 标题栏 -->
          <div class="flex items-center justify-between p-6 border-b border-gray-700/50">
            <h2 class="text-2xl font-bold flex items-center gap-2">
              <Sprout :size="24" class="text-purple-400" /> 配置管理
            </h2>
            <button
              @click="close"
              class="p-2 hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="关闭配置管理"
            >
              <X :size="24" />
            </button>
          </div>

          <!-- 主内容区域 -->
          <div class="flex-1 flex overflow-hidden">
            <!-- 左侧：植物列表或配置管理 -->
            <div class="flex-1 flex flex-col overflow-hidden border-r border-gray-700/50">
              <!-- 标签页切换 -->
              <div class="flex items-center gap-2 px-6 py-4 border-b border-gray-700/50" role="tablist">
                <button
                  @click="currentTab = 'plants'"
                  role="tab"
                  :aria-selected="currentTab === 'plants'"
                  class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  :class="currentTab === 'plants' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
                >
                  <Sprout :size="16" /> 植物
                </button>
                <button
                  @click="currentTab = 'configs'"
                  role="tab"
                  :aria-selected="currentTab === 'configs'"
                  class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  :class="currentTab === 'configs' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
                >
                  <Folder :size="16" /> 植物预设
                </button>
                <button
                  @click="currentTab = 'rules'"
                  role="tab"
                  :aria-selected="currentTab === 'rules'"
                  class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  :class="currentTab === 'rules' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
                >
                  <SlidersHorizontal :size="16" /> BP 流程
                </button>
              </div>

              <!-- 植物管理标签页 -->
              <div v-if="currentTab === 'plants'" class="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold">植物列表</h3>
                  <div class="flex gap-2">
                    <!-- 批量操作按钮 -->
                    <button
                      @click="batchMode = !batchMode"
                      class="px-3 py-1 rounded text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      :class="batchMode ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
                    >
                      {{ batchMode ? '退出批量' : '批量选择' }}
                    </button>
                    <!-- 分类标签 -->
                    <button
                      v-for="type in plantTypes"
                      :key="type.value"
                      @click="selectedType = type.value"
                      class="px-3 py-1 rounded text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      :class="selectedType === type.value ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
                    >
                      {{ type.label }}
                    </button>
                  </div>
                </div>

                <!-- 批量操作工具栏 -->
                <Transition name="fade">
                  <div v-if="batchMode" class="mb-4 p-3 bg-purple-900/30 border border-purple-600/50 rounded-lg">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            :checked="isAllSelected"
                            @change="toggleSelectAll"
                            class="w-4 h-4 rounded accent-purple-500"
                          />
                          全选
                        </label>
                        <span class="text-sm text-purple-300">
                          已选择 {{ selectedPlants.size }} 个植物
                        </span>
                      </div>
                      <div class="flex gap-2">
                        <button
                          v-if="selectedPlants.size > 0"
                          @click="batchDelete"
                          class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          <Trash2 :size="16" />
                          删除选中
                        </button>
                        <button
                          v-if="selectedPlants.size > 0"
                          @click="clearSelection"
                          class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        >
                          清空选择
                        </button>
                      </div>
                    </div>
                  </div>
                </Transition>

                <!-- 搜索框 -->
                <div class="mb-4">
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="搜索植物名称..."
                    class="w-full px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg focus:border-purple-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  />
                </div>

                <!-- 植物网格 -->
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  <PlantCard
                    v-for="plant in filteredPlants"
                    :key="plant.id"
                    :plant="plant"
                    :batch-mode="batchMode"
                    :selected="selectedPlants.has(plant.id)"
                    @edit="editPlant"
                    @delete="confirmDelete"
                    @hide="confirmHide"
                    @toggle-select="toggleSelectPlant"
                  />

                  <!-- 新建按钮卡片 -->
                  <button
                    @click="createNew"
                    class="aspect-square border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center hover:border-purple-400 hover:bg-purple-400/10 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  >
                    <Plus :size="48" class="text-gray-500 group-hover:text-purple-400 mb-2" />
                    <span class="text-gray-500 group-hover:text-purple-400">新建植物</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 右侧：表单/预览区（仅植物管理标签页显示） -->
            <div v-if="currentTab === 'plants'" class="w-[450px] p-6 overflow-y-auto">
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
                    <Sprout :size="64" class="mx-auto mb-4 opacity-50" />
                    <p>选择左侧植物进行编辑<br />或点击新建按钮</p>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- 植物预设标签页 -->
            <div v-if="currentTab === 'configs'" class="flex-1 overflow-hidden">
              <ConfigManager />
            </div>

            <!-- BP 流程标签页：BPRulesEditor（已剥 details 外壳），独占左栏全宽、内部滚动 -->
            <div v-if="currentTab === 'rules'" class="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <BPRulesEditor />
            </div>
          </div>

          <!-- 底部工具栏（仅植物管理标签页显示） -->
          <div v-if="currentTab === 'plants'" class="p-4 border-t border-gray-700/50 flex justify-between items-center">
            <div class="flex items-center gap-4 text-sm text-gray-400">
              <span>内置: {{ builtinCount }} | 自定义: {{ customCount }}</span>
              <span v-if="hiddenCount > 0" class="text-orange-400 flex items-center gap-2">
                | 已隐藏: {{ hiddenCount }}
                <button
                  @click="showRecycleBin = true"
                  class="ml-1 px-2 py-1 bg-orange-600/20 hover:bg-orange-600/40 rounded transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                >
                  <RotateCcw :size="14" /> 回收站
                </button>
              </span>
            </div>
            <ImportExport @import="handleImport" @export="handleExport" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- 回收站对话框（BaseDialog：焦点陷阱 + Esc + 回焦） -->
  <BaseDialog
    v-model="showRecycleBin"
    title="回收站（已隐藏的内置植物）"
    panel-class="max-w-2xl"
    aria-label="回收站"
  >
    <div v-if="hiddenPlants.length === 0" class="text-center text-gray-500 py-12">
      <Trash2 :size="48" class="mx-auto mb-4 opacity-50" />
      <p>回收站为空</p>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      <div
        v-for="plant in hiddenPlants"
        :key="plant.id"
        class="relative group bg-gray-800/60 rounded-xl overflow-hidden border border-orange-600/50 hover:border-orange-400 transition-colors"
      >
        <img :src="getPlantImage(plant.id)" class="w-full aspect-square object-cover opacity-60" />
        <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent flex flex-col justify-end p-3">
          <h4 class="font-bold text-white">{{ plant.name }}</h4>
          <p class="text-xs text-gray-400 truncate">{{ plant.description }}</p>
        </div>
        <button
          @click="restorePlant(plant)"
          class="absolute top-2 right-2 p-2 bg-green-600/90 hover:bg-green-500 rounded backdrop-blur opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green"
          aria-label="恢复植物"
        >
          <RotateCcw :size="16" class="text-white" />
        </button>
      </div>
    </div>

    <template #footer>
      <span class="flex-1 text-sm text-gray-400 self-center">共 {{ hiddenPlants.length }} 个已隐藏植物</span>
      <BaseButton v-if="hiddenPlants.length > 0" variant="primary" @click="restoreAll">恢复全部</BaseButton>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { getAllPlantsSync, getHiddenBuiltinPlants, hideBuiltinPlant, unhideBuiltinPlant, checkPlantInGame, getPlantImage } from '@/data/customPlants'
import { useGameStore } from '@/stores/gameStore'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { Sprout, Folder, X, Plus, Trash2, RotateCcw, SlidersHorizontal } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlantCard from './PlantCard.vue'
import PlantForm from './PlantForm.vue'
import ImportExport from './ImportExport.vue'
import ConfigManager from './ConfigManager.vue'
import BPRulesEditor from '@/components/RulesEditor/BPRulesEditor.vue'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['update:show'])

const store = useGameStore()
const toast = useToast()
const { confirm } = useConfirm()

const selectedType = ref('all')
const searchQuery = ref('')
const editingPlant = ref(null)
const isEditMode = ref(false)
const showRecycleBin = ref(false)
const batchMode = ref(false)
const selectedPlants = ref(new Set())
const currentTab = ref('plants') // 'plants' | 'configs'

const plantTypes = [
  { value: 'all', label: '全部' },
  { value: '副C', label: '副C' },
  { value: '大C', label: '大C' },
  { value: '辅助', label: '辅助' },
  { value: '前排', label: '前排' }
]

// 过滤植物列表
const filteredPlants = computed(() => {
  let plants = getAllPlantsSync()

  if (selectedType.value !== 'all') {
    plants = plants.filter(p => {
      // 支持类型为数组或包含多个类型的情况（如忧郁蘑菇既是前排也是大C）
      const plantType = p.type
      if (Array.isArray(plantType)) {
        return plantType.includes(selectedType.value)
      }
      // 支持用 "/" 或 "," 分隔的类型字符串
      if (typeof plantType === 'string' && (plantType.includes('/') || plantType.includes(','))) {
        const types = plantType.split(/\/|,/).map(t => t.trim())
        return types.includes(selectedType.value)
      }
      return plantType === selectedType.value
    })
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

// 强制刷新列表
const refreshList = () => {
  const currentType = selectedType.value
  selectedType.value = ''
  setTimeout(() => { selectedType.value = currentType }, 0)
}

// 操作方法
const close = () => emit('update:show', false)

const createNew = () => {
  editingPlant.value = {}
  isEditMode.value = false
}

const editPlant = (plant) => {
  if (plant.builtin !== false) {
    toast.warning('内置植物无法编辑')
    return
  }
  editingPlant.value = { ...plant }
  isEditMode.value = true
}

const confirmDelete = async (plant) => {
  if (plant.builtin !== false) {
    toast.warning('内置植物无法删除，请使用"隐藏"功能')
    return
  }
  if (await confirm({
    title: '删除植物',
    message: `确定删除植物"${plant.name}"？`,
    confirmText: '删除',
    variant: 'danger',
  })) {
    handleDelete(plant.id)
  }
}

const confirmHide = async (plant) => {
  // 检查用户是否已经确认过隐藏操作（全局标记）
  const CONFIRMED_ANY_HIDDEN_KEY = 'userConfirmedAnyHide'
  const hasConfirmedBefore = localStorage.getItem(CONFIRMED_ANY_HIDDEN_KEY) === 'true'

  if (hasConfirmedBefore) {
    // 用户已经确认过一次，之后所有隐藏都不再提示
    try {
      hideBuiltinPlant(plant.id)
      refreshList()
    } catch (error) {
      console.error('隐藏植物失败:', error)
      toast.error('隐藏植物失败')
    }
    return
  }

  // 检查是否在游戏中使用
  const checkResult = checkPlantInGame(plant.id, store)

  // 构造提示消息
  let message = `确定隐藏内置植物"${plant.name}"？隐藏后不会出现在植物列表中，但可以在回收站恢复。`
  if (checkResult.inUse) {
    message = `该植物正在被使用：${checkResult.locations.join('、')}。${message}`
  }
  message += '（确认后，后续隐藏内置植物将不再提示）'

  // 首次隐藏，需要确认
  if (await confirm({
    title: '隐藏内置植物',
    message,
    confirmText: '隐藏',
    variant: 'danger',
  })) {
    try {
      hideBuiltinPlant(plant.id)
      // 标记用户已经确认过隐藏操作（全局）
      localStorage.setItem(CONFIRMED_ANY_HIDDEN_KEY, 'true')
      refreshList()
    } catch (error) {
      console.error('隐藏植物失败:', error)
      toast.error('隐藏植物失败')
    }
  }
}

const restorePlant = async (plant) => {
  if (await confirm({
    title: '恢复植物',
    message: `确定恢复植物"${plant.name}"？`,
    confirmText: '恢复',
    variant: 'primary',
  })) {
    try {
      unhideBuiltinPlant(plant.id)
      refreshList()
    } catch (error) {
      console.error('恢复植物失败:', error)
      toast.error('恢复植物失败')
    }
  }
}

const restoreAll = async () => {
  if (await confirm({
    title: '恢复全部',
    message: '确定恢复所有已隐藏的内置植物？',
    confirmText: '恢复全部',
    variant: 'primary',
  })) {
    try {
      // 导入 localStorage 清除函数
      const { unhideAllBuiltinPlants } = await import('@/data/customPlants')
      unhideAllBuiltinPlants()
      refreshList()
      toast.success('已恢复所有隐藏的内置植物')
    } catch (error) {
      console.error('恢复所有植物失败:', error)
      toast.error('恢复所有植物失败')
    }
  }
}

const handleDelete = async (id) => {
  try {
    const { deleteCustomPlant } = await import('@/data/customPlants')
    await deleteCustomPlant(id)
    refreshList()
  } catch (error) {
    console.error('删除植物失败:', error)
    toast.error('删除植物失败')
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
    refreshList()
    toast.success(isEditMode.value ? '植物已更新' : '植物已创建')
  } catch (error) {
    console.error('保存植物失败:', error)
    toast.error('保存植物失败：' + error.message)
  }
}

const cancelEdit = () => {
  editingPlant.value = null
  isEditMode.value = false
}

// 批量操作方法
const isAllSelected = computed(() => {
  const customPlants = filteredPlants.value.filter(p => p.builtin === false)
  return customPlants.length > 0 && customPlants.every(p => selectedPlants.value.has(p.id))
})

const toggleSelectPlant = (plant) => {
  if (selectedPlants.value.has(plant.id)) {
    selectedPlants.value.delete(plant.id)
  } else {
    selectedPlants.value.add(plant.id)
  }
  // 强制更新（因为 Set 的更新不会触发响应式）
  selectedPlants.value = new Set(selectedPlants.value)
}

const toggleSelectAll = () => {
  const customPlants = filteredPlants.value.filter(p => p.builtin === false)
  if (isAllSelected.value) {
    // 取消全选
    selectedPlants.value.clear()
  } else {
    // 全选（只能选自定义植物）
    customPlants.forEach(p => selectedPlants.value.add(p.id))
  }
  selectedPlants.value = new Set(selectedPlants.value)
}

const clearSelection = () => {
  selectedPlants.value.clear()
  selectedPlants.value = new Set(selectedPlants.value)
}

const batchDelete = async () => {
  if (selectedPlants.value.size === 0) return

  const count = selectedPlants.value.size
  if (!await confirm({
    title: '批量删除',
    message: `确定删除选中的 ${count} 个自定义植物？`,
    confirmText: '删除',
    variant: 'danger',
  })) return

  try {
    const { deleteCustomPlant } = await import('@/data/customPlants')

    for (const plantId of selectedPlants.value) {
      await deleteCustomPlant(plantId)
    }

    selectedPlants.value.clear()
    selectedPlants.value = new Set(selectedPlants.value)

    refreshList()
    toast.success(`成功删除 ${count} 个植物`)
  } catch (error) {
    console.error('批量删除失败:', error)
    toast.error('批量删除失败')
  }
}

// 监听批量模式变化，退出时清空选择
watch(batchMode, (newVal) => {
  if (!newVal) {
    selectedPlants.value.clear()
    selectedPlants.value = new Set(selectedPlants.value)
  }
})

const handleExport = () => {
  // 导出逻辑在 ImportExport 组件中实现
}

const handleImport = () => {
  // 导入逻辑在 ImportExport 组件中实现
}

// ===== 主模态焦点陷阱（Tab 循环 + Esc 关闭 + 打开聚焦 + 关闭回焦） =====
const rootRef = ref(null)
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
let previouslyFocused = null

function trapKeydown(e) {
  // 回收站对话框打开时，焦点管理交给 BaseDialog
  if (showRecycleBin.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key === 'Tab') {
    const root = rootRef.value
    if (!root) return
    const f = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null)
    if (f.length === 0) return
    const first = f[0]
    const last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(() => props.show, (v) => {
  if (v) {
    previouslyFocused = document.activeElement
    document.addEventListener('keydown', trapKeydown)
    nextTick(() => {
      const root = rootRef.value
      if (!root) return
      const f = root.querySelector(FOCUSABLE)
      if (f) f.focus()
    })
  } else {
    document.removeEventListener('keydown', trapKeydown)
    showRecycleBin.value = false
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus()
    }
    previouslyFocused = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.removeEventListener('keydown', trapKeydown)
})
</script>

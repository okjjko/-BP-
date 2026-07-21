<template>
  <!--
    植物库管理（从 PlantManager/index.vue 抽出，PlantManager 植物 tab 与「编辑预设」对话框复用）。
    mode='global'：读写全局 IndexedDB + 全局 localStorage 隐藏列表（原植物 tab 行为）。
    mode='draft' ：操作传入的 plants/hiddenBuiltinPlants 快照副本，emit 更新，不动全局库/当前对局。
  -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <div class="flex flex-1 overflow-hidden">
      <!-- 左栏：植物网格 -->
      <div class="flex-1 flex flex-col overflow-hidden border-r border-gray-700/50">
        <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
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
              :hidden="isHidden(plant)"
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

      <!-- 右栏：表单/预览区 -->
      <div class="w-[450px] p-6 overflow-y-auto">
        <Transition name="fade" mode="out-in">
          <PlantForm
            v-if="editingPlant"
            :plant="editingPlant"
            :is-edit="isEditMode"
            :existing-ids="existingIdsForEdit"
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
    </div>

    <!-- 底部工具栏 -->
    <div class="p-4 border-t border-gray-700/50 flex justify-between items-center">
      <div class="flex items-center gap-4 text-sm text-gray-400">
        <span>内置: {{ builtinCount }} | 自定义: {{ customCount }}</span>
        <span class="flex items-center gap-2" :class="hiddenCount > 0 ? 'text-orange-400' : 'text-gray-400'">
          <span v-if="hiddenCount > 0">| 已隐藏: {{ hiddenCount }}</span>
          <button
            @click="showRecycleBin = true"
            class="ml-1 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            :class="hiddenCount > 0 ? 'bg-orange-600/20 hover:bg-orange-600/40' : 'bg-gray-700/50 hover:bg-gray-600/50'"
            :aria-label="hiddenCount > 0 ? `回收站（${hiddenCount} 个已隐藏植物）` : '回收站（空）'"
          >
            <RotateCcw :size="14" /> 回收站
          </button>
        </span>
      </div>
      <ImportExport v-if="!hideImportExport" @import="handleImport" @export="handleExport" />
    </div>
  </div>

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
        <img
          :src="plant.image"
          :alt="plant.name"
          class="w-full aspect-square object-cover opacity-60"
          @error="(e) => e.target.src = 'https://placehold.co/100x100/9370DB/white?text=图片丢失'"
        />
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
import { ref, computed, watch } from 'vue'
import { PLANTS } from '@/data/plants'
import {
  getAllPlantsSync,
  getHiddenBuiltinPlants,
  hideBuiltinPlant,
  unhideBuiltinPlant,
  checkPlantInGame,
  isPlantHidden,
  blobToBase64,
  base64ToBlob
} from '@/data/customPlants'
import { useGameStore } from '@/stores/gameStore'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { Sprout, Plus, Trash2, RotateCcw } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PlantCard from './PlantCard.vue'
import PlantForm from './PlantForm.vue'
import ImportExport from './ImportExport.vue'

const props = defineProps({
  mode: { type: String, default: 'global' }, // 'global' | 'draft'
  // draft 模式下使用的快照（配合 v-model:plants / v-model:hidden-builtin-plants）
  plants: { type: Array, default: null },
  hiddenBuiltinPlants: { type: Array, default: null },
  hideImportExport: { type: Boolean, default: false }
})
const emit = defineEmits(['update:plants', 'update:hiddenBuiltinPlants'])

const store = useGameStore()
const toast = useToast()
const { confirm } = useConfirm()

const isDraftMode = computed(() => props.mode === 'draft')

// ===== UI 状态 =====
const selectedType = ref('all')
const searchQuery = ref('')
const editingPlant = ref(null)
const isEditMode = ref(false)
const showRecycleBin = ref(false)
const batchMode = ref(false)
const selectedPlants = ref(new Set())

const plantTypes = [
  { value: 'all', label: '全部' },
  { value: '副C', label: '副C' },
  { value: '大C', label: '大C' },
  { value: '辅助', label: '辅助' },
  { value: '前排', label: '前排' }
]

// ===== draft 模式工作副本 =====
const draftPlants = ref(props.plants ? JSON.parse(JSON.stringify(props.plants)) : [])
const draftHiddenIds = ref(Array.isArray(props.hiddenBuiltinPlants) ? [...props.hiddenBuiltinPlants] : [])

// draft 副本仅在外部 props 变化时重新初始化（打开对话框时挂载即 immediate 一次）
watch(() => props.plants, (val) => {
  if (isDraftMode.value) {
    draftPlants.value = val ? JSON.parse(JSON.stringify(val)) : []
  }
}, { immediate: true })
watch(() => props.hiddenBuiltinPlants, (val) => {
  if (isDraftMode.value) {
    draftHiddenIds.value = Array.isArray(val) ? [...val] : []
  }
}, { immediate: true })

const commitDraft = () => {
  if (!isDraftMode.value) return
  emit('update:plants', [...draftPlants.value])
  emit('update:hiddenBuiltinPlants', [...draftHiddenIds.value])
}

// ===== 数据源（双模式） =====
const allPlants = computed(() => {
  if (isDraftMode.value) {
    const hidden = new Set(draftHiddenIds.value)
    return [...PLANTS.filter(p => !hidden.has(p.id)), ...draftPlants.value]
  }
  // global：依赖缓存版本号，隐藏/恢复/增删后由 triggerPlantCacheUpdate 驱动重算
  const _v = store._plantCacheVersion
  return getAllPlantsSync()
})

const filteredPlants = computed(() => {
  let plants = allPlants.value

  if (selectedType.value !== 'all') {
    plants = plants.filter(p => {
      const plantType = p.type
      if (Array.isArray(plantType)) {
        return plantType.includes(selectedType.value)
      }
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

const builtinCount = computed(() => allPlants.value.filter(p => p.builtin !== false).length)
const customCount = computed(() => allPlants.value.filter(p => p.builtin === false).length)
const hiddenPlants = computed(() => {
  if (isDraftMode.value) return PLANTS.filter(p => draftHiddenIds.value.includes(p.id))
  const _v = store._plantCacheVersion
  return getHiddenBuiltinPlants()
})
const hiddenCount = computed(() => hiddenPlants.value.length)

const isHidden = (plant) => {
  if (plant.builtin === false) return false
  return isDraftMode.value
    ? draftHiddenIds.value.includes(plant.id)
    : isPlantHidden(plant.id)
}

// PlantForm 的 ID 校验列表：draft 模式传 [内置 id + 其他草稿植物 id]（排除自身）；global 传 null（查 IndexedDB）
const existingIdsForEdit = computed(() => {
  if (!isDraftMode.value) return null
  const selfId = isEditMode.value ? editingPlant.value?.id : null
  return [
    ...PLANTS.map(p => p.id),
    ...draftPlants.value.map(p => p.id)
  ].filter(id => id !== selfId)
})

// ===== 刷新 =====
const refreshList = () => {
  if (isDraftMode.value) return // draft 数据在内存，无需 trigger
  store.triggerPlantCacheUpdate()
}

// ===== 编辑/新建 =====
const createNew = () => {
  editingPlant.value = {}
  isEditMode.value = false
}

const editPlant = async (plant) => {
  if (plant.builtin !== false) {
    toast.warning('内置植物无法编辑')
    return
  }
  if (isDraftMode.value) {
    // 预设副本植物的 image 是 Base64，PlantForm/ImageUploader 需要 Blob
    let imageData = null
    if (plant.image) {
      try {
        imageData = await base64ToBlob(plant.image)
      } catch (error) {
        console.error('转换图片失败:', error)
      }
    }
    editingPlant.value = { ...plant, imageData }
  } else {
    editingPlant.value = { ...plant }
  }
  isEditMode.value = true
}

const cancelEdit = () => {
  editingPlant.value = null
  isEditMode.value = false
}

// ===== 保存（双模式） =====
const handleSave = async (plantData) => {
  if (isDraftMode.value) {
    await handleSaveDraft(plantData)
    return
  }
  // global：写 IndexedDB
  try {
    const { addCustomPlant, updateCustomPlant, updateCustomPlantId } = await import('@/data/customPlants')
    if (isEditMode.value) {
      const oldId = editingPlant.value.id
      const newId = plantData.id
      if (oldId !== newId) {
        const { id, ...updates } = plantData
        await updateCustomPlantId(oldId, newId, updates)
      } else {
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

const handleSaveDraft = async (plantData) => {
  try {
    if (isEditMode.value) {
      const idx = draftPlants.value.findIndex(p => p.id === editingPlant.value.id)
      if (idx === -1) return
      const old = draftPlants.value[idx]
      // 新上传图片→转 Base64；未换图→沿用 old.image
      const imageChanged = plantData.imageData && plantData.imageData !== editingPlant.value.imageData
      const imageBase64 = imageChanged ? await blobToBase64(plantData.imageData) : old.image
      const newPlant = {
        ...old,
        id: plantData.id || old.id,
        name: plantData.name,
        description: plantData.description,
        type: plantData.type,
        image: imageBase64,
        updatedAt: new Date().toISOString()
      }
      draftPlants.value = draftPlants.value.map((p, i) => (i === idx ? newPlant : p))
    } else {
      const imageBase64 = plantData.imageData ? await blobToBase64(plantData.imageData) : ''
      draftPlants.value = [...draftPlants.value, {
        id: plantData.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        name: plantData.name,
        description: plantData.description,
        type: plantData.type,
        image: imageBase64,
        builtin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    }
    commitDraft()
    cancelEdit()
    toast.success(isEditMode.value ? '植物已更新' : '植物已创建')
  } catch (error) {
    console.error('保存植物失败:', error)
    toast.error('保存植物失败：' + error.message)
  }
}

// ===== 删除（双模式） =====
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

const handleDelete = async (id) => {
  if (isDraftMode.value) {
    draftPlants.value = draftPlants.value.filter(p => p.id !== id)
    commitDraft()
    return
  }
  try {
    const { deleteCustomPlant } = await import('@/data/customPlants')
    await deleteCustomPlant(id)
    refreshList()
  } catch (error) {
    console.error('删除植物失败:', error)
    toast.error('删除植物失败')
  }
}

// ===== 隐藏/恢复（双模式） =====
const confirmHide = async (plant) => {
  if (isDraftMode.value) {
    // draft：直接操作副本，不写全局 localStorage、不触发"首次确认"全局标记
    if (!draftHiddenIds.value.includes(plant.id)) {
      draftHiddenIds.value = [...draftHiddenIds.value, plant.id]
      commitDraft()
    }
    return
  }
  // global：首次需确认 + 写全局 localStorage
  const CONFIRMED_ANY_HIDDEN_KEY = 'userConfirmedAnyHide'
  const hasConfirmedBefore = localStorage.getItem(CONFIRMED_ANY_HIDDEN_KEY) === 'true'

  if (hasConfirmedBefore) {
    try {
      hideBuiltinPlant(plant.id)
      refreshList()
    } catch (error) {
      console.error('隐藏植物失败:', error)
      toast.error('隐藏植物失败')
    }
    return
  }

  const checkResult = checkPlantInGame(plant.id, store)
  let message = `确定隐藏内置植物"${plant.name}"？隐藏后不会出现在植物列表中，但可以在回收站恢复。`
  if (checkResult.inUse) {
    message = `该植物正在被使用：${checkResult.locations.join('、')}。${message}`
  }
  message += '（确认后，后续隐藏内置植物将不再提示）'

  if (await confirm({
    title: '隐藏内置植物',
    message,
    confirmText: '隐藏',
    variant: 'danger',
  })) {
    try {
      hideBuiltinPlant(plant.id)
      localStorage.setItem(CONFIRMED_ANY_HIDDEN_KEY, 'true')
      refreshList()
    } catch (error) {
      console.error('隐藏植物失败:', error)
      toast.error('隐藏植物失败')
    }
  }
}

const restorePlant = async (plant) => {
  if (isDraftMode.value) {
    draftHiddenIds.value = draftHiddenIds.value.filter(id => id !== plant.id)
    commitDraft()
    return
  }
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
  if (isDraftMode.value) {
    draftHiddenIds.value = []
    commitDraft()
    return
  }
  if (await confirm({
    title: '恢复全部',
    message: '确定恢复所有已隐藏的内置植物？',
    confirmText: '恢复全部',
    variant: 'primary',
  })) {
    try {
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

// ===== 批量（双模式） =====
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
  selectedPlants.value = new Set(selectedPlants.value)
}

const toggleSelectAll = () => {
  const customPlants = filteredPlants.value.filter(p => p.builtin === false)
  if (isAllSelected.value) {
    selectedPlants.value.clear()
  } else {
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

  if (isDraftMode.value) {
    const ids = new Set(selectedPlants.value)
    draftPlants.value = draftPlants.value.filter(p => !ids.has(p.id))
    selectedPlants.value.clear()
    selectedPlants.value = new Set(selectedPlants.value)
    commitDraft()
    toast.success(`成功删除 ${count} 个植物`)
    return
  }

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

watch(batchMode, (newVal) => {
  if (!newVal) {
    selectedPlants.value.clear()
    selectedPlants.value = new Set(selectedPlants.value)
  }
})

// ===== 导入导出桥接（仅 global；draft 模式隐藏 ImportExport） =====
const handleExport = () => {
  // 导出逻辑在 ImportExport 组件中实现
}
const handleImport = () => {
  // ImportExport 内部 await 完成 IndexedDB 写入与 updateCache 后才 emit('import')
  refreshList()
}
</script>

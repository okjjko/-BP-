<template>
  <div class="flex gap-2">
    <!-- 导出按钮 -->
    <button
      @click="exportData"
      :disabled="isExporting"
      class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
    >
      <Loader2 v-if="isExporting" :size="16" class="animate-spin" />
      <Download v-else :size="16" />
      导出
    </button>

    <!-- 导入按钮 -->
    <button
      @click="triggerImport"
      :disabled="isImporting"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <Loader2 v-if="isImporting" :size="16" class="animate-spin" />
      <Upload v-else :size="16" />
      导入
    </button>

    <input
      ref="fileInput"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleImport"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { loadCustomPlants, addCustomPlant, blobToBase64, base64ToBlob, getHiddenPlants, updateCustomPlant } from '@/data/customPlants'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { Download, Upload, Loader2 } from 'lucide-vue-next'

// 当前导出格式版本
const EXPORT_VERSION = '2.0'

const emit = defineEmits(['import', 'export'])
const fileInput = ref(null)
const isExporting = ref(false)
const isImporting = ref(false)
const toast = useToast()
const { confirm } = useConfirm()

/**
 * 验证单个植物数据完整性
 */
function validatePlantData(plant) {
  const errors = []
  if (!plant.id || typeof plant.id !== 'string') errors.push('缺少有效ID')
  if (!plant.name || typeof plant.name !== 'string') errors.push('缺少名称')
  if (!plant.description || typeof plant.description !== 'string') errors.push('缺少描述')
  if (!plant.type || typeof plant.type !== 'string') errors.push('缺少类型')
  if (!plant.image && !plant.imageData) errors.push('缺少图片')
  return { valid: errors.length === 0, errors }
}

/**
 * 验证导出文件结构
 */
function validateExportFile(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '文件内容不是有效的JSON对象' }
  }

  if (!data.version) {
    return { valid: false, error: '缺少版本号，可能是不兼容的旧格式文件' }
  }

  if (!data.plants || !Array.isArray(data.plants)) {
    return { valid: false, error: '缺少植物数据列表' }
  }

  // 版本兼容性检查
  const [major] = data.version.split('.').map(Number)
  if (major > Number(EXPORT_VERSION.split('.')[0])) {
    return { valid: false, error: `文件版本 ${data.version} 高于当前支持版本 ${EXPORT_VERSION}，请更新应用` }
  }

  return { valid: true }
}

const exportData = async () => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const customPlants = await loadCustomPlants()
    const hiddenBuiltinPlants = getHiddenPlants()

    if (customPlants.length === 0 && hiddenBuiltinPlants.length === 0) {
      toast.warning('没有自定义植物可以导出，也没有隐藏的内置植物')
      return
    }

    // 转换为导出格式（图片转Base64）
    const plantsToExport = await Promise.all(
      customPlants.map(async (plant) => {
        let imageBase64 = ''
        if (plant.imageData instanceof Blob) {
          imageBase64 = await blobToBase64(plant.imageData)
        } else {
          imageBase64 = plant.image || ''
        }

        return {
          id: plant.id,
          name: plant.name,
          description: plant.description,
          type: plant.type,
          image: imageBase64,
          builtin: false,
          createdAt: plant.createdAt,
          updatedAt: plant.updatedAt
        }
      })
    )

    const data = {
      version: EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      plantCount: plantsToExport.length,
      hiddenCount: hiddenBuiltinPlants.length,
      plants: plantsToExport,
      hiddenBuiltinPlants: hiddenBuiltinPlants
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `bp_plants_v${EXPORT_VERSION}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()

    URL.revokeObjectURL(url)

    emit('export')
    const messages = []
    if (customPlants.length > 0) messages.push(`${customPlants.length} 个自定义植物`)
    if (hiddenBuiltinPlants.length > 0) messages.push(`${hiddenBuiltinPlants.length} 个隐藏的内置植物`)
    toast.success(`已导出：${messages.join('，')}`)
  } catch (error) {
    console.error('导出失败', error)
    toast.error('导出失败：' + error.message)
  } finally {
    isExporting.value = false
  }
}

const triggerImport = () => {
  fileInput.value?.click()
}

const handleImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  isImporting.value = true
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)

      // 验证文件结构
      const fileValidation = validateExportFile(data)
      if (!fileValidation.valid) {
        throw new Error(fileValidation.error)
      }

      // 验证每个植物数据
      const validationResults = data.plants.map(p => ({ plant: p, ...validatePlantData(p) }))
      const invalidPlants = validationResults.filter(r => !r.valid)

      if (invalidPlants.length > 0) {
        toast.warning(`发现 ${invalidPlants.length} 个无效植物数据，将被跳过`, { duration: 5000 })
      }

      // 只导入有效的植物
      const validPlants = validationResults.filter(r => r.valid).map(r => r.plant)

      if (validPlants.length === 0 && (!data.hiddenBuiltinPlants || data.hiddenBuiltinPlants.length === 0)) {
        toast.warning('没有可导入的有效数据')
        return
      }

      // 处理隐藏的内置植物列表
      let hiddenImported = false
      if (data.hiddenBuiltinPlants && Array.isArray(data.hiddenBuiltinPlants)) {
        const currentHidden = getHiddenPlants()
        const importedHidden = data.hiddenBuiltinPlants

        const hasDifferences =
          importedHidden.length !== currentHidden.length ||
          importedHidden.some(id => !currentHidden.includes(id)) ||
          currentHidden.some(id => !importedHidden.includes(id))

        if (hasDifferences && importedHidden.length > 0) {
          const replaceHidden = await confirm({
            title: '隐藏植物设置',
            message: `配置文件包含 ${importedHidden.length} 个隐藏的内置植物，当前你有 ${currentHidden.length} 个。确认使用配置文件的隐藏列表（替换），取消则保留当前设置。`,
            confirmText: '替换',
            cancelText: '保留',
            variant: 'primary',
          })
          if (replaceHidden) {
            localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(importedHidden))
            hiddenImported = true
          }
        }
      }

      if (validPlants.length === 0) {
        if (hiddenImported) {
          toast.success('成功导入隐藏的内置植物设置')
          setTimeout(() => window.location.reload(), 1500)
        }
        return
      }

      // 处理冲突
      const existingPlants = await loadCustomPlants()
      const existingNames = new Set(existingPlants.map(p => p.name))
      const conflicts = validPlants.filter(p => existingNames.has(p.name))

      let plantsToAdd = validPlants
      let plantsToUpdate = []

      if (conflicts.length > 0) {
        const overwrite = await confirm({
          title: '名称重复',
          message: `发现 ${conflicts.length} 个名称重复的植物：${conflicts.map(p => p.name).join('、')}。确认覆盖这些植物，取消则跳过重复植物。`,
          confirmText: '覆盖',
          cancelText: '跳过',
          variant: 'danger',
        })
        if (overwrite) {
          plantsToUpdate = conflicts
          plantsToAdd = validPlants.filter(p => !existingNames.has(p.name))
        } else {
          plantsToAdd = validPlants.filter(p => !existingNames.has(p.name))
        }
      }

      // 更新冲突的植物
      let updatedCount = 0
      for (const plant of plantsToUpdate) {
        try {
          const existingPlant = existingPlants.find(p => p.name === plant.name)
          if (!existingPlant) continue

          let imageBlob
          if (plant.image.startsWith('data:')) {
            imageBlob = await base64ToBlob(plant.image)
          } else {
            const response = await fetch(plant.image)
            imageBlob = await response.blob()
          }

          await updateCustomPlant(existingPlant.id, {
            name: plant.name,
            description: plant.description,
            type: plant.type,
            imageData: imageBlob,
            imageType: imageBlob.type
          })
          updatedCount++
        } catch (error) {
          console.error(`更新植物 ${plant.name} 失败:`, error)
        }
      }

      // 添加新植物
      let addedCount = 0
      for (const plant of plantsToAdd) {
        try {
          let imageBlob
          if (plant.image.startsWith('data:')) {
            imageBlob = await base64ToBlob(plant.image)
          } else {
            const response = await fetch(plant.image)
            imageBlob = await response.blob()
          }

          await addCustomPlant({
            name: plant.name,
            description: plant.description,
            type: plant.type,
            imageData: imageBlob,
            imageType: imageBlob.type
          })
          addedCount++
        } catch (error) {
          console.error(`导入植物 ${plant.name} 失败:`, error)
        }
      }

      emit('import', addedCount + updatedCount)

      const messages = []
      if (addedCount > 0) messages.push(`添加 ${addedCount} 个新植物`)
      if (updatedCount > 0) messages.push(`更新 ${updatedCount} 个植物`)
      if (invalidPlants.length > 0) messages.push(`跳过 ${invalidPlants.length} 个无效植物`)
      if (hiddenImported) messages.push(`${data.hiddenBuiltinPlants.length} 个隐藏的内置植物设置`)

      toast.success(`导入结果：${messages.join('，')}`, { duration: 5000 })

      if (hiddenImported) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch (error) {
      console.error('导入失败', error)
      toast.error('导入失败：' + (error.message || '文件格式错误或已损坏'))
    } finally {
      isImporting.value = false
    }
  }

  reader.readAsText(file)
  event.target.value = ''
}
</script>

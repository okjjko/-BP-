<template>
  <div class="flex gap-2">
    <!-- 导出按钮 -->
    <button
      @click="exportData"
      class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l4-4m4 4V4" />
      </svg>
      导出
    </button>

    <!-- 导入按钮 -->
    <button
      @click="triggerImport"
      class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l4-4m4 4V4" />
      </svg>
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

const emit = defineEmits(['import', 'export'])
const fileInput = ref(null)

const exportData = async () => {
  try {
    // 加载所有自定义植物
    const customPlants = await loadCustomPlants()

    // 获取隐藏的内置植物列表
    const hiddenBuiltinPlants = getHiddenPlants()

    if (customPlants.length === 0 && hiddenBuiltinPlants.length === 0) {
      alert('没有自定义植物可以导出，也没有隐藏的内置植物')
      return
    }

    // 转换为导出格式（图片转Base64）
    const plantsToExport = await Promise.all(
      customPlants.map(async (plant) => {
        let imageBase64 = ''

        if (plant.imageData instanceof Blob) {
          imageBase64 = await blobToBase64(plant.imageData)
        } else {
          // 如果是URL，直接使用
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
      version: '1.0',
      exportDate: new Date().toISOString(),
      plants: plantsToExport,
      // 新增：隐藏的内置植物列表
      hiddenBuiltinPlants: hiddenBuiltinPlants
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `plants_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()

    URL.revokeObjectURL(url)

    emit('export')
    const messages = []
    if (customPlants.length > 0) messages.push(`${customPlants.length} 个自定义植物`)
    if (hiddenBuiltinPlants.length > 0) messages.push(`${hiddenBuiltinPlants.length} 个隐藏的内置植物`)
    alert(`已导出：${messages.join('，')}`)
  } catch (error) {
    console.error('导出失败', error)
    alert('导出失败：' + error.message)
  }
}

const triggerImport = () => {
  fileInput.value?.click()
}

const handleImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)

      // 验证数据格式
      if (!data.plants || !Array.isArray(data.plants)) {
        throw new Error('无效的文件格式')
      }

      // 验证每个植物
      const invalidPlants = data.plants.filter(p =>
        !p.id || !p.name || !p.description || !p.type || !p.image
      )

      if (invalidPlants.length > 0) {
        alert(`文件包含 ${invalidPlants.length} 个无效植物，无法导入`)
        return
      }

      // 处理隐藏的内置植物列表
      let hiddenImported = false
      if (data.hiddenBuiltinPlants && Array.isArray(data.hiddenBuiltinPlants)) {
        const currentHidden = getHiddenPlants()
        const importedHidden = data.hiddenBuiltinPlants

        // 检查是否有差异
        const hasDifferences =
          importedHidden.length !== currentHidden.length ||
          importedHidden.some(id => !currentHidden.includes(id)) ||
          currentHidden.some(id => !importedHidden.includes(id))

        if (hasDifferences && importedHidden.length > 0) {
          const message =
            `配置文件包含 ${importedHidden.length} 个隐藏的内置植物。\n\n` +
            `当前你有 ${currentHidden.length} 个隐藏的内置植物。\n\n` +
            `选择操作方式：\n` +
            `• "确定" - 使用配置文件的隐藏列表（替换）\n` +
            `• "取消" - 保留当前的隐藏列表（跳过）`

          if (confirm(message)) {
            // 应用配置文件的隐藏列表
            localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(importedHidden))
            hiddenImported = true
            console.log(`已应用 ${importedHidden.length} 个隐藏的内置植物`)
          }
        }
      }

      // 加载现有自定义植物
      const existingPlants = await loadCustomPlants()
      const existingNames = new Set(existingPlants.map(p => p.name))
      const conflicts = data.plants.filter(p => existingNames.has(p.name))

      let plantsToAdd = data.plants
      let plantsToUpdate = []

      if (conflicts.length > 0) {
        const message = `发现 ${conflicts.length} 个名称重复的植物：\n${conflicts.map(p => p.name).join(', ')}\n\n点击"确定"覆盖这些植物，"取消"跳过重复植物`
        if (confirm(message)) {
          // 需要更新的植物（名称冲突的）
          plantsToUpdate = conflicts
          // 只添加不冲突的植物
          plantsToAdd = data.plants.filter(p => !existingNames.has(p.name))
        } else {
          // 跳过冲突的植物
          plantsToAdd = data.plants.filter(p => !existingNames.has(p.name))
        }
      }

      // 更新冲突的植物（按名称匹配）
      let updatedCount = 0
      for (const plant of plantsToUpdate) {
        try {
          // 根据名称找到现有植物的ID
          const existingPlant = existingPlants.find(p => p.name === plant.name)
          if (!existingPlant) {
            console.error(`未找到名为 "${plant.name}" 的现有植物`)
            continue
          }

          // 转换Base64为Blob
          let imageBlob
          if (plant.image.startsWith('data:')) {
            imageBlob = await base64ToBlob(plant.image)
          } else {
            const response = await fetch(plant.image)
            imageBlob = await response.blob()
          }

          // 使用现有植物的ID进行更新（保留ID，更新其他信息）
          await updateCustomPlant(existingPlant.id, {
            name: plant.name, // 保持名称一致
            description: plant.description,
            type: plant.type,
            imageData: imageBlob,
            imageType: imageBlob.type
          })
          updatedCount++
          console.log(`已更新植物: ${plant.name} (ID: ${existingPlant.id})`)
        } catch (error) {
          console.error(`更新植物 ${plant.name} 失败:`, error)
        }
      }

      // 添加新植物
      let addedCount = 0
      for (const plant of plantsToAdd) {
        try {
          // 转换Base64为Blob
          let imageBlob
          if (plant.image.startsWith('data:')) {
            imageBlob = await base64ToBlob(plant.image)
          } else {
            // 如果是URL，使用fetch获取Blob
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

      // 构建导入结果消息
      const messages = []
      if (addedCount > 0) messages.push(`添加 ${addedCount} 个新植物`)
      if (updatedCount > 0) messages.push(`更新 ${updatedCount} 个植物`)
      if (hiddenImported) messages.push(`${data.hiddenBuiltinPlants.length} 个隐藏的内置植物设置`)

      if (messages.length > 0) {
        alert(`成功导入：${messages.join('，')}`)
      } else {
        alert('导入完成')
      }

      // 如果导入了隐藏设置，刷新页面以应用更改
      if (hiddenImported) {
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (error) {
      console.error('导入失败', error)
      alert('导入失败：文件格式错误或已损坏')
    }
  }

  reader.readAsText(file)
  event.target.value = ''
}
</script>

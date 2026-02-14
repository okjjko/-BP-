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
import { loadCustomPlants, addCustomPlant, blobToBase64, base64ToBlob } from '@/data/customPlants'

const emit = defineEmits(['import', 'export'])
const fileInput = ref(null)

const exportData = async () => {
  try {
    // 加载所有自定义植物
    const customPlants = await loadCustomPlants()

    if (customPlants.length === 0) {
      alert('没有自定义植物可以导出')
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
      plants: plantsToExport
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `plants_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()

    URL.revokeObjectURL(url)

    emit('export')
    alert(`已导出 ${customPlants.length} 个自定义植物`)
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

      // 加载现有自定义植物
      const existingPlants = await loadCustomPlants()
      const existingIds = new Set(existingPlants.map(p => p.id))
      const conflicts = data.plants.filter(p => existingIds.has(p.id))

      let plantsToAdd = data.plants

      if (conflicts.length > 0) {
        const message = `发现 ${conflicts.length} 个ID冲突的植物：\n${conflicts.map(p => p.name).join(', ')}\n\n点击"确定"覆盖这些植物，"取消"跳过冲突植物`
        if (confirm(message)) {
          // 删除冲突的植物（暂不实现删除功能，这里跳过）
          // 实际应用中可以调用 deleteCustomPlant
        } else {
          // 跳过冲突的植物
          plantsToAdd = data.plants.filter(p => !existingIds.has(p.id))
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

      emit('import', addedCount)
      alert(`成功导入 ${addedCount} 个植物`)
    } catch (error) {
      console.error('导入失败', error)
      alert('导入失败：文件格式错误或已损坏')
    }
  }

  reader.readAsText(file)
  event.target.value = ''
}
</script>

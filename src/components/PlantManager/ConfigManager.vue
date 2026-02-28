<template>
  <div class="config-manager flex flex-col h-full">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <h3 class="text-xl font-bold text-purple-400">📁 配置管理</h3>
        <span v-if="activeConfig" class="text-sm text-gray-400">
          当前: <span class="text-green-400">{{ activeConfig.name }}</span>
        </span>
      </div>
      <div class="flex gap-2">
        <button
          @click="showSaveDialog = true"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          保存当前配置
        </button>
        <button
          @click="triggerImport"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l4-4m4 4V4" />
          </svg>
          导入配置
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleImport"
        />
      </div>
    </div>

    <!-- 配置列表 -->
    <div v-if="configs.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center text-gray-500">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p>还没有保存的配置</p>
        <p class="text-sm mt-2">点击"保存当前配置"来创建第一个配置</p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="config in configs"
          :key="config.id"
          class="config-card glass-panel rounded-xl p-4 transition-all duration-300"
          :class="{ 'active': config.id === activeConfigId }"
        >
          <!-- 配置头部 -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h4 class="font-bold text-lg text-white mb-1">{{ config.name }}</h4>
              <p v-if="config.description" class="text-sm text-gray-400 line-clamp-2">
                {{ config.description }}
              </p>
              <p v-else class="text-sm text-gray-500 italic">无描述</p>
            </div>
            <span v-if="config.id === activeConfigId" class="active-badge px-2 py-1 bg-green-600 text-white text-xs rounded-full">
              ✓ 当前配置
            </span>
          </div>

          <!-- 配置统计 -->
          <div class="flex items-center gap-4 mb-4 text-sm">
            <span class="flex items-center gap-1 text-gray-400">
              🌱 {{ config.plants.length }} 个植物
            </span>
            <span v-if="config.hiddenBuiltinPlants.length > 0" class="flex items-center gap-1 text-gray-400">
              🚫 {{ config.hiddenBuiltinPlants.length }} 个隐藏
            </span>
          </div>

          <!-- 配置时间 -->
          <div class="text-xs text-gray-500 mb-4">
            创建于 {{ formatDate(config.createdAt) }}
          </div>

          <!-- 操作按钮 -->
          <div class="flex flex-wrap gap-2">
            <button
              @click="handleLoad(config.id)"
              :disabled="config.id === activeConfigId"
              class="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              加载
            </button>
            <button
              @click="handleRename(config.id)"
              class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
            >
              重命名
            </button>
            <button
              @click="handleExport(config.id)"
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
            >
              导出
            </button>
            <button
              @click="handleDelete(config.id)"
              :disabled="config.id === activeConfigId && configs.length === 1"
              class="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存配置对话框 -->
    <Transition name="fade">
      <div v-if="showSaveDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showSaveDialog = false"></div>
        <div class="relative glass-card rounded-2xl w-full max-w-md p-6">
          <h3 class="text-xl font-bold mb-4">💾 保存当前配置</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">配置名称 *</label>
              <input
                v-model="newConfigName"
                type="text"
                placeholder="例如：标准赛、娱乐赛..."
                class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                maxlength="50"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">配置描述（可选）</label>
              <textarea
                v-model="newConfigDesc"
                placeholder="描述这个配置的用途..."
                class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none resize-none"
                rows="3"
                maxlength="100"
              ></textarea>
            </div>
            <div class="flex gap-3">
              <button
                @click="confirmSave"
                :disabled="!newConfigName.trim()"
                class="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                保存
              </button>
              <button
                @click="showSaveDialog = false"
                class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 重命名对话框 -->
    <Transition name="fade">
      <div v-if="showRenameDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showRenameDialog = false"></div>
        <div class="relative glass-card rounded-2xl w-full max-w-md p-6">
          <h3 class="text-xl font-bold mb-4">✏️ 重命名配置</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">新名称</label>
              <input
                v-model="renameValue"
                type="text"
                class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                maxlength="50"
              />
            </div>
            <div class="flex gap-3">
              <button
                @click="confirmRename"
                :disabled="!renameValue.trim()"
                class="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                确认
              </button>
              <button
                @click="showRenameDialog = false"
                class="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getAllConfigs,
  getActiveConfig,
  saveConfig,
  loadConfig,
  deleteConfig,
  renameConfig,
  exportConfig,
  importConfig,
  setActiveConfig
} from '@/data/plantConfigs'

const emit = defineEmits(['configLoaded'])

// 状态
const configs = ref([])
const activeConfigId = ref(null)
const activeConfig = computed(() => configs.value.find(c => c.id === activeConfigId.value))

// 对话框状态
const showSaveDialog = ref(false)
const showRenameDialog = ref(false)
const newConfigName = ref('')
const newConfigDesc = ref('')
const renameConfigId = ref(null)
const renameValue = ref('')

// 文件输入
const fileInput = ref(null)

// 加载配置列表
const loadConfigs = async () => {
  configs.value = await getAllConfigs()
  const active = await getActiveConfig()
  activeConfigId.value = active ? active.id : null
}

// 格式化日期
const formatDate = (isoString) => {
  const date = new Date(isoString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

// 保存配置
const confirmSave = async () => {
  if (!newConfigName.value.trim()) return

  try {
    await saveConfig(newConfigName.value.trim(), newConfigDesc.value.trim())
    await loadConfigs()
    showSaveDialog.value = false
    newConfigName.value = ''
    newConfigDesc.value = ''
    alert('配置已保存')
  } catch (error) {
    alert('保存失败: ' + error.message)
  }
}

// 加载配置
const handleLoad = async (configId) => {
  const config = configs.value.find(c => c.id === configId)
  const message = `确定要加载配置"${config.name}"吗？\n\n当前的自定义植物和隐藏设置将被替换。`

  if (!confirm(message)) return

  try {
    await loadConfig(configId)
    alert(`配置"${config.name}"已加载，页面即将刷新...`)
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } catch (error) {
    alert('加载失败: ' + error.message)
  }
}

// 重命名配置
const handleRename = (configId) => {
  const config = configs.value.find(c => c.id === configId)
  renameConfigId.value = configId
  renameValue.value = config.name
  showRenameDialog.value = true
}

const confirmRename = async () => {
  if (!renameValue.value.trim()) return

  try {
    await renameConfig(renameConfigId.value, renameValue.value.trim())
    await loadConfigs()
    showRenameDialog.value = false
    alert('配置已重命名')
  } catch (error) {
    alert('重命名失败: ' + error.message)
  }
}

// 导出配置
const handleExport = async (configId) => {
  try {
    await exportConfig(configId)
    alert('配置已导出')
  } catch (error) {
    alert('导出失败: ' + error.message)
  }
}

// 删除配置
const handleDelete = async (configId) => {
  const config = configs.value.find(c => c.id === configId)
  const message = `确定要删除配置"${config.name}"吗？\n\n此操作无法撤销。`

  if (!confirm(message)) return

  try {
    await deleteConfig(configId)
    await loadConfigs()
    alert('配置已删除')
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

// 触发导入
const triggerImport = () => {
  fileInput.value?.click()
}

// 处理导入
const handleImport = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)
      const imported = await importConfig(data)
      await loadConfigs()
      alert(`配置"${imported.name}"已导入`)
    } catch (error) {
      alert('导入失败: ' + error.message)
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

// 初始化
onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.config-card {
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.config-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.config-card.active {
  border-color: #22c55e;
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.2);
}

.active-badge {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(147, 51, 234, 0.5);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(147, 51, 234, 0.7);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

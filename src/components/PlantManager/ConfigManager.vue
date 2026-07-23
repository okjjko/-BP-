<template>
  <div class="config-manager flex flex-col h-full">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <h3 class="text-xl font-bold text-purple-400 flex items-center gap-2">
          <Folder :size="20" /> 比赛预设
        </h3>
        <span v-if="activeConfig" class="text-sm text-gray-400">
          当前: <span class="text-green-400">{{ activeConfig.name }}</span>
        </span>
      </div>
      <div class="flex gap-2">
        <button
          @click="showSaveDialog = true"
          class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <Save :size="16" />
          保存当前配置
        </button>
        <button
          @click="triggerImport"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <Upload :size="16" />
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
        <FolderOpen :size="64" class="mx-auto mb-4 opacity-50" />
        <p>还没有保存的配置</p>
        <p class="text-sm mt-2">点击"保存当前配置"来创建第一个配置</p>
      </div>
    </div>

    <div v-else class="flex-1 overflow-y-auto custom-scrollbar">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="config in sortedConfigs"
          :key="config.id"
          class="config-card glass-panel rounded-xl p-4 transition-colors duration-200"
          :class="{ 'active': config.id === activeConfigId, 'config-card-default': config.isDefault }"
        >
          <!-- 配置头部 -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h4 class="font-bold text-lg text-white mb-1 flex items-center gap-2">
                {{ config.name }}
                <span v-if="config.isDefault" class="px-2 py-0.5 bg-purple-600/30 text-purple-300 text-[10px] rounded-full border border-purple-500/40">默认</span>
              </h4>
              <p v-if="config.description" class="text-sm text-gray-400 line-clamp-2">
                {{ config.description }}
              </p>
              <p v-else class="text-sm text-gray-500 italic">无描述</p>
            </div>
            <span v-if="config.id === activeConfigId" class="active-badge px-2 py-1 bg-green-600 text-white text-xs rounded-full flex items-center gap-1">
              <Check :size="12" /> 当前
            </span>
          </div>

          <!-- 配置统计 -->
          <div class="flex items-center gap-4 mb-4 text-sm">
            <span v-if="config.isDefault" class="flex items-center gap-1 text-gray-400">
              <Sprout :size="14" /> 全部内置植物
            </span>
            <span v-else class="flex items-center gap-1 text-gray-400">
              <Sprout :size="14" /> {{ config.plants.length }} 个植物
            </span>
            <span v-if="!config.isDefault && config.hiddenBuiltinPlants.length > 0" class="flex items-center gap-1 text-gray-400">
              <Ban :size="14" /> {{ config.hiddenBuiltinPlants.length }} 个隐藏
            </span>
            <span v-if="config.ruleConfig" class="flex items-center gap-1 text-pick-blue" title="含自定义比赛规则（BP 流程/上限/南瓜/阵营/选边）">
              <SlidersHorizontal :size="14" /> 含规则
            </span>
          </div>

          <!-- 配置时间（默认预设 createdAt 为 null，显示系统标记） -->
          <div v-if="!config.isDefault" class="text-xs text-gray-500 mb-4">
            创建于 {{ formatDate(config.createdAt) }}
          </div>
          <div v-else class="text-xs text-gray-600 mb-4 italic">系统预设 · 不可修改</div>

          <!-- 操作按钮 -->
          <div class="flex flex-wrap gap-2">
            <button
              @click="handleLoad(config.id)"
              :disabled="config.id === activeConfigId"
              class="flex-1 min-h-[40px] px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
            >
              加载
            </button>

            <!-- 默认预设：复制 + 导出（不可编辑/重命名/删除） -->
            <template v-if="config.isDefault">
              <button
                @click="handleDuplicate(config.id)"
                class="min-h-[40px] px-3 py-1.5 bg-pick-blue hover:bg-pick-blue-hover text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue flex items-center gap-1"
              >
                <Copy :size="14" /> 复制
              </button>
              <button
                @click="handleExport(config.id)"
                class="min-h-[40px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                导出
              </button>
            </template>

            <!-- 普通预设：重命名 + 编辑预设 + 导出 + 删除 -->
            <template v-else>
              <button
                @click="handleRename(config.id)"
                class="min-h-[40px] px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                重命名
              </button>
              <button
                @click="handleEditPreset(config)"
                class="min-h-[40px] px-3 py-1.5 bg-pick-blue hover:bg-pick-blue-hover text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue flex items-center gap-1"
              >
                <Pencil :size="14" /> 编辑预设
              </button>
              <button
                @click="handleExport(config.id)"
                class="min-h-[40px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                导出
              </button>
              <button
                @click="handleDelete(config.id)"
                class="min-h-[40px] px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                删除
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存配置对话框 -->
    <BaseDialog v-model="showSaveDialog" panel-class="max-w-md" aria-label="保存配置">
      <template #header><span class="flex items-center gap-2"><Save :size="20" /> 保存当前配置</span></template>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2" for="cfg-name">配置名称 *</label>
          <input
            id="cfg-name"
            v-model="newConfigName"
            type="text"
            placeholder="例如：标准赛、娱乐赛..."
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            maxlength="50"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2" for="cfg-desc">配置描述（可选）</label>
          <textarea
            id="cfg-desc"
            v-model="newConfigDesc"
            placeholder="描述这个配置的用途..."
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 resize-none"
            rows="3"
            maxlength="100"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="showSaveDialog = false">取消</BaseButton>
        <BaseButton variant="primary" :disabled="!newConfigName.trim()" @click="confirmSave">保存</BaseButton>
      </template>
    </BaseDialog>

    <!-- 重命名对话框 -->
    <BaseDialog v-model="showRenameDialog" panel-class="max-w-md" aria-label="重命名配置">
      <template #header><span class="flex items-center gap-2"><Pencil :size="20" /> 重命名配置</span></template>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2" for="cfg-rename">新名称</label>
          <input
            id="cfg-rename"
            v-model="renameValue"
            type="text"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            maxlength="50"
          />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="showRenameDialog = false">取消</BaseButton>
        <BaseButton variant="primary" :disabled="!renameValue.trim()" @click="confirmRename">确认</BaseButton>
      </template>
    </BaseDialog>

    <!-- 编辑预设对话框（植物卡组 + BP 流程） -->
    <BaseDialog
      v-model="showPresetEditor"
      panel-class="max-w-6xl h-[85vh]"
      body-flex
      aria-label="编辑预设"
    >
      <template #header>
        <span class="flex items-center gap-2"><Pencil :size="20" /> 编辑预设 — {{ editingConfigName }}</span>
      </template>

      <!-- 子 tab -->
      <div class="flex gap-2 px-6 pt-4 border-b border-gray-700/50" role="tablist">
        <button
          @click="presetTab = 'plants'"
          role="tab"
          :aria-selected="presetTab === 'plants'"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          :class="presetTab === 'plants' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
        >
          <Sprout :size="14" /> 植物卡组
        </button>
        <button
          @click="presetTab = 'rules'"
          role="tab"
          :aria-selected="presetTab === 'rules'"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          :class="presetTab === 'rules' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
        >
          <SlidersHorizontal :size="14" /> BP 流程
        </button>
      </div>

      <!-- 子 tab 内容（bodyFlex 内容区 flex-1 flex-col，这里再 flex-1 flex 放面板） -->
      <div class="flex-1 flex overflow-hidden">
        <PlantLibrary
          v-if="presetTab === 'plants'"
          mode="draft"
          v-model:plants="editingPlants"
          v-model:hidden-builtin-plants="editingHiddenIds"
          :hide-import-export="true"
        />
        <div v-if="presetTab === 'rules'" class="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <BPRulesEditor
            :preset-rule-config="editingRuleConfig"
            @update:preset-rule-config="onRuleUpdate"
          />
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="showPresetEditor = false">取消</BaseButton>
        <BaseButton variant="primary" @click="savePresetEdit">保存</BaseButton>
      </template>
    </BaseDialog>
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
  setActiveConfig,
  updateConfigRuleConfig,
  updateConfigPlants,
  ensureDefaultPreset,
  duplicateConfig
} from '@/data/plantConfigs'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { Folder, FolderOpen, Save, Upload, Check, Sprout, Ban, Pencil, SlidersHorizontal, Copy } from 'lucide-vue-next'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BPRulesEditor from '@/components/RulesEditor/BPRulesEditor.vue'
import PlantLibrary from './PlantLibrary.vue'
import defaultRules from '@/config/defaultRules'

const emit = defineEmits(['configLoaded'])
const store = useGameStore()
const connStore = useConnectionStore()
const toast = useToast()
const { confirm } = useConfirm()

// 状态
const configs = ref([])
const activeConfigId = ref(null)
const activeConfig = computed(() => configs.value.find(c => c.id === activeConfigId.value))
// 默认预设置顶
const sortedConfigs = computed(() => {
  return [...configs.value].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return 0
  })
})

// 对话框状态
const showSaveDialog = ref(false)
const showRenameDialog = ref(false)
const showPresetEditor = ref(false)
const newConfigName = ref('')
const newConfigDesc = ref('')
const renameConfigId = ref(null)
const renameValue = ref('')
// 编辑预设（植物卡组 + BP 流程）
const editingConfigId = ref(null)
const editingConfigName = ref('')
const editingRuleConfig = ref(null)
const editingPlants = ref([])
const editingHiddenIds = ref([])
const presetTab = ref('plants') // 'plants' | 'rules'

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
    await saveConfig(newConfigName.value.trim(), newConfigDesc.value.trim(), store.ruleConfig)
    await loadConfigs()
    showSaveDialog.value = false
    newConfigName.value = ''
    newConfigDesc.value = ''
    toast.success('配置已保存')
  } catch (error) {
    toast.error('保存失败：' + error.message)
  }
}

// 加载配置
const handleLoad = async (configId) => {
  const config = configs.value.find(c => c.id === configId)

  if (!await confirm({
    title: '加载配置',
    message: `确定要加载配置"${config.name}"吗？当前的自定义植物、隐藏设置${config.ruleConfig ? '和比赛规则（BP 流程等）' : ''}将被替换。`,
    confirmText: '加载',
    variant: 'primary',
  })) return

  try {
    const loaded = await loadConfig(configId)
    // 恢复自定义比赛规则（BP 流程/上限/南瓜/阵营/选边）；写入 bpGameState 后随 reload 生效
    if (loaded?.ruleConfig) {
      store.applyRuleConfig(loaded.ruleConfig)
    }
    toast.info(`配置"${config.name}"已加载，页面即将刷新...`, { duration: 1500 })
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } catch (error) {
    toast.error('加载失败：' + error.message)
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
    toast.success('配置已重命名')
  } catch (error) {
    toast.error('重命名失败：' + error.message)
  }
}

// 编辑预设（植物卡组 + BP 流程，改预设快照，不影响当前对局）
const handleEditPreset = (config) => {
  editingConfigId.value = config.id
  editingConfigName.value = config.name
  // 深拷贝，避免编辑过程中直接 mutate 原配置
  editingPlants.value = JSON.parse(JSON.stringify(config.plants || []))
  editingHiddenIds.value = [...(config.hiddenBuiltinPlants || [])]
  // 合并默认值，保证 ruleConfig 字段完整（bpSequence/limits/pumpkinRule/sideNames/sideSelection）
  editingRuleConfig.value = { ...defaultRules, ...(config.ruleConfig || {}) }
  presetTab.value = 'plants'
  showPresetEditor.value = true
}

// BPRulesEditor 预设模式 emit 回传的编辑结果
const onRuleUpdate = (updated) => {
  editingRuleConfig.value = updated
}

const savePresetEdit = async () => {
  try {
    // 双写：植物/隐藏 与 规则 分两个 API（与 updateConfigRuleConfig 对称）
    await updateConfigPlants(editingConfigId.value, editingPlants.value, editingHiddenIds.value)
    await updateConfigRuleConfig(editingConfigId.value, editingRuleConfig.value)
    await loadConfigs()
    // 若编辑的是当前正在应用的预设，同步其规则到当前对局 store.ruleConfig
    // （预设与 store.ruleConfig 脱钩：加载时复制进 store，之后各自独立；
    //  此处让"编辑 active 预设并保存"反映到当前对局——bpSequence 因 startRound 已快照而不影响当前小局，
    //  其余字段即时生效，下一小局起用新 bpSequence）
    if (editingConfigId.value === activeConfigId.value) {
      store.applyRuleConfig(editingRuleConfig.value)
      // 多人：host 广播给其他端；local 模式 syncState 内部 no-op
      if (connStore.roomMode === 'host') {
        connStore.syncState()
      }
    }
    showPresetEditor.value = false
    toast.success('预设已更新（植物卡组 + BP 流程）')
  } catch (error) {
    toast.error('保存失败：' + error.message)
  }
}

// 导出配置
const handleExport = async (configId) => {
  try {
    await exportConfig(configId)
    toast.success('配置已导出')
  } catch (error) {
    toast.error('导出失败：' + error.message)
  }
}

// 复制预设为可编辑副本（默认预设的入口：一键生成可改可删的普通预设）
const handleDuplicate = async (configId) => {
  try {
    const copy = await duplicateConfig(configId)
    await loadConfigs()
    toast.success(`已复制为「${copy.name}」（可编辑）`)
  } catch (error) {
    toast.error('复制失败：' + error.message)
  }
}

// 删除配置
const handleDelete = async (configId) => {
  const config = configs.value.find(c => c.id === configId)

  // 删除最后一个配置时额外澄清：仅移除预设记录，当前植物/隐藏/规则保持不变
  const isLast = configs.value.length === 1
  const message = isLast
    ? `确定要删除配置"${config.name}"吗？删除后配置列表将为空，但当前的自定义植物、隐藏设置和比赛规则保持不变。此操作无法撤销。`
    : `确定要删除配置"${config.name}"吗？此操作无法撤销。`

  if (!await confirm({
    title: '删除配置',
    message,
    confirmText: '删除',
    variant: 'danger',
  })) return

  try {
    await deleteConfig(configId)
    await loadConfigs()
    toast.success('配置已删除')
  } catch (error) {
    toast.error('删除失败：' + error.message)
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
      toast.success(`配置"${imported.name}"已导入`)
    } catch (error) {
      toast.error('导入失败：' + error.message)
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

// 初始化
onMounted(async () => {
  await ensureDefaultPreset()
  await loadConfigs()
})
</script>

<style scoped>
.config-card {
  border: 2px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.config-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.config-card.active {
  border-color: #22c55e;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.3);
}

.config-card-default {
  border-color: rgba(147, 51, 234, 0.4);
  box-shadow: 0 0 0 1px rgba(147, 51, 234, 0.15);
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

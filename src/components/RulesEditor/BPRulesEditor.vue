<template>
  <!--
    功能2（BP 顺序自定义）+ 功能4（植物使用上限自定义）配置 UI。
    开发者 A 负责。直接读写 useGameStore().ruleConfig.bpSequence / .limits。
    勿改动 SideRulesEditor.vue（开发者 B 负责）。
  -->
  <!-- 移入「配置管理」弹窗的 BP 流程 tab 后，外层 details 折叠语义冗余（tab 即显隐切换），剥为普通 div -->
  <div class="space-y-5">
      <!-- 多人对局进行中锁定提示 -->
      <div
        v-if="!isPresetMode && !store.isRuleEditable"
        class="text-xs text-gray-500 bg-gray-800/40 border border-gray-700/50 rounded-md px-3 py-2 flex items-center gap-2"
      >
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>规则已锁定（对局进行中）</span>
      </div>
      <!-- 功能4：同种植物使用上限 -->
      <section class="rounded-lg bg-black/20 border border-white/5 p-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <label for="max-plant-usage" class="text-xs font-semibold text-gray-300">
            同种植物使用上限（每名选手独立计数）
          </label>
          <div class="flex items-center gap-2">
            <input
              id="max-plant-usage"
              type="number"
              min="1"
              max="5"
              :value="maxPlantUsage"
              :disabled="!canEditRules"
              @input="onMaxUsageInput"
              class="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-pick-blue"
            />
            <span class="text-xs text-gray-500">次（1~5）</span>
          </div>
        </div>
      </section>

      <!-- 南瓜头锁定保护特殊规则开关 -->
      <section class="rounded-lg bg-black/20 border border-white/5 p-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <span class="text-xs font-semibold text-gray-300 block">南瓜头锁定保护特殊规则</span>
            <p class="text-[10px] text-gray-600 mt-0.5">
              开启：选南瓜不消耗 BP 步骤，并保护下一个普通植物；关闭：南瓜当作普通植物。
            </p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0" :class="{ 'cursor-not-allowed opacity-60': !canEditRules }">
            <input
              type="checkbox"
              :checked="pumpkinRuleEnabled"
              :disabled="!canEditRules"
              @change="togglePumpkinRule"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-gray-600 peer-checked:bg-pick-blue rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
          </label>
        </div>
      </section>

      <!-- 功能2：BP 顺序模板 -->
      <section class="rounded-lg bg-black/20 border border-white/5 p-3 space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="text-xs font-semibold text-gray-300">BP 流程顺序模板</div>
          <div class="flex items-center gap-2">
            <!-- 预设模板下拉 -->
            <select
              v-model="selectedPreset"
              :disabled="!canEditRules"
              @change="applyPreset"
              class="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pick-blue"
            >
              <option :value="PRESET_NONE">选择预设…</option>
              <option v-for="(tpl, idx) in presets" :key="idx" :value="idx">{{ tpl.name }}</option>
            </select>
            <!-- 重置为默认 -->
            <button
              type="button"
              @click="resetToDefault"
                  :disabled="!canEditRules"
              class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              重置为默认
            </button>
          </div>
        </div>

        <!-- 校验提示 -->
        <div v-if="validationError" class="text-xs text-ban-red bg-ban-red/10 border border-ban-red/30 rounded px-2 py-1">
          {{ validationError }}
        </div>

        <!-- 阶段列表编辑器：阶段多时内部滚动，避免撑高对话框/页面溢出屏幕 -->
        <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          <div
            v-for="(stage, stageIdx) in localSequence"
            :key="stageIdx"
            class="rounded-md border border-gray-700/60 bg-gray-900/40 p-2"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-300">阶段 {{ stageIdx + 1 }}（{{ stage.length }} 步）</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="addStep(stageIdx)"
                  :disabled="!canEditRules"
                  class="text-[11px] px-1.5 py-0.5 rounded bg-pick-blue/20 hover:bg-pick-blue/40 text-pick-blue border border-pick-blue/40 transition-colors"
                >
                  + 步骤
                </button>
                <button
                  type="button"
                  @click="removeStage(stageIdx)"
                  :disabled="!canEditRules"
                  class="text-[11px] px-1.5 py-0.5 rounded bg-ban-red/20 hover:bg-ban-red/40 text-ban-red border border-ban-red/40 transition-colors"
                >
                  删除阶段
                </button>
              </div>
            </div>

            <div v-if="stage.length === 0" class="text-[11px] text-gray-600 italic px-1 pb-1">
              （空阶段，将删除）
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="(step, stepIdx) in stage"
                :key="stepIdx"
                class="flex items-center gap-1.5 text-xs"
              >
                <span class="text-gray-500 w-6 text-right">{{ stepIdx + 1 }}.</span>

                <!-- action 选择 -->
                <select
                  v-model="step.action"
                  :disabled="!canEditRules"
                  @change="onActionChange(step)"
                  class="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-pick-blue"
                  :class="step.action === 'pick' ? 'text-pick-blue' : 'text-ban-red'"
                >
                  <option value="ban">禁用</option>
                  <option value="pick">选择</option>
                  <option value="globalBan">全局禁用</option>
                </select>

                <!-- player 选择（globalBan 时锁定为 system，不归属任何阵营） -->
                <select
                  v-model="step.player"
                  :disabled="!canEditRules || step.action === 'globalBan'"
                  @change="commit"
                  class="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-pick-blue disabled:opacity-50"
                >
                  <option value="road2">二路</option>
                  <option value="road4">四路</option>
                  <option v-if="step.action === 'globalBan'" value="system">系统</option>
                </select>

                <!-- count（pick=选择数量 / globalBan=抽取数量 / ban 现状不用但可填） -->
                <label class="flex items-center gap-1 text-gray-400">
                  {{ step.action === 'globalBan' ? '抽取' : '数量' }}
                  <input
                    type="number"
                    min="1"
                    max="9"
                    v-model.number="step.count"
                    :disabled="!canEditRules"
                    @change="commit"
                    class="w-12 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-white text-center focus:outline-none focus:ring-1 focus:ring-pick-blue"
                  />
                </label>

                <button
                  type="button"
                  @click="removeStep(stageIdx, stepIdx)"
                  :disabled="!canEditRules"
                  class="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-ban-red/40 text-gray-300 hover:text-ban-red transition-colors"
                  aria-label="删除步骤"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 新增阶段按钮 -->
        <button
          type="button"
          @click="addStage"
                  :disabled="!canEditRules"
          class="w-full text-xs px-2 py-1.5 rounded border border-dashed border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
        >
          + 新增阶段
        </button>

        <!-- 统计 -->
        <div class="text-[11px] text-gray-500 text-right">
          共 {{ localSequence.length }} 阶段 · {{ totalSteps }} 步
        </div>
      </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useConfirm } from '@/composables/useConfirm'
import { PRESET_TEMPLATES, getDefaultTemplate } from '@/config/rules/bpSequence'

// 可选 presetRuleConfig：传入则进入"预设编辑模式"，编辑该对象的副本（bpSequence/limits/pumpkinRule），
// commit 时 emit update；不传则维持原行为（编辑 store.ruleConfig，含持久化与多人同步）。
const props = defineProps({
  presetRuleConfig: { type: Object, default: null }
})
const emit = defineEmits(['update:presetRuleConfig'])

const store = useGameStore()

const connStore = useConnectionStore()

const { confirm } = useConfirm()

const isPresetMode = computed(() => !!props.presetRuleConfig)

// 预设模式下的本地可编辑副本（仅在 presetRuleConfig 变化时重新初始化）
const editablePreset = ref(null)
watch(() => props.presetRuleConfig, (val) => {
  if (isPresetMode.value && val) {
    editablePreset.value = JSON.parse(JSON.stringify(val))
  }
}, { immediate: true })

// 当前编辑目标：预设模式用 editablePreset；否则用 store.ruleConfig
const sourceRuleConfig = computed(() => (isPresetMode.value ? editablePreset.value : store.ruleConfig))

// 多人权限：预设模式编辑的是快照，恒可改；原模式单机恒可改、多人仅 host 且赛前可改。
const canEditRules = computed(() =>
  isPresetMode.value || ((connStore.roomMode === 'local' || connStore.myRole === 'host') && store.isRuleEditable)
)

// 把部分 ruleConfig 字段更新写回当前编辑目标（预设模式写 editablePreset 并 emit；原模式写 store）
const writeRuleConfig = (partial) => {
  if (isPresetMode.value) {
    editablePreset.value = { ...editablePreset.value, ...partial }
    emit('update:presetRuleConfig', editablePreset.value)
  } else {
    Object.assign(store.ruleConfig, partial)
  }
}

// 写回后显式同步（契约3）：仅 host 广播；客户端 disabled 不会触发，天然无回环。
// local 模式 syncState 内部 return，安全。仅 host 改完一次广播一次（commit/失焦时触发，非每次输入抖动）。
// 预设模式不同步（数据经 emit 由父组件写回预设）。
const syncRuleConfig = () => {
  if (isPresetMode.value) return
  store.saveToLocalStorage()
  if (connStore.roomMode === 'host') {
    connStore.syncState()
  }
}

const PRESET_NONE = '__none__'
const presets = PRESET_TEMPLATES
const selectedPreset = ref(PRESET_NONE)

// 当前生效模板（预设模式取 editablePreset，否则取 store）
const currentSequence = computed(() => sourceRuleConfig.value?.bpSequence || [])

// 本地可编辑副本（深拷贝），编辑后 commit 回 store
const localSequence = ref(JSON.parse(JSON.stringify(currentSequence.value)))

// 当 store 模板被外部（如预设/重置/多人同步）改变时，同步到本地副本
watch(currentSequence, (val) => {
  localSequence.value = JSON.parse(JSON.stringify(val))
}, { deep: true })

// 最大使用上限
const maxPlantUsage = computed(() => sourceRuleConfig.value?.limits?.maxPlantUsage ?? 2)

// 南瓜特殊规则开关（默认开启；关闭后南瓜当作普通植物）
const pumpkinRuleEnabled = computed(() => sourceRuleConfig.value?.pumpkinRule?.enabled ?? true)
const togglePumpkinRule = () => {
  writeRuleConfig({ pumpkinRule: { enabled: !pumpkinRuleEnabled.value } })
  syncRuleConfig()
}

const totalSteps = computed(() =>
  localSequence.value.reduce((sum, stage) => sum + (stage?.length || 0), 0)
)

// 基础校验：至少 1 阶段、每步 action/player 有效
const validationError = computed(() => {
  if (!localSequence.value || localSequence.value.length === 0) {
    return '至少需要 1 个阶段'
  }
  for (const stage of localSequence.value) {
    if (!stage || stage.length === 0) {
      // 空阶段允许存在（将被删除），不阻断
      continue
    }
    for (const step of stage) {
      if (!step) return '存在空步骤'
      if (!['ban', 'pick', 'globalBan'].includes(step.action)) return '步骤的动作无效（须为 禁用/选择/全局禁用）'
      // globalBan 步骤无阵营归属（player='system'）；其余须为二路/四路
      if (step.action === 'globalBan') {
        if (step.player !== 'system') return '全局禁用步骤的阵营须为系统'
      } else if (!['road2', 'road4'].includes(step.player)) {
        return '步骤的阵营无效（须为 二路/四路）'
      }
    }
  }
  return ''
})

// 将本地副本写回 store
const commit = () => {
  // 过滤掉空阶段；globalBan 步骤强制 player='system'（不归属任何阵营）
  const cleaned = localSequence.value
    .filter(stage => Array.isArray(stage) && stage.length > 0)
    .map(stage => stage.map(step => ({
      player: step.action === 'globalBan' ? 'system' : step.player,
      action: step.action,
      count: Number(step.count) || 1
    })))
  writeRuleConfig({ bpSequence: cleaned })
  // 同步本地副本（过滤后索引可能变化）
  localSequence.value = JSON.parse(JSON.stringify(cleaned))
  syncRuleConfig()
}

// action 切换联动：切到 globalBan 时把 player 锁定为 system；切回 ban/pick 时若仍是 system 则回落二路
const onActionChange = (step) => {
  if (step.action === 'globalBan') {
    step.player = 'system'
  } else if (step.player === 'system') {
    step.player = 'road2'
  }
  commit()
}

// 预设模板应用
const applyPreset = () => {
  if (selectedPreset.value === PRESET_NONE) return
  const tpl = presets[selectedPreset.value]
  if (!tpl || !tpl.sequence) return
  const cloned = JSON.parse(JSON.stringify(tpl.sequence))
  writeRuleConfig({ bpSequence: cloned })
  localSequence.value = JSON.parse(JSON.stringify(cloned))
  syncRuleConfig()
  // 重置下拉显示
  selectedPreset.value = PRESET_NONE
}

// 重置为默认
const resetToDefault = () => {
  const def = getDefaultTemplate()
  writeRuleConfig({ bpSequence: def })
  localSequence.value = JSON.parse(JSON.stringify(def))
  syncRuleConfig()
  selectedPreset.value = PRESET_NONE
}

// 阶段/步骤增删
const addStage = () => {
  localSequence.value.push([])
  commit()
}

const removeStage = async (stageIdx) => {
  const stage = localSequence.value[stageIdx]
  const stepCount = Array.isArray(stage) ? stage.length : 0
  // 非空阶段直接删会连带丢失其内步骤，需确认；空阶段无损失，直接删
  if (stepCount > 0) {
    const ok = await confirm({
      title: '删除阶段',
      message: `确定删除阶段 ${stageIdx + 1}？该阶段的 ${stepCount} 个步骤将一并删除。`,
      confirmText: '删除',
      variant: 'danger',
    })
    if (!ok) return
  }
  localSequence.value.splice(stageIdx, 1)
  commit()
}

const addStep = (stageIdx) => {
  if (!localSequence.value[stageIdx]) localSequence.value[stageIdx] = []
  localSequence.value[stageIdx].push({ player: 'road2', action: 'ban', count: 1 })
  commit()
}

const removeStep = (stageIdx, stepIdx) => {
  localSequence.value[stageIdx].splice(stepIdx, 1)
  commit()
}

// 使用上限输入
const onMaxUsageInput = (e) => {
  let val = parseInt(e.target.value, 10)
  if (isNaN(val)) val = 2
  val = Math.min(5, Math.max(1, val))
  writeRuleConfig({ limits: { ...(sourceRuleConfig.value?.limits || {}), maxPlantUsage: val } })
  syncRuleConfig()
}
</script>


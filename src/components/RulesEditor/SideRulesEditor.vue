<template>
  <!--
    阵营与选边规则编辑器（功能1 阵营名称自定义 + 功能3 选边方式自定义）。
    数据入口：直接读写 useGameStore().ruleConfig.sideNames / .sideSelection
    勿改动 BPRulesEditor.vue（开发者 A 负责）。
  -->
  <details class="rounded-lg border border-gray-700/60 bg-gray-900/30" open>
    <summary class="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-400 uppercase tracking-wide hover:text-gray-200">
      阵营与选边规则
    </summary>

    <div class="px-4 pb-4 pt-1 space-y-6">
      <!-- 多人对局进行中锁定提示 -->
      <div
        v-if="!store.isRuleEditable"
        class="text-xs text-gray-500 bg-gray-800/40 border border-gray-700/50 rounded-md px-3 py-2 flex items-center gap-2"
      >
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>规则已锁定（对局进行中）</span>
      </div>
      <!-- 功能1：阵营名称 -->
      <section class="space-y-3">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wide">阵营名称</h4>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="block text-[11px] text-gray-500 mb-1">2 路阵营显示名</span>
            <input
              v-model="sideNames.road2"
              type="text"
              maxlength="8"
              placeholder="二路"
              :disabled="!canEditRules"
              :class="inputClass"
              @change="onSync"
            />
          </label>
          <label class="block">
            <span class="block text-[11px] text-gray-500 mb-1">4 路阵营显示名</span>
            <input
              v-model="sideNames.road4"
              type="text"
              maxlength="8"
              placeholder="四路"
              :disabled="!canEditRules"
              :class="inputClass"
              @change="onSync"
            />
          </label>
        </div>
        <p class="text-[10px] text-gray-600">仅影响显示文案，不影响 BP 顺序逻辑。留空将回退为默认名。</p>
      </section>

      <hr class="border-gray-700/50" />

      <!-- 功能3：初始选边方式 -->
      <section class="space-y-3">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wide">初始选边方式</h4>
        <div class="grid grid-cols-3 gap-2">
          <label
            v-for="opt in initialModeOptions"
            :key="opt.value"
            :class="radioLabelClass"
          >
            <input
              v-model="sideSelection.initialMode"
              :value="opt.value"
              type="radio"
              class="sr-only peer"
              :disabled="!canEditRules"
              @change="onSync"
            />
            <span class="block text-center text-xs py-2 px-1 rounded-md border transition-colors peer-checked:bg-plant-green/20 peer-checked:border-plant-green peer-checked:text-plant-green-neon border-gray-600 text-gray-400 hover:border-gray-400">
              {{ opt.label }}
            </span>
          </label>
        </div>

        <!-- assigned 模式下显示指定选边方 -->
        <div v-if="sideSelection.initialMode === 'assigned'" class="flex items-center gap-2 pl-1">
          <span class="text-[11px] text-gray-500">指定选边方：</span>
          <label
            v-for="opt in pickerOptions"
            :key="opt.value"
            :class="radioLabelClass"
          >
            <input
              v-model="sideSelection.initialPicker"
              :value="opt.value"
              type="radio"
              class="sr-only peer"
              :disabled="!canEditRules"
              @change="onSync"
            />
            <span class="inline-block text-xs py-1 px-3 rounded border transition-colors peer-checked:bg-pick-blue/20 peer-checked:border-pick-blue peer-checked:text-pick-blue-neon border-gray-600 text-gray-400 hover:border-gray-400">
              {{ opt.label }}
            </span>
          </label>
        </div>

        <p class="text-[10px] text-gray-600">{{ initialModeHint }}</p>
      </section>

      <hr class="border-gray-700/50" />

      <!-- 功能3：每小局后选边权 -->
      <section class="space-y-3">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wide">小局结束后选边权</h4>
        <div class="grid grid-cols-3 gap-2">
          <label
            v-for="opt in loserPickModeOptions"
            :key="opt.value"
            :class="radioLabelClass"
          >
            <input
              v-model="sideSelection.loserPickMode"
              :value="opt.value"
              type="radio"
              class="sr-only peer"
              :disabled="!canEditRules"
              @change="onSync"
            />
            <span class="block text-center text-xs py-2 px-1 rounded-md border transition-colors peer-checked:bg-plant-green/20 peer-checked:border-plant-green peer-checked:text-plant-green-neon border-gray-600 text-gray-400 hover:border-gray-400">
              {{ opt.label }}
            </span>
          </label>
        </div>
        <p class="text-[10px] text-gray-600">{{ loserPickModeHint }}</p>
      </section>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'

const store = useGameStore()
const connStore = useConnectionStore()

// 多人权限（契约2）：单机恒可改；多人仅 host 且赛前可改。
const canEditRules = computed(() =>
  (connStore.roomMode === 'local' || connStore.myRole === 'host') && store.isRuleEditable
)

// 直接引用 ruleConfig 子对象（响应式双向绑定）
const sideNames = computed(() => store.ruleConfig.sideNames)
const sideSelection = computed(() => store.ruleConfig.sideSelection)

const initialModeOptions = [
  { value: 'mutual', label: '双方互斥' },
  { value: 'assigned', label: '指定一方' },
  { value: 'random', label: '随机分配' }
]

const pickerOptions = [
  { value: 'player1', label: '选手1' },
  { value: 'player2', label: '选手2' }
]

const loserPickModeOptions = [
  { value: 'loser', label: '败者选' },
  { value: 'winner', label: '胜者选' },
  { value: 'keep', label: '不换边' }
]

const initialModeHint = computed(() => {
  switch (sideSelection.value.initialMode) {
    case 'random': return '开局由系统随机分配 2 路 / 4 路，双方无需手动选边。'
    case 'assigned': return '仅指定一方选路，对手自动取相反道路。'
    default: return '双方各自手动选路（互斥），现状默认行为。'
  }
})

const loserPickModeHint = computed(() => {
  switch (sideSelection.value.loserPickMode) {
    case 'winner': return '每小局结束后由胜者选择下一局道路。'
    case 'keep': return '每小局结束后保持当前道路，直接进入下一局。'
    default: return '每小局结束后由败者选择下一局道路，现状默认行为。'
  }
})
// 样式：锁定时降低不透明度并禁用光标
const inputClass = computed(() => [
  'w-full px-3 py-2 bg-gray-900/60 border border-gray-600 rounded-md text-sm text-white',
  'focus:border-plant-green-neon focus:ring-1 focus:ring-plant-green-neon focus:outline-none transition-all',
  'disabled:opacity-50 disabled:cursor-not-allowed'
])

const radioLabelClass = computed(() =>
  canEditRules.value ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
)

// 写回后显式同步（契约3）：仅 host 广播一次；客户端 disabled 不会触发，天然无回环。
// local 模式下 syncState 内部直接 return，安全。
const onSync = () => {
  store.saveToLocalStorage()
  if (connStore.roomMode === 'host') {
    connStore.syncState()
  }
}
</script>

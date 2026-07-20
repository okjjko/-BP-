<template>
  <!--
    阵营与选边规则编辑器（功能1 阵营名称自定义 + 功能3 选边方式自定义）。
    数据入口：直接读写 useGameStore().ruleConfig.sideNames / .sideSelection
    勿改动 BPRulesEditor.vue（开发者 A 负责）。
  -->
  <details
    ref="detailsRef"
    :open="isOpen"
    class="animated-details rounded-lg border border-gray-700/60 bg-gray-900/30"
  >
    <summary
      @click.prevent="toggle"
      class="cursor-pointer select-none px-4 py-3 text-sm font-bold text-gray-400 uppercase tracking-wide hover:text-gray-200"
    >
      阵营与选边规则
    </summary>

    <div ref="contentRef" class="details-content px-4 pb-4 pt-1 space-y-6">
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
            <div class="field-grow" style="--grow-color:#00ff41">
              <input
                v-model="sideNames.road2"
                type="text"
                maxlength="8"
                placeholder="二路"
                :disabled="!canEditRules"
                :class="inputClass"
                @change="onSync"
              />
            </div>
          </label>
          <label class="block">
            <span class="block text-[11px] text-gray-500 mb-1">4 路阵营显示名</span>
            <div class="field-grow" style="--grow-color:#00ff41">
              <input
                v-model="sideNames.road4"
                type="text"
                maxlength="8"
                placeholder="四路"
                :disabled="!canEditRules"
                :class="inputClass"
                @change="onSync"
              />
            </div>
          </label>
        </div>
        <p class="text-[10px] text-gray-600">仅影响显示文案，不影响 BP 顺序逻辑。留空将回退为默认名。</p>
      </section>

      <hr class="border-gray-700/50" />

      <!-- 功能3：初始选边方式 -->
      <section class="space-y-3">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wide">初始选边方式</h4>
        <div class="segment-track grid grid-cols-3 gap-2">
          <div
            class="segment-indicator rounded-md bg-plant-green/20 border border-plant-green"
            :style="segmentIndicatorStyle(initialModeIndex, 3)"
          ></div>
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
            <span class="block text-center text-xs py-2 px-1 rounded-md border transition-colors peer-checked:text-plant-green-neon border-gray-600 text-gray-400 hover:border-gray-400">
              {{ opt.label }}
            </span>
          </label>
        </div>

        <!-- assigned 模式下显示指定选边方（滑动展开） -->
        <Transition name="slide-down">
          <div v-if="sideSelection.initialMode === 'assigned'" class="flex items-center gap-2 pl-1">
            <span class="text-[11px] text-gray-500">指定选边方：</span>
            <div class="segment-track inline-grid grid-cols-2 gap-2">
              <div
                class="segment-indicator rounded bg-pick-blue/20 border border-pick-blue"
                :style="segmentIndicatorStyle(pickerIndex, 2)"
              ></div>
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
                <span class="block text-center text-xs py-1 px-3 rounded border transition-colors peer-checked:text-pick-blue-neon border-gray-600 text-gray-400 hover:border-gray-400">
                  {{ opt.label }}
                </span>
              </label>
            </div>
          </div>
        </Transition>

        <p class="text-[10px] text-gray-600">{{ initialModeHint }}</p>
      </section>

      <hr class="border-gray-700/50" />

      <!-- 功能3：每小局后选边权 -->
      <section class="space-y-3">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wide">小局结束后选边权</h4>
        <div class="segment-track grid grid-cols-3 gap-2">
          <div
            class="segment-indicator rounded-md bg-plant-green/20 border border-plant-green"
            :style="segmentIndicatorStyle(loserPickModeIndex, 3)"
          ></div>
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
            <span class="block text-center text-xs py-2 px-1 rounded-md border transition-colors peer-checked:text-plant-green-neon border-gray-600 text-gray-400 hover:border-gray-400">
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
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useDetailsAnimation } from '@/composables/useDetailsAnimation'

const store = useGameStore()
const connStore = useConnectionStore()

// details 折叠面板丝滑展开/收起动画（grid 0fr→1fr 在 Chrome 实测不插值，改用 JS+height）
const detailsRef = ref(null)
const contentRef = ref(null)
const { isOpen, toggle } = useDetailsAnimation({
  getDetails: () => detailsRef.value,
  getContent: () => contentRef.value,
  initialOpen: true, // 阵营与选边规则默认展开
})

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

// 各 radio 组选中项在选项数组中的索引（驱动滑动指示器定位）
const initialModeIndex = computed(() =>
  initialModeOptions.findIndex(o => o.value === sideSelection.value.initialMode))
const loserPickModeIndex = computed(() =>
  loserPickModeOptions.findIndex(o => o.value === sideSelection.value.loserPickMode))
const pickerIndex = computed(() =>
  pickerOptions.findIndex(o => o.value === sideSelection.value.initialPicker))

// 滑动指示器定位：width 等分（扣掉 gap），translateX = index 个（自身宽 + gap）。
// gap-2 = 0.5rem；translateX 的 100% 相对 indicator 自身宽，+ index*gap 补上 gap。
const segmentIndicatorStyle = (index, count, gapRem = 0.5) => ({
  width: `calc((100% - ${(count - 1) * gapRem}rem) / ${count})`,
  transform: `translateX(calc(${index} * 100% + ${index * gapRem}rem))`,
})

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
  'focus:outline-none transition-colors',
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

<style scoped>
/* details 收起态隐藏内容。
   必须显式控制：原生 details 在「运行时移除 open 属性」时不可靠隐藏子内容（实测高度残留），
   且需保证页面初始（未 open）时内容也是隐藏的。靠 JS 动画结束时 open=false 触发本规则，
   因此刻高度已为 0，display:none 无跳变。 */
.animated-details:not([open]) > .details-content {
  display: none;
}

/* 边框生长动效（border-grow / 生长边缘）—— 聚焦时彩色描边从中间向两端展开包围输入框，失焦反向收缩。
   复用 RoomSetup 的 .field-grow 模式（RoomSetup 为 scoped，本组件需自带一份）。
   参数对齐本组件 input：rounded-md=6px。颜色由 --grow-color 变量传入。 */
.field-grow {
  position: relative;
}
.field-grow::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  border-radius: 6px;   /* 对齐 input 的 rounded-md */
  padding: 2px;         /* 描边环带宽度 */
  background: var(--grow-color, transparent);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 0.5s ease;
  pointer-events: none;
  z-index: 1;
}
.field-grow:focus-within::before {
  transform: scaleX(1);
}

/* assigned 选边方选项：滑动展开/收起
   max-height + margin-top 让占位（含与上方的 space-y 间距）真实变化 → 下方提示文字完全平滑跟随，
   不再瞬间跳变；transform+opacity 保留按钮的滑动淡入感；overflow:hidden 仅过渡期间裁剪位移。
   margin-top 用 !important 覆盖 .space-y-3 > * + * 的更高优先级选择器。 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: max-height 0.25s ease, margin-top 0.25s ease, opacity 0.25s ease, transform 0.25s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  margin-top: 0 !important;
  opacity: 0;
  transform: translateY(-8px);
}
.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 50px;
  margin-top: 0.75rem !important;
  opacity: 1;
  transform: translateY(0);
}

/* radio 组滑动指示器（segmented control）：选中高亮块在选项间平滑滑动 */
.segment-track {
  position: relative;
}
.segment-track label {
  position: relative;
  z-index: 1;
}
.segment-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  transition: transform 0.2s ease;
  z-index: 10;
  pointer-events: none;
}
</style>


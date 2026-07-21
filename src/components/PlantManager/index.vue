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
        <div class="relative glass-card rounded-2xl w-full max-w-7xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">
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
          <div class="flex-1 flex flex-col overflow-hidden">
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
                @click="currentTab = 'rules'"
                role="tab"
                :aria-selected="currentTab === 'rules'"
                class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                :class="currentTab === 'rules' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
              >
                <SlidersHorizontal :size="16" /> BP 流程
              </button>
              <button
                @click="currentTab = 'configs'"
                role="tab"
                :aria-selected="currentTab === 'configs'"
                class="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                :class="currentTab === 'configs' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'"
              >
                <Folder :size="16" /> 比赛预设
              </button>
            </div>

            <!-- 内容区 -->
            <div class="flex-1 flex overflow-hidden">
              <!-- 植物 tab：PlantLibrary（global 模式，读写全局 IndexedDB） -->
              <PlantLibrary v-if="currentTab === 'plants'" mode="global" />

              <!-- BP 流程 tab -->
              <div v-if="currentTab === 'rules'" class="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <BPRulesEditor />
              </div>

              <!-- 比赛预设 tab -->
              <div v-if="currentTab === 'configs'" class="flex-1 overflow-hidden">
                <ConfigManager />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { isAnyBaseDialogOpen } from '@/components/ui/baseDialogState'
import { Sprout, Folder, X, SlidersHorizontal } from 'lucide-vue-next'
import PlantLibrary from './PlantLibrary.vue'
import ConfigManager from './ConfigManager.vue'
import BPRulesEditor from '@/components/RulesEditor/BPRulesEditor.vue'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['update:show'])

const currentTab = ref('plants') // 'plants' | 'rules' | 'configs'

const close = () => emit('update:show', false)

// ===== 主模态焦点陷阱（Tab 循环 + Esc 关闭 + 打开聚焦 + 关闭回焦） =====
const rootRef = ref(null)
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
let previouslyFocused = null

function trapKeydown(e) {
  // 任意 BaseDialog（回收站 / 编辑预设 / 重命名等）打开时，焦点管理交给 BaseDialog
  if (isAnyBaseDialogOpen()) return
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

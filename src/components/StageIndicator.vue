<template>
  <!-- 手机端紧凑版（md 以下）：融入顶部状态条中央，仅保留阶段名/进度/当前操作 -->
  <div class="md:hidden flex flex-col items-center min-w-0 flex-1 px-1" role="region" aria-label="当前游戏阶段">
    <!-- 多人模式：角色 / 回合 极简徽章 -->
    <div v-if="roomMode !== 'local'" class="flex items-center justify-center gap-1 mb-0.5 min-w-0 flex-wrap">
      <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap border" :class="roleBadgeClass">
        {{ getRoleLabel() }}
      </span>
      <span
        v-if="myTurnDescription"
        class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate max-w-[80px] border"
        :class="isMyTurn ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-red-500/20 border-red-500/40 text-red-300'"
      >
        {{ myTurnDescription }}
      </span>
    </div>

    <!-- 阶段名 -->
    <div class="flex items-baseline gap-1 min-w-0 justify-center">
      <span class="text-[9px] text-gray-500 whitespace-nowrap">R{{ roundNumber }}</span>
      <span class="text-xs font-black truncate max-w-[96px]" :class="stageClass">{{ stageName }}</span>
      <span
        v-if="timerEnabled && remainingSeconds !== null"
        class="text-[10px] font-mono font-bold tabular-nums px-1 rounded"
        :class="remainingSeconds <= 10 ? 'text-red-300 animate-pulse' : 'text-gray-300'"
        role="timer"
        aria-label="本步剩余思考时间"
      >{{ remainingSeconds }}s</span>
    </div>

    <!-- 进度条 -->
    <div class="w-full max-w-[130px] h-3.5 bg-gray-800/70 rounded-full my-1 overflow-hidden border border-gray-700/50 relative" role="progressbar" aria-label="BP 进度" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
      <div class="h-full rounded-full transition-all duration-500" :class="progressBarClass" :style="{ width: `${((step + 1) / totalSteps) * 100}%` }"></div>
      <!-- 当前进度文字叠在进度条中央 -->
      <span class="absolute inset-0 flex items-center justify-center text-[9px] text-white font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">
        {{ step + 1 }}<span class="text-white/60 mx-0.5">/</span>{{ totalSteps }}
      </span>
    </div>
  </div>

  <!-- 桌面端完整版（md 以上，原样） -->
  <div class="hidden md:block glass-panel rounded-xl p-2 lg:p-3 min-w-0 lg:min-w-[300px] shadow-lg border-t border-white/10" role="region" aria-label="当前游戏阶段">
    <div class="text-center">
      <!-- 多人模式：角色徽章和回合提示 -->
      <div v-if="roomMode !== 'local'" class="flex items-center justify-center gap-2 mb-2">
        <!-- 角色徽章 -->
        <span class="role-badge">
          <component :is="roleIcon" v-if="roleIcon" class="role-icon" :size="14" aria-hidden="true" />
          <span class="role-text">{{ getRoleLabel() }}</span>
        </span>
        <!-- 回合提示 -->
        <span v-if="myTurnDescription" class="turn-badge" :class="{ 'is-opponent': !isMyTurn }">
          {{ myTurnDescription }}
        </span>
      </div>

      <!-- 同步状态指示器 -->
      <div v-if="roomMode !== 'local' && syncStatus" class="sync-status" :class="syncStatus.class">
        <component :is="syncStatus.icon" class="sync-icon" :size="14" aria-hidden="true" />
        <span class="sync-text">{{ syncStatus.text }}</span>
      </div>

      <h3 class="text-sm font-bold mb-1 text-gray-400 uppercase tracking-widest">ROUND {{ roundNumber }}</h3>
      <div class="text-xl lg:text-3xl font-black mb-2 tracking-wide flex items-center justify-center gap-2" :class="stageClass">
        {{ stageName }}
        <!-- 每步思考倒计时（ruleConfig.timer 开启时显示；<10s 变红） -->
        <span
          v-if="timerEnabled && remainingSeconds !== null"
          class="align-middle px-2 py-0.5 rounded-md text-sm lg:text-base font-mono font-bold tabular-nums border"
          :class="remainingSeconds <= 10 ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse' : 'bg-gray-800/70 border-gray-600 text-gray-200'"
          role="timer"
          aria-label="本步剩余思考时间"
        >{{ Math.floor(remainingSeconds / 60) }}:{{ String(remainingSeconds % 60).padStart(2, '0') }}</span>
      </div>

      <!-- 进度条 -->
      <div class="mb-2 relative">
        <div class="w-full bg-gray-800/50 rounded-full h-4 lg:h-5 border border-gray-700 relative overflow-hidden" role="progressbar" aria-label="BP 进度" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="progressBarClass"
            :style="{ width: `${((step + 1) / totalSteps) * 100}%` }"
          >
          </div>
          <!-- 当前进度文字叠在进度条中央 -->
          <span class="absolute inset-0 flex items-center justify-center text-[10px] lg:text-xs text-white font-mono font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none">
            {{ step + 1 }}<span class="text-white/60 mx-0.5">/</span>{{ totalSteps }}
          </span>
        </div>
        <div class="flex justify-between items-center mt-1.5 px-1">
          <span class="text-[10px] text-gray-500">开始</span>
          <span class="text-[10px] text-gray-500">结束</span>
        </div>
      </div>

      <!-- 南瓜保护提示 -->
      <transition name="fade">
        <div v-if="hasPumpkinProtection"
             class="mt-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/50 flex items-center gap-2">
          <span class="text-lg">南</span>
          <span class="text-sm font-bold text-orange-300">南瓜保护已激活！下一个植物将获得保护</span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Crown, Gamepad2, Eye, RefreshCw, TriangleAlert, Check } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { getStageNames } from '@/utils/bpRules'

const store = useGameStore()
const connStore = useConnectionStore()

// ===== 每步思考倒计时显示 =====
// 各端（含 player/spectator）纯显示：用同步来的 stepStartedAt + 本地 ticker 算剩余秒数。
// 只有权威方跑真实定时器并执行超时动作（见 gameStore._restartStepTimer）。
const timerEnabled = computed(() => store.ruleConfig?.timer?.enabled === true)
const now = ref(Date.now())
let ticker = null
onMounted(() => {
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => { if (ticker) clearInterval(ticker) })

const remainingSeconds = computed(() => {
  if (!timerEnabled.value || store.gameStatus !== 'banning') return null
  if (store.currentRound?.action === 'globalBan' || store.currentRound?.extraPick) return null
  if (!store.stepStartedAt) return null
  const total = store.ruleConfig?.timer?.secondsPerStep || 90
  const elapsed = Math.floor((now.value - store.stepStartedAt) / 1000)
  return Math.max(0, total - elapsed)
})

// 多人模式相关
const roomMode = computed(() => connStore.roomMode)
const myRole = computed(() => connStore.myRole)
const myTurnDescription = computed(() => connStore.myTurnDescription)
const isMyTurn = computed(() => connStore.isMyTurn)

// 同步状态指示器
const syncStatus = computed(() => {
  if (connStore.isSyncing) {
    return {
      icon: RefreshCw,
      text: '同步中...',
      class: 'syncing'
    }
  }

  if (connStore.syncError) {
    return {
      icon: TriangleAlert,
      text: '同步失败',
      class: 'error'
    }
  }

  if (store.lastSyncTime) {
    const seconds = Math.floor((Date.now() - store.lastSyncTime) / 1000)
    if (seconds < 2) {
      return {
        icon: Check,
        text: '已同步',
        class: 'success'
      }
    }
  }

  return null
})

// 角色图标（lucide 组件）
const roleIcon = computed(() => {
  switch (myRole.value) {
    case 'host': return Crown
    case 'player': return Gamepad2
    case 'spectator': return Eye
    default: return null
  }
})

// 手机端角色徽章配色（host=紫 / player=蓝 / spectator=灰）
const roleBadgeClass = computed(() => {
  switch (myRole.value) {
    case 'host': return 'bg-purple-500/20 border-purple-500/40 text-purple-300'
    case 'player': return 'bg-blue-500/20 border-blue-500/40 text-blue-300'
    case 'spectator': return 'bg-slate-500/20 border-slate-500/40 text-slate-300'
    default: return 'bg-slate-500/20 border-slate-500/40 text-slate-300'
  }
})

// 获取角色标签
const getRoleLabel = () => {
  switch (myRole.value) {
    case 'host': return '主办方'
    case 'player': {
      // 显示选手ID
      return connStore.myPlayerName ? `选手 ${connStore.myPlayerName}` : '选手'
    }
    case 'spectator': return '观众'
    default: return ''
  }
}

// 当前小局序号 = 双方分数和 + 1
const roundNumber = computed(() => {
  return (store.player1.score || 0) + (store.player2.score || 0) + 1
})
const stage = computed(() => store.currentRound?.stage || 1)
const step = computed(() => store.currentRound?.step || 0)
const action = computed(() => store.currentRound?.action || '')
// 阶段数与阶段名不再硬编码 4，依据当前生效模板动态生成
const bpSequence = computed(() => store.currentRound?.bpSequence || [])
const stageNamesMap = computed(() => getStageNames(store.currentBPTemplate))

const stageName = computed(() => stageNamesMap.value[stage.value] || `阶段${stage.value}`)

const totalSteps = computed(() => {
  return bpSequence.value.reduce((total, stage) => total + stage.length, 0)
})

// globalBan 与 ban 共用 ban-red 色系
const isBanLike = (a) => a === 'ban' || a === 'globalBan'

const stageClass = computed(() => {
  if (isBanLike(action.value)) return 'text-ban-red'
  if (action.value === 'pick') return 'text-pick-blue'
  return 'text-gray-400'
})

const progressBarClass = computed(() => {
  if (isBanLike(action.value)) return 'bg-gradient-to-r from-ban-red-dark to-ban-red'
  if (action.value === 'pick') return 'bg-gradient-to-r from-pick-blue-dark to-pick-blue'
  return 'bg-gray-500'
})

// 检查是否有南瓜保护激活（extraPick.remaining > 0 表示有待消耗的南瓜保护名额）
const hasPumpkinProtection = computed(() => {
  const extraPick = store.currentRound?.extraPick
  return !!(extraPick && extraPick.remaining > 0)
})
</script>

<style scoped>
.sync-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.sync-status.syncing {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #60a5fa;
}

.sync-status.success {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.sync-status.error {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.sync-icon {
  font-size: 14px;
}

.sync-status.syncing .sync-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.sync-text {
  font-weight: 600;
}

.role-badge, .turn-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.role-badge {
  background: rgba(147, 51, 234, 0.2);
  border: 1px solid rgba(147, 51, 234, 0.4);
  color: #a855f7;
}

.role-icon {
  font-size: 14px;
}

.turn-badge {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.4);
  color: #22c55e;
}

.turn-badge.is-opponent {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
</style>

<template>
  <div class="glass-panel rounded-xl p-4 min-w-[300px] shadow-lg border-t border-white/10" role="region" aria-label="当前游戏阶段">
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
      <div class="text-3xl font-black mb-4 tracking-wide" :class="stageClass">
        {{ stageName }}
      </div>

      <!-- 进度条 -->
      <div class="mb-4 relative">
        <div class="w-full bg-gray-800/50 rounded-full h-3 border border-gray-700" role="progressbar" aria-label="BP 进度" :aria-valuenow="step + 1" :aria-valuemin="1" :aria-valuemax="totalSteps">
          <div
            class="h-full rounded-full transition-all duration-500 relative overflow-hidden"
            :class="progressBarClass"
            :style="{ width: `${((step + 1) / totalSteps) * 100}%` }"
          >
          </div>
        </div>
        <div class="flex justify-between items-center mt-1.5 px-1">
          <span class="text-[10px] text-gray-500">开始</span>
          <span class="text-xs text-gray-300 font-mono font-bold">{{ step + 1 }} <span class="text-gray-600">/</span> {{ totalSteps }}</span>
          <span class="text-[10px] text-gray-500">结束</span>
        </div>
      </div>

      <!-- 当前操作 -->
      <div class="mt-2">
        <div
          class="inline-flex items-center gap-3 px-6 py-2 rounded-lg text-lg font-bold shadow-lg transition-colors duration-300 border border-white/5"
          :class="actionClass"
        >
          <span class="inline-flex relative flex h-3 w-3">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span>{{ currentPlayerName }}</span>
          <span class="opacity-80 text-sm uppercase bg-black/20 px-2 py-0.5 rounded">{{ actionText }}</span>
        </div>
      </div>

      <!-- 南瓜保护提示 -->
      <transition name="fade">
        <div v-if="hasPumpkinProtection"
             class="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/50 flex items-center gap-2">
          <span class="text-lg">南</span>
          <span class="text-sm font-bold text-orange-300">南瓜保护已激活！下一个植物将获得保护</span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Crown, Gamepad2, Eye, RefreshCw, TriangleAlert, Check } from 'lucide-vue-next'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { getStageNames } from '@/utils/bpRules'

const store = useGameStore()
const connStore = useConnectionStore()

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
const currentPlayer = computed(() => store.currentRound?.currentPlayer || '')
const action = computed(() => store.currentRound?.action || '')
// 阶段数与阶段名不再硬编码 4，依据当前生效模板动态生成
const bpSequence = computed(() => store.currentRound?.bpSequence || [])
const stageNamesMap = computed(() => getStageNames(store.currentBPTemplate))

const stageName = computed(() => stageNamesMap.value[stage.value] || `阶段${stage.value}`)

const totalSteps = computed(() => {
  return bpSequence.value.reduce((total, stage) => total + stage.length, 0)
})

const currentPlayerName = computed(() => {
  if (currentPlayer.value === 'system') return '系统'
  if (currentPlayer.value === 'player1') {
    return store.player1.id || '蓝方'
  } else if (currentPlayer.value === 'player2') {
    return store.player2.id || '红方'
  }
  return ''
})

const actionText = computed(() => {
  if (action.value === 'ban') return '禁用'
  if (action.value === 'pick') return '选择'
  if (action.value === 'globalBan') return '全局禁用'
  return ''
})

// globalBan 与 ban 共用 ban-red 色系
const isBanLike = (a) => a === 'ban' || a === 'globalBan'

const stageClass = computed(() => {
  if (isBanLike(action.value)) return 'text-ban-red'
  if (action.value === 'pick') return 'text-pick-blue'
  return 'text-gray-400'
})

// 当前操作条 = 全场唯一发光焦点（单层 glow + 单处 ping）
const actionClass = computed(() => {
  if (isBanLike(action.value)) return 'bg-ban-red text-white shadow-[0_0_18px_rgba(239,68,68,0.45)]'
  if (action.value === 'pick') return 'bg-pick-blue text-white shadow-[0_0_18px_rgba(59,130,246,0.45)]'
  return 'bg-gray-600 text-white'
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

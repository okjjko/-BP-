<template>
  <div class="room-setup">
    <!-- 自动重连提示 -->
    <div v-if="showReconnectPrompt" class="reconnect-prompt">
      <div class="reconnect-card glass-panel rounded-xl p-6">
        <div class="reconnect-icon"><RefreshCw :size="48" /></div>
        <h3 class="text-xl font-bold text-center mb-2">检测到未完成的多人对战</h3>
        <p class="text-gray-400 text-center mb-4">
          {{ reconnectSession?.myRole === 'host' ? '你是主办方' : '你是' + reconnectSession?.myPlayerName }}
        </p>
        <div class="reconnect-info mb-4">
          <div class="info-item">
            <span class="info-label">角色：</span>
            <span class="info-value">{{ getRoleLabel(reconnectSession?.myRole) }}</span>
          </div>
          <div v-if="reconnectSession?.inviteCode" class="info-item">
            <span class="info-label">邀请码：</span>
            <span class="info-value">{{ reconnectSession.inviteCode }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">时间：</span>
            <span class="info-value">{{ getSessionTime(reconnectSession?.timestamp) }}</span>
          </div>
        </div>
        <div v-if="reconnectSession?.myRole === 'host'" class="warning-box mb-4">
          <p class="text-yellow-400 text-sm text-center flex items-center justify-center gap-1.5">
            <TriangleAlert :size="16" /> 主办方重连后会生成新的邀请码，需要选手重新加入
          </p>
        </div>
        <div class="flex gap-3">
          <button
            @click="performReconnect"
            :disabled="isReconnecting"
            class="flex-1 px-6 py-3 bg-plant-green hover:bg-plant-green-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Loader2 v-if="isReconnecting" :size="18" class="animate-spin" />
            {{ isReconnecting ? '重连中...' : '重新连接' }}
          </button>
          <button
            @click="cancelReconnect"
            :disabled="isReconnecting"
            class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            开始新对局
          </button>
        </div>
        <div v-if="reconnectError" class="error-message mt-3">
          {{ reconnectError }}
        </div>
      </div>
    </div>

    <!-- 模式选择 -->
    <div v-else-if="!mode" class="mode-selection">
      <h3 class="text-xl font-bold mb-4 text-center">选择对战模式</h3>
      <div class="flex gap-4 justify-center">
        <button
          @click="selectMode('local')"
          class="mode-btn px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <Home :size="18" /> 本地对战
        </button>
        <button
          @click="selectMode('multiplayer')"
          class="mode-btn px-6 py-3 bg-pick-blue hover:bg-pick-blue-dark text-white font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <Globe :size="18" /> 多人对战
        </button>
      </div>

      <!-- 植物管理按钮 -->
      <div class="mt-6 flex justify-center">
        <BaseButton variant="secondary" @click="uiStore.setShowPlantManager(true)">
          <template #icon><Sprout :size="18" /></template>
          植物管理
        </BaseButton>
      </div>
    </div>

    <!-- 多人对战设置 -->
    <div v-else class="multiplayer-setup">
      <!-- 角色选择 -->
      <div v-if="!role" class="role-selection">
        <h3 class="text-xl font-bold mb-4 text-center">选择你的角色</h3>
        <div class="flex flex-col gap-3">
          <button
            @click="selectRole('host')"
            class="role-btn px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Crown :size="24" />
            <div class="text-left">
              <div class="font-bold">主办方</div>
              <div class="text-sm opacity-80">创建房间，管理比赛</div>
            </div>
          </button>
          <button
            @click="selectRole('player')"
            class="role-btn px-6 py-4 bg-plant-green hover:bg-plant-green-dark text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Gamepad2 :size="24" />
            <div class="text-left">
              <div class="font-bold">选手</div>
              <div class="text-sm opacity-80">加入房间，参与对战</div>
            </div>
          </button>
          <button
            @click="selectRole('spectator')"
            class="role-btn px-6 py-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Eye :size="24" />
            <div class="text-left">
              <div class="font-bold">观众</div>
              <div class="text-sm opacity-80">加入房间，观看比赛</div>
            </div>
          </button>
        </div>
        <button
          @click="backToModeSelection"
          class="mt-4 w-full px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
        >
          ← 返回模式选择
        </button>
      </div>

      <!-- 主办方界面 -->
      <div v-else-if="role === 'host'" class="host-panel">
        <div class="panel-header">
          <h3 class="text-xl font-bold text-center text-purple-400 flex items-center justify-center gap-2">
            <Crown :size="20" /> 主办方控制台
          </h3>
        </div>

        <!-- 返回按钮 -->
        <button
          @click="backFromHostPanel"
          class="mb-4 w-full px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
        >
          <span>←</span>
          <span>返回对战模式选择</span>
        </button>

        <!-- 房间创建/显示 -->
        <div v-if="!inviteCode" class="creation-section">
          <!-- 公开房间开关 -->
          <label class="public-toggle flex items-center gap-2 mb-4 cursor-pointer justify-center">
            <input
              type="checkbox"
              v-model="isPublicRoom"
              class="w-4 h-4 accent-purple-500"
            >
            <span class="text-gray-300 text-sm flex items-center gap-1.5"><Globe :size="16" /> 公开房间（其他人可在公共列表中看到并加入）</span>
          </label>

          <!-- 房主显示名（公开房间时必填） -->
          <div v-if="isPublicRoom" class="input-group mb-4">
            <label class="input-label">房主显示名</label>
            <input
              v-model="hostName"
              type="text"
              maxlength="20"
              placeholder="如：小明"
              class="player-input"
            >
          </div>

          <button
            @click="createRoom"
            :disabled="isCreating || (isPublicRoom && !hostName.trim())"
            class="w-full px-6 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Loader2 v-if="isCreating" :size="20" class="animate-spin" />
            {{ isCreating ? '创建中...' : (isPublicRoom ? '创建公开房间' : '创建房间') }}
          </button>
        </div>

        <div v-else class="room-info">
          <!-- 邀请码显示 -->
          <div class="invite-code-display">
            <div class="text-sm text-gray-400 mb-2">邀请码</div>
            <div class="invite-code-text">{{ inviteCode }}</div>
            <button
              @click="copyInviteCode"
              class="copy-btn mt-3 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <ClipboardCopy v-if="!copied" :size="16" />
              <Check v-else :size="16" />
              <span>{{ copied ? '已复制' : '复制邀请码' }}</span>
            </button>
          </div>

          <!-- 连接状态 -->
          <div class="connection-status">
            <div class="status-item">
              <span class="status-label">已连接：</span>
              <span class="status-value">{{ connectionStats.total }} 人</span>
            </div>
            <div class="status-item">
              <span class="status-label">选手：</span>
              <span class="status-value">{{ connectionStats.players }} 人</span>
            </div>
            <div class="status-item">
              <span class="status-label">观众：</span>
              <span class="status-value">{{ connectionStats.spectators }} 人</span>
            </div>
          </div>

          <!-- ICE 连接状态指示器 -->
          <div v-if="connectionStatus" class="ice-status-indicator" :class="connectionStatusClass">
            <div class="status-icon"><component :is="connectionStatusIcon" :size="22" /></div>
            <div class="status-content">
              <div class="status-text">{{ connectionStatusMessage }}</div>
              <div v-if="connectionType" class="connection-type">{{ connectionType }}</div>
            </div>
          </div>

          <!-- 已连接用户列表 -->
          <div v-if="connectedUsers.length > 0" class="users-list">
            <div class="text-sm text-gray-400 mb-2">已连接用户</div>
            <div
              v-for="user in connectedUsers"
              :key="user.peerId"
              class="user-item"
            >
              <span class="user-icon"><component :is="getRoleIcon(user.role)" :size="18" /></span>
              <span class="user-role">{{ getRoleLabel(user.role) }}</span>
              <span class="user-status">{{ user.connected ? '● 在线' : '○ 离线' }}</span>
            </div>
          </div>

          <!-- 确认开始按钮 -->
          <button
            @click="confirmStart"
            :disabled="connectionStats.total === 0"
            class="start-btn mt-4 w-full px-6 py-3 bg-plant-green hover:bg-plant-green-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            开始对战 →
          </button>

          <button
            @click="leaveRoom"
            class="mt-3 w-full px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
          >
            解散房间
          </button>
        </div>
      </div>

      <!-- 选手/观众界面 -->
      <div v-else class="client-panel">
        <div class="panel-header">
          <h3 class="text-xl font-bold text-center text-plant-green flex items-center justify-center gap-2">
            <component :is="role === 'player' ? Gamepad2 : Eye" :size="20" />
            {{ role === 'player' ? '选手' : '观众' }}面板
          </h3>
        </div>

        <!-- 加入房间 -->
        <div v-if="!isConnected" class="join-section">
          <div class="input-group">
            <label class="input-label">输入邀请码</label>
            <input
              v-model="inputInviteCode"
              type="text"
              maxlength="6"
              placeholder="如：ABC123"
              class="invite-input"
              @keyup.enter="joinRoom"
            >
          </div>

          <!-- 选手ID输入 -->
          <div v-if="role === 'player'" class="input-group">
            <label class="input-label">你的ID/昵称</label>
            <input
              v-model="playerName"
              type="text"
              maxlength="20"
              placeholder="输入选手ID..."
              class="player-input"
              @keyup.enter="joinRoom"
            >
          </div>

          <button
            @click="joinRoom"
            :disabled="!canJoin || isJoining"
            class="join-btn w-full px-6 py-4 bg-plant-green hover:bg-plant-green-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors mt-4 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plant-green focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Loader2 v-if="isJoining" :size="20" class="animate-spin" />
            {{ isJoining ? '连接中...' : '加入房间' }}
          </button>

          <div v-if="joinError" class="error-message mt-3">
            {{ joinError }}
          </div>

          <!-- 分隔线 -->
          <div class="lobby-divider flex items-center my-4 gap-3">
            <div class="flex-1 h-px bg-gray-700"></div>
            <span class="text-gray-500 text-xs">或者</span>
            <div class="flex-1 h-px bg-gray-700"></div>
          </div>

          <!-- 浏览公共房间入口 -->
          <button
            @click="toggleLobbyList"
            class="w-full px-4 py-2.5 bg-pick-blue/80 hover:bg-pick-blue text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Globe :size="18" />
            <span>{{ showLobbyList ? '收起公共房间列表' : '浏览公共房间' }}</span>
          </button>

          <!-- 公共房间列表 -->
          <div v-if="showLobbyList" class="lobby-list mt-3">
            <div class="lobby-list-header flex justify-between items-center mb-2">
              <span class="text-sm text-gray-400">公共房间 ({{ lobbyRooms.length }})</span>
              <button
                @click="refreshLobbyList"
                :disabled="lobbyLoading"
                class="text-xs text-pick-blue hover:text-pick-blue-dark disabled:opacity-50 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue rounded"
              >
                <RefreshCw :size="12" :class="lobbyLoading ? 'animate-spin' : ''" />
                {{ lobbyLoading ? '刷新中...' : '刷新' }}
              </button>
            </div>

            <div v-if="lobbyError" class="error-message">{{ lobbyError }}</div>

            <div v-if="lobbyRooms.length === 0 && !lobbyLoading" class="text-center text-gray-500 text-sm py-4">
              暂无公开房间
            </div>

            <button
              v-for="room in lobbyRooms"
              :key="room.inviteCode"
              type="button"
              class="lobby-room-card glass-panel rounded-lg p-3 mb-2 w-full text-left hover:border-pick-blue/50 transition-colors border border-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pick-blue focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              @click="joinFromLobby(room)"
            >
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <Crown :size="18" class="text-yellow-400" />
                  <span class="font-semibold text-white">{{ room.hostName }}</span>
                </div>
                <span class="text-xs text-gray-400">{{ formatLobbyTime(room.createdAt) }}</span>
              </div>
              <div class="flex gap-3 mt-1 text-xs text-gray-400">
                <span class="flex items-center gap-1"><Gamepad2 :size="12" /> 选手 {{ room.playerCount }}/2</span>
                <span class="flex items-center gap-1"><Eye :size="12" /> 观众 {{ room.spectatorCount }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 等待确认 -->
        <div v-else class="waiting-section">
          <div class="success-icon"><Check :size="40" /></div>
          <div class="success-text">已连接到主办方</div>
          <div class="info-text">等待比赛开始...</div>

          <button
            @click="leaveRoom"
            class="mt-4 px-6 py-2 text-red-400 hover:text-red-300 transition-colors"
          >
            离开房间
          </button>
        </div>

        <button
          v-if="!isConnected"
          @click="backToRoleSelection"
          class="mt-4 w-full px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
        >
          ← 返回角色选择
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import roomManager from '@/utils/roomManager'
import * as lobbyApi from '@/utils/lobbyApi'
import webrtcConfig from '@/config/webrtc.config'
import { useGameStore } from '@/stores/gameStore'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUIStore } from '@/stores/uiStore'
import { useToast } from '@/composables/useToast'
import {
  RefreshCw, Globe, Home, Sprout, Crown, Gamepad2, Eye,
  ClipboardCopy, Check, TriangleAlert, Plug, CheckCircle2,
  CircleX, Lock, HelpCircle, Loader2,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['startGame', 'cancel'])
const store = useGameStore()
const connStore = useConnectionStore()
const uiStore = useUIStore()
const toast = useToast()

// 连接状态相关
const connectionStatus = ref(null)
const connectionMessage = ref('')
const connectionType = ref('')

// 状态
const mode = ref(null) // 'local' | 'multiplayer'
const role = ref(null) // 'host' | 'player' | 'spectator'
const inviteCode = ref(null)
const inputInviteCode = ref('')
const playerName = ref('') // 选手ID/昵称
const isCreating = ref(false)
const isJoining = ref(false)
const isConnected = ref(false)
const joinError = ref('')
const copied = ref(false)
const connectedUsers = ref([])

// 公共房间（lobby）相关
const isPublicRoom = ref(false)        // 是否公开房间
const hostName = ref('')               // 房主显示名（lobby 展示用）
const hostSecret = ref(null)           // lobby 返回的注销/心跳凭证（内存，不持久化）
const lobbyHeartbeatTimer = ref(null)  // 房主心跳定时器 id

// 自动重连相关
const showReconnectPrompt = ref(false)
const reconnectSession = ref(null)
const isReconnecting = ref(false)
const reconnectError = ref('')

// 连接统计
const connectionStats = computed(() => {
  const stats = { total: 0, players: 0, spectators: 0 }
  connectedUsers.value.forEach(user => {
    if (user.connected) {
      stats.total++
      if (user.role === 'player') stats.players++
      if (user.role === 'spectator') stats.spectators++
    }
  })
  return stats
})

// 检查是否可以加入房间
const canJoin = computed(() => {
  if (!inputInviteCode.value) return false
  if (role.value === 'player' && !playerName.value.trim()) return false
  return true
})

// 连接状态相关的计算属性
const connectionStatusClass = computed(() => ({
  'status-connecting': connectionStatus.value === 'checking' || connectionStatus.value === 'new',
  'status-connected': connectionStatus.value === 'connected' || connectionStatus.value === 'completed',
  'status-failed': connectionStatus.value === 'failed' || connectionStatus.value === 'disconnected'
}))

const connectionStatusIcon = computed(() => {
  const icons = {
    'new': Plug,
    'checking': RefreshCw,
    'connected': CheckCircle2,
    'completed': CheckCircle2,
    'failed': CircleX,
    'disconnected': TriangleAlert,
    'closed': Lock
  }
  return icons[connectionStatus.value] || null
})

const connectionStatusMessage = computed(() => connectionMessage.value)

// 选择模式
const selectMode = (selectedMode) => {
  mode.value = selectedMode

  if (selectedMode === 'local') {
    // 本地模式，直接开始游戏
    emit('startGame', { mode: 'local' })
  }
}

// 返回模式选择
const backToModeSelection = () => {
  mode.value = null
  role.value = null
}

// 从主办方面板返回
const backFromHostPanel = () => {
  // 如果已创建房间，先清理连接
  if (inviteCode.value) {
    unregisterPublicRoom()  // 先注销公开房间
    roomManager.disconnect()
    inviteCode.value = null
    connectedUsers.value = []
    connStore.clearMultiplayerSession()
  }
  // 返回模式选择
  backToModeSelection()
}

// 选择角色
const selectRole = (selectedRole) => {
  role.value = selectedRole
}

// 返回角色选择
const backToRoleSelection = () => {
  role.value = null
  inputInviteCode.value = ''
  playerName.value = ''
  joinError.value = ''
}

// 创建房间（主办方）
const createRoom = async () => {
  // 公开房间需要房主显示名
  if (isPublicRoom.value && !hostName.value.trim()) {
    joinError.value = '请输入房主显示名'
    return
  }

  isCreating.value = true

  try {
    const code = await roomManager.createRoom()
    inviteCode.value = code
    console.log('房间已创建，邀请码:', code)

    // 关键修复：主办方也需要设置 roomMode，否则 startStateSync() 会认为这是本地模式
    connStore.setRoomMode('host', code)

    // 关键修复：主办方需要设置身份，否则无法转发状态
    connStore.setMyIdentity('host', null)

    // 主办方也需要开始状态同步，以便接收选手的消息
    connStore.startStateSync()

    // ===== 公共房间：登记到 lobby 目录并启心跳 =====
    if (isPublicRoom.value) {
      connStore.wasPublicRoom = true
      connStore.hostName = hostName.value.trim()
      try {
        const res = await lobbyApi.registerRoom(code, hostName.value.trim())
        hostSecret.value = res.hostSecret
        startLobbyHeartbeat(code, res.hostSecret)
        console.log('[lobby] 已登记公开房间', code)
      } catch (e) {
        // 登记失败：房间退化为私密，仍可用邀请码，不阻断
        console.warn('[lobby] 公开登记失败，房间退化为私密:', e)
        joinError.value = '公开登记失败，房间仍可用邀请码（私密模式）'
        isPublicRoom.value = false
        connStore.wasPublicRoom = false
      }
    }
  } catch (error) {
    console.error('创建房间失败:', error)
    joinError.value = '创建房间失败，请重试'
  } finally {
    isCreating.value = false
  }
}

// 房主心跳保活：定期向 lobby 上报房间状态，防止被 TTL 清理
const startLobbyHeartbeat = (code, secret) => {
  stopLobbyHeartbeat()
  const tick = async () => {
    const stats = roomManager.getConnectionStats()
    try {
      await lobbyApi.heartbeat(code, secret, {
        playerCount: stats.players,
        spectatorCount: stats.spectators
      })
    } catch (e) {
      // 404 = 房间已被服务端过期（可能因网络中断超过 TTL），停止心跳
      // 房间本身（P2P）还在，只是不再出现在公共列表
      if (e.response && e.response.status === 404) {
        console.warn('[lobby] 房间已在目录过期，停止心跳')
        stopLobbyHeartbeat()
      }
    }
  }
  tick() // 立即发一次
  lobbyHeartbeatTimer.value = setInterval(tick, webrtcConfig.lobby.heartbeatIntervalMs)
}

const stopLobbyHeartbeat = () => {
  if (lobbyHeartbeatTimer.value) {
    clearInterval(lobbyHeartbeatTimer.value)
    lobbyHeartbeatTimer.value = null
  }
}

// 注销公开房间（解散/离开时调用）—— 停心跳 + 通知 lobby 删除
const unregisterPublicRoom = () => {
  stopLobbyHeartbeat()
  if (inviteCode.value && hostSecret.value) {
    lobbyApi.unregisterRoom(inviteCode.value, hostSecret.value)
  }
  hostSecret.value = null
}

// 加入房间（选手/观众）
const joinRoom = async () => {
  // 选手需要输入ID
  if (role.value === 'player' && !playerName.value.trim()) {
    joinError.value = '请输入你的ID'
    return
  }

  if (!inputInviteCode.value) {
    joinError.value = '请输入邀请码'
    return
  }

  isJoining.value = true
  joinError.value = ''

  try {
    // 加入房间并传递选手ID
    await roomManager.joinRoom(
      inputInviteCode.value.toUpperCase(),
      role.value,
      role.value === 'player' ? playerName.value.trim() : null
    )

    // 关键修复：在加入房间成功后立即设置 roomMode
    connStore.setRoomMode(role.value, inputInviteCode.value.toUpperCase())

    // 设置身份到connStore
    if (role.value === 'player') {
      connStore.setMyIdentity('player', playerName.value.trim())
    } else if (role.value === 'spectator') {
      connStore.setMyIdentity('spectator', null)
    }

    isConnected.value = true

    // 开始状态同步，这样才能接收游戏开始消息
    connStore.startStateSync()

    console.log('已加入房间，roomMode 已设置为:', connStore.roomMode)
  } catch (error) {
    console.error('加入房间失败:', error)
    joinError.value = error.message || '加入房间失败，请检查邀请码是否正确'
  } finally {
    isJoining.value = false
  }
}

// ===== 公共房间列表（选手/观众端） =====
const showLobbyList = ref(false)
const lobbyRooms = ref([])
const lobbyLoading = ref(false)
const lobbyError = ref('')
let lobbyPollTimer = null

const toggleLobbyList = async () => {
  showLobbyList.value = !showLobbyList.value
  if (showLobbyList.value) {
    await refreshLobbyList()
    startLobbyPolling()
  } else {
    stopLobbyPolling()
  }
}

const refreshLobbyList = async () => {
  lobbyLoading.value = true
  lobbyError.value = ''
  try {
    const res = await lobbyApi.listRooms()
    lobbyRooms.value = res.rooms || []
  } catch (e) {
    lobbyError.value = '无法获取公共房间列表'
    lobbyRooms.value = []
  } finally {
    lobbyLoading.value = false
  }
}

const startLobbyPolling = () => {
  stopLobbyPolling()
  lobbyPollTimer = setInterval(refreshLobbyList, webrtcConfig.lobby.listRefreshIntervalMs)
}

const stopLobbyPolling = () => {
  if (lobbyPollTimer) {
    clearInterval(lobbyPollTimer)
    lobbyPollTimer = null
  }
}

// 从公共房间列表加入 —— 复用现有 joinRoom 逻辑（把邀请码填入输入框再调 joinRoom）
const joinFromLobby = async (room) => {
  inputInviteCode.value = room.inviteCode
  await joinRoom()
  // 加入成功后停止轮询
  if (isConnected.value) {
    stopLobbyPolling()
    showLobbyList.value = false
  }
}

const formatLobbyTime = (ts) => {
  const minutes = Math.floor((Date.now() - ts) / 60000)
  return minutes > 0 ? `${minutes} 分钟前` : '刚刚'
}

// 复制邀请码（兼容 HTTP 和 HTTPS）
const copyInviteCode = async () => {
  const code = inviteCode.value

  // 方案1: 优先使用现代 Clipboard API（仅 HTTPS）
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(code)
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
      return
    } catch (error) {
      console.warn('Clipboard API 失败，尝试备用方案:', error)
    }
  }

  // 方案2: 使用传统的 document.execCommand（兼容 HTTP）
  try {
    // 创建一个临时的 textarea 元素
    const textarea = document.createElement('textarea')
    textarea.value = code
    textarea.style.position = 'fixed'  // 防止页面滚动
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    // 选中并复制
    textarea.select()
    textarea.setSelectionRange(0, 99999)  // 兼容移动设备

    const successful = document.execCommand('copy')

    // 清理
    document.body.removeChild(textarea)

    if (successful) {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    } else {
      throw new Error('execCommand 失败')
    }
  } catch (error) {
    console.error('复制失败:', error)
    // 提示用户手动复制
    toast.error(`复制失败，请手动复制邀请码：${code}`, { duration: 6000 })
  }
}

// 确认开始（主办方）
const confirmStart = () => {
  emit('startGame', {
    mode: 'host',  // 修复：应该是 'host' 而不是 'multiplayer'
    role: 'host',
    inviteCode: inviteCode.value
  })
}

// 离开房间
const leaveRoom = () => {
  unregisterPublicRoom()  // 先注销公开房间（房主）并停止心跳
  roomManager.disconnect()
  inviteCode.value = null
  inputInviteCode.value = ''
  isConnected.value = false
  connectedUsers.value = []
  // 清除重连会话信息
  connStore.clearMultiplayerSession()
  emit('cancel')
}

// 获取角色图标
const getRoleIcon = (r) => {
  const icons = {
    host: Crown,
    player: Gamepad2,
    spectator: Eye
  }
  return icons[r] || HelpCircle
}

// 获取角色标签
const getRoleLabel = (r) => {
  const labels = {
    host: '主办方',
    player: '选手',
    spectator: '观众'
  }
  return labels[r] || r
}

// 获取会话时间显示
const getSessionTime = (timestamp) => {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}小时前`
  } else if (minutes > 0) {
    return `${minutes}分钟前`
  } else {
    return '刚刚'
  }
}

// 检查是否有需要重连的会话
const checkReconnectSession = () => {
  const session = connStore.loadMultiplayerSession()
  if (session && session.roomMode && session.roomMode !== 'local') {
    console.log('[RoomSetup] 检测到需要重连的会话:', session)
    reconnectSession.value = session
    showReconnectPrompt.value = true
  }
}

// 执行重连
const performReconnect = async () => {
  if (!reconnectSession.value) return

  isReconnecting.value = true
  reconnectError.value = ''

  try {
    const session = reconnectSession.value

    if (session.myRole === 'host') {
      // 主办方：重新创建房间
      console.log('[RoomSetup] 主办方重连，创建新房间...')
      // 恢复"公开房间"状态：createRoom 会用新 inviteCode + 原 hostName 重新登记到 lobby
      isPublicRoom.value = !!session.wasPublicRoom
      hostName.value = session.hostName || ''
      await createRoom()

      // 房间创建成功后，恢复游戏状态
      if (store.loadFromLocalStorage()) {
        console.log('[RoomSetup] 游戏状态已恢复')
        // 通知选手开始游戏（因为已经开始了）
        emit('startGame', {
          mode: 'multiplayer',
          role: 'host',
          inviteCode: inviteCode.value
        })
      }
    } else {
      // 选手/观众：重新加入房间
      console.log('[RoomSetup] 选手/观众重连，加入房间...')
      mode.value = 'multiplayer'
      role.value = session.myRole
      inputInviteCode.value = session.inviteCode
      playerName.value = session.myPlayerName

      await joinRoom()

      // 重连成功后，恢复游戏状态
      if (isConnected.value && store.loadFromLocalStorage()) {
        console.log('[RoomSetup] 游戏状态已恢复')
        emit('startGame', {
          mode: 'multiplayer',
          role: session.myRole,
          inviteCode: session.inviteCode
        })
      }
    }

    showReconnectPrompt.value = false
    reconnectSession.value = null
  } catch (error) {
    console.error('[RoomSetup] 重连失败:', error)
    reconnectError.value = error.message || '重连失败，请检查网络或邀请码是否正确'
  } finally {
    isReconnecting.value = false
  }
}

// 取消重连，开始新对局
const cancelReconnect = () => {
  console.log('[RoomSetup] 取消重连，清除旧会话')
  connStore.clearMultiplayerSession()
  showReconnectPrompt.value = false
  reconnectSession.value = null
  reconnectError.value = ''
}

// 更新已连接用户列表
const updateConnectedUsers = () => {
  connectedUsers.value = roomManager.getConnectedUsers()
}

// 定义事件处理函数（保存引用以便正确清理）
const handleUserJoined = ({ peerId, role }) => {
  console.log('用户加入:', peerId, role)
  updateConnectedUsers()
}

const handleUserLeft = ({ peerId }) => {
  console.log('用户离开:', peerId)
  updateConnectedUsers()
}

const handleConnected = () => {
  isConnected.value = true
}

const handleGameStart = (data) => {
  console.log('[RoomSetup] 收到游戏开始消息:', data)
  const { player1Name, player2Name, player1Road, player2Road, globalBans, hiddenBuiltinPlants } = data

  // 新增：在游戏开始前先同步隐藏植物设置
  if (hiddenBuiltinPlants && Array.isArray(hiddenBuiltinPlants)) {
    localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(hiddenBuiltinPlants))
    console.log('[RoomSetup] 已同步主办方的隐藏植物设置:', hiddenBuiltinPlants.length, '个')
  } else {
    // 如果主办方没有隐藏植物，清除选手端的本地设置
    localStorage.removeItem('hiddenBuiltinPlants')
    console.log('[RoomSetup] 主办方没有隐藏植物，已清除本地设置')
  }

  // 1. 先保存 globalBans（因为 initGame 会清空它）
  const savedGlobalBans = globalBans || []

  // 2. 初始化游戏（选手端跳过 randomBanPlants，会清空 globalBans）
  store.initGame(
    player1Name,
    player2Name,
    'player1', // 默认第一个选手先手
    player1Road,
    player2Road
  )

  // 3. 恢复 globalBans
  if (savedGlobalBans.length > 0) {
    store.globalBans = [...savedGlobalBans]
    console.log('[RoomSetup] 已恢复永久禁用植物:', savedGlobalBans.length, '个')
  }

  // 选手端不需要调用 syncState()，会通过 handleStateUpdate() 接收主办方的状态

  // 通知父组件隐藏房间设置界面
  emit('startGame', {
    mode: 'multiplayer',
    role: connStore.myRole,
    inviteCode: connStore.inviteCode
  })
}

const handleError = ({ type, error }) => {
  console.error('房间错误:', type, error)
  if (type === 'connection') {
    joinError.value = '连接失败，请检查邀请码'
  }
}

const handleConnectionStatus = ({ status, message }) => {
  console.log('连接状态变化:', status, message)
  connectionStatus.value = status
  connectionMessage.value = message

  // 判断连接类型（简化处理）
  if (status === 'connected') {
    connectionType.value = 'P2P 直连'
    // 3秒后自动隐藏成功消息
    setTimeout(() => {
      connectionStatus.value = null
    }, 3000)
  } else if (status === 'completed') {
    connectionType.value = 'P2P 直连（已完成）'
    setTimeout(() => {
      connectionStatus.value = null
    }, 3000)
  }
}

// 设置事件监听器（使用命名函数）
const setupEventListeners = () => {
  roomManager.on('userJoined', handleUserJoined)
  roomManager.on('userLeft', handleUserLeft)
  roomManager.on('connected', handleConnected)
  roomManager.on('gameStart', handleGameStart)
  roomManager.on('error', handleError)
  roomManager.on('connectionStatus', handleConnectionStatus)
}

// 清理事件监听器（传入相同的函数引用）
const cleanupEventListeners = () => {
  roomManager.off('userJoined', handleUserJoined)
  roomManager.off('userLeft', handleUserLeft)
  roomManager.off('connected', handleConnected)
  roomManager.off('gameStart', handleGameStart)
  roomManager.off('error', handleError)
  roomManager.off('connectionStatus', handleConnectionStatus)
}

onMounted(() => {
  setupEventListeners()
  // 检查是否有需要重连的会话
  checkReconnectSession()
})

onUnmounted(() => {
  cleanupEventListeners()
  stopLobbyHeartbeat()  // 防止房主心跳定时器泄漏（关页面靠服务端 TTL 兜底）
  stopLobbyPolling()    // 防止选手列表轮询定时器泄漏
})
</script>

<style scoped>
.room-setup {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.mode-btn,
.role-btn {
  min-width: 150px;
}

.invite-code-display {
  background: rgba(147, 51, 234, 0.1);
  border: 2px solid rgba(147, 51, 234, 0.3);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.invite-code-text {
  font-size: 48px;
  font-weight: bold;
  letter-spacing: 8px;
  color: #a855f7;
  font-family: 'Courier New', monospace;
}

.connection-status {
  margin-top: 20px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 15px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.status-item:last-child {
  margin-bottom: 0;
}

.status-label {
  color: #9ca3af;
}

.status-value {
  font-weight: bold;
  color: #ffffff;
}

.users-list {
  margin-top: 15px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.user-item:last-child {
  border-bottom: none;
}

.user-icon {
  font-size: 20px;
}

.user-role {
  flex: 1;
  color: #e5e7eb;
}

.user-status {
  font-size: 12px;
}

.user-status:nth-child(3) {
  color: #22c55e;
}

.input-group {
  margin-bottom: 15px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  color: #9ca3af;
  font-size: 14px;
}

.invite-input {
  width: 100%;
  padding: 12px;
  font-size: 24px;
  text-align: center;
  letter-spacing: 4px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
}

.invite-input:focus {
  outline: none;
  border-color: #22c55e;
}

.invite-input::placeholder {
  letter-spacing: 1px;
  text-transform: none;
  font-size: 16px;
}

.player-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
}

.player-input:focus {
  outline: none;
  border-color: #22c55e;
}

.player-input::placeholder {
  color: #6b7280;
}

.error-message {
  padding: 12px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  text-align: center;
  font-size: 14px;
}

.waiting-section {
  text-align: center;
  padding: 30px;
}

.success-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: white;
}

.success-text {
  font-size: 24px;
  font-weight: bold;
  color: #22c55e;
  margin-bottom: 8px;
}

.info-text {
  color: #9ca3af;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:not(:disabled) {
  cursor: pointer;
}

.copy-btn:hover:not(:disabled) {
  background: rgba(107, 114, 128, 0.8);
}

/* 自动重连提示样式 */
.reconnect-prompt {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 20px;
}

.reconnect-card {
  width: 100%;
  max-width: 500px;
  text-align: center;
}

.reconnect-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.reconnect-info {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 15px;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #9ca3af;
  font-size: 14px;
}

.info-value {
  color: #ffffff;
  font-weight: 600;
}

.warning-box {
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: 8px;
  padding: 12px;
}

/* ICE 连接状态指示器 */
.ice-status-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  margin: 1rem 0;
  animation: fadeIn 0.3s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-content {
  flex: 1;
}

.ice-status-indicator .status-icon {
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
}

.ice-status-indicator .status-text {
  font-size: 0.9375rem;
  color: #e5e7eb;
  font-weight: 500;
}

.ice-status-indicator .connection-type {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.25rem;
}

.ice-status-indicator.status-connecting .status-icon {
  animation: spin 1s linear infinite;
}

.ice-status-indicator.status-connected {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.1);
}

.ice-status-indicator.status-failed {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

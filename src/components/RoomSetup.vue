<template>
  <div class="room-setup">
    <!-- 自动重连提示 -->
    <div v-if="showReconnectPrompt" class="reconnect-prompt">
      <div class="reconnect-card glass-panel rounded-xl p-6">
        <div class="reconnect-icon">🔄</div>
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
          <p class="text-yellow-400 text-sm text-center">
            ⚠️ 主办方重连后会生成新的邀请码，需要选手重新加入
          </p>
        </div>
        <div class="flex gap-3">
          <button
            @click="performReconnect"
            :disabled="isReconnecting"
            class="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-all"
          >
            {{ isReconnecting ? '重连中...' : '重新连接' }}
          </button>
          <button
            @click="cancelReconnect"
            :disabled="isReconnecting"
            class="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-all"
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
          class="mode-btn px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all"
        >
          🏠 本地对战
        </button>
        <button
          @click="selectMode('multiplayer')"
          class="mode-btn px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all"
        >
          🌐 多人对战
        </button>
      </div>

      <!-- 植物管理按钮 -->
      <div class="mt-6 flex justify-center">
        <button
          @click="showPlantManager = true"
          class="px-6 py-2.5 bg-purple-600/80 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all duration-300 border border-purple-400/50 hover:border-purple-300 shadow-lg hover:shadow-purple-500/20 flex items-center gap-2"
        >
          <span>🌱</span>
          <span>植物管理</span>
        </button>
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
            class="role-btn px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span class="text-2xl">👑</span>
            <div class="text-left">
              <div class="font-bold">主办方</div>
              <div class="text-sm opacity-80">创建房间，管理比赛</div>
            </div>
          </button>
          <button
            @click="selectRole('player')"
            class="role-btn px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span class="text-2xl">🎮</span>
            <div class="text-left">
              <div class="font-bold">选手</div>
              <div class="text-sm opacity-80">加入房间，参与对战</div>
            </div>
          </button>
          <button
            @click="selectRole('spectator')"
            class="role-btn px-6 py-4 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span class="text-2xl">👀</span>
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
          <h3 class="text-xl font-bold text-center text-purple-400">👑 主办方控制台</h3>
        </div>

        <!-- 房间创建/显示 -->
        <div v-if="!inviteCode" class="creation-section">
          <button
            @click="createRoom"
            :disabled="isCreating"
            class="w-full px-6 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-all"
          >
            {{ isCreating ? '创建中...' : '创建房间' }}
          </button>
        </div>

        <div v-else class="room-info">
          <!-- 邀请码显示 -->
          <div class="invite-code-display">
            <div class="text-sm text-gray-400 mb-2">邀请码</div>
            <div class="invite-code-text">{{ inviteCode }}</div>
            <button
              @click="copyInviteCode"
              class="copy-btn mt-3 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <span v-if="!copied">📋 复制邀请码</span>
              <span v-else>✓ 已复制</span>
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

          <!-- 已连接用户列表 -->
          <div v-if="connectedUsers.length > 0" class="users-list">
            <div class="text-sm text-gray-400 mb-2">已连接用户</div>
            <div
              v-for="user in connectedUsers"
              :key="user.peerId"
              class="user-item"
            >
              <span class="user-icon">{{ getRoleIcon(user.role) }}</span>
              <span class="user-role">{{ getRoleLabel(user.role) }}</span>
              <span class="user-status">{{ user.connected ? '● 在线' : '○ 离线' }}</span>
            </div>
          </div>

          <!-- 确认开始按钮 -->
          <button
            @click="confirmStart"
            :disabled="connectionStats.total === 0"
            class="start-btn mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
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
          <h3 class="text-xl font-bold text-center text-green-400">
            {{ role === 'player' ? '🎮 选手' : '👀 观众' }}面板
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
            :disabled="!canJoin"
            class="join-btn w-full px-6 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-all mt-4"
          >
            {{ isJoining ? '连接中...' : '加入房间' }}
          </button>

          <div v-if="joinError" class="error-message mt-3">
            {{ joinError }}
          </div>
        </div>

        <!-- 等待确认 -->
        <div v-else class="waiting-section">
          <div class="success-icon">✓</div>
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

    <!-- 植物管理模态框 -->
    <PlantManager v-model:show="showPlantManager" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import roomManager from '@/utils/roomManager'
import { useGameStore } from '@/store/gameStore'
import PlantManager from '@/components/PlantManager/index.vue'

const emit = defineEmits(['startGame', 'cancel'])
const store = useGameStore()

// 植物管理模态框状态
const showPlantManager = ref(false)

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
  isCreating.value = true

  try {
    const code = await roomManager.createRoom()
    inviteCode.value = code
    console.log('房间已创建，邀请码:', code)

    // ✅ 关键修复：主办方也需要设置 roomMode，否则 startStateSync() 会认为这是本地模式
    store.setRoomMode('host', code)

    // ✅ 关键修复：主办方需要设置身份，否则无法转发状态
    store.setMyIdentity('host', null)

    // 主办方也需要开始状态同步，以便接收选手的消息
    store.startStateSync()
  } catch (error) {
    console.error('创建房间失败:', error)
    joinError.value = '创建房间失败，请重试'
  } finally {
    isCreating.value = false
  }
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

    // ✅ 关键修复：在加入房间成功后立即设置 roomMode
    store.setRoomMode(role.value, inputInviteCode.value.toUpperCase())

    // 设置身份到store
    if (role.value === 'player') {
      store.setMyIdentity('player', playerName.value.trim())
    } else if (role.value === 'spectator') {
      store.setMyIdentity('spectator', null)
    }

    isConnected.value = true

    // 开始状态同步，这样才能接收游戏开始消息
    store.startStateSync()

    console.log('已加入房间，roomMode 已设置为:', store.roomMode)
  } catch (error) {
    console.error('加入房间失败:', error)
    joinError.value = error.message || '加入房间失败，请检查邀请码是否正确'
  } finally {
    isJoining.value = false
  }
}

// 复制邀请码
const copyInviteCode = async () => {
  try {
    await navigator.clipboard.writeText(inviteCode.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('复制失败:', error)
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
  roomManager.disconnect()
  inviteCode.value = null
  inputInviteCode.value = ''
  isConnected.value = false
  connectedUsers.value = []
  // 清除重连会话信息
  store.clearMultiplayerSession()
  emit('cancel')
}

// 获取角色图标
const getRoleIcon = (r) => {
  const icons = {
    host: '👑',
    player: '🎮',
    spectator: '👀'
  }
  return icons[r] || '❓'
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
  const session = store.loadMultiplayerSession()
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
  store.clearMultiplayerSession()
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
  const { player1Name, player2Name, player1Road, player2Road, globalBans } = data

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
    role: store.myRole,
    inviteCode: store.inviteCode
  })
}

const handleError = ({ type, error }) => {
  console.error('房间错误:', type, error)
  if (type === 'connection') {
    joinError.value = '连接失败，请检查邀请码'
  }
}

// 设置事件监听器（使用命名函数）
const setupEventListeners = () => {
  roomManager.on('userJoined', handleUserJoined)
  roomManager.on('userLeft', handleUserLeft)
  roomManager.on('connected', handleConnected)
  roomManager.on('gameStart', handleGameStart)
  roomManager.on('error', handleError)
}

// 清理事件监听器（传入相同的函数引用）
const cleanupEventListeners = () => {
  roomManager.off('userJoined', handleUserJoined)
  roomManager.off('userLeft', handleUserLeft)
  roomManager.off('connected', handleConnected)
  roomManager.off('gameStart', handleGameStart)
  roomManager.off('error', handleError)
}

onMounted(() => {
  setupEventListeners()
  // 检查是否有需要重连的会话
  checkReconnectSession()
})

onUnmounted(() => {
  cleanupEventListeners()
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
</style>

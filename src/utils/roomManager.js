/**
 * 房间管理器 - WebRTC P2P 连接管理（重构版）
 *
 * 改进：
 * - 心跳机制：30s ping/pong 检测死连接
 * - 自动重连：断线后自动尝试重新加入房间
 * - 操作队列：防止快速操作导致竞态
 * - 连接状态监控：实时连接质量反馈
 */

import Peer from 'peerjs'
import webrtcConfig from '@/config/webrtc.config'

// 心跳配置
const HEARTBEAT_INTERVAL = 30000  // 30秒发送一次心跳
const HEARTBEAT_TIMEOUT = 10000   // 10秒无回复视为断开

// 重连配置
const RECONNECT_MAX_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 2000 // 基础延迟2秒

class RoomManager {
  constructor() {
    this.peer = null
    this.connections = new Map()
    this.role = null
    this.inviteCode = null
    this.eventHandlers = new Map()
    this.localVersion = 0

    // 心跳相关
    this._heartbeatTimers = new Map()   // peerId -> intervalId
    this._heartbeatTimeouts = new Map() // peerId -> timeoutId

    // 重连相关
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._isReconnecting = false
    this._lastJoinParams = null  // 缓存上次加入房间的参数

    // 消息队列
    this._messageQueue = []
    this._isProcessingQueue = false
  }

  // ==================== 心跳机制 ====================

  /**
   * 为连接启动心跳检测
   */
  _startHeartbeat(peerId, conn) {
    this._stopHeartbeat(peerId)

    const timer = setInterval(() => {
      if (!conn.open) {
        this._stopHeartbeat(peerId)
        return
      }

      // 发送 ping
      try {
        conn.send({ type: 'ping', timestamp: Date.now() })
      } catch (e) {
        console.warn('[Heartbeat] 发送 ping 失败:', e)
        this._handleHeartbeatTimeout(peerId)
        return
      }

      // 设置超时等待 pong
      const timeout = setTimeout(() => {
        console.warn(`[Heartbeat] ${peerId} 心跳超时`)
        this._handleHeartbeatTimeout(peerId)
      }, HEARTBEAT_TIMEOUT)

      this._heartbeatTimeouts.set(peerId, timeout)
    }, HEARTBEAT_INTERVAL)

    this._heartbeatTimers.set(peerId, timer)
  }

  /**
   * 停止心跳检测
   */
  _stopHeartbeat(peerId) {
    const timer = this._heartbeatTimers.get(peerId)
    if (timer) {
      clearInterval(timer)
      this._heartbeatTimers.delete(peerId)
    }
    const timeout = this._heartbeatTimeouts.get(peerId)
    if (timeout) {
      clearTimeout(timeout)
      this._heartbeatTimeouts.delete(peerId)
    }
  }

  /**
   * 停止所有心跳
   */
  _stopAllHeartbeats() {
    this._heartbeatTimers.forEach((timer) => clearInterval(timer))
    this._heartbeatTimers.clear()
    this._heartbeatTimeouts.forEach((timeout) => clearTimeout(timeout))
    this._heartbeatTimeouts.clear()
  }

  /**
   * 处理心跳超时
   */
  _handleHeartbeatTimeout(peerId) {
    console.warn(`[RoomManager] 连接 ${peerId} 心跳超时，视为断开`)
    this.emit('connectionStatus', {
      status: 'heartbeat-lost',
      message: `⚠️ 与 ${peerId} 的连接不稳定`,
      timestamp: Date.now()
    })
  }

  /**
   * 处理收到的心跳消息
   */
  _handleHeartbeatMessage(data, conn) {
    if (data.type === 'ping') {
      // 回复 pong
      try {
        conn.send({ type: 'pong', timestamp: data.timestamp })
      } catch (e) {
        // 忽略
      }
    } else if (data.type === 'pong') {
      // 收到 pong，清除超时
      const timeout = this._heartbeatTimeouts.get(conn.peer)
      if (timeout) {
        clearTimeout(timeout)
        this._heartbeatTimeouts.delete(conn.peer)
      }
    }
  }

  // ==================== 消息队列 ====================

  /**
   * 将消息加入队列并发送
   */
  _enqueueMessage(conn, message) {
    this._messageQueue.push({ conn, message, attempts: 0 })
    this._processQueue()
  }

  /**
   * 处理消息队列
   */
  async _processQueue() {
    if (this._isProcessingQueue || this._messageQueue.length === 0) return

    this._isProcessingQueue = true

    while (this._messageQueue.length > 0) {
      const item = this._messageQueue[0]

      if (!item.conn.open) {
        console.warn('[Queue] 连接已关闭，丢弃消息')
        this._messageQueue.shift()
        continue
      }

      try {
        item.conn.send(item.message)
        this._messageQueue.shift()
        // 小延迟防止消息拥堵
        await new Promise(resolve => setTimeout(resolve, 16))
      } catch (error) {
        item.attempts++
        if (item.attempts >= 3) {
          console.error('[Queue] 消息发送失败3次，丢弃:', error)
          this._messageQueue.shift()
        } else {
          console.warn(`[Queue] 消息发送失败，重试 ${item.attempts}/3`)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    this._isProcessingQueue = false
  }

  // ==================== 自动重连 ====================

  /**
   * 尝试自动重连
   */
  async _attemptReconnect() {
    if (!this._lastJoinParams || this._isReconnecting) return
    if (this._reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      console.error('[RoomManager] 重连失败，已达最大重试次数')
      this.emit('reconnectFailed', {
        attempts: this._reconnectAttempts,
        message: '无法重新连接到房间，请手动重新加入'
      })
      return
    }

    this._isReconnecting = true
    this._reconnectAttempts++

    const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, this._reconnectAttempts - 1)
    console.log(`[RoomManager] ${delay / 1000}秒后尝试第 ${this._reconnectAttempts} 次重连...`)

    this.emit('reconnecting', {
      attempt: this._reconnectAttempts,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      delay: Math.round(delay)
    })

    await new Promise(resolve => {
      this._reconnectTimer = setTimeout(resolve, delay)
    })

    try {
      const { inviteCode, role, playerName } = this._lastJoinParams
      await this.joinRoom(inviteCode, role, playerName)
      this._reconnectAttempts = 0
      this._isReconnecting = false
      this.emit('reconnected', { inviteCode, role })
      console.log('[RoomManager] 重连成功！')
    } catch (error) {
      this._isReconnecting = false
      console.warn(`[RoomManager] 第 ${this._reconnectAttempts} 次重连失败:`, error.message)
      this._attemptReconnect()
    }
  }

  /**
   * 取消重连
   */
  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._isReconnecting = false
    this._reconnectAttempts = 0
  }

  // ==================== 核心：创建/加入房间 ====================

  async createRoom() {
    this.inviteCode = this.generateInviteCode()
    const peerId = `bp-room-${this.inviteCode.toLowerCase()}`

    this.peer = new Peer(peerId, {
      ...webrtcConfig.peerjs,
      config: webrtcConfig.config,
      debug: webrtcConfig.debug
    })
    this.role = 'host'

    return new Promise((resolve, reject) => {
      this.peer.on('open', (id) => {
        console.log('[RoomManager] 房间已创建，PeerID:', id)
        this.emit('roomCreated', { inviteCode: this.inviteCode, peerId: id })
        resolve(this.inviteCode)
      })

      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn)
      })

      this._setupPeerErrorHandlers(reject)
    })
  }

  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  async joinRoom(inviteCode, role = 'player', playerName = null) {
    this.role = role
    this.inviteCode = inviteCode

    // 缓存参数用于重连
    this._lastJoinParams = { inviteCode, role, playerName }
    this._cancelReconnect()

    const hostPeerId = `bp-room-${inviteCode.toLowerCase()}`
    const clientPeerId = `${hostPeerId}-${role}-${Date.now()}`

    this.peer = new Peer(clientPeerId, {
      ...webrtcConfig.peerjs,
      config: webrtcConfig.config,
      debug: webrtcConfig.debug
    })

    return new Promise((resolve, reject) => {
      this.peer.on('open', () => {
        const conn = this.peer.connect(hostPeerId, {
          reliable: true,
          metadata: { role, playerName }
        })

        conn.on('open', () => {
          console.log('[RoomManager] 已连接到主办方')
          this.connections.set('host', conn)
          this.setupConnectionHandlers(conn)
          this._startHeartbeat('host', conn)
          this.emit('connected', { peerId: hostPeerId, role: 'host' })
          resolve()
        })

        conn.on('close', () => {
          console.log('[RoomManager] 与主办方的连接已断开')
          this._stopHeartbeat('host')
          this.connections.delete('host')
          this.emit('userLeft', { peerId: 'host', count: this.connections.size })

          // 触发自动重连
          if (this.role !== 'host') {
            this._attemptReconnect()
          }
        })

        conn.on('error', (error) => {
          console.error('[RoomManager] 连接错误:', error)
          this.emit('error', { type: 'connection', error })
          reject(new Error('无法连接到主办方，请检查邀请码是否正确'))
        })
      })

      this._setupPeerErrorHandlers(reject)
    })
  }

  // ==================== 连接处理 ====================

  handleIncomingConnection(conn) {
    const peerId = conn.peer
    const role = conn.metadata?.role || 'player'

    console.log(`[RoomManager] 收到连接请求: ${peerId} (${role})`)

    conn.on('open', () => {
      console.log(`[RoomManager] ${peerId} 已连接`)
      this.connections.set(peerId, conn)
      this.setupConnectionHandlers(conn)
      this._startHeartbeat(peerId, conn)
      this.emit('userJoined', { peerId, role, count: this.connections.size })
    })

    conn.on('close', () => {
      console.log(`[RoomManager] ${peerId} 断开连接`)
      this._stopHeartbeat(peerId)
      this.connections.delete(peerId)
      this.emit('userLeft', { peerId, count: this.connections.size })
    })

    conn.on('error', (error) => {
      console.error(`[RoomManager] 连接错误 (${peerId}):`, error)
      this.emit('connectionError', { peerId, error })
    })
  }

  setupConnectionHandlers(conn) {
    conn.on('data', (data) => {
      // 心跳消息特殊处理
      if (data.type === 'ping' || data.type === 'pong') {
        this._handleHeartbeatMessage(data, conn)
        return
      }

      // ACK 确认
      if (data.type === 'ack') {
        return // 已确认，无需处理
      }

      // 业务消息
      const messageTypes = ['stateUpdate', 'customPlants', 'chatMessage', 'gameStart', 'identityAssigned']
      if (messageTypes.includes(data.type)) {
        // 发送 ACK
        try {
          conn.send({ type: 'ack', messageId: data.timestamp })
        } catch (e) {
          // 忽略
        }
        this.emit(data.type, data)
      }
    })
  }

  // ==================== 错误处理 ====================

  _setupPeerErrorHandlers(reject) {
    const errorMessages = {
      'peer-unavailable': '无法找到对方，请检查邀请码是否正确',
      'disconnected': '网络连接已断开，请检查网络设置',
      'network': '网络错误，请检查您的网络连接',
      'ssl-unavailable': '需要 HTTPS 连接，请确保使用安全连接',
      'server-error': '服务器错误，请检查 PeerJS 服务器是否正常运行',
      'socket-error': '连接错误，请检查服务器地址和端口',
      'socket-closed': '连接已关闭',
      'unavailable-id': 'ID 不可用，请尝试重新创建房间'
    }

    this.peer.on('error', (error) => {
      console.error('[RoomManager] Peer 错误:', error)
      const userMessage = errorMessages[error.type] || `连接错误：${error.message || '未知错误'}`
      this.emit('error', { type: 'peer', error, userFriendlyMessage: userMessage })
      if (reject) reject(error)
    })

    this.peer.on('iceStateChange', (iceState) => {
      const messages = {
        'new': '正在初始化连接...',
        'checking': '正在尝试建立网络连接...',
        'connected': '✅ 网络连接已建立',
        'completed': '✅ 连接建立完成',
        'failed': '❌ 网络连接失败',
        'disconnected': '⚠️ 网络连接已断开',
        'closed': '连接已关闭'
      }
      if (messages[iceState]) {
        this.emit('connectionStatus', {
          status: iceState,
          message: messages[iceState],
          timestamp: Date.now()
        })
      }
    })
  }

  // ==================== 广播与发送 ====================

  broadcastState(gameState, version, excludePeerId = null) {
    if (this.role !== 'host') return

    this.localVersion = version
    const message = {
      type: 'stateUpdate',
      senderId: this.peer.id,
      senderRole: this.role,
      timestamp: Date.now(),
      version,
      gameState
    }

    this.connections.forEach((conn, peerId) => {
      if (conn.open && peerId !== excludePeerId) {
        this._enqueueMessage(conn, message)
      }
    })
  }

  broadcastToOthers(gameState, version, excludePeerId) {
    if (this.role !== 'host') return

    const message = {
      type: 'stateUpdate',
      senderId: this.peer.id,
      senderRole: this.role,
      timestamp: Date.now(),
      version,
      gameState
    }

    this.connections.forEach((conn, peerId) => {
      if (conn.open && peerId !== excludePeerId) {
        this._enqueueMessage(conn, message)
      }
    })
  }

  broadcastGameStart(player1Name, player2Name, player1Road, player2Road, globalBans, hiddenBuiltinPlants) {
    if (this.role !== 'host') return

    const message = {
      type: 'gameStart',
      player1Name, player2Name, player1Road, player2Road,
      globalBans: globalBans || [],
      hiddenBuiltinPlants: hiddenBuiltinPlants || [],
      timestamp: Date.now()
    }

    this.connections.forEach((conn) => {
      if (conn.open) {
        this._enqueueMessage(conn, message)
      }
    })
  }

  sendStateUpdate(gameState, version) {
    if (this.role === 'host') return

    this.localVersion = version
    const hostConn = this.connections.get('host')

    if (hostConn && hostConn.open) {
      const message = {
        type: 'stateUpdate',
        senderId: this.peer.id,
        senderRole: this.role,
        timestamp: Date.now(),
        version,
        gameState
      }
      this._enqueueMessage(hostConn, message)
    } else {
      console.error('[RoomManager] 未连接到主办方')
    }
  }

  async broadcastCustomPlants(config) {
    if (this.role !== 'host') return

    const { plants, hiddenBuiltinPlants } = config
    const message = {
      type: 'customPlants',
      timestamp: Date.now(),
      plants: plants || [],
      hiddenBuiltinPlants: hiddenBuiltinPlants || []
    }

    this.connections.forEach((conn) => {
      if (conn.open) {
        this._enqueueMessage(conn, message)
      }
    })
  }

  // ==================== 查询方法 ====================

  getConnectionStats() {
    const stats = { total: this.connections.size, players: 0, spectators: 0 }
    this.connections.forEach((conn) => {
      const role = conn.metadata?.role || 'player'
      if (role === 'player') stats.players++
      else if (role === 'spectator') stats.spectators++
    })
    return stats
  }

  getConnectedUsers() {
    const users = []
    this.connections.forEach((conn, peerId) => {
      users.push({
        peerId,
        role: conn.metadata?.role || 'player',
        playerName: conn.metadata?.playerName || null,
        connected: conn.open
      })
    })
    return users
  }

  getConnectedPlayerNames() {
    const names = []
    this.connections.forEach((conn) => {
      if (conn.open && conn.metadata?.role === 'player' && conn.metadata?.playerName) {
        names.push(conn.metadata.playerName)
      }
    })
    return names
  }

  getStatus() {
    return {
      role: this.role,
      inviteCode: this.inviteCode,
      connected: this.connections.size,
      stats: this.getConnectionStats(),
      peerId: this.peer?.id || null,
      isReconnecting: this._isReconnecting
    }
  }

  // ==================== 事件系统 ====================

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) handlers.splice(index, 1)
    }
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => {
      try { handler(data) } catch (error) {
        console.error(`[RoomManager] 事件处理器错误 (${event}):`, error)
      }
    })
  }

  // ==================== 断开连接 ====================

  disconnect() {
    console.log('[RoomManager] 断开所有连接')
    this._cancelReconnect()
    this._stopAllHeartbeats()
    this._messageQueue = []

    this.connections.forEach((conn) => {
      if (conn.open) conn.close()
    })
    this.connections.clear()

    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    this.role = null
    this.inviteCode = null
    this.localVersion = 0
    this._lastJoinParams = null
  }
}

// 导出单例
export default new RoomManager()

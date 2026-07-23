/**
 * 房间管理器 - WebSocket 中心化版（重构自 PeerJS P2P 版）
 *
 * 设计依据：docs/network-protocol.md（冻结契约）。
 *
 * 关键不变量（对消费者零改）：
 * - 公共方法签名 100% 保持（createRoom / joinRoom / disconnect / broadcastState /
 *   sendStateUpdate / broadcastToOthers / broadcastGameStart / broadcastCustomPlants /
 *   getConnectionStats / getConnectedUsers / getConnectedPlayerNames / getStatus /
 *   on / off）。
 * - emit 事件名与 payload 字段与 PeerJS 版完全一致（roomCreated / connected /
 *   userJoined / userLeft / stateUpdate / gameStart / customPlants / identityAssigned /
 *   error / connectionStatus / reconnecting / reconnected / reconnectFailed /
 *   connectionError）；roster 为 WS 中心化版新增（成员名册变动时 emit，供 host 补发身份）。
 *
 * 语义映射（PeerJS → WS 中心化）：
 * - this.peer.id → 服务器分配的 this.clientId
 * - this.connections Map → this.members[]（由 roster 首次快照 + userJoined/userLeft 增量维护）
 * - host broadcastState / client sendStateUpdate 都发 C2S stateUpdate（服务器按 senderRole 转发）
 * - getConnectedUsers / getConnectionStats / getConnectedPlayerNames 从 this.members 推导
 *
 * transport 可注入：生产用原生 WebSocket，测试/dev 可注入 FakeHub（见 src/utils/devTransport.js）。
 * 默认导出 new RoomManager()，使用默认（原生 WebSocket）transport。
 */

import networkConfig from '@/config/network.config'

// 心跳配置（契约 §7）
const HEARTBEAT_INTERVAL = 30000  // 30s 发 ping
const HEARTBEAT_TIMEOUT = 10000   // 10s 无 pong → heartbeat-lost

// 重连配置
const RECONNECT_MAX_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 2000 // 基础延迟 2s

// 用户友好错误信息映射（参照 PeerJS 版 errorMessages，保留语义）
const ERROR_MESSAGES = {
  ROOM_NOT_FOUND: '找不到房间，请检查邀请码',
  ROOM_FULL: '房间已满',
  NAME_TAKEN: '该名字已被使用，请换一个',
  INVALID_PARAMS: '请求参数错误',
  INTERNAL: '服务器异常，请重试'
}

/**
 * 默认 transport 工厂：生产用原生 WebSocket。
 * connect(url, onMessage) → 返回 ws 句柄（同步），onopen/onclose/onerror 由调用方挂载。
 * onMessage 在 ws.onmessage 中被调用，参数为 { data: string }。
 */
function _defaultTransportFactory() {
  return {
    connect(url, onMessage) {
      const ws = new WebSocket(url)
      ws.onmessage = (event) => onMessage(event)
      return ws
    }
  }
}

class RoomManager {
  /**
   * @param {object} [options]
   * @param {object} [options.transport] 可注入 transport（生产缺省=原生 WebSocket）
   */
  constructor(options = {}) {
    this.ws = null
    this.clientId = null        // 服务器分配的客户端 ID（替代旧 this.peer.id）
    this.role = null            // 'host' | 'player' | 'spectator'
    this.inviteCode = null
    this.eventHandlers = new Map()
    this.localVersion = 0

    // 成员名册（替代旧 this.connections Map）
    // member: { clientId, role, playerName, connected }
    this.members = []

    // 心跳相关（复用旧字段名 _heartbeatTimers/_heartbeatTimeouts，单连接场景只用一个键 'server'）
    this._heartbeatTimers = new Map()
    this._heartbeatTimeouts = new Map()
    this._lastPingT = null

    // 重连相关
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._isReconnecting = false
    this._lastJoinParams = null

    // transport
    this._transport = options.transport || _defaultTransportFactory()
  }

  // ==================== 内部：发送 / 收消息 ====================

  /**
   * 经 transport 发送一条消息（JSON 序列化）。契约 §3 C2S 消息。
   */
  _send(msg) {
    if (!this.ws) {
      console.warn('[RoomManager] ws 未建立，丢弃消息:', msg && msg.type)
      return false
    }
    if (this.ws.readyState !== undefined && this.ws.readyState !== 1 /* OPEN */) {
      console.warn('[RoomManager] ws 未 OPEN，丢弃消息:', msg && msg.type)
      return false
    }
    try {
      const payload = JSON.stringify(msg)
      this.ws.send(payload)
      return true
    } catch (e) {
      console.error('[RoomManager] 序列化/发送失败:', e)
      return false
    }
  }

  /**
   * ws.onmessage 统一入口。JSON.parse → 内部消息处理 → 其余 emit(msg.type, msg)。
   */
  _handleMessage(event) {
    let msg
    try {
      const raw = event && event.data !== undefined ? event.data : event
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {
      console.error('[RoomManager] 消息解析失败:', e)
      return
    }
    if (!msg || !msg.type) return

    switch (msg.type) {
      case 'pong':
        this._handlePong(msg)
        return
      case 'roster':
        this._applyRoster(msg)
        return
      case 'roomCreated':
        this.clientId = msg.peerId || this.clientId
        this.emit('roomCreated', msg)
        return
      case 'connected':
        this.clientId = msg.peerId || this.clientId
        this.emit('connected', msg)
        return
      case 'userJoined':
        this._applyUserJoined(msg)
        this.emit('userJoined', msg)
        return
      case 'userLeft':
        this._applyUserLeft(msg)
        this.emit('userLeft', msg)
        return
      case 'error':
        this._handleServerError(msg)
        return
      // stateUpdate / gameStart / customPlants / identityAssigned / connectionStatus
      // 直接 emit（事件名 = type，与契约 §4 约束一致）
      default:
        this.emit(msg.type, msg)
        return
    }
  }

  _applyRoster(msg) {
    if (!Array.isArray(msg.members)) return
    this.members = msg.members.map((m) => ({
      clientId: m.clientId,
      role: m.role,
      playerName: m.playerName,
      connected: m.connected !== false
    }))
    // 通知上层（host 的 connectionStore.handleRoster 据此为重连/重新加入者补发身份 + 推状态）
    this.emit('roster', msg)
  }

  _applyUserJoined(msg) {
    // 增量：避免重复
    const exists = this.members.some((m) => m.clientId === msg.peerId)
    if (!exists) {
      this.members.push({
        clientId: msg.peerId,
        role: msg.role,
        playerName: msg.playerName || null,
        connected: true
      })
    }
  }

  _applyUserLeft(msg) {
    this.members = this.members.filter((m) => m.clientId !== msg.peerId)
  }

  _handleServerError(msg) {
    const code = msg.error && msg.error.code
    const userFriendlyMessage =
      msg.userFriendlyMessage || ERROR_MESSAGES[code] || '服务器返回错误'
    const enriched = { ...msg, userFriendlyMessage }
    this.emit('error', enriched)
  }

  // ==================== 心跳 ====================

  _startHeartbeat() {
    this._stopHeartbeat()
    const timer = setInterval(() => {
      this._lastPingT = Date.now()
      const ok = this._send({ type: 'ping', t: this._lastPingT })
      if (!ok) return
      const timeout = setTimeout(() => {
        console.warn('[Heartbeat] 心跳超时（无 pong）')
        this.emit('connectionStatus', {
          status: 'heartbeat-lost',
          message: '与服务器的连接不稳定',
          timestamp: Date.now()
        })
      }, HEARTBEAT_TIMEOUT)
      this._heartbeatTimeouts.set('server', timeout)
    }, HEARTBEAT_INTERVAL)
    this._heartbeatTimers.set('server', timer)
  }

  _stopHeartbeat() {
    const t = this._heartbeatTimers.get('server')
    if (t) { clearInterval(t); this._heartbeatTimers.delete('server') }
    const to = this._heartbeatTimeouts.get('server')
    if (to) { clearTimeout(to); this._heartbeatTimeouts.delete('server') }
  }

  _handlePong(_msg) {
    const to = this._heartbeatTimeouts.get('server')
    if (to) { clearTimeout(to); this._heartbeatTimeouts.delete('server') }
  }

  // ==================== 自动重连 ====================

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
    this._reconnectAttempts += 1

    const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, this._reconnectAttempts - 1)
    this.emit('reconnecting', {
      attempt: this._reconnectAttempts,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
      delay: Math.round(delay)
    })

    await new Promise((resolve) => {
      this._reconnectTimer = setTimeout(resolve, delay)
    })

    try {
      const { inviteCode, role, playerName } = this._lastJoinParams
      await this.joinRoom(inviteCode, role, playerName)
      this._reconnectAttempts = 0
      this._isReconnecting = false
      this.emit('reconnected', { inviteCode, role })
    } catch (error) {
      this._isReconnecting = false
      this._attemptReconnect()
    }
  }

  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._isReconnecting = false
    this._reconnectAttempts = 0
  }

  // ==================== ws 连接生命周期 ====================

  _wsUrl() {
    return import.meta.env.DEV ? networkConfig.ws.devUrl : networkConfig.ws.prodUrl
  }

  /**
   * 建立底层 ws 连接（若未建立）。返回 Promise，open 后 resolve(ws)。
   */
  _ensureConnected() {
    if (this.ws && this.ws.readyState === 1 /* OPEN */) return Promise.resolve(this.ws)

    return new Promise((resolve, reject) => {
      const url = this._wsUrl()
      let opened = false
      try {
        const ws = this._transport.connect(url, (event) => this._handleMessage(event))
        this.ws = ws

        ws.onopen = () => {
          opened = true
          this._startHeartbeat()
          resolve(ws)
        }
        ws.onclose = (event) => {
          this._stopHeartbeat()
          if (!opened) {
            // 连接阶段就失败
            reject(new Error('无法连接到服务器，请检查网络'))
          }
          this.emit('connectionStatus', {
            status: 'disconnected',
            message: '连接已断开',
            timestamp: Date.now()
          })
          // client 角色（非 host）触发重连
          if (this.role && this.role !== 'host' && this._lastJoinParams) {
            this._attemptReconnect()
          }
        }
        ws.onerror = (e) => {
          this.emit('connectionError', { error: e })
          this.emit('error', {
            type: 'connection',
            error: e,
            userFriendlyMessage: '连接错误，请检查网络'
          })
          if (!opened) reject(new Error('无法连接到服务器，请检查网络'))
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  // ==================== 核心：创建/加入房间 ====================

  async createRoom() {
    this.role = 'host'
    await this._ensureConnected()
    this._send({ type: 'createRoom', role: 'host' })
    // 等待 roomCreated
    return new Promise((resolve, reject) => {
      const onCreated = (data) => {
        this.off('roomCreated', onCreated)
        this.off('error', onError)
        this.inviteCode = data.inviteCode
        resolve(data.inviteCode)
      }
      const onError = (data) => {
        this.off('roomCreated', onCreated)
        this.off('error', onError)
        reject(new Error((data && data.userFriendlyMessage) || '创建房间失败'))
      }
      this.on('roomCreated', onCreated)
      this.on('error', onError)
    })
  }

  generateInviteCode() {
    // 保留公共方法（兼容旧调用）。WS 版下 inviteCode 由服务器生成，此方法仅用于本地兜底/测试。
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

    await this._ensureConnected()

    const ok = this._send({
      type: 'joinRoom',
      inviteCode,
      role,
      playerName
    })
    if (!ok) throw new Error('发送 joinRoom 失败')

    return new Promise((resolve, reject) => {
      const onConnected = () => {
        this.off('connected', onConnected)
        this.off('error', onError)
        resolve()
      }
      const onError = (data) => {
        this.off('connected', onConnected)
        this.off('error', onError)
        reject(new Error((data && data.userFriendlyMessage) || '加入房间失败'))
      }
      this.on('connected', onConnected)
      this.on('error', onError)
    })
  }

  // ==================== 广播与发送（C2S） ====================

  broadcastState(gameState, version, _excludePeerId = null) {
    // 中心化：host 发 stateUpdate，服务器转发给除自己外所有成员
    if (this.role !== 'host') return

    this.localVersion = version
    this._send({
      type: 'stateUpdate',
      senderRole: this.role,
      version,
      gameState
    })
  }

  broadcastToOthers(gameState, version, _excludePeerId) {
    // host 转发段（契约 §5 第一版保留）：与 broadcastState 等价（服务器去重）
    if (this.role !== 'host') return
    this._send({
      type: 'stateUpdate',
      senderRole: this.role,
      version,
      gameState
    })
  }

  broadcastGameStart(player1Name, player2Name, player1Road, player2Road, globalBans, hiddenBuiltinPlants) {
    if (this.role !== 'host') return
    this._send({
      type: 'gameStart',
      player1Name, player2Name, player1Road, player2Road,
      globalBans: globalBans || [],
      hiddenBuiltinPlants: hiddenBuiltinPlants || []
    })
  }

  sendStateUpdate(gameState, version) {
    // client（player/spectator）发状态更新 → 服务器转发（含给 host）
    if (this.role === 'host') return
    this.localVersion = version
    this._send({
      type: 'stateUpdate',
      senderRole: this.role,
      version,
      gameState
    })
  }

  async broadcastCustomPlants(config) {
    if (this.role !== 'host') return
    const { plants, hiddenBuiltinPlants } = config || {}
    this._send({
      type: 'customPlants',
      plants: plants || [],
      hiddenBuiltinPlants: hiddenBuiltinPlants || []
    })
  }

  /**
   * 身份分配（定向单投）。契约 §6 关键路径。
   * 由 host 调用，服务器按 playerName 定向投递给目标 client。
   */
  sendIdentityAssignment(playerName, playerNumber) {
    this._send({ type: 'identityAssigned', playerName, playerNumber })
  }

  // ==================== 查询方法（从 this.members 推导） ====================

  getConnectionStats() {
    const stats = { total: this.members.length, players: 0, spectators: 0 }
    this.members.forEach((m) => {
      if (m.role === 'player') stats.players += 1
      else if (m.role === 'spectator') stats.spectators += 1
    })
    return stats
  }

  getConnectedUsers() {
    // 字段与 PeerJS 版兼容：peerId / role / playerName / connected
    return this.members.map((m) => ({
      peerId: m.clientId,
      role: m.role,
      playerName: m.playerName,
      connected: m.connected !== false
    }))
  }

  getConnectedPlayerNames() {
    const names = []
    this.members.forEach((m) => {
      if (m.connected !== false && m.role === 'player' && m.playerName) {
        names.push(m.playerName)
      }
    })
    return names
  }

  getStatus() {
    return {
      role: this.role,
      inviteCode: this.inviteCode,
      connected: this.members.length,
      stats: this.getConnectionStats(),
      peerId: this.clientId || null,
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
    handlers.forEach((handler) => {
      try { handler(data) } catch (error) {
        console.error(`[RoomManager] 事件处理器错误 (${event}):`, error)
      }
    })
  }

  // ==================== 断开连接 ====================

  disconnect() {
    this._cancelReconnect()
    this._stopHeartbeat()

    // 通知服务器离开（尽力发送）
    if (this.ws && this.ws.readyState === 1) {
      try { this._send({ type: 'leave' }) } catch (_) { /* ignore */ }
    }

    if (this.ws) {
      try { this.ws.close && this.ws.close() } catch (_) { /* ignore */ }
      this.ws = null
    }

    this.clientId = null
    this.role = null
    this.inviteCode = null
    this.members = []
    this.localVersion = 0
    this._lastJoinParams = null
  }
}

// 导出单例（使用默认原生 WebSocket transport）
export { RoomManager }
export default new RoomManager()

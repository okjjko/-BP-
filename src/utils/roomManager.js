/**
 * 房间管理器 - WebRTC P2P 连接管理
 *
 * 功能：
 * - 主办方创建房间，生成邀请码
 * - 选手/观众通过邀请码加入房间
 * - 状态同步（双向）
 * - 自定义植物同步
 * - 断线重连处理
 */

import Peer from 'peerjs'
import { getHiddenPlants } from '@/data/customPlants'

class RoomManager {
  constructor() {
    this.peer = null
    this.connections = new Map() // peerId -> DataConnection
    this.role = null // 'host' | 'player' | 'spectator'
    this.inviteCode = null
    this.eventHandlers = new Map()
    this.localVersion = 0 // 状态版本号
  }

  /**
   * 创建房间（主办方）
   * @returns {Promise<string>} 邀请码
   */
  async createRoom() {
    // 生成 6 位邀请码
    this.inviteCode = this.generateInviteCode()

    // 使用邀请码作为 PeerID，方便选手直接连接
    const peerId = `bp-room-${this.inviteCode.toLowerCase()}`
    this.peer = new Peer(peerId)
    this.role = 'host'

    return new Promise((resolve, reject) => {
      // 等待 PeerJS 连接到信令服务器
      this.peer.on('open', (id) => {
        console.log('[RoomManager] 房间已创建，PeerID:', id, '邀请码:', this.inviteCode)
        this.emit('roomCreated', { inviteCode: this.inviteCode, peerId: id })
        resolve(this.inviteCode)
      })

      // 监听连接请求
      this.peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn)
      })

      // 错误处理
      this.peer.on('error', (error) => {
        console.error('[RoomManager] Peer 错误:', error)
        this.emit('error', { type: 'peer', error })
        reject(error)
      })
    })
  }

  /**
   * 生成随机邀请码
   * @returns {string} 6 位大写字母/数字
   */
  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除易混淆的字符
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * 加入房间（选手/观众）
   * @param {string} inviteCode - 邀请码
   * @param {string} role - 角色 ('player' | 'spectator')
   * @param {string} playerName - 选手名字/ID（选手必须提供）
   * @returns {Promise<void>}
   */
  async joinRoom(inviteCode, role = 'player', playerName = null) {
    this.role = role
    this.inviteCode = inviteCode

    // 构造主办方的 PeerID
    const hostPeerId = `bp-room-${inviteCode.toLowerCase()}`

    console.log('[RoomManager] 尝试连接到主办方:', hostPeerId)

    // 为客户端生成唯一的 PeerID
    const clientPeerId = `${hostPeerId}-${role}-${Date.now()}`
    this.peer = new Peer(clientPeerId)

    return new Promise((resolve, reject) => {
      this.peer.on('open', (id) => {
        console.log('[RoomManager] 本地 PeerID:', id)

        const conn = this.peer.connect(hostPeerId, {
          reliable: true,
          metadata: { role, playerName } // 包含选手名字
        })

        conn.on('open', () => {
          console.log('[RoomManager] 已连接到主办方')
          this.connections.set('host', conn)
          this.setupConnectionHandlers(conn)
          this.emit('connected', { peerId: hostPeerId, role: 'host' })
          resolve()
        })

        conn.on('error', (error) => {
          console.error('[RoomManager] 连接错误:', error)
          this.emit('error', { type: 'connection', error })
          reject(new Error('无法连接到主办方，请检查邀请码是否正确'))
        })
      })

      this.peer.on('error', (error) => {
        console.error('[RoomManager] Peer 错误:', error)
        this.emit('error', { type: 'peer', error })
        reject(error)
      })
    })
  }

  /**
   * 处理传入连接（主办方）
   * @param {DataConnection} conn
   */
  handleIncomingConnection(conn) {
    const peerId = conn.peer
    const role = conn.metadata?.role || 'player'

    console.log(`[RoomManager] 收到连接请求: ${peerId} (${role})`)

    conn.on('open', () => {
      console.log(`[RoomManager] ${peerId} 已连接`)
      this.connections.set(peerId, conn)
      this.setupConnectionHandlers(conn)

      // 通知所有已连接的用户
      this.emit('userJoined', { peerId, role, count: this.connections.size })
    })

    conn.on('close', () => {
      console.log(`[RoomManager] ${peerId} 断开连接`)
      this.connections.delete(peerId)
      this.emit('userLeft', { peerId, count: this.connections.size })
    })

    conn.on('error', (error) => {
      console.error(`[RoomManager] 连接错误 (${peerId}):`, error)
      this.emit('connectionError', { peerId, error })
    })
  }

  /**
   * 设置连接处理器
   * @param {DataConnection} conn
   */
  setupConnectionHandlers(conn) {
    conn.on('data', (data) => {
      console.log('[RoomManager] 收到数据:', data.type)

      if (data.type === 'stateUpdate') {
        this.emit('stateUpdate', data)
      } else if (data.type === 'customPlants') {
        this.emit('customPlants', data)
      } else if (data.type === 'chatMessage') {
        this.emit('chatMessage', data)
      } else if (data.type === 'gameStart') {
        this.emit('gameStart', data)
      } else if (data.type === 'identityAssigned') {
        this.emit('identityAssigned', data)
      }
    })
  }

  /**
   * 广播状态到所有连接（主办方）
   * @param {Object} gameState - 游戏状态
   * @param {number} version - 状态版本号
   * @param {string} excludePeerId - 排除的PeerID（避免回环）
   */
  broadcastState(gameState, version, excludePeerId = null) {
    if (this.role !== 'host') {
      console.warn('[RoomManager] 只有主办方可以广播状态')
      return
    }

    this.localVersion = version

    const message = {
      type: 'stateUpdate',
      senderId: this.peer.id,
      senderRole: this.role,
      timestamp: Date.now(),
      version,
      gameState
    }

    console.log(`[RoomManager] 广播状态到 ${this.connections.size} 个连接，版本: ${version}`)

    this.connections.forEach((conn, peerId) => {
      // 跳过发送者（避免回环）
      if (conn.open && peerId !== excludePeerId) {
        conn.send(message)
      } else if (!conn.open) {
        console.warn(`[RoomManager] 连接 ${peerId} 未打开，跳过`)
      }
    })
  }

  /**
   * 转发状态到其他所有连接（主办方收到选手操作后立即转发）
   * @param {Object} gameState - 游戏状态
   * @param {number} version - 状态版本号
   * @param {string} excludePeerId - 排除的PeerID（原始发送者）
   */
  broadcastToOthers(gameState, version, excludePeerId) {
    if (this.role !== 'host') {
      console.warn('[RoomManager] 只有主办方可以转发状态')
      return
    }

    const message = {
      type: 'stateUpdate',
      senderId: this.peer.id,
      senderRole: this.role,
      timestamp: Date.now(),
      version,
      gameState
    }

    console.log(`[RoomManager] 转发状态到其他连接，排除: ${excludePeerId}`)

    this.connections.forEach((conn, peerId) => {
      // 只发送给其他连接，不发送给原始发送者
      if (conn.open && peerId !== excludePeerId) {
        conn.send(message)
      }
    })
  }

  /**
   * 广播游戏开始（主办方）
   * @param {string} player1Name - 选手1名字
   * @param {string} player2Name - 选手2名字
   * @param {number} player1Road - 选手1道路
   * @param {number} player2Road - 选手2道路
   * @param {Array<string>} globalBans - 永久禁用的植物ID列表
   */
  broadcastGameStart(player1Name, player2Name, player1Road, player2Road, globalBans) {
    if (this.role !== 'host') {
      console.warn('[RoomManager] 只有主办方可以广播游戏开始')
      return
    }

    const message = {
      type: 'gameStart',
      player1Name,
      player2Name,
      player1Road,
      player2Road,
      globalBans: globalBans || [],  // 新增：永久禁用植物列表
      timestamp: Date.now()
    }

    console.log('[RoomManager] 广播游戏开始消息，包含', globalBans?.length || 0, '个永久禁用植物')

    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(message)
      }
    })
  }

  /**
   * 发送状态更新（选手/观众 -> 主办方）
   * @param {Object} gameState - 游戏状态
   * @param {number} version - 状态版本号
   */
  sendStateUpdate(gameState, version) {
    if (this.role === 'host') {
      console.warn('[RoomManager] 主办方应使用 broadcastState')
      return
    }

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

      console.log('[RoomManager] 发送状态更新到主办方，版本:', version)
      hostConn.send(message)
    } else {
      console.error('[RoomManager] 未连接到主办方')
    }
  }

  /**
   * 广播自定义植物（主办方）
   * @param {Object} config - 植物配置对象
   * @param {Array} config.plants - 自定义植物列表
   * @param {Array} config.hiddenBuiltinPlants - 隐藏的内置植物ID列表
   */
  async broadcastCustomPlants(config) {
    if (this.role !== 'host') {
      console.warn('[RoomManager] 只有主办方可以广播自定义植物')
      return
    }

    const { plants, hiddenBuiltinPlants } = config

    const message = {
      type: 'customPlants',
      timestamp: Date.now(),
      plants: plants || [],
      hiddenBuiltinPlants: hiddenBuiltinPlants || []
    }

    console.log('[RoomManager] 广播植物配置:', {
      customPlants: plants.length,
      hiddenBuiltin: hiddenBuiltinPlants.length
    })

    this.connections.forEach((conn, peerId) => {
      if (conn.open) {
        conn.send(message)
      }
    })
  }

  /**
   * 获取连接统计
   * @returns {Object}
   */
  getConnectionStats() {
    const stats = {
      total: this.connections.size,
      players: 0,
      spectators: 0
    }

    this.connections.forEach((conn, peerId) => {
      const role = conn.metadata?.role || 'player'
      if (role === 'player') {
        stats.players++
      } else if (role === 'spectator') {
        stats.spectators++
      }
    })

    return stats
  }

  /**
   * 获取连接的用户列表
   * @returns {Array}
   */
  getConnectedUsers() {
    const users = []

    this.connections.forEach((conn, peerId) => {
      users.push({
        peerId,
        role: conn.metadata?.role || 'player',
        playerName: conn.metadata?.playerName || null, // 包含选手名字
        connected: conn.open
      })
    })

    return users
  }

  /**
   * 获取已连接的选手列表（按连接顺序）
   * @returns {Array} 选手名字列表
   */
  getConnectedPlayerNames() {
    const names = []
    this.connections.forEach((conn, peerId) => {
      if (conn.open && conn.metadata?.role === 'player' && conn.metadata?.playerName) {
        names.push(conn.metadata.playerName)
      }
    })
    return names
  }

  /**
   * 事件监听
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(handler)
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error(`[RoomManager] 事件处理器错误 (${event}):`, error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    console.log('[RoomManager] 断开所有连接')

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.close()
      }
    })

    this.connections.clear()

    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    this.role = null
    this.inviteCode = null
    this.localVersion = 0
  }

  /**
   * 获取当前状态
   * @returns {Object}
   */
  getStatus() {
    return {
      role: this.role,
      inviteCode: this.inviteCode,
      connected: this.connections.size,
      stats: this.getConnectionStats(),
      peerId: this.peer?.id || null
    }
  }
}

// 导出单例
export default new RoomManager()

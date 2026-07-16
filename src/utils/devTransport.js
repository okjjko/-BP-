/**
 * 开发期 FakeHub —— 内存消息总线，模拟中心化 WebSocket 服务器（仅 dev / 测试用）。
 *
 * 设计：
 * - 每个 Client 持有一个 onMessage 回调，对应 roomManager 的 ws.onmessage。
 * - Client.send(msg) → 经 JSON 双向序列化（复刻真实 ws 文本帧边界）→ 投递到 hub。
 * - Hub 按 docs/network-protocol.md 的转发规则把消息路由到目标 Client：
 *     · createRoom / joinRoom：hub 生成 inviteCode / clientId / roster / userJoined / connected
 *     · stateUpdate：广播给同房除发送者外所有成员（含 host）
 *     · gameStart / customPlants：广播给同房除 host 外所有成员
 *     · identityAssigned：定向单投给同房 playerName 匹配的成员
 *     · ping → 回 pong；leave → 移除成员 + 广播 userLeft
 * - 生产构建会被 tree-shake（仅 dev 面板 / 单元测试引用，且 dev 面板有 import.meta.env.DEV 守卫）。
 */

// 6 位 inviteCode 字符集（无易混淆 0/O/1/I），与契约 §11 一致
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genInviteCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length))
  }
  return code
}

let _clientIdSeq = 0
function genClientId() {
  _clientIdSeq += 1
  return `fake-cli-${_clientIdSeq}-${Date.now().toString(36)}`
}

/**
 * 内存 Hub：维护 rooms Map 与 clientId → room 反查。
 * 一个进程内所有 FakeClient 共享同一 Hub 实例（单例）。
 */
export class FakeHub {
  constructor() {
    // code(大写) -> { inviteCode, host:clientId, members:Map<clientId, member> }
    this.rooms = new Map()
    // clientId -> { roomCode, client:FakeClient }
    this.clientIndex = new Map()
    this._handlers = new Set() // dev 面板可视化用：监听所有跨客户端投递
  }

  onDispatch(fn) {
    this._handlers.add(fn)
    return () => this._handlers.delete(fn)
  }

  _notify(route) {
    this._handlers.forEach((fn) => {
      try { fn(route) } catch (_) { /* ignore */ }
    })
  }

  _roomOf(clientId) {
    const entry = this.clientIndex.get(clientId)
    if (!entry) return null
    return this.rooms.get(entry.roomCode)
  }

  /**
   * 由 FakeClient.send 调用：把一条已序列化过的 msg 投递进 hub 处理。
   */
  dispatchFrom(clientId, msg) {
    const client = this.clientIndex.get(clientId)
    if (!client) return
    const room = this.rooms.get(client.roomCode)

    switch (msg.type) {
      case 'createRoom': {
        const code = genInviteCode()
        const newRoom = {
          inviteCode: code,
          host: clientId,
          members: new Map()
        }
        this.rooms.set(code, newRoom)
        this.clientIndex.set(clientId, { roomCode: code, client: client.client })
        newRoom.members.set(clientId, {
          clientId, role: 'host', playerName: null, connected: true
        })
        this._sendTo(clientId, { type: 'roomCreated', inviteCode: code, peerId: clientId })
        this._pushRoster(newRoom)
        this._notify({ kind: 'createRoom', code, from: clientId })
        break
      }

      case 'joinRoom': {
        const code = (msg.inviteCode || '').toUpperCase()
        const target = this.rooms.get(code)
        if (!target) {
          this._sendTo(clientId, {
            type: 'error',
            error: { code: 'ROOM_NOT_FOUND', message: 'room not found' },
            userFriendlyMessage: '找不到房间，请检查邀请码'
          })
          this._notify({ kind: 'joinRoom-error', code, from: clientId })
          break
        }
        // 校验同房 playerName 唯一（host 名字为 null 不参与）
        const nameTaken = [...target.members.values()].some(
          (m) => m.playerName && m.playerName === msg.playerName
        )
        if (nameTaken) {
          this._sendTo(clientId, {
            type: 'error',
            error: { code: 'NAME_TAKEN', message: 'name taken' },
            userFriendlyMessage: '该名字已被使用，请换一个'
          })
          this._notify({ kind: 'joinRoom-error-name', code, from: clientId })
          break
        }
        this.clientIndex.set(clientId, { roomCode: code, client: client.client })
        const member = {
          clientId, role: msg.role || 'player',
          playerName: msg.playerName || null, connected: true
        }
        target.members.set(clientId, member)

        // 1) 回 connected 给新人
        this._sendTo(clientId, {
          type: 'connected', peerId: clientId, role: member.role
        })
        // 2) 推 roster 给新人（驱动 this.members）
        this._pushRoster(target, clientId)
        // 3) 广播 userJoined 给同房其他人（契约 §4：userJoined payload 不含 playerName，
        //    故同时广播一次 roster 让现有成员补齐 playerName）
        this._broadcast(target, {
          type: 'userJoined',
          peerId: clientId,
          role: member.role,
          count: target.members.size
        }, clientId)
        this._pushRoster(target)
        this._notify({ kind: 'joinRoom', code, from: clientId })
        break
      }

      case 'stateUpdate': {
        if (!room) break
        const out = {
          type: 'stateUpdate',
          senderId: clientId,
          senderRole: msg.senderRole,
          timestamp: Date.now(),
          version: msg.version,
          gameState: msg.gameState
        }
        // 广播给同房除发送者外所有成员（含 host）
        this._broadcast(room, out, clientId)
        this._notify({ kind: 'stateUpdate', code: room.inviteCode, from: clientId, version: msg.version })
        break
      }

      case 'gameStart':
      case 'customPlants': {
        if (!room) break
        // 广播给同房除 host 外所有成员
        this._broadcast(room, { ...msg }, room.host)
        this._notify({ kind: msg.type, code: room.inviteCode, from: clientId })
        break
      }

      case 'identityAssigned': {
        if (!room) break
        // 定向单投：同房首个 playerName 匹配
        const target = [...room.members.values()].find(
          (m) => m.playerName && m.playerName === msg.playerName
        )
        if (target) {
          this._sendTo(target.clientId, {
            type: 'identityAssigned',
            playerNumber: msg.playerNumber,
            playerName: msg.playerName
          })
          this._notify({ kind: 'identityAssigned', code: room.inviteCode, from: clientId, to: target.clientId })
        }
        break
      }

      case 'ping': {
        this._sendTo(clientId, { type: 'pong', t: msg.t })
        break
      }

      case 'leave': {
        this._removeMember(clientId)
        break
      }

      default:
        // 未知类型忽略
        break
    }
  }

  _sendTo(clientId, msg) {
    const entry = this.clientIndex.get(clientId)
    if (!entry || !entry.client) return
    entry.client._deliver(msg)
  }

  _broadcast(room, msg, excludeClientId) {
    for (const id of room.members.keys()) {
      if (id === excludeClientId) continue
      this._sendTo(id, msg)
    }
  }

  _pushRoster(room, onlyClientId = null) {
    const roster = {
      type: 'roster',
      members: [...room.members.values()].map((m) => ({
        clientId: m.clientId, role: m.role, playerName: m.playerName, connected: m.connected
      }))
    }
    if (onlyClientId) {
      this._sendTo(onlyClientId, roster)
    } else {
      this._broadcast(room, roster, null)
    }
  }

  _removeMember(clientId) {
    const entry = this.clientIndex.get(clientId)
    if (!entry) return
    const room = this.rooms.get(entry.roomCode)
    if (room) {
      room.members.delete(clientId)
      // 广播 userLeft
      this._broadcast(room, {
        type: 'userLeft', peerId: clientId, count: room.members.size
      }, clientId)
      // 推 roster 增量给剩余成员（契约 §10：增量推送；这里也推一次 roster 保证 members 同步）
      this._pushRoster(room)
      // host 离开 → 清房
      if (room.host === clientId) {
        this.rooms.delete(entry.roomCode)
      }
    }
    this.clientIndex.delete(clientId)
  }

  /** 模拟客户端连接断开（ws.onclose 触发） */
  simulateDisconnect(clientId) {
    this._removeMember(clientId)
  }
}

/**
 * 单例 Hub（一个页面/一个测试用例共享）。
 * 单元测试可通过 createHub() 显式新建隔离实例。
 */
let _singleton = null
export function getHub() {
  if (!_singleton) _singleton = new FakeHub()
  return _singleton
}
export function createHub() {
  return new FakeHub()
}

/**
 * FakeClient：roomManager 经 transport 注入后，调 client.send(msg)/client.close()，
 * 收到消息经 client._deliver → 注入时绑定的 onMessage 回调（即 roomManager.ws.onmessage）。
 *
 * 与真实 WebSocket 接口对齐：
 *   - send(data)：发送（已由 roomManager JSON.stringify；这里再 parse 一次作为入站边界）
 *   - close()：触发 onClose
 *   - onmessage / onopen / onclose / onerror：回调槽
 */
export class FakeClient {
  constructor(hub, onMessage) {
    this.hub = hub
    this.clientId = genClientId()
    this._onMessage = onMessage // (parsedMsg) => void
    this.onopen = null
    this.onclose = null
    this.onerror = null
    this._closed = false
    // 在 hub 注册自己（dispatchFrom 时通过 clientIndex 找到 client.client = this）
    hub.clientIndex.set(this.clientId, { roomCode: null, client: this })

    // 模拟 ws 连接建立（异步，给 roomManager 的 onopen 一个 tick）
    Promise.resolve().then(() => {
      if (!this._closed && typeof this.onopen === 'function') {
        this.onopen({ type: 'open' })
      }
    })
  }

  /** roomManager 调用：发一条已 stringify 的消息 */
  send(data) {
    if (this._closed) return
    // 入站边界：先 parse（模拟收），hub 处理后会 _deliver 序列化后的消息
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    // 复刻真实 ws 边界：hub 内部所有投递都 JSON.parse(JSON.stringify())
    this.hub.dispatchFrom(this.clientId, parsed)
  }

  /** hub 投递到本客户端（出站边界序列化） */
  _deliver(msg) {
    if (this._closed) return
    // 复刻真实 ws 序列化：两端 JSON.parse(JSON.stringify(msg))
    const serialized = JSON.parse(JSON.stringify(msg))
    Promise.resolve().then(() => {
      if (!this._closed && typeof this._onMessage === 'function') {
        // onMessage 收到的是已序列化对象，roomManager 内部会再 parse（这里直接给对象即可，与真实 Event.target.data=string 等价）
        this._onMessage({ data: JSON.stringify(serialized) })
      }
    })
  }

  close() {
    if (this._closed) return
    this._closed = true
    this.hub._removeMember(this.clientId)
    if (typeof this.onclose === 'function') {
      this.onclose({ type: 'close', code: 1000, reason: 'closed', wasClean: true })
    }
  }
}

/**
 * 工厂：为 roomManager 构造一个 transport（注入用）。
 * transport 必须实现：
 *   - connect(url): Promise<wsLike>，wsLike 含 send/close/onmessage/onopen/onclose/onerror
 *   - 生产版用原生 WebSocket（见 roomManager.js 内 _defaultTransportFactory）
 *
 * 这里返回的 transport 忽略 url（FakeHub 单例寻址），每次 connect 新建一个 FakeClient。
 */
export function createFakeTransport(hub = getHub()) {
  return {
    connect(_url, onMessage) {
      const client = new FakeClient(hub, onMessage)
      // roomManager 期望 connect 同步返回 ws 句柄，onopen 异步触发
      return client
    }
  }
}

export default { FakeHub, FakeClient, createFakeTransport, getHub, createHub }

/**
 * BP 对战工具 —— 中心化 WebSocket 服务器（单进程三合一）
 *
 * 一个 Node 进程同时提供：
 *   1. WebSocket hub（多人对战实时中转）—— `/ws`
 *   2. lobby HTTP 路由（公共房间目录）—— `/lobby/*`、`/rooms`、`/health`
 *   3. 静态文件托管（前端 dist）—— `/assets/*`、`/index.html`、`/favicon.ico`、`/plants/*`
 *   4. SPA fallback（history 路由刷新）—— 其它 GET 一律回 dist/index.html
 *
 * 协议契约：docs/network-protocol.md（冻结，禁止单方面偏离）。
 *
 * 启动：node server/index.js   （默认 :8080，PORT 环境变量可改）
 * 依赖：ws ^8.x（唯一运行时依赖）
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { spawn } from 'node:child_process'

import { handleLobbyRequest, isLobbyPath, startLobbyCleanupTimer } from './lobby-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== 配置 ====================

const PORT = Number(process.env.PORT) || 8080
const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const WS_PATH = '/ws'

// Webhook 配置
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me-in-production'
const WEBHOOK_PATH = '/webhook/deploy'
const DEPLOY_SCRIPT = path.resolve(__dirname, '..', 'scripts', 'auto-deploy.sh')

// 服务器侧心跳（契约 §7：30s ping，45s 无响应断开）
const SERVER_PING_INTERVAL_MS = 30 * 1000
const SERVER_PONG_TIMEOUT_MS = 45 * 1000

// ==================== 静态文件 ====================

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}

const DIST_EXISTS = fs.existsSync(DIST_DIR)

function safeJoin(base, target) {
  // 防路径穿越：把 target 规范化后限制在 base 内
  const joined = path.normalize(path.join(base, target))
  if (!joined.startsWith(base)) return null
  return joined
}

function serveStaticFile(res, filePath, { fallback404ToIndex = false } = {}) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (fallback404ToIndex && DIST_EXISTS) {
        return serveIndex(res)
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Not Found')
    }
    const ext = path.extname(filePath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'
    // dist 内文件名通常带 hash，可长期缓存；index.html 不缓存（保证发版即时生效）
    const cacheHeaders = ext === '.html'
      ? { 'Cache-Control': 'no-cache' }
      : { 'Cache-Control': 'public, max-age=31536000, immutable' }
    res.writeHead(200, { 'Content-Type': mime, ...cacheHeaders })
    fs.createReadStream(filePath).pipe(res)
  })
}

function serveIndex(res) {
  if (!DIST_EXISTS) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end('<!doctype html><meta charset="utf-8"><title>BP Server</title>' +
      '<h1>BP WebSocket Server</h1><p>dist/ 未构建。ws hub 与 lobby 已就绪：' +
      '<code>ws://host/ws</code>、<code>/lobby/rooms</code>。</p>')
  }
  serveStaticFile(res, path.join(DIST_DIR, 'index.html'))
}

// ==================== 房间数据模型 ====================

/**
 * rooms: Map<UPPERCASE_inviteCode, {
 *   inviteCode, host:clientId, members:Map<clientId, {
 *     clientId, ws, role, playerName, joinedAt, isAlive
 *   }>, createdAt, lastActivity
 * }>
 */
const rooms = new Map()
/** clientId -> inviteCode（反查，断线时 O(1) 定位房间） */
const clientIdToRoom = new Map()

// ==================== inviteCode 生成（契约 §11） ====================

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 无易混淆 0/O/1/I
const CODE_LEN = 6

function generateInviteCode() {
  // 全局唯一：冲突重生成（理论极低概率）
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = ''
    const bytes = crypto.randomBytes(CODE_LEN)
    for (let i = 0; i < CODE_LEN; i++) {
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
    }
    if (!rooms.has(code)) return code
  }
  // 兜底：用时间戳低位补齐
  let code = ''
  const bytes = crypto.randomBytes(CODE_LEN)
  for (let i = 0; i < CODE_LEN; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return code
}

// ==================== ws 发送工具 ====================

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return
  let payload
  try {
    payload = JSON.stringify(obj)
  } catch (e) {
    console.error('[ws] JSON.stringify 失败，丢弃消息:', e.message)
    return
  }
  ws.send(payload, (err) => {
    if (err) console.error('[ws] send error:', err.message)
  })
}

function sendError(ws, code, message, userFriendlyMessage) {
  safeSend(ws, {
    type: 'error',
    error: { code, message },
    userFriendlyMessage: userFriendlyMessage || message
  })
}

// ==================== 房间成员辅助 ====================

function getRoomByClient(clientId) {
  const code = clientIdToRoom.get(clientId)
  if (!code) return { room: null, code: null }
  const room = rooms.get(code) || null
  return { room, code }
}

function broadcastToRoom(room, msg, { excludeClientId = null } = {}) {
  for (const [cid, member] of room.members) {
    if (cid === excludeClientId) continue
    safeSend(member.ws, msg)
  }
}

function buildRoster(room) {
  const members = []
  for (const [, m] of room.members) {
    members.push({
      clientId: m.clientId,
      role: m.role,
      playerName: m.playerName,
      connected: !!m.isAlive
    })
  }
  return { type: 'roster', members }
}

function memberCount(room) {
  return room.members.size
}

// ==================== 消息分发（契约 §3 C2S） ====================

async function handleMessage(ws, clientId, msg) {
  if (!msg || typeof msg.type !== 'string') {
    return sendError(ws, 'INVALID_PARAMS', '消息缺少 type 字段')
  }

  switch (msg.type) {
    case 'createRoom':
      return handleCreateRoom(ws, clientId, msg)
    case 'joinRoom':
      return handleJoinRoom(ws, clientId, msg)
    case 'stateUpdate':
      return handleStateUpdate(ws, clientId, msg)
    case 'gameStart':
      return handleGameStart(ws, clientId, msg)
    case 'customPlants':
      return handleCustomPlants(ws, clientId, msg)
    case 'identityAssigned':
      return handleIdentityAssigned(ws, clientId, msg)
    case 'ping':
      return safeSend(ws, { type: 'pong', t: msg.t })
    case 'leave':
      return handleLeave(ws, clientId)
    default:
      return sendError(ws, 'INVALID_PARAMS', `未知消息类型: ${msg.type}`)
  }
}

function handleCreateRoom(ws, clientId, msg) {
  // 已在房间里？先清理旧绑定
  if (clientIdToRoom.has(clientId)) {
    removeMember(clientId, { silent: true })
  }

  const role = msg.role || 'host'
  if (!['host', 'player', 'spectator'].includes(role)) {
    return sendError(ws, 'INVALID_PARAMS', 'role 非法')
  }

  const inviteCode = generateInviteCode()
  const now = Date.now()
  const room = {
    inviteCode,
    host: clientId,
    members: new Map(),
    createdAt: now,
    lastActivity: now
  }
  room.members.set(clientId, {
    clientId,
    ws,
    role: 'host',
    playerName: '',  // host 不强制 playerName
    joinedAt: now,
    isAlive: true
  })
  rooms.set(inviteCode, room)
  clientIdToRoom.set(clientId, inviteCode)

  // 绑定到 ws 便于 close 时反查
  ws.__clientId = clientId
  ws.__inviteCode = inviteCode

  console.log(`[ws] createRoom host=${clientId} code=${inviteCode}`)
  safeSend(ws, { type: 'roomCreated', inviteCode, peerId: clientId })
}

function handleJoinRoom(ws, clientId, msg) {
  const inviteCode = String(msg.inviteCode || '').toUpperCase().trim()
  const role = msg.role || 'player'
  const playerName = String(msg.playerName || '').trim()

  if (!inviteCode || !['host', 'player', 'spectator'].includes(role)) {
    return sendError(ws, 'INVALID_PARAMS', 'inviteCode 或 role 非法')
  }
  if (!playerName && role !== 'host') {
    return sendError(ws, 'INVALID_PARAMS', 'playerName 缺失')
  }

  const room = rooms.get(inviteCode)
  if (!room) {
    return sendError(ws, 'ROOM_NOT_FOUND', `房间 ${inviteCode} 不存在`, '找不到房间，请检查邀请码')
  }

  // 校验同房 playerName 唯一（契约 §6、§9）
  if (playerName) {
    for (const [, m] of room.members) {
      if (m.playerName && m.playerName === playerName) {
        return sendError(ws, 'NAME_TAKEN', `playerName ${playerName} 已存在`, '该名字已被使用，请换一个')
      }
    }
  }

  // 已在别的房？先清旧
  if (clientIdToRoom.has(clientId)) {
    removeMember(clientId, { silent: true })
  }

  const now = Date.now()
  room.members.set(clientId, {
    clientId,
    ws,
    role,
    playerName,
    joinedAt: now,
    isAlive: true
  })
  room.lastActivity = now
  clientIdToRoom.set(clientId, inviteCode)
  ws.__clientId = clientId
  ws.__inviteCode = inviteCode

  const count = memberCount(room)
  console.log(`[ws] joinRoom client=${clientId} code=${inviteCode} role=${role} name=${playerName} count=${count}`)

  // 1. 广播 userJoined 给同房其他人（契约 §4）
  broadcastToRoom(room, {
    type: 'userJoined',
    peerId: clientId,
    role,
    count
  }, { excludeClientId: clientId })

  // 2. 回 connected 给新人（契约 §4）
  safeSend(ws, { type: 'connected', peerId: clientId, role })

  // 3. 广播 roster 给全房间（含新人；契约 §10：每次成员变动后全房广播 roster，
  //    保证所有成员 playerName 同步——userJoined payload 不含 playerName）
  broadcastToRoom(room, buildRoster(room))
}

function handleStateUpdate(ws, clientId, msg) {
  const { room } = getRoomByClient(clientId)
  if (!room) return sendError(ws, 'INVALID_PARAMS', '尚未加入任何房间')

  // 中心化转发（契约 §5）：广播给同房除发送者外所有人（含 host）
  const out = {
    type: 'stateUpdate',
    senderId: clientId,
    senderRole: msg.senderRole,
    timestamp: Date.now(),
    version: msg.version,
    gameState: msg.gameState
  }
  room.lastActivity = Date.now()
  broadcastToRoom(room, out, { excludeClientId: clientId })
}

function handleGameStart(ws, clientId, msg) {
  const { room } = getRoomByClient(clientId)
  if (!room) return sendError(ws, 'INVALID_PARAMS', '尚未加入任何房间')

  // 广播给同房除 host 外所有成员（契约 §5）
  const out = {
    type: 'gameStart',
    player1Name: msg.player1Name,
    player2Name: msg.player2Name,
    player1Road: msg.player1Road,
    player2Road: msg.player2Road,
    globalBans: msg.globalBans,
    hiddenBuiltinPlants: msg.hiddenBuiltinPlants
  }
  room.lastActivity = Date.now()
  const hostId = room.host
  for (const [cid, member] of room.members) {
    if (cid === hostId) continue  // host 已本地应用
    safeSend(member.ws, out)
  }
}

function handleCustomPlants(ws, clientId, msg) {
  const { room } = getRoomByClient(clientId)
  if (!room) return sendError(ws, 'INVALID_PARAMS', '尚未加入任何房间')

  const out = {
    type: 'customPlants',
    plants: msg.plants,
    hiddenBuiltinPlants: msg.hiddenBuiltinPlants
  }
  room.lastActivity = Date.now()
  const hostId = room.host
  for (const [cid, member] of room.members) {
    if (cid === hostId) continue
    safeSend(member.ws, out)
  }
}

function handleIdentityAssigned(ws, clientId, msg) {
  const { room } = getRoomByClient(clientId)
  if (!room) return sendError(ws, 'INVALID_PARAMS', '尚未加入任何房间')

  const playerName = String(msg.playerName || '').trim()
  const playerNumber = msg.playerNumber
  if (!playerName || !['player1', 'player2'].includes(playerNumber)) {
    return sendError(ws, 'INVALID_PARAMS', 'playerName 或 playerNumber 非法')
  }

  // 定向单投（契约 §5、§6）：找同房首个 playerName 匹配的连接单发
  let target = null
  for (const [, m] of room.members) {
    if (m.playerName && m.playerName === playerName) {
      target = m
      break
    }
  }
  if (!target) {
    console.warn(`[ws] identityAssigned 找不到 playerName=${playerName}（房间 ${room.inviteCode}）`)
    // 不回错（host 可能先于 client 加入触发），静默丢弃
    return
  }
  if (target.clientId === clientId) {
    // host 不该给自己投身份，但容错：仍按契约转发
  }
  safeSend(target.ws, {
    type: 'identityAssigned',
    playerNumber,
    playerName
  })
}

function handleLeave(ws, clientId) {
  removeMember(clientId)
}

// ==================== 断线清理 ====================

function removeMember(clientId, { silent = false } = {}) {
  const code = clientIdToRoom.get(clientId)
  if (!code) return
  const room = rooms.get(code)
  if (!room) {
    clientIdToRoom.delete(clientId)
    return
  }

  const member = room.members.get(clientId)
  const playerName = member ? member.playerName : ''
  const wasHost = room.host === clientId

  room.members.delete(clientId)
  clientIdToRoom.delete(clientId)

  // host 断开：第一版简化为整房清理
  if (wasHost) {
    const count = room.members.size
    for (const [, m] of room.members) {
      safeSend(m.ws, {
        type: 'userLeft',
        peerId: clientId,
        count: 0
      })
      // 通知其他成员房间将关闭
      safeSend(m.ws, {
        type: 'connectionStatus',
        status: 'host-left',
        message: '房主已断开，房间关闭',
        timestamp: Date.now()
      })
      try { m.ws.close(1001, 'host left') } catch (_) {}
      clientIdToRoom.delete(m.clientId)
    }
    rooms.delete(code)
    console.log(`[ws] host=${clientId} 断开，清房 ${code}（驱散 ${count} 名成员）`)
    return
  }

  // 普通成员断开：广播 userLeft
  if (!silent) {
    const count = memberCount(room)
    broadcastToRoom(room, {
      type: 'userLeft',
      peerId: clientId,
      count
    })
    console.log(`[ws] client=${clientId}(${playerName}) 离开房间 ${code}，剩余 ${count}`)
  }

  // 房间空了（仅剩 host 已不可能到这；host 断开上面已处理）—— 兜底清理
  if (room.members.size === 0) {
    rooms.delete(code)
  }
}

// ==================== ws 服务器 ====================

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: WS_PATH })

  wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID()
    ws.__clientId = clientId
    ws.__inviteCode = null
    ws.isAlive = true

    ws.on('pong', () => { ws.isAlive = true })

    ws.on('message', async (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch (e) {
        return sendError(ws, 'INVALID_PARAMS', '消息不是合法 JSON')
      }
      try {
        await handleMessage(ws, clientId, msg)
      } catch (err) {
        console.error('[ws] handleMessage 异常:', err)
        sendError(ws, 'INTERNAL', '服务器内部异常', '服务器异常，请重试')
      }
    })

    const cleanup = () => {
      if (ws.__closed) return
      ws.__closed = true
      removeMember(ws.__clientId)
    }
    ws.on('close', cleanup)
    ws.on('error', (err) => {
      console.error(`[ws] 连接错误 client=${ws.__clientId}:`, err.message)
      cleanup()
    })

    // 立即告知客户端其 clientId（前端据此完成握手等待）
    safeSend(ws, {
      type: 'connectionStatus',
      status: 'connected',
      message: 'WebSocket 已连接',
      timestamp: Date.now()
    })
  })

  // 服务器侧心跳（契约 §7）：30s ping，45s 内无 pong 视为断开
  const pingTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        // 超时，终止连接（触发 close → removeMember）
        try { ws.terminate() } catch (_) {}
        continue
      }
      ws.isAlive = false
      try { ws.ping() } catch (_) {}
    }
  }, SERVER_PING_INTERVAL_MS)
  pingTimer.unref()

  return wss
}

// ==================== Webhook 自动部署 ====================

/**
 * 验证 GitHub/GitLab Webhook 签名
 * GitHub: X-Hub-Signature-256: sha256=<HMAC>
 * GitLab: X-Gitlab-Token: <plain token>
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'] || req.headers['x-gitlab-token']
  if (!signature) {
    return { valid: false, error: 'Missing signature' }
  }

  // GitLab: 直接比较 token
  if (req.headers['x-gitlab-token']) {
    return { valid: req.headers['x-gitlab-token'] === WEBHOOK_SECRET }
  }

  // GitHub: HMAC 验证
  if (req.headers['x-hub-signature-256']) {
    const payload = req.body || ''
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex')
    // timingSafeEqual 要求两 Buffer 等长，否则抛 RangeError；先比长度，拒绝异常签名
    if (signature.length !== expectedSignature.length) {
      return { valid: false, error: 'Signature length mismatch' }
    }
    return {
      valid: crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    }
  }

  return { valid: false, error: 'Unknown signature format' }
}

/**
 * 触发部署脚本（异步，不阻塞响应）
 */
function triggerDeploy() {
  console.log('[webhook] 触发自动部署...')

  const deploy = spawn('bash', [DEPLOY_SCRIPT], {
    cwd: path.dirname(DEPLOY_SCRIPT),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // 记录输出
  deploy.stdout.on('data', (data) => {
    console.log(`[deploy:out] ${data.toString().trim()}`)
  })

  deploy.stderr.on('data', (data) => {
    console.error(`[deploy:err] ${data.toString().trim()}`)
  })

  deploy.unref()  // 让父进程不等待子进程
}

/**
 * Webhook 请求处理
 */
async function handleWebhook(req, res) {
  // 仅允许 POST
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }))
  }

  // 读取请求体（限制 2MB，防止恶意大 payload 耗尽内存）
  const chunks = []
  let bodySize = 0
  const MAX_BODY_BYTES = 2 * 1024 * 1024
  for await (const chunk of req) {
    bodySize += chunk.length
    if (bodySize > MAX_BODY_BYTES) {
      console.warn(`[webhook] 请求体超过 ${MAX_BODY_BYTES} 字节，拒绝`)
      res.writeHead(413, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: 'PAYLOAD_TOO_LARGE' }))
    }
    chunks.push(chunk)
  }
  const body = Buffer.concat(chunks).toString()
  req.body = body

  // 验证签名
  const verification = verifyWebhookSignature(req)
  if (!verification.valid) {
    console.warn(`[webhook] 签名验证失败: ${verification.error || 'Invalid signature'}`)
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }))
  }

  // 解析事件类型（可选：限制仅在 push/push 事件时部署）
  const event = req.headers['x-github-event'] || req.headers['x-gitlab-event']
  console.log(`[webhook] 收到 ${event || 'unknown'} 事件`)

  // 仅在 push 事件时部署
  if (event && event !== 'Push Hook' && event !== 'push') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, message: 'Event ignored', event }))
  }

  // 触发部署
  triggerDeploy()

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    ok: true,
    message: 'Deployment triggered',
    timestamp: new Date().toISOString()
  }))
}

// ==================== HTTP server（路由优先级） ====================

/**
 * 请求处理顺序（契约 §A4，风险点 4）：
 *   1. WebSocket upgrade —— 由 ws 库在 'upgrade' 事件拦截 /ws（不进这里）
 *   2. lobby HTTP 路由 —— isLobbyPath 为真则交给 handleLobbyRequest
 *   3. 静态文件 —— GET /assets/*、/index.html、/favicon.ico、/plants/* 等 dist 下文件
 *   4. SPA fallback —— 其它 GET 回 dist/index.html
 *   5. dist 不存在 —— 返回简短占位（ws/lobby 仍可用）
 */
const server = http.createServer(async (req, res) => {
  let pathname
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
    return res.end(JSON.stringify({ ok: false, error: 'BAD_URL' }))
  }

  // 1. Webhook 部署路由（优先级最高）
  if (pathname === WEBHOOK_PATH) {
    return handleWebhook(req, res)
  }

  // 2. lobby 路由（/lobby/*、/rooms、/health、/lobby、/lobby/health）
  if (isLobbyPath(pathname)) {
    const handled = await handleLobbyRequest(req, res, pathname)
    if (handled) return
    // 未匹配具体 lobby 子路由（如 /lobby/unknown）→ 落到 404 而非 SPA fallback
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    return res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND', path: pathname }))
  }

  // 仅 GET 走静态 / SPA fallback
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' })
    return res.end(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }))
  }

  // 3. 静态文件 / SPA fallback
  if (DIST_EXISTS) {
    if (pathname === '/' || pathname === '') {
      // 根路径直接返回 index.html
      return serveStaticFile(res, path.join(DIST_DIR, 'index.html'))
    }
    const filePath = safeJoin(DIST_DIR, pathname)
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end('Forbidden')
    }
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '' || ext === '.html') {
      // 无扩展名（SPA history 路由，如 /some/route）或 .html：文件存在则返回，否则 fallback 到 index.html
      return serveStaticFile(res, filePath, { fallback404ToIndex: true })
    }
    // 带其它扩展名（/assets/x.js、/favicon.ico、/plants/x.png）：文件存在则返回，不存在直接 404（不 SPA fallback）
    return serveStaticFile(res, filePath, { fallback404ToIndex: false })
  }

  // dist 不存在：返回占位（ws/lobby 仍可用）
  return serveIndex(res)
})

// ==================== 启动 ====================

const wss = setupWebSocket(server)
startLobbyCleanupTimer()

server.listen(PORT, () => {
  console.log(`[server] BP 中心化服务已启动，监听 :${PORT}`)
  console.log(`[server]   ws     : ws://localhost:${PORT}${WS_PATH}`)
  console.log(`[server]   lobby  : http://localhost:${PORT}/lobby/rooms`)
  console.log(`[server]   health : http://localhost:${PORT}/health`)
  console.log(`[server]   webhook: http://localhost:${PORT}${WEBHOOK_PATH}`)
  console.log(`[server]   static : ${DIST_EXISTS ? DIST_DIR : '(dist/ 未构建，SPA fallback 返回占位)'}`)
})

process.on('SIGINT', () => { console.log('[server] 收到 SIGINT，退出'); process.exit(0) })
process.on('SIGTERM', () => { console.log('[server] 收到 SIGTERM，退出'); process.exit(0) })

export { server, wss, rooms, clientIdToRoom }

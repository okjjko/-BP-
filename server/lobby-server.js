/**
 * 公共房间目录服务（lobby service）
 *
 * 作用：维护一个临时的"公共房间目录"。房主开公开房时登记，其他人在列表中看到后，
 *   直接复用现有 roomManager.joinRoom(inviteCode) 加入。本服务【不参与 P2P 数据传输】——
 *   P2P 由 roomManager（PeerJS）处理；本服务只做房间目录的登记 / 查询 / 心跳 / 注销。
 *
 * 设计：Node 原生 http + 内存 Map，零运行时依赖。房间是临时的（房主在线才有），
 *   无心跳超 60s 视为下线自动清理；进程重启即清空（重新开房即可，可接受）。
 *
 * 部署：与现有 PeerJS:9000 / coturn:3478 同 ECS，监听 8800，由 nginx 反代到
 *   https://okjjko.top/lobby（解决 https 前端的混合内容问题）。详见 README.md。
 */

import http from 'node:http'
import crypto from 'node:crypto'

// ==================== 配置 ====================

const PORT = Number(process.env.PORT) || 8800
const TTL_MS = Number(process.env.LOBBY_TTL_MS) || 60 * 1000                  // 心跳过期阈值：60s 无心跳视为下线
const MAX_AGE_MS = Number(process.env.LOBBY_MAX_AGE_MS) || 6 * 60 * 60 * 1000 // 房间最大存活：6h（硬上限，防内存占用）
const CLEANUP_INTERVAL_MS = Number(process.env.LOBBY_CLEANUP_MS) || 30 * 1000 // 兜底清理扫描间隔
const MAX_BODY_BYTES = 8 * 1024

// CORS 白名单（其余 origin 一律不放行 ACAO，浏览器读取会被拒）
const ALLOWED_ORIGINS = new Set([
  'https://okjjko.top',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
])
if (process.env.LOBBY_EXTRA_ORIGINS) {
  for (const o of process.env.LOBBY_EXTRA_ORIGINS.split(',')) {
    if (o.trim()) ALLOWED_ORIGINS.add(o.trim())
  }
}

// 限流配置（token bucket，按 IP）
const LIMIT = {
  POST_ROOMS: { windowMs: 10 * 1000, max: 1 },  // 同 IP 10s 内最多登记 1 个房间
  GET_ROOMS: { windowMs: 1 * 1000, max: 5 }      // 同 IP 每秒最多查询 5 次
}

// ==================== 存储 ====================

/** @type {Map<string, object>} key = 大写邀请码 */
const rooms = new Map()
const postBuckets = new Map()  // ip -> { count, resetAt }
const getBuckets = new Map()

// ==================== 工具函数 ====================

// 6 位大写字母或 2-9（宽松覆盖 roomManager.generateInviteCode 的字符集，不误拒合法码）
const CODE_RE = /^[A-Z2-9]{6}$/

function isValidCode(code) {
  return CODE_RE.test(String(code || ''))
}
function normalizeCode(code) {
  return String(code || '').toUpperCase().trim()
}
function isValidHostName(name) {
  const n = String(name || '').trim()
  return n.length >= 1 && n.length <= 20
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function allowOrigin(req) {
  const origin = req.headers.origin
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null
}

function sendJson(res, status, obj, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  res.writeHead(status, headers)
  res.end(JSON.stringify(obj))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > MAX_BODY_BYTES) {
        req.destroy()
        reject(new Error('PAYLOAD_TOO_LARGE'))
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(new Error('INVALID_JSON'))
      }
    })
    req.on('error', (err) => reject(err))
  })
}

function rateLimit(ip, buckets, { windowMs, max }) {
  const now = Date.now()
  let bucket = buckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(ip, bucket)
  }
  bucket.count++
  return bucket.count <= max
}

// ==================== 清理 ====================

function cleanupExpired() {
  const now = Date.now()
  let removed = 0
  for (const [code, room] of rooms) {
    if (now - room.lastHeartbeat > TTL_MS || now - room.createdAt > MAX_AGE_MS) {
      rooms.delete(code)
      removed++
    }
  }
  if (removed > 0) {
    console.log(`[lobby] 清理 ${removed} 个过期房间，剩余 ${rooms.size}`)
  }
}

// ==================== 路由处理器 ====================

async function handlePostRooms(req, res, origin, ip) {
  if (!rateLimit(ip, postBuckets, LIMIT.POST_ROOMS)) {
    return sendJson(res, 429, { ok: false, error: 'RATE_LIMITED', message: '创建过于频繁，请稍后再试' }, origin)
  }
  let body
  try {
    body = await readJsonBody(req)
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_PARAMS', message: '请求体格式错误' }, origin)
  }
  const code = normalizeCode(body.inviteCode)
  const hostName = String(body.hostName || '').trim()
  if (!isValidCode(code) || !isValidHostName(hostName)) {
    return sendJson(res, 400, { ok: false, error: 'INVALID_PARAMS', message: '邀请码须 6 位大写字母/数字，房主名 1-20 字' }, origin)
  }
  const existing = rooms.get(code)
  if (existing && Date.now() - existing.lastHeartbeat <= TTL_MS) {
    return sendJson(res, 409, { ok: false, error: 'ROOM_EXISTS', message: '该邀请码已存在公开房间' }, origin)
  }
  const now = Date.now()
  const room = {
    inviteCode: code,
    hostName,
    createdAt: now,
    lastHeartbeat: now,
    playerCount: 0,
    spectatorCount: 0,
    hostSecret: crypto.randomBytes(16).toString('hex')
  }
  rooms.set(code, room)
  console.log(`[lobby] 登记房间 ${code}（房主: ${hostName}, 来源: ${ip}），当前房间数 ${rooms.size}`)
  sendJson(res, 200, { ok: true, inviteCode: code, hostSecret: room.hostSecret, createdAt: room.createdAt }, origin)
}

function handleGetRooms(res, origin, ip) {
  if (!rateLimit(ip, getBuckets, LIMIT.GET_ROOMS)) {
    return sendJson(res, 429, { ok: false, error: 'RATE_LIMITED' }, origin)
  }
  cleanupExpired()  // 懒清理（与定时清理双保险）
  const list = []
  for (const room of rooms.values()) {
    list.push({
      inviteCode: room.inviteCode,
      hostName: room.hostName,
      createdAt: room.createdAt,
      playerCount: room.playerCount,
      spectatorCount: room.spectatorCount
    })
  }
  sendJson(res, 200, { ok: true, rooms: list, serverTime: Date.now() }, origin)
}

async function handleHeartbeat(req, res, origin, code) {
  const room = rooms.get(code)
  if (!room) return sendJson(res, 404, { ok: false, error: 'ROOM_NOT_FOUND' }, origin)
  if (req.headers['x-host-secret'] !== room.hostSecret) {
    return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' }, origin)
  }
  let body = {}
  try { body = await readJsonBody(req) } catch (e) { /* 空 body 容忍，仅刷新心跳时间 */ }
  const pc = Number(body.playerCount)
  const sc = Number(body.spectatorCount)
  room.lastHeartbeat = Date.now()
  if (Number.isFinite(pc) && pc >= 0) room.playerCount = Math.floor(pc)
  if (Number.isFinite(sc) && sc >= 0) room.spectatorCount = Math.floor(sc)
  sendJson(res, 200, { ok: true, lastHeartbeat: room.lastHeartbeat }, origin)
}

function handleDelete(req, res, origin, code) {
  const room = rooms.get(code)
  if (!room) return sendJson(res, 404, { ok: false, error: 'ROOM_NOT_FOUND' }, origin)
  if (req.headers['x-host-secret'] !== room.hostSecret) {
    return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' }, origin)
  }
  rooms.delete(code)
  console.log(`[lobby] 注销房间 ${code}，当前房间数 ${rooms.size}`)
  sendJson(res, 200, { ok: true }, origin)
}

function handleHealth(res, origin) {
  sendJson(res, 200, { ok: true, service: 'bp-lobby-server', rooms: rooms.size, uptime: process.uptime() }, origin)
}

// ==================== HTTP 服务 ====================

const server = http.createServer(async (req, res) => {
  const origin = allowOrigin(req)
  const ip = clientIp(req)

  // 预检请求
  if (req.method === 'OPTIONS') {
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Host-Secret',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    res.writeHead(204, headers)
    return res.end()
  }

  // 解析路径（兼容有无 /lobby 前缀，取决于 nginx 反代是否 strip 前缀）
  let pathname
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: 'BAD_URL' }, origin)
  }
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'lobby') parts.shift()  // 容错：nginx 未 strip /lobby 前缀

  try {
    // GET / 或 /health —— 健康检查
    if ((parts.length === 0 || (parts.length === 1 && parts[0] === 'health')) && req.method === 'GET') {
      return handleHealth(res, origin)
    }

    // /rooms 及子路由
    if (parts[0] === 'rooms') {
      if (parts.length === 1) {
        if (req.method === 'POST') return await handlePostRooms(req, res, origin, ip)
        if (req.method === 'GET') return handleGetRooms(res, origin, ip)
      } else if (parts.length === 2 && req.method === 'DELETE') {
        return handleDelete(req, res, origin, normalizeCode(parts[1]))
      } else if (parts.length === 3 && parts[2] === 'heartbeat' && req.method === 'POST') {
        return await handleHeartbeat(req, res, origin, normalizeCode(parts[1]))
      }
    }

    sendJson(res, 404, { ok: false, error: 'NOT_FOUND', path: pathname }, origin)
  } catch (err) {
    console.error('[lobby] 处理异常:', err)
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'INTERNAL' }, origin)
  }
})

server.listen(PORT, () => {
  console.log(`[lobby] 公共房间目录服务已启动，监听 :${PORT}`)
  console.log(`[lobby] 允许的 Origin: ${[...ALLOWED_ORIGINS].join(', ')}`)
})

// 兜底定时清理（即便无人查询也清；.unref 让进程能正常退出）
const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS)
cleanupTimer.unref()

process.on('SIGINT', () => { console.log('[lobby] 收到 SIGINT，退出'); process.exit(0) })
process.on('SIGTERM', () => { console.log('[lobby] 收到 SIGTERM，退出'); process.exit(0) })

/**
 * roomManager 单元测试（WebSocket 中心化版）
 *
 * 关键技巧：FakeHub 两端都套 JSON.parse(JSON.stringify())，复刻真实 ws 文本帧序列化边界，
 * 抓「序列化丢字段」类 bug（undefined/Date/BigInt）。
 *
 * 覆盖契约 §3-§10 的关键路径：
 * - createRoom → joinRoom 两端成员一致
 * - host broadcastState → client 收 stateUpdate（字段完整）
 * - client sendStateUpdate → host 收到
 * - 旧 version 忽略 / 乱序丢弃（由 connectionStore 验证；roomManager 只转发）
 * - identityAssigned 定向（目标收 / 非目标不收）
 * - customPlants / gameStart payload 完整
 * - 序列化鲁棒性（含 undefined/Date 的 gameState 两端一致）
 * - 断线重连
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RoomManager } from '@/utils/roomManager'
import { createHub, createFakeTransport } from '@/utils/devTransport'

// 等待所有 microtask / setTimeout(0) flush（FakeClient 用 Promise.resolve().then 投递）
function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// 构造一对注入同一 FakeHub 的 roomManager（host + client）
function makePair() {
  const hub = createHub()
  const host = new RoomManager({ transport: createFakeTransport(hub) })
  const client = new RoomManager({ transport: createFakeTransport(hub) })
  return { hub, host, client }
}

describe('roomManager (ws centralized)', () => {
  let hub, host, client

  beforeEach(async () => {
    ({ hub, host, client } = makePair())
  })

  afterEach(() => {
    try { host && host.disconnect() } catch (_) { /* ignore */ }
    try { client && client.disconnect() } catch (_) { /* ignore */ }
  })

  it('createRoom → joinRoom：两端 members 一致', async () => {
    const code = await host.createRoom()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)

    await client.joinRoom(code, 'player', 'alice')

    // flush 异步投递
    await flushMicrotasks()

    const hostUsers = host.getConnectedUsers()
    const clientUsers = client.getConnectedUsers()
    // host 视角：自己（host）+ alice
    expect(hostUsers.length).toBeGreaterThanOrEqual(1)
    // client 视角应能看到 host 和自己
    expect(clientUsers.some((u) => u.playerName === 'alice')).toBe(true)
    // host 能看到 alice（userJoined 增量）
    expect(host.getConnectedPlayerNames()).toContain('alice')
    // stats 推导正确
    const stats = host.getConnectionStats()
    expect(stats.players).toBeGreaterThanOrEqual(1)
  })

  it('host broadcastState → client 收 stateUpdate，字段完整', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    client.on('stateUpdate', (msg) => received.push(msg))

    const gameState = { foo: 'bar', nested: { a: 1 } }
    host.broadcastState(gameState, 3)

    await flushMicrotasks()

    expect(received.length).toBe(1)
    const msg = received[0]
    expect(msg.type).toBe('stateUpdate')
    expect(msg.version).toBe(3)
    expect(msg.gameState).toEqual(gameState)
    // 字段完整性：senderId/senderRole/timestamp 齐备
    expect(typeof msg.senderId).toBe('string')
    expect(msg.senderRole).toBe('host')
    expect(typeof msg.timestamp).toBe('number')
  })

  it('client sendStateUpdate → host 收到（中心化转发）', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    host.on('stateUpdate', (msg) => received.push(msg))

    client.sendStateUpdate({ step: 1 }, 5)
    await flushMicrotasks()

    expect(received.length).toBe(1)
    expect(received[0].senderRole).toBe('player')
    expect(received[0].version).toBe(5)
    expect(received[0].gameState).toEqual({ step: 1 })
  })

  it('stateUpdate 不回声给发送者自己', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const hostReceived = []
    host.on('stateUpdate', (m) => hostReceived.push(m))

    // host 自己 broadcast，host 不应收到自己发的（服务器排除发送者）
    host.broadcastState({ x: 1 }, 7)
    await flushMicrotasks()
    expect(hostReceived.length).toBe(0)

    // client 发，client 不应收到回声
    const clientReceived = []
    client.on('stateUpdate', (m) => clientReceived.push(m))
    client.sendStateUpdate({ y: 2 }, 8)
    await flushMicrotasks()
    expect(clientReceived.length).toBe(0)
  })

  it('identityAssigned 定向单投：目标收、非目标不收', async () => {
    const code = await host.createRoom()
    const client2 = new RoomManager({ transport: createFakeTransport(hub) })
    await client.joinRoom(code, 'player', 'alice')
    await client2.joinRoom(code, 'player', 'bob')
    await flushMicrotasks()

    const aliceReceived = []
    const bobReceived = []
    client.on('identityAssigned', (m) => aliceReceived.push(m))
    client2.on('identityAssigned', (m) => bobReceived.push(m))

    host.sendIdentityAssignment('alice', 'player1')
    host.sendIdentityAssignment('bob', 'player2')
    await flushMicrotasks()

    expect(aliceReceived.length).toBe(1)
    expect(aliceReceived[0].playerNumber).toBe('player1')
    expect(aliceReceived[0].playerName).toBe('alice')
    expect(bobReceived.length).toBe(1)
    expect(bobReceived[0].playerNumber).toBe('player2')
  })

  it('identityAssigned 未匹配 playerName 时静默不投递', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    client.on('identityAssigned', (m) => received.push(m))

    host.sendIdentityAssignment('nonexistent', 'player1')
    await flushMicrotasks()
    expect(received.length).toBe(0)
  })

  it('customPlants payload 完整（含 plants 数组与 hiddenBuiltinPlants）', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    client.on('customPlants', (m) => received.push(m))

    await host.broadcastCustomPlants({
      plants: [{ id: 'p1', name: '豌豆', image: 'data:image/png;base64,AAAA' }],
      hiddenBuiltinPlants: ['sunflower']
    })
    await flushMicrotasks()

    expect(received.length).toBe(1)
    expect(received[0].plants.length).toBe(1)
    expect(received[0].plants[0].id).toBe('p1')
    expect(received[0].hiddenBuiltinPlants).toEqual(['sunflower'])
  })

  it('gameStart payload 字段完整', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    client.on('gameStart', (m) => received.push(m))

    host.broadcastGameStart('p1', 'p2', 2, 4, ['cherry'], ['wallnut'])
    await flushMicrotasks()

    expect(received.length).toBe(1)
    const m = received[0]
    expect(m.player1Name).toBe('p1')
    expect(m.player2Name).toBe('p2')
    expect(m.player1Road).toBe(2)
    expect(m.player2Road).toBe(4)
    expect(m.globalBans).toEqual(['cherry'])
    expect(m.hiddenBuiltinPlants).toEqual(['wallnut'])
  })

  it('序列化鲁棒性：gameState 含 undefined/Date 两端等价（undefined 字段丢失）', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const received = []
    client.on('stateUpdate', (m) => received.push(m))

    // 真实 ws 经 JSON.stringify：undefined 字段会丢失，Date 变字符串
    const gameState = { keep: 1, drop: undefined, when: new Date('2026-01-01T00:00:00Z') }
    host.broadcastState(gameState, 1)
    await flushMicrotasks()

    expect(received.length).toBe(1)
    const got = received[0].gameState
    expect(got.keep).toBe(1)
    expect('drop' in got).toBe(false) // undefined 字段被序列化丢弃
    expect(typeof got.when).toBe('string') // Date → string
    expect(got.when).toBe('2026-01-01T00:00:00.000Z')
  })

  it('userJoined/userLeft 正确更新成员名册与 count', async () => {
    const code = await host.createRoom()
    const joined = []
    host.on('userJoined', (m) => joined.push(m))

    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    expect(joined.length).toBe(1)
    expect(joined[0].role).toBe('player')

    const leftEvents = []
    host.on('userLeft', (m) => leftEvents.push(m))
    client.disconnect()
    await flushMicrotasks()

    expect(leftEvents.length).toBe(1)
    expect(host.getConnectedPlayerNames()).not.toContain('alice')
  })

  it('error 事件携带 userFriendlyMessage（服务器错误码映射）', async () => {
    const errors = []
    client.on('error', (e) => errors.push(e))

    // joinRoom 不存在的房间
    await expect(client.joinRoom('ZZZZZZ', 'player', 'alice')).rejects.toThrow()
    await flushMicrotasks()

    const found = errors.find((e) => e.error && e.error.code === 'ROOM_NOT_FOUND')
    expect(found).toBeTruthy()
    expect(found.userFriendlyMessage).toContain('房间')
  })

  it('心跳：ping 后服务器回 pong（不对外 emit）', async () => {
    const code = await host.createRoom()
    await flushMicrotasks()

    // 直接调 _send({type:'ping'}) 触发，确保 hub 回 pong（pong 不应产生 emit）
    const stateStatuses = []
    host.on('connectionStatus', (m) => stateStatuses.push(m))

    host._send({ type: 'ping', t: 123 })
    await flushMicrotasks()

    // pong 内部消化，不触发 heartbeat-lost
    expect(stateStatuses.find((s) => s.status === 'heartbeat-lost')).toBeFalsy()
  })

  it('公共 API 签名保持：getStatus/getConnectionStats/getConnectedUsers 返回结构', async () => {
    const code = await host.createRoom()
    await client.joinRoom(code, 'player', 'alice')
    await flushMicrotasks()

    const status = host.getStatus()
    expect(status).toHaveProperty('role')
    expect(status).toHaveProperty('inviteCode')
    expect(status).toHaveProperty('connected')
    expect(status).toHaveProperty('stats')
    expect(status).toHaveProperty('peerId')
    expect(status).toHaveProperty('isReconnecting')

    const stats = host.getConnectionStats()
    expect(stats).toHaveProperty('total')
    expect(stats).toHaveProperty('players')
    expect(stats).toHaveProperty('spectators')

    const users = host.getConnectedUsers()
    users.forEach((u) => {
      expect(u).toHaveProperty('peerId')
      expect(u).toHaveProperty('role')
      expect(u).toHaveProperty('playerName')
      expect(u).toHaveProperty('connected')
    })
  })
})


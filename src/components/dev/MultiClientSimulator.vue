/**
 * DEV ONLY：多客户端模拟面板
 *
 * 单 tab 内用 FakeHub 模拟 host + 2 client，可视化 WebSocket 消息流。
 * 仅 dev 环境（import.meta.env.DEV）加载；生产构建经动态 import + DEV 守卫 tree-shake。
 *
 * 路由：/dev/sim（router/index.js 内 DEV 守卫）
 */
<template>
  <div class="dev-sim p-4 text-gray-200 min-h-screen bg-slate-950">
    <h1 class="text-xl font-bold mb-2">多客户端 WebSocket 模拟器（DEV）</h1>
    <p class="text-xs text-gray-400 mb-4">
      基于 FakeHub（内存消息总线），复刻 docs/network-protocol.md 契约。无真实网络。
    </p>

    <div class="flex gap-3 mb-4">
      <button
        class="px-3 py-1 rounded bg-plant-green text-black font-semibold"
        :disabled="!!running"
        @click="start"
      >开始模拟</button>
      <button
        class="px-3 py-1 rounded bg-ban-red text-white"
        :disabled="!running"
        @click="reset"
      >重置</button>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div v-for="peer in peers" :key="peer.name" class="border border-gray-700 rounded p-3 bg-slate-900">
        <div class="font-bold text-pick-blue">{{ peer.name }} <span class="text-xs text-gray-500">({{ peer.role }})</span></div>
        <div class="text-xs mt-1">clientId: <code>{{ peer.clientId || '-' }}</code></div>
        <div class="text-xs">members: {{ peer.memberCount }}</div>
        <div class="text-xs">playerNames: {{ peer.playerNames.join(', ') || '-' }}</div>
        <div class="mt-2 text-xs">
          <div class="text-gray-400">最近事件：</div>
          <ul class="font-mono text-[10px] max-h-32 overflow-auto">
            <li v-for="(ev, i) in peer.events" :key="i">{{ ev }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="mt-4 border border-gray-700 rounded p-3 bg-slate-900">
      <div class="font-bold mb-1">消息总线（{{ dispatchLog.length }}）</div>
      <ul class="font-mono text-[10px] max-h-64 overflow-auto">
        <li v-for="(line, i) in dispatchLog" :key="i">{{ line }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onUnmounted } from 'vue'

// DEV 守卫：生产构建时整个 setup 体的动态 import 不触发
const peers = reactive([
  { name: 'Host', role: 'host', clientId: '', memberCount: 0, playerNames: [], events: [] },
  { name: 'Client1', role: 'player', clientId: '', memberCount: 0, playerNames: [], events: [] },
  { name: 'Client2', role: 'player', clientId: '', memberCount: 0, playerNames: [], events: [] }
])
const dispatchLog = ref([])
const running = ref(null)

let _unsub = null
let _rms = []

async function start() {
  reset()
  // 动态 import，生产不打包
  const { RoomManager } = await import('@/utils/roomManager')
  const { createHub, createFakeTransport } = await import('@/utils/devTransport')

  const hub = createHub()
  _unsub = hub.onDispatch((route) => {
    dispatchLog.value.unshift(
      `[${new Date().toLocaleTimeString()}] ${route.kind} ${route.code || ''} ${route.from ? 'from=' + route.from.slice(0, 12) : ''}${route.to ? ' to=' + route.to.slice(0, 12) : ''}${route.version !== undefined ? ' v=' + route.version : ''}`
    )
    if (dispatchLog.value.length > 200) dispatchLog.value.length = 200
  })

  // host
  const host = new RoomManager({ transport: createFakeTransport(hub) })
  host.on('roomCreated', (m) => { peers[0].clientId = m.peerId; peers[0].events.unshift('roomCreated ' + m.inviteCode) })
  host.on('userJoined', (m) => { peers[0].memberCount = host.getConnectedUsers().length; peers[0].playerNames = host.getConnectedPlayerNames(); peers[0].events.unshift('userJoined ' + m.peerId.slice(0, 8)) })
  host.on('stateUpdate', (m) => { peers[0].events.unshift('stateUpdate v=' + m.version) })
  host.on('connected', () => {})
  _rms.push(host)

  await host.createRoom()
  peers[0].memberCount = host.getConnectedUsers().length

  const code = host.inviteCode

  // client1
  const c1 = new RoomManager({ transport: createFakeTransport(hub) })
  c1.on('connected', (m) => { peers[1].clientId = m.peerId })
  c1.on('stateUpdate', (m) => { peers[1].events.unshift('stateUpdate v=' + m.version) })
  c1.on('identityAssigned', (m) => { peers[1].events.unshift(`identityAssigned ${m.playerName}=${m.playerNumber}`) })
  c1.on('roster', () => { peers[1].memberCount = c1.getConnectedUsers().length; peers[1].playerNames = c1.getConnectedPlayerNames() })
  _rms.push(c1)
  await c1.joinRoom(code, 'player', 'alice')

  // client2
  const c2 = new RoomManager({ transport: createFakeTransport(hub) })
  c2.on('connected', (m) => { peers[2].clientId = m.peerId })
  c2.on('identityAssigned', (m) => { peers[2].events.unshift(`identityAssigned ${m.playerName}=${m.playerNumber}`) })
  c2.on('roster', () => { peers[2].memberCount = c2.getConnectedUsers().length; peers[2].playerNames = c2.getConnectedPlayerNames() })
  _rms.push(c2)
  await c2.joinRoom(code, 'player', 'bob')

  // flush
  await new Promise((r) => setTimeout(r, 50))
  peers[0].playerNames = host.getConnectedPlayerNames()
  peers[1].playerNames = c1.getConnectedPlayerNames()
  peers[2].playerNames = c2.getConnectedPlayerNames()

  // 演示：host 广播状态
  host.broadcastState({ stage: 1, step: 0 }, 1)
  await new Promise((r) => setTimeout(r, 50))
  // 演示：身份分配
  host.sendIdentityAssignment('alice', 'player1')
  host.sendIdentityAssignment('bob', 'player2')
  await new Promise((r) => setTimeout(r, 50))

  running.value = { code }
}

function reset() {
  if (_unsub) { _unsub(); _unsub = null }
  _rms.forEach((r) => { try { r.disconnect() } catch (_) {} })
  _rms = []
  dispatchLog.value = []
  peers.forEach((p) => { p.clientId = ''; p.memberCount = 0; p.playerNames = []; p.events = [] })
  running.value = null
}

onUnmounted(reset)
</script>

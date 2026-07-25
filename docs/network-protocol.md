# 多人对战网络协议（WebSocket 中心化）

> ⚠️ 本文件是**前后端冻结契约**（single source of truth）。任何变更须前后端双方同步，**禁止单方面修改**。
>
> 对应实现：前端 `src/utils/roomManager.js`（ws 版）、后端 `server/index.js`（ws hub）。
> 维护义务：改协议必须先改本文件，再同步两端（见 §12 变更管理）。

## 1. 概述

- **传输**：每个客户端与中心服务器维持**一条 WebSocket 连接**。所有游戏状态经服务器中转。
- **服务器职责**：房间管理、成员名册、消息路由（状态广播 / 定向投递）、心跳、断线清理。
- **前端零改原则**：roomManager 收到 S2C 消息后 `emit(msg.type, msg)`，事件名与历史 PeerJS 版**完全一致**，`connectionStore` / `GameSetup.vue` / `RoomSetup.vue` 等消费者无需改动。
- **序列化**：所有消息为 JSON 文本帧。前端/后端读写均经过 `JSON.stringify` / `JSON.parse`（等价于真实 ws 边界）。注意：`undefined` 字段会丢失、`Date` 会变字符串、`Map/Set/BigInt` 不兼容——payload 内不得包含这些类型。

## 2. 连接地址

| 环境 | 地址 | 说明 |
|---|---|---|
| dev | `ws://localhost:3000/ws` | vite proxy `/ws`（`ws:true`）→ 本地 Node `:8080` |
| prod | `wss://okjjko.top/ws` | nginx 终止 TLS 并反代 → Node `:8080` |

- 前端用 `import.meta.env.DEV` 在 `network.config.ws.devUrl` / `prodUrl` 间选址。
- nginx 必须配置 ws upgrade 头（`Upgrade` / `Connection: upgrade`）与较大 `proxy_read_timeout`（见 `docs/SERVER-SETUP.md`）。

## 3. C2S 消息（客户端 → 服务器）

| type | 触发 | 字段 | 服务器动作 |
|---|---|---|---|
| `createRoom` | `roomManager.createRoom(playerName?)` | `{type, role:'host', playerName?}` | 生成 inviteCode + 建房 + 设该连接为 host + 分配 clientId；`playerName`（host 兼选手的参赛名，可选）存入成员并参与 NAME_TAKEN 唯一校验 → 回 `roomCreated` |
| `joinRoom` | `roomManager.joinRoom(code, role, name)` | `{type, inviteCode, role, playerName}` | 校验房间存在 + 校验同房 playerName 唯一 + 加入成员 + 分配 clientId → 广播 `userJoined` 给同房其他人 → 回 `connected` + 推 `roster` 给新人 |
| `stateUpdate` | syncState（host 用 broadcastState / client 用 sendStateUpdate） | `{type, senderRole, version, gameState}` | **中心化转发**：补 `senderId=clientId`、`timestamp`，广播给同房**除发送者外**所有成员（含 host） |
| `gameStart` | `broadcastGameStart(...)` | `{type, player1Name, player2Name, player1Road, player2Road, globalBans, hiddenBuiltinPlants}` | 广播给同房**除 host 外**所有成员（host 已本地应用） |
| `customPlants` | `broadcastCustomPlants({plants, hiddenBuiltinPlants})` | `{type, plants, hiddenBuiltinPlants}` | 广播给同房**除 host 外**所有成员 |
| `identityAssigned` | `roomManager.sendIdentityAssignment(playerName, playerNumber)` | `{type, playerName, playerNumber}` | **定向单投**：找同房 `member.playerName === playerName` 的连接**单发**（不广播） |
| `ping` | roomManager 心跳 | `{type:'ping', t}` | 回 `{type:'pong', t}` |
| `leave` | `roomManager.disconnect()` | `{type:'leave'}` | 移除成员 + 广播 `userLeft` |

> `role` 取值：`'host'` | `'player'` | `'spectator'`。
> `playerNumber` 取值：`'player1'` | `'player2'`。

## 4. S2C 消息（服务器 → 客户端）

**约束：`type` 必须等于 roomManager 现有 emit 事件名**，前端直接 `emit(msg.type, msg)`。

| type | 对应 emit | payload 字段（逐字段复刻 PeerJS 版现状） |
|---|---|---|
| `roomCreated` | `roomCreated` | `{type, inviteCode, peerId:clientId}` |
| `connected` | `connected` | `{type, peerId:clientId, role}` |
| `roster` | （内部，驱动 `this.members`，不对外 emit） | `{type:'roster', members:[{clientId, role, playerName, connected}]}` |
| `userJoined` | `userJoined` | `{type, peerId:clientId, role, count}` |
| `userLeft` | `userLeft` | `{type, peerId:clientId, count}` |
| `stateUpdate` | `stateUpdate` | `{type, senderId, senderRole, timestamp, version, gameState}` |
| `gameStart` | `gameStart` | 同 C2S `gameStart` 字段集 |
| `customPlants` | `customPlants` | 同 C2S `customPlants` 字段集 |
| `identityAssigned` | `identityAssigned` | `{type, playerNumber, playerName}` |
| `pong` | （内部心跳，不对外 emit） | `{type:'pong', t}` |
| `error` | `error` | `{type:'error', error:{code, message}, userFriendlyMessage}` |
| `connectionStatus` | `connectionStatus` | `{type:'connectionStatus', status, message, timestamp}` |

## 5. 转发规则（中心化）

- **stateUpdate**：服务器是唯一转发者。收到任何成员（含 host）的 `stateUpdate` → 广播给同房**除发送者外**所有成员。
- **gameStart / customPlants**：广播给同房**除 host 外**所有成员。
- **identityAssigned**：**定向单投**给同房 `playerName` 匹配的成员，不广播。

### host 转发段（第一版保留）

`connectionStore.handleStateUpdate` 中 host 收到 client 状态后再 `broadcastToOthers` 的逻辑（`connectionStore.js:206-209`）**第一版保留不动**。中心化下这会产生一次「回声」，但因 `version` 相同被 `if (version <= stateVersion) return` 幂等吸收，不放大。第二版稳定后再清理该段，让服务器成唯一转发源。

## 6. 身份分配流程（关键路径）

```
host 端 gameStore.initGame()
  → connectionStore.assignPlayerIdentityOnInit(player1Id, player2Id)
  → connectionStore._sendIdentityAssignment(playerName, playerNumber)
  → roomManager.sendIdentityAssignment(playerName, playerNumber)   // B6 改造点
  → C2S {type:'identityAssigned', playerName, playerNumber}
  → 服务器定向单投给 member.playerName === playerName 的连接
  → 目标 client roomManager emit('identityAssigned', {playerNumber, playerName})
  → connectionStore 监听器命中（data.playerName === myPlayerName）
  → receiveIdentityAssignment(playerNumber) → myAssignedPlayer 赋值
  → isMyTurn getter 生效
```

- 服务器 `joinRoom` 须校验同房 `playerName` 唯一；冲突返回 `error:{code:'NAME_TAKEN'}`。
- 定向投递用「同房首个 playerName 匹配」并 log 警告（理论上唯一）。

### host 兼选手（2 人开局）

host 可兼任其中一名选手，使 host + 1 名远端选手即可开局（向后兼容：host 不参赛时仍需 2 名远端选手）。

- **参赛名**：host 在 RoomSetup 勾选「我也参赛」，复用房主显示名作参赛名，经 `createRoom(playerName)` 带入并进 roster。
- **身份分配（本地优先）**：`assignPlayerIdentityOnInit` 在 host 端**本地**设 `myAssignedPlayer='player1'`（host 固定 player1/2 路），**不为 host 自己发 `identityAssigned`**（避免服务器按 playerName 找到 host 连接后回投）；远端选手 player2 仍走定向单投。
- **回合制**：`isMyTurn` 用 `myAssignedPlayer` 是否为空区分——选手 host（非空）按 `currentPlayer === myAssignedPlayer` 判定（对手回合不能操作）；纯裁判 host（空）恒 true。裁判元操作（撤销/抽取永禁）用 `myRole==='host'` 判定，不受影响。
- **道路**：`initGame` 检测到 host 参赛时强制 `player1.road=2 / player2.road=4`（忽略 `sideSelection.initialMode`），在 `startRound` 生成 BP 序列前生效。
- **重连自愈**：复用 `rederiveMyIdentity`（已扩展支持选手 host）+ `handleRoster`（给远端补发 player2），三条自愈通道全覆盖。

## 7. 心跳

| 方向 | 间隔 | 超时判定 |
|---|---|---|
| 客户端 → 服务器 | 30s 发 `{type:'ping', t}` | 10s 未收 `pong` → emit `connectionStatus:{status:'heartbeat-lost'}` |
| 服务器 → 客户端 | 30s 主动 ping | 45s 无响应 → 视为断开，清理成员 + 广播 `userLeft` |

## 8. 版本号与去重

- `stateUpdate.version` 为单调递增整数（由发送方 `stateVersion++` 产生）。
- 接收方：`if (version <= this.stateVersion) return`（旧版本 / 重复 / 乱序后到一律丢弃）。
- 此机制吸收 host 转发回声、网络乱序、重复投递。

## 9. 错误码

S2C `error` 的 `error.code`：

| code | 触发 | userFriendlyMessage（建议） |
|---|---|---|
| `ROOM_NOT_FOUND` | joinRoom 房间不存在 | 找不到房间，请检查邀请码 |
| `ROOM_FULL` | （预留）房间已满 | 房间已满 |
| `NAME_TAKEN` | 同房 playerName 重复（含 host 参赛名） | 该名字已被使用，请换一个 |
| `INVALID_PARAMS` | 消息字段非法 | 请求参数错误 |
| `INTERNAL` | 服务器内部异常 | 服务器异常，请重试 |

## 10. 成员名册（roster）

- **`joinRoom` 成功后，服务器向全房间广播 `roster`**（含新人）：新人据此初始化 `this.members`，已有成员据此补齐新成员的 `playerName`（因 `userJoined` payload 不含 `playerName`，必须靠 roster 同步）。
- `userJoined` / `userLeft` 作为成员变动的**事件信号**（驱动 UI 刷新与 `count` 更新）；`members` 的权威来源是 `roster`。
- `member` 结构：`{clientId, role, playerName, connected}`。
- roomManager 的 `getConnectedUsers` / `getConnectionStats` / `getConnectedPlayerNames` 均从 `this.members` 推导（替代旧 `this.connections` Map）。

## 11. inviteCode 生成

- 6 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（无易混淆的 0/O/1/I）。
- 服务器生成并保证全局唯一（冲突重生成）。大小写不敏感：传输/存储统一转大写。

## 12. 变更管理

- 本契约为**冻结基线**。
- 任何协议变更必须：① 先更新本文件 → ② 同步前端 roomManager 与后端 server → ③ 增补对应测试 → ④ **不得单方面偏离**。
- 新增可选字段向后兼容；删除/重命名字段视为破坏性变更，需双端同步发布。

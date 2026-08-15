# AGENTS.md

本文件是给所有 AI 编码助手（Claude Code / Codex 等）在本仓库工作时的**项目主指令**。Claude Code 通过 `CLAUDE.md` 的 `@AGENTS.md` 导入本文件。

> 与用户交流始终使用中文（项目约定）。

---

## 开发命令

```bash
npm install            # 首次安装依赖
npm run dev            # 一键启动前端 vite:3000 + ws 后端 :8080（多人对战需两者同跑）
npm run dev:web        # 仅前端
npm run dev:server     # 仅后端（不跑则创建房间报 ws proxy ECONNREFUSED）
npm run build          # 生产构建到 dist/
npm run preview        # 预览生产构建
npm run test:unit:run  # vitest 单次运行（CI / 改多人逻辑后的首选回归）
npm run test:multiplayer:headed   # Playwright 多人同步 E2E（有头）
```

不要同时启动多个 dev server（端口冲突）。3000 被占用时先查杀进程。

---

## 版本号与 Git Hooks

- **版本号来源**：`package.json` 的 `version`。构建期由 `vite.config.js` 的 `define` 注入 `__APP_VERSION__`，git 短 hash 注入 `__APP_GIT_HASH__`，封装于 `src/config/buildInfo.js`，显示在 `App.vue` footer（如 `v3.2.2 · 32d5ce4`），用于肉眼确认 webhook 部署是否生效。
- **pre-commit 自动 bump**：`.githooks/pre-commit` 每次 commit patch+1（满 10 进 minor；minor 不自动进 major——major 仅大重构时手动改 `package.json`，随后那次用 `git commit --no-verify` 避免再 +1）。bump 逻辑见 `scripts/bump-version.mjs`。
- **hooks 安装与自愈**：`core.hooksPath` 由 `scripts/setup-hooks.mjs`（npm `prepare` 钩子）管理，clone/install 后自动配置并加可执行位。prepare 时若检测到 `core.hooksPath` 被外部（IDE/GUI）改成非 `.githooks`，自动纠正并告警；同时在 `.git/hooks/pre-commit` 写 fallback 脚本（不进版本库）——即使 hooksPath 被覆盖，git 回退默认 `.git/hooks/` 仍能 bump 并纠正回来，破解「hooksPath 被改 → 钩子不触发 → 无法自纠正」死循环。
- **语义版本里程碑**：v1.0.0 首次发布 / v2.0.0 多人对战 / v3.0.0 WS 中心化。

---

## 测试与质量

**单元测试（vitest）——多人对战回归主力**

多人对战与状态同步的纯逻辑用 vitest + 内存 FakeHub 测试，两端套 `JSON.parse(JSON.stringify())` 复刻真实 ws 序列化边界，毫秒级、可离线跑。改多人功能时首选此回归手段。FakeHub 在 `src/utils/devTransport.js`（与 dev 多客户端模拟面板共用，面板在 `src/components/dev/MultiClientSimulator.vue`，路由 `/dev/sim`，`import.meta.env.DEV` 守卫，不进生产）。

关键 spec：

- `src/stores/__tests__/gameStore.undo.spec.js` — 通用撤销栈、`lastActor` 权限模型、南瓜回退
- `src/stores/__tests__/gameStore.pumpkin.spec.js` — 南瓜 pick 索引同步回归（守住「连续选多个南瓜头 splice 索引失效导致植物误删/南瓜残留」bug）
- `src/stores/__tests__/gameStore.globalBan.spec.js` / `drawGlobalBan.spec.js` — globalBan 自动抽取 / 手动抽取
- `src/stores/__tests__/gameStore.randomBan.spec.js` — 开局随机禁用可配
- `src/stores/__tests__/gameStore.reset.spec.js` — resetGame 保留 ruleConfig、存档向后兼容
- `src/stores/__tests__/gameStore.hostParticipates.spec.js` — host 兼选手道路分配
- `src/stores/__tests__/connectionStore.spec.js` — `isMyTurn` 权限矩阵、身份自愈、版本号去重、host 兼选手
- `src/utils/__tests__/roomManager.spec.js` — ws 协议：成员同步、stateUpdate 不回声、identityAssigned 定向、序列化鲁棒性

**E2E（Playwright）**

真实 server 协议端到端：本地 `node server/index.js` + ws 客户端联调，契约见 `docs/network-protocol.md`。多端同步测试在 `agents/tests/multiplayer-sync-test.spec.js`（本地 ws server，不依赖外网），自动模拟三端（host + 2 选手），验证房间创建/加入、身份分配、Ban/Pick 实时同步、**完整 20 步 BP 流程三端一致性**、非回合方操作被拒。断言为内容级（植物 id 集合对比，非仅数量）。`playwright.config.js` 在仓库根（testDir 指 agents/tests；勿放回 agents/tests/，否则从根跑会扫到 .claude/worktrees 副本）。测试报告与截图分别落 `agents/test-reports/`、`agents/screenshots/`，详见 `agents/README.md`。

---

## 文档同步约定（MANDATORY）

**修改代码时必须同步更新本文件**：新增功能 → 补「关键文件职责」/「已实现规则」；改组件 → 更新文件清单；改规则 → 更新「自定义与规则点」；改数据格式 → 更新「自定义」相关段。文档与代码必须一致。机器特定信息（真实 IP/域名/路径/密钥）不进本文件，写本地 `*.local.md`（已 gitignore）。

---

## 项目架构

Vue 3 + Pinia 应用，管理 PvZ 改版 BP 对战，处理动态选手-道路分配的复杂比赛规则。

### 核心数据流

1. **初始化**（`GameSetup.vue` / 多人 `RoomSetup.vue`）：两名选手输入 ID 并选初始道路（2 路 / 4 路）；系统随机永久禁用若干植物（默认 5，可配）。**道路选择决定谁是「二路选手」谁是「四路选手」，不固定于 player1/player2。**
2. **动态 BP 序列生成**（`src/utils/bpRules.js`）：BP 模板用 `road2`/`road4` 占位符，`getBPSequence(road2Player, road4Player)` 运行期替换为实际 player。标准流程 Stage1(4) + Stage2(6) + Stage3(6) + Stage4(4) = 20 步。
3. **状态管理**（`src/stores/gameStore.js`）：`currentRound.bpSequence` 存动态生成的步骤（2D 数组 `[[stage1_steps], ...]`，每步 `{ player:'road2'|'road4'|'system', action:'ban'|'pick'|'globalBan', count }`）；`updateCurrentStep()` 据 `player1.road`/`player2.road` 解析 road2/road4 → 实际 player。每次操作后自动存 localStorage。

### 小局 / 大局术语

- **小局（round）**：一轮完整 BP 的胜负单位，BP → 站位 → 结算。变量名沿用 `currentRound` / `setRoundWinner` / `gameStatus`。
- **大局（match）**：由若干小局组成，率先累计达成约定胜场数即赢得大局。胜负阈值存顶级字段 `winThreshold`（开局设置、持久化、随多人状态同步，**默认 4，下拉 1~7**）。比分中的「分」即小局胜场数。
- 流程：BP 阶段 → Positioning（站位）→ Result（小局结算）→ 下一小局。败者获下一小局选路权（可配）。

### 关键文件职责

**数据层**

- `src/data/plants.js` — 内置植物数据
- `src/data/customPlants.js` — 自定义植物（IndexedDB，Blob 存图，`getAllPlantsSync()` 内存缓存同步访问，JSON 导入导出）
- `src/data/plantConfigs.js` — 比赛预设（植物卡组 + 规则），localStorage 存预设列表与 `activeConfigId`
- `src/utils/bpRules.js` — BP 顺序模板与动态序列生成（`STAGE_NAMES`、`getBPSequence`）
- `src/utils/validators.js` — 规则校验（`canBan` / `canPick` / `isPumpkin` / `validatePosition` 等）。**`canPick`/`canBan` 是「可否选择」的单一事实来源**（含南瓜互斥/南瓜跨小局上限），`availablePlants` getter 与 `confirmSelection` 均委托，勿在他处重复实现判定逻辑。
- `src/utils/bpFlowRender.js` — BP 流程渲染映射
- `src/utils/shuffle.js` — Fisher-Yates 均匀洗牌（开局禁用/globalBan 抽取等统一入口；勿用 `sort(random)` 洗牌，分布有偏）
- `src/utils/legacyMigrations.js` — 旧存档数据迁移纯函数（站位字符串数组→实例对象、清理 buggy 穿插南瓜残留；由 `loadFromLocalStorage` 调用）

**状态层**

- `src/stores/gameStore.js` — 核心 Pinia store：getters（`road2Player`/`road4Player`/`sideName`/`availablePlants`/`isPumpkinPlant`/`isRuleEditable`）、actions（`initGame`/`startRound`/`confirmSelection`/`undoLastAction`/`drawRandomGlobalBan`/`skipBanStep`/`resetCurrentRound`/`applyNextRoundSideSelection`/`applyRuleConfig`）、localStorage 持久化、多人同步接口（`getSyncPayload`/`applySyncState`）、数据迁移
- `src/stores/connectionStore.js` — 多人连接/身份/回合判定（`isMyTurn`/`isViewOnly`/`rederiveMyIdentity`/`handleRoster`/`assignPlayerIdentityOnInit`）、多人会话保存/加载/清理（24h 过期）
- `src/stores/uiStore.js` — 飞行动效等 UI 状态

**多人网络**

- `server/index.js` — **统一入口（单进程三合一）**：ws hub（`/ws`，房间管理/消息路由/身份分配/心跳 30s ping·45s 超时/断线清理）、lobby HTTP（`/lobby/*`、`/rooms`、`/health`）、webhook 自动部署（`POST /webhook/deploy`，校验 GitHub HMAC / GitLab token 后异步 spawn `scripts/auto-deploy.sh`）、静态文件（`../dist/`）+ SPA fallback。端口 `process.env.PORT || 8080`。
- `server/lobby-server.js` — lobby handler 模块（export `handleLobbyRequest`/`isLobbyPath`/`startLobbyCleanupTimer`，CORS/限流/TTL 60s/最大存活 6h）
- `src/utils/roomManager.js` — ws 客户端（重构自 PeerJS，保持公共方法签名 + emit 事件名 + payload 不变；transport 可注入：生产原生 WebSocket，测试/dev 注入 FakeHub）
- `src/config/network.config.js` — ws 连接地址（dev `ws://localhost:3000/ws` / prod `wss://okjjko.top/ws`）+ lobby 配置

**UI 层**

- `src/components/ui/` — 共享基座：`BaseButton`（variant/size/loading）、`BaseDialog`（v-model + 焦点陷阱 + Esc/backdrop）、`ToastContainer` + `useToast`、`ConfirmDialog` + `useConfirm`、composables 层的 `usePermission`（`isReferee`/`isActor`/`isViewer`/`canUndo`，按钮级权限统一判定，替代各组件手写 host 判定）
- `src/components/GameSetup.vue`、`RoomSetup.vue`、`PlantSelector.vue`、`BanArea.vue`、`PickArea.vue`、`StageIndicator.vue`、`PlayerInfo.vue`、`RoundResult.vue`、`PositionSetup.vue`
- `src/components/PlantManager/` — 配置管理弹窗（`index.vue` + `PlantLibrary` + `ConfigManager` + `PlantForm` + `ImageUploader` + `ImportExport` + `PlantCard`）
- `src/components/RulesEditor/` — `SideRulesEditor`（阵营名/选边）、`BPRulesEditor` + `BPRulesDialog`（BP 流程/上限）、`RulesSummary`、`BPFlowPreview`
- `src/views/BanPickView.vue` — BP 对局主视图

---

## 关键设计决策（易踩坑，改动前必读）

### 1. 动态 player-road 映射（最重要）

**二路/四路不固定于 player1/player2。** player1 选 2 路 → `road2Player='player1'`、Stage1 由 player1 先 ban；反之同理。`getBPSequence()` 接收实际 player ID 替换模板占位符实现。任何「假定 player1 一定是二路」的代码都是错的。

### 2. ruleConfig 配置契约（自定义规则集中层）

开局可自定义的比赛规则（阵营名 / 选边方式 / BP 顺序模板 / 使用上限 / 南瓜 / 随机禁用）集中存于 `gameStore.state.ruleConfig` 单一对象。

1. **默认值单一事实来源**：`src/config/defaultRules.js` 聚合 `src/config/rules/{sideNames,sideSelection,bpSequence,limits,pumpkinRule,randomBan,timer}.js`。聚合器定型不再改，各功能默认值在各自子文件维护。
2. **序列化整体处理**：`saveToLocalStorage` / `loadFromLocalStorage` / `getSyncPayload` / `applySyncState` 对 `ruleConfig` 整体存取（`{ ...defaultRules, ...(state.ruleConfig||{}) }` 深合并默认值，向后兼容）。**新增配置项禁止在这四个函数逐字段列举——只改对应 `rules/` 子文件即自动获得持久化 + 多人同步。**
3. **解耦**：`bpSequence` 模板始终用 `road2`/`road4` 占位符；`sideNames` 仅影响显示文案；两者通过 road 数值（2/4）桥接。
4. `gameStore.js` getters 区有 `// A-ANCHOR`（maxPlantUsage）与 `// B-ANCHOR`（sideName）占位注释，多人协作时在各自锚点下新增 getter 避免冲突。
5. `store.ruleConfig` 与比赛预设脱钩，是「当前应用的 BP」的权威来源：赛前 `BPRulesDialog` 改的只进 store，不写预设。`resetGame()` 清空对局进度但**保留 `ruleConfig`**（`$reset()` 前缓存、后恢复，并用 `saveToLocalStorage()` 覆盖旧存档为「新对局起点」；`winThreshold` 不在保留之列，回默认 4）。

### 3. 路由 Transition 与 Teleport 根（选边卡死修复）

`App.vue` 的 `<router-view>` 外层 `<transition>` **不可用 `mode="out-in"`**。原因：`RoundResult.vue` 以 `BaseDialog` 为内容，而 `BaseDialog` 根是 `<Teleport>`——`<Transition>` 会警告 "non-element root node"，且 `out-in` 模式下结算页 leave 的 `transitionend` 无法可靠触发，导致下一小局 `BanPickView` 永不挂载（需刷新才恢复）。

约束：① App.vue 路由 transition 用默认交叉过渡 + `:key="$route.path"`，禁用 `out-in`；② 任何以 `BaseDialog` 为内容的**路由页面**（如 `RoundResult.vue`）必须外包真实 `<div>` 根，避免 `<Teleport>` 成为 `<Transition>` 直接子节点。

### 4. 选边方式与「先更新双方 road 再 startRound」

`ruleConfig.sideSelection = { initialMode, initialPicker, loserPickMode }`：
- `initialMode`：`'mutual'`（双方互斥，默认）/ `'assigned'`（指定 `initialPicker` 单方选路）/ `'random'`（系统随机，隐藏选路 UI）
- `loserPickMode`：`'loser'`（默认）/ `'winner'` / `'keep'`（不换边）

`gameStore.applyNextRoundSideSelection({ loser, winner, pickerRoad })` 集中处理小局结束后的选边三分支，**内部必须先同时更新败者+胜者双方 road，再 `startRound`**；只更新一方就 `startRound` 会让 `getBPSequence` 因缺另一条 road 报错并生成空 BP 序列。`RoundResult.vue` 统一委托此 action，不直接写 `player.road`。

---

## 多人对战网络（中心化 WebSocket）

### 架构

2026-07 从 P2P（PeerJS/coturn/TURN）重构为**单一 Node 进程**（ws hub + lobby + 静态 dist + SPA fallback 四合一），所有游戏状态经服务器中转，连接稳定性等同普通网站，不再依赖 NAT 穿透。协议契约见 `docs/network-protocol.md`（**冻结，禁止单方面偏离**）。已移除 `src/config/webrtc.config.js`、PeerJS 依赖、coturn 配置。

### 消息类型与转发规则（契约 §3/§4/§5）

- **C2S**：`createRoom` / `joinRoom` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `ping` / `leave`
- **S2C**：`roomCreated` / `connected` / `roster` / `userJoined` / `userLeft` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `pong` / `error` / `connectionStatus`
- **转发**：`stateUpdate` 广播给同房除发送者外所有人（含 host）；`gameStart`/`customPlants` 广播除 host 外；`identityAssigned` 按 `playerName` 定向单投（joinRoom 校验同房 playerName 唯一，冲突返 `NAME_TAKEN`）
- `roster`（含 playerName）由服务器在每次成员变动时全房广播；前端 `_applyRoster` 应用并 `emit('roster')`，供 host 补发身份

### 权威方模型（多人一致性关键）

随机操作（开局 `randomBanPlants`、globalBan 抽取）必须由**权威方（`roomMode==='local' || roomMode==='host'`）单点执行并 `syncState` 广播**，其余端被动 `applySyncState` 同步，避免各端随机数不一致导致状态分叉。`player`/`spectator` 端的 `_processAutoSteps` 是 no-op。撤销**不需重新随机**（只恢复快照），故选手撤销也安全，无需权威方单点。

### 重连身份自愈（双通道）

`myAssignedPlayer` 不持久化，刷新重连后内存丢失 → `isMyTurn` 与撤销权失效。修复无需持久化身份：

- **本地自愈 `rederiveMyIdentity()`**（幂等）：`myRole==='player'`（或选手 host）且 `myAssignedPlayer` 为空时，用 `myPlayerName` 匹配 `gameStore.player1.id`/`player2.id` 推导；都不匹配则保持 `null`（降级只读，安全失败）。调用时机：`handleStateUpdate` 的 `applySyncState` 之后 + `performReconnect` 选手分支 `loadFromLocalStorage` 之后。
- **host 补发 `handleRoster(message)`**：host 收到 roster 且 `gameStatus!=='setup'` 时，对每个 connected 的 player 成员按 `playerName` 重发 `identityAssigned`（服务器定向单投，幂等）并 `syncState()`。
- **重新加入自动进入对局**：选手/观众重新加入（无 `gameStart`）时，`RoomSetup` 监听 `stateUpdate`，收到 `gameStatus!=='setup'` 自动 `emit('startGame')` 进入对局路由。

### host 兼选手（2 人开局）

host 可兼任其中一名选手，host + 1 名远端选手即可开局（向后兼容：host 不勾参赛时仍需 2 名远端选手）。用 `myAssignedPlayer` 是否为空区分两种 host：

- **参赛入口**：RoomSetup 勾「我也参赛」，复用房主显示名 `hostName` 作参赛名 → `createRoom(playerName)` 带名进 roster（受 NAME_TAKEN 保护）→ `setMyIdentity('host', participateName)`。
- **固定身份/道路**：host 参赛即固定 player1（2 路/先手 ban），远端选手固定 player2（4 路）。`assignPlayerIdentityOnInit` host 端本地自分配 `myAssignedPlayer='player1'` 且不为自己发 `identityAssigned`；`initGame` 强制 `player1.road=2`/`player2.road=4`（忽略 `initialMode`，在 BP 序列生成前生效）。
- **回合制**：`isMyTurn` host 分支——选手 host（`myAssignedPlayer` 非空）按 `currentPlayer === myAssignedPlayer` 判定；纯裁判 host（空）恒 true。裁判元操作（撤销/抽取永禁/规则编辑/自动步骤/随机禁用）用 `myRole==='host'` 判定，**不依赖 isMyTurn**。

### 连接地址与部署

- dev `ws://localhost:3000/ws`（vite proxy → 本地 :8080，需 `{target:'http://localhost:8080', ws:true}`）；prod `wss://okjjko.top/ws`（nginx 终止 TLS 反代到 Node :8080，需 `Upgrade`/`Connection:upgrade` 头与 `proxy_read_timeout 3600s`）
- 单 Node 进程 + nginx TLS 终止，8080 不对公网开放。详见 `docs/SERVER-SETUP.md`、`docs/AUTO-DEPLOY.md`、`server/README.md`

### 服务端注意事项

- **静态文件路径必须先 `decodeURIComponent`**：`URL.pathname` 保留 percent 编码，中文文件名（如 `/plants/胆.png` 被编码成 `%E8%83%86.png`）若不解码，`fs.stat` 按字面量找文件 → 中文资源全 404（nginx 直托时自动解码未暴露，改 Node 托管后须在 createServer 入口显式解码）。
- webhook 密钥取 `WEBHOOK_SECRET` 环境变量（**勿加 `VITE_` 前缀**，否则打进前端 bundle 泄露）。**fail-safe**：未配置时不回落公开默认值——改用一次性随机密钥（校验必然 401）+ 显式 503 拒绝 + 启动告警，自动部署整体禁用但 ws/lobby/静态不受影响；密钥须与 GitHub/GitLab webhook Secret 一致（见 `docs/AUTO-DEPLOY.md`）。
- host 断开当前简化为整房清理（无 host 迁移）。成员端由 `App.vue` **全局**监听 `connectionStatus: host-left` 弹单按钮告知框（RoomSetup 的连接监听只覆盖其挂载期，对局中 BanPickView 无人处理）；确认后 `roomManager.disconnect()`（停对已删房间的徒劳重连）+ `clearMultiplayerSession()`（清 24h 死会话，防刷新后被引导重连），但不改 roomMode/身份，维持选手端只读态。

---

## 自定义与规则点

### 自定义植物

通过「配置管理」弹窗的「植物库」tab 管理。支持 PNG/JPG/WEBP，原图 ≤2MB，自动压缩到 100×100 JPEG 70% 质量（≤500KB），Blob 存 IndexedDB，JSON 导入导出（图Base64）。植物名设为「南瓜头」即触发南瓜特殊规则（即使 id 非 `pumpkin`）。

### 比赛预设与配置管理弹窗

「配置管理」弹窗两个 tab：「植物库」（`PlantLibrary mode="global"`，浏览/管理全部内置+自定义植物）与「比赛预设」（`ConfigManager`，预设 = 植物卡组 + BP 流程规则）。内置不可改不可删的「默认预设」（`DEFAULT_CONFIG_ID='config_default'`，`ensureDefaultPreset` 注入并置顶，可加载/导出/复制）。赛前改当前对局 BP 规则走 GameSetup/RoomSetup 的「BP 规则」按钮 → 全局 `BPRulesDialog`（改 `store.ruleConfig`，不存预设）。

### 南瓜头特殊规则

- 判断：植物 id 为 `'pumpkin'` 或名称为 `'南瓜头'`（`isPumpkin`，支持 id 和名称）
- 效果：Pick 阶段选南瓜头**不消耗 BP 步骤**，给后续 pick 累积 `extraPick`（每南瓜 +1），随后选的植物与南瓜建立保护关系
- 限制：仍受使用次数限制（最多 `maxPlantUsage` 次）；对手本轮用过南瓜则自己不可选
- 开关：`ruleConfig.pumpkinRule.enabled`（默认开，关闭时南瓜当普通植物——消耗步数、受上限约束、计入 plantUsage）
- 关键实现：`_handleNormalPick` 在 splice 删除南瓜前，必须先前移 `pumpkinProtection` 中 `index > pumpkinIdx` 的 key、再前移 `lastPumpkinIndices`（连续选南瓜的索引同步，回归测试守住）

### 全局永久禁用（`globalBans`，三种来源）

| 来源 | 配置时机 | 触发 | 单次数量 | 实现 |
|---|---|---|---|---|
| 开局随机禁用 | 赛前 `ruleConfig.randomBan` | `initGame` 一次性 | `count`（默认 5） | `randomBanPlants` |
| 预设步骤 | 赛前 BP 模板 | 流程到该步自动 | `count` | `_processAutoSteps` → `_drawGlobalBans` |
| 局内手动抽取 | 局内按需 | 裁判/host 点按钮 | 固定 1 | `drawRandomGlobalBan` → `_drawGlobalBans(1)` |

- **预设步骤数据结构**：`{ player:'system', action:'globalBan', count:N }`（`player:'system'` 占位，`getBPSequence` 的 `convertTemplate` 仅替换 road2/road4，其余原样透传）。
- **自动执行**：`_processAutoSteps()` 在 `startRound` 末尾与 `moveToNextStep` 后循环检测 globalBan 步，权威方抽取并推进；仅在确实处理过自动步骤时才落盘+同步。`moveToNextStep` = `_advanceOneStep` + `_processAutoSteps`。
- **手动抽取权限**：仅 `local`/`host`（`connStore.roomMode==='local' || myRole==='host'`），仅 `gameStatus==='banning'`；UI `BanPickView.vue` 的「抽取永禁」按钮。
- 持久化/同步：globalBan 是 bpSequence 步骤 action 取值（嵌在 `ruleConfig.bpSequence` 整体存取，无需改四函数）；抽取结果写顶级 `globalBans`，随 `getSyncPayload`/`applySyncState` 同步。

### 通用撤销栈（Undo Stack）

BP 流程内所有用户操作（ban / pick / 南瓜 pick / 手动抽取永禁）统一可撤销。采用**操作前快照压栈 + 撤销时整体 pop 恢复**（不用逐操作反向逻辑——南瓜索引重映射太复杂）。

- **数据**：`undoStack: []`（上限 30，每快照含 `currentRound` 全量深拷贝 + `globalBans`/`plantUsage`/`pumpkinUsage`/`gameStatus`）；`lastActor`（`'player1'|'player2'|'system'|null`）。
- **实现**：`_pushUndoSnapshot`/`_buildUndoSnapshot` 压栈；`undoLastAction` pop 整体恢复 → 强制 `selectedPlant=null`、`lastActor=null` → 仅调 `updateCurrentStep()` 重算指针（**不调 `_advanceOneStep`/`_processAutoSteps`**，避免撤销回 globalBan 自动步时被自动重抽）。
- **压栈时机**：`confirmSelection` 头部（canPick 校验已提前到压栈前，避免失败留无效快照）、`drawRandomGlobalBan`（抽取失败时回滚快照）。自动步骤与 `randomBanPlants` 不单独压栈。
- **权限（`lastActor` 模型，关键）**：不用 `isMyTurn` 判定选手撤销权——选手做完操作后 `currentPlayer` 已推进到对手，`isMyTurn` 恒 false。改用 `lastActor`：观众拒；裁判（local/host）永真；**选手仅当 `lastActor === myAssignedPlayer`**（撤自己刚做的，回合回退给自己重做）。
- **范围**：仅当前小局（`startRound` 清栈）；`gameStatus !== 'banning'` 返回 `wrong-phase`。
- 持久化/同步：顶级运行时字段，按 `globalBans`/`plantUsage` 同模式加入 save/load/sync 四函数；旧存档/旧 payload 无则降级 `[]`/`null`。

### 其它自定义点

- **阵营名称**（`ruleConfig.sideNames = { road2, road4 }`）：仅影响显示文案。`gameStore.sideName(road)` getter 统一映射，各显示点（GameSetup/RoundResult/PlayerInfo/PositionSetup）都用它。入口 `SideRulesEditor.vue`（≤8 字符）。
- **内置植物数据**：编辑 `src/data/plants.js`。
- **Tailwind 颜色**：`plant-green`（主操作）/ `ban-red`（ban）/ `pick-blue`（pick），定义于 `tailwind.config.js`。

---

## 已实现规则

- ✅ 动态 BP 顺序（基于道路选择）、选路互斥与 toggle
- ✅ 同小局重复 pick（默认上限 2，可配）、不能选对手已选植物、使用次数追踪（含历史）
- ✅ 全局永久禁用（开局随机 / 预设步骤 / 局内手动抽取三来源）
- ✅ 大局计分（先到约定小局数，默认 4）、败者选路权（可配败者/胜者/不换边）、首局选路边界
- ✅ 自定义植物管理（IndexedDB + 内存缓存 + 导入导出）、比赛预设（多套，含不可删默认预设）
- ✅ 南瓜头特殊规则（可开关）
- ✅ 阵营名称 / 选边方式 / BP 顺序模板 / 使用上限 / 随机禁用数量 自定义（集中 `ruleConfig`）
- ✅ 通用撤销栈（`lastActor` 权限模型）
- ✅ 空 ban（`skipBanStep`：仅 ban 步、仅回合方，消耗步骤不禁任何植物，可撤销）
- ✅ 重置本小局（`resetCurrentRound`：仅裁判，清本局回起点；比分/历史 plantUsage 保留；**本小局新增的 globalBans（预设步骤自动抽取/局内手动抽取）与 pumpkinUsage 一并回退到 `roundBaseline` 基线并重抽**——基线由 `startRound` 在 `_processAutoSteps` 之前记录，旧存档无则降级不回退，UI ConfirmDialog 二次确认）
- ✅ 每步思考倒计时（`ruleConfig.timer`，默认关）：权威方（local/host）单点跑定时器，超时从可选池**排除南瓜**后随机 ban/pick（可撤销，`lastActor`=当前选手）；池空则 ban 步按空 ban 跳过；`stepStartedAt` 随 `getSyncPayload` 同步、其余端纯显示（StageIndicator 内嵌倒计时，<10s 变红）；globalBan 自动步与南瓜 extraPick pending 不计时
- ✅ 多人对战：中心化 ws、三角色、断线重连身份自愈、公共房间目录、host 兼选手
- ✅ ban/pick 飞行动效、Toast/Confirm 系统、移动端/桌面端响应式

## 未实现

- ⚠️ 巅峰对决 mode（3:3 tiebreaker）—— `isGrandFinal` 函数保留但不触发，遇此情况手动处理
- ⚠️ 站位阶段「副C/大C」规则校验（`validatePosition` 目前只校验道路与数量）、南瓜套摆阵校验（`validatePumpkin` 暂恒真）
- 完整待办见 `docs/TODO.md`

---

## 浏览器兼容与持久化

现代浏览器（Chrome/Firefox/Edge/Safari，需 ES6+/WebSocket/IndexedDB/localStorage）。localStorage 存游戏进度，刷新自动恢复；「重置游戏」清进度但保留 `ruleConfig`；清浏览器数据丢全部本地状态。

---

## 安全与机器特定信息

生产部署的真实 IP/域名/路径/密钥等机器特定信息见本地 `*.local.md`（已 gitignore，不进仓库）。安全基线：webhook `WEBHOOK_SECRET` 未配置时自动部署整体禁用（fail-safe，见「服务端注意事项」），生产要启用 webhook 须配置该环境变量。

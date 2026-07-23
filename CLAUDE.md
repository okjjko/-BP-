# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies (first time only)
npm install

# Start development server（一键启动 ws server:8080 + vite:3000，多人对战需要两者同时运行）
npm run dev

# 仅前端 / 仅后端（分进程调试用）
npm run dev:web      # vite:3000
npm run dev:server   # ws server:8080（多人对战的后端；不运行则创建房间时报 ws proxy ECONNREFUSED）

# Build for production
npm run build

# Preview production build
npm run preview
```

**版本号确认 webhook 部署生效**:`App.vue` 全局 footer 显示 `v{version} · {git短hash}`(如 `v3.1.0 · 6df59eb`)。`vite.config.js` 的 `define` 在构建期注入 `__APP_VERSION__`(取自 `package.json` 的 `version`)与 `__APP_GIT_HASH__`(`git rev-parse --short HEAD`),封装于 `src/config/buildInfo.js`。`scripts/auto-deploy.sh` 在 `git merge --ff-only` 之后才 `npm run build`,故 build 期拿到的 HEAD 即最新部署 commit —— 每次 push → webhook → 部署后 hash 自动变化,刷新页面看 footer hash 是否更新即知部署是否生效;**版本号自动递增(pre-commit 钩子)**:`.githooks/pre-commit` 每次 commit 自动把 patch+1(满 10 进 minor;minor 不进 major——major 仅大重构/重大功能时手动改 `package.json`),bump 逻辑见 `scripts/bump-version.mjs`;`core.hooksPath` 由 `scripts/setup-hooks.mjs`(npm `prepare` 钩子,clone/install 后自动配置 + 给 hook 加可执行位)管理,无新依赖。手动改 major 后若不想那次 commit 再 +1,用 `git commit --no-verify`。语义版本里程碑:v1.0.0 首次 / v2.0.0 多人对战 / v3.0.0 WS 中心化。

## Testing & Quality Assurance

**单元测试（vitest，多人对战回归主力）：**

多人对战与状态同步的纯逻辑用 vitest + 内存 FakeHub 测试（两端套 `JSON.parse(JSON.stringify())` 复刻真实 ws 序列化边界），毫秒级、可离线 CI 跑，是改多人功能时的首选回归手段。

```bash
npm run test:unit          # watch 模式
npm run test:unit:run      # 单次运行（CI）
```

- `src/utils/__tests__/roomManager.spec.js` - WebSocket roomManager：createRoom/joinRoom 成员同步、stateUpdate 转发（不回声发送者）、identityAssigned 定向、版本号/序列化鲁棒性、断线重连
- `src/stores/__tests__/connectionStore.spec.js` - isMyTurn 权限（host/player/spectator）、版本号去重、远端状态 apply
- `src/stores/__tests__/gameStore.pumpkin.spec.js` - 南瓜头 pick 索引同步回归（连续选 2/3 南瓜、保护关系绑定、pending 清空、protection key 与 picks 索引对齐）；守住"连续选多个南瓜头时 splice 索引失效导致植物误删/南瓜残留"bug
- `src/utils/devTransport.js` - 内存 FakeHub（单元测试与 dev 面板共用）；dev 多客户端模拟面板在 `src/components/dev/MultiClientSimulator.vue`（路由 `/dev/sim`，`import.meta.env.DEV` 守卫，不进生产构建）
- 真实 server 协议端到端：本地 `node server/index.js` + ws 客户端联调（契约见 `docs/network-protocol.md`）；Playwright E2E 见下方 `agents/tests/multiplayer-ws.spec.js`（本地 ws server，不依赖外网）

**Agent Testing System:**

This project includes an automated testing system using Agent architecture with Playwright:

```bash
# Run all agent tests
npm run test:agents

# Run quick tests (game initialization)
npm run test:quick

# Run Playwright tests only
npm run test

# Run tests in headed mode (for debugging)
npm run test:headed

# Run multiplayer sync tests (多人对战同步测试)
npm run test:multiplayer           # 无头模式
npm run test:multiplayer:headed    # 有头模式（可观察浏览器窗口）
```

**Agent Architecture:**

- **Test Coordinator** (`agents/test-coordinator.js`) - Main orchestration script
- **Tester Agent** (`agents/tester-agent.md`) - Executes Playwright automated tests
- **Error Analyst Agent** (`agents/error-analyst-agent.md`) - Analyzes test failures and provides fix suggestions

**Test Suites:**

- `agents/tests/basic-test.spec.js` - Game initialization, road selection, validation
- `agents/tests/plant-display-test.spec.js` - Plant image/name display verification
- `agents/tests/example.spec.js` - BP flow and state persistence tests
- `agents/tests/multiplayer-sync-test.spec.js` - **多人对战同步功能自动化测试**
  - 自动模拟三个浏览器上下文（主办方、选手1、选手2）
  - 验证 WebRTC 连接建立
  - 验证身份分配同步
  - 验证 Ban/Pick 操作实时同步
  - 收集并分析控制台日志
  - 自动保存测试截图

**Test Reports:**

- Test reports saved to `agents/test-reports/TEST-xxx.json`
- Error analysis saved to `agents/error-reports/ERROR-xxx.md`
- Screenshots saved to `agents/screenshots/`

**Quick Start with Agents:**

1. Start dev server: `npm run dev`
2. Run tests: `npm run test:quick`
3. Review reports in `agents/` directory
4. Fix issues and re-run tests

**多人对战同步测试:**

项目包含完整的多人对战同步自动化测试，用于验证 WebRTC P2P 连接和实时状态同步功能：

```bash
# 运行多人对战同步测试（有头模式，推荐）
npm run test:multiplayer:headed

# 或使用无头模式
npm run test:multiplayer
```

测试会自动：
- 创建三个浏览器上下文（主办方、选手1、选手2）
- 验证房间创建和加入流程
- 验证身份分配消息同步
- 执行 Ban 操作并验证所有客户端状态一致
- 收集控制台日志验证同步机制
- 保存关键步骤截图到 `agents/screenshots/multiplayer-sync/`

**测试验证点：**
- ✅ WebRTC 连接成功建立
- ✅ 身份分配消息正确发送和接收
- ✅ 状态同步日志完整（`[gameStore] 收到状态更新 vX`）
- ✅ UI 实时更新（BanArea、PickArea、StageIndicator）
- ✅ 同步状态指示器正常工作
- ✅ 完整20步BP流程同步验证

For detailed usage, see `agents/README.md` and `agents/QUICKSTART.md`

## Development Guidelines

**Code-Documentation Sync:**

- **MANDATORY**: When modifying code, update this documentation (CLAUDE.md) simultaneously
- Examples of documentation updates:
  - Adding new features → Document functionality in appropriate sections
  - Modifying components → Update "Key Files & Responsibilities"
  - Changing rules → Update "Rules Implementation"
  - Adding data formats → Update "Customization Points"
- Keep documentation and code in sync to ensure maintainability

**Development Server:**

- **Default port**: 3000 (<http://localhost:3000>)
- **Before starting**: Check if port 3000 is already in use

```bash
# Windows
netstat -ano | findstr ":3000" | findstr "LISTENING"

# Linux/Mac
lsof -i :3000
```

- **If port is occupied**: Either stop the existing process or let Vite auto-select next available port
- **IMPORTANT**: Do not start multiple dev servers simultaneously - this causes port conflicts and confusion
- **Check running servers**: Always verify if a development server is already running before starting a new one

## Project Architecture

This is a **Vue 3 + Pinia** web application for managing a Ban/Pick (BP) battle system for a modified Plants vs. Zombies game. The tool handles complex tournament rules with dynamic player-road assignments.

### Core Data Flow

1. **Game Initialization** (`GameSetup.vue`)
   - Two players input IDs and select initial roads (2路 or 4路)
   - System randomly bans 5 plants globally
   - Road selection determines who is "二路选手" and "四路选手" (NOT fixed to player1/player2!)

2. **Dynamic BP Sequence Generation** (`bpRules.js`)
   - BP sequence uses `road2`/`road4` placeholders (NOT player1/player2)
   - `getBPSequence(road2Player, road4Player)` dynamically converts to actual players
   - This allows the BP order to adapt to whichever player chose which road
   - Total steps: Stage1(4) + Stage2(6) + Stage3(6) + Stage4(4) = 20 actions

3. **State Management** (`gameStore.js`)
   - Central Pinia store managing all game state
   - `currentRound.bpSequence` stores the dynamically generated BP steps
   - `updateCurrentStep()` converts `road2`/`road4` → actual player IDs
   - Auto-saves to localStorage after every action

4. **BP Phases** (4 stages, total 20 steps)
   - **Stage 1**: Ban order: 二路→四路→二路→四路 (4 bans)
   - **Stage 2**: Pick order: 二路→四路→四路→二路→二路→四路 (6 picks)
   - **Stage 3**: Ban order: 四路→二路→四路→二路→四路→二路 (6 bans)
   - **Stage 4**: Pick order: 四路→二路→二路→四路 (4 picks)

5. **Round Flow（小局 / 大局 术语）**
   - **小局（round）** = 一轮完整 BP 的胜负单位：BP → 站位 → 小局结算
   - **大局（match）** = 由若干小局组成，率先累计达成约定胜场数即赢得大局
   - 每赢一小局记 1 分，**大局获胜所需小局数开局可配置（下拉 1~7，默认 4）**，率先达成者赢得大局
   - 流程：BP阶段 → Positioning (站位设置) → Result (小局结算) → 下一小局
   - 败者获得下一小局的选路权（败者选路权）
   - 说明：比分中的「分」即小局胜场数；变量名沿用 `currentRound`(当前小局)/`setRoundWinner`/`gameStatus`；胜负阈值存于顶级字段 `winThreshold`，开局设置、持久化并随多人状态同步
   - **重置游戏（`resetGame`）保留当前 BP 规则**：`resetGame()` 清空所有对局进度（选手/比分/bans/picks/站位/撤销栈等回初始），但**保留当前应用的 `ruleConfig`**（BP 流程模板/阵营名/上限/南瓜/选边/随机禁用）——`store.ruleConfig` 与比赛预设脱钩，是「当前应用的 BP」的权威来源（赛前 `BPRulesDialog` 改的也只进 store，不写预设）。实现：`$reset()` 前缓存 `ruleConfig`、`$reset()` 后恢复，并用 `saveToLocalStorage()` 覆盖旧存档为「新对局起点」（初始 setup + 保留的 `ruleConfig`），保证刷新后仍以同一套 BP 开始（原 `removeItem` 会让刷新后 `ruleConfig` 丢失变默认预设）。`winThreshold` 不在保留之列（回默认 4，属「进度」）。回归测试：`src/stores/__tests__/gameStore.reset.spec.js`

### Key Files & Responsibilities

**Data Layer:**

- `src/data/plants.js` - Built-in plant data structure (currently placeholder images)
- `src/data/customPlants.js` - Custom plant management using IndexedDB storage
  - Supports adding/editing/deleting custom plants
  - Images stored as Blob objects in IndexedDB
  - Provides memory cache for synchronous access (`getAllPlantsSync()`)
  - Export/Import functionality (JSON with Base64 images)
- `src/utils/bpRules.js` - BP order templates and dynamic sequence generation
- `src/utils/validators.js` - Rule validation (ban checks, usage limits, etc.)

**State Management:**

- `src/stores/gameStore.js` - Pinia store with getters, actions, and localStorage persistence
  - `road2Player` getter - identifies who chose road 2
  - `road4Player` getter - identifies who chose road 4
  - `initGame()` - initializes new match with both players' road selections
  - `startRound()` - generates dynamic BP sequence for each round
  - `updateCurrentStep()` - translates road2/road4 to actual player IDs
  - `saveMultiplayerSession()` - saves multiplayer session info for auto-reconnect
  - `loadMultiplayerSession()` - loads session with 24-hour expiry check
  - `clearMultiplayerSession()` - clears session data

**Multiplayer Networking:**

- **架构（中心化 WebSocket，2026-07 重构）**：放弃 P2P(PeerJS)/TURN/coturn，改为**单一 Node 进程**同时提供 ws hub + lobby HTTP + 静态前端 dist + SPA fallback 四合一能力。所有游戏状态经服务器中转，连接稳定性等同于普通网站，不再依赖 NAT 穿透。协议契约见 `docs/network-protocol.md`（冻结，禁止单方面偏离）。

- `server/index.js` - **统一入口（单进程）**
  - WebSocket hub（`/ws`）：房间管理、消息路由、身份分配、心跳（服务器 30s ping / 45s 超时断开）、断线清理
  - lobby HTTP 路由（`/lobby/*`、`/rooms`、`/health`）：公共房间目录（复用 `lobby-server.js` 的 handler）
  - Webhook 自动部署（`POST /webhook/deploy`）：校验 GitHub `X-Hub-Signature-256` HMAC / GitLab `X-Gitlab-Token` 签名后异步 spawn `scripts/auto-deploy.sh`（`git fetch`→比较→`--ff-only` 合并→按需 `npm install`→`npm run build`→PM2 重启→reload aa_nginx）。密钥取 `WEBHOOK_SECRET` 环境变量（**勿加 `VITE_` 前缀**，否则会被打进前端 bundle 泄露）。路由优先级高于 lobby/静态
  - 静态文件（`../dist/`）+ SPA fallback（history 刷新）。**⚠️ 静态文件路径必须先 `decodeURIComponent`**：`URL.pathname` 保留 percent 编码态，中文文件名（如 `/plants/胆.png` 被浏览器编码成 `%E8%83%86.png`）若不解码，`fs.stat` 会按字面量 `%E8%83%86.png` 找文件 → 中文静态资源全 404。2026-07-16 前 aa_nginx 直托 dist 时 nginx 自动解码未暴露此问题，改 Node 托管后须在 `createServer` 入口显式解码（见 `server/index.js` URL 解析后的 decode 块）
  - 端口 `process.env.PORT || 8080`；启动 `cd server && npm install && npm start`

- `server/lobby-server.js` - lobby handler 模块（export `handleLobbyRequest/isLobbyPath/startLobbyCleanupTimer`，由 index.js 挂载；不再自启动）。行为/CORS/限流/TTL(60s)/最大存活(6h) 与重构前一致。

- `server/package.json` - 唯一运行时依赖 `ws@^8.x`，ESM（`type:module`），`start: node index.js`。

- `src/utils/roomManager.js` - WebSocket 中心化版（重构自 PeerJS）。**保持公共方法签名 + emit 事件名 + payload 不变**（消费者 connectionStore/GameSetup.vue/RoomSetup.vue 几乎零改）。新增 `sendIdentityAssignment(playerName, playerNumber)`；transport 可注入（生产原生 WebSocket，测试/dev 注入 FakeHub）。

- `src/config/network.config.js` - ws 连接地址（dev `ws://localhost:3000/ws` / prod `wss://okjjko.top/ws`）+ lobby 配置（baseUrl/心跳/刷新间隔，原 webrtc.config.js 的 lobby 块迁入）。

- **消息类型**（契约 §3/§4）：
  - C2S：`createRoom` / `joinRoom` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `ping` / `leave`
  - S2C：`roomCreated` / `connected` / `roster` / `userJoined` / `userLeft` / `stateUpdate` / `gameStart` / `customPlants` / `identityAssigned` / `pong` / `error` / `connectionStatus`
  - 转发规则：`stateUpdate` 广播给同房除发送者外所有人（含 host）；`gameStart`/`customPlants` 广播除 host 外；`identityAssigned` 按 `playerName` 定向单投（joinRoom 校验同房 playerName 唯一，冲突返 `NAME_TAKEN`）。

- **连接地址**：dev `ws://localhost:3000/ws`（vite proxy，需配 `{target:'http://localhost:8080', ws:true}`）；prod `wss://okjjko.top/ws`（nginx 终止 TLS 并反代到 Node :8080，需 `Upgrade`/`Connection:upgrade` 头与 `proxy_read_timeout 3600s`）。

- **部署**：单 Node 进程 + nginx TLS 终止。不再需要 PeerJS server / coturn / STUN / TURN。8080 不对公网开放，仅本机 nginx 访问。详见 `docs/SERVER-SETUP.md` 与 `server/README.md`。

- **已移除**：`src/config/webrtc.config.js`（peerjs/config/timeout/retry 废弃，lobby 三字段迁至 `network.config.js`）、PeerJS 依赖、coturn TURN 配置。

**Multiplayer UI:**

- `src/components/RoomSetup.vue` - Room creation/joining interface
  - Auto-reconnect prompt on page refresh
  - Host panel: create room, view connections, broadcast game start; 可勾选"公开房间"登记到 lobby 目录并启心跳
  - Player/spectator panel: join room with invite code, display name; 或"浏览公共房间"从公共列表一键加入（复用 joinRoom）
  - Auto-reconnect: detects previous session in localStorage (24h expiry)
    - Host reconnect: creates new room, new invite code, players must rejoin
    - Player reconnect: auto-joins using stored invite code and name
    - Cancel option: clear session and start new game

**UI Components:**
- `src/components/GameSetup.vue` - Player registration & road selection (mutual exclusion between players)
- `src/components/PlayerInfo.vue` - Displays player ID, score, and current road
- `src/components/StageIndicator.vue` - Shows current phase/stage/step in BP process
- `src/components/BanArea.vue` - Displays banned plants per player
- `src/components/PickArea.vue` - Displays picked plants per player
- `src/components/PlantSelector.vue` - Grid for selecting plants to ban/pick
- `src/components/PlantManager/` - Custom plant management module
  - `index.vue` - Main plant management interface
  - `PlantForm.vue` - Add/edit plant form
  - `ImageUploader.vue` - Image upload with auto-compression
  - `ImportExport.vue` - Export/import plants as JSON
- `src/components/PositionSetup.vue` - Road and position configuration (not yet implemented)
- `src/components/RoundResult.vue` - Round winner & next round road selection

**Shared Primitives（`src/components/ui/`，Phase 0 基座，全局复用）：**
- `BaseButton.vue` - 统一按钮：`variant`(primary/blue/danger/secondary/ghost)、`size`(sm/md/lg)、`loading`、`#icon` 插槽；含 focus 环与 cursor
- `BaseDialog.vue` - 统一模态：`v-model` + 焦点陷阱 + Esc/backdrop 关闭 + 回焦（替代各组件手写 fixed 遮罩）。**根为 `<Teleport>`，不可直接作为路由组件根**（详见「路由 Transition 与 Teleport 根」）
- `ToastContainer.vue` + `composables/useToast.js` - 轻量通知（替代 `alert()`）：`useToast().success/error/warning/info`
- `ConfirmDialog.vue` + `composables/useConfirm.js` - 应用内确认（替代 `confirm()`）：`await useConfirm().confirm(msg)` 返回 `Promise<boolean>`

### Critical Design Decisions

**路由 Transition 与 Teleport 根（选边卡死修复，2026-07）：**
`App.vue` 的 `<router-view>` 外层 `<transition>` **不可用 `mode="out-in"`**。原因：`RoundResult.vue`（小局结算页）以 `BaseDialog` 为内容，而 `BaseDialog` 根是 `<Teleport>`——`<Transition>` 会警告 "non-element root node that cannot be animated"，且 `out-in` 模式下结算页离开时 leave 的 `transitionend` 无法可靠触发，导致下一小局 `BanPickView` 永不挂载（router-view 被清空，只剩背景，需刷新浏览器才恢复）。两条约束：
1. `App.vue` 路由 transition 用默认交叉过渡 + `:key="$route.path"`，禁用 `out-in`；
2. 任何以 `BaseDialog` 为内容的**路由页面**（如 `RoundResult.vue`）必须外包一个真实 `<div>` 根，避免 `<Teleport>` 成为 `<Transition>` 直接子节点。

另：`RoundResult.confirmRoadSelection` 必须**先同时更新败者+胜者双方 road，再 `startRound`**；只更新一方就 `startRound` 会让 `getBPSequence` 因缺另一条 road 报错并生成空 BP 序列。

**Dynamic Player-Road Mapping:**
The most important architectural decision: **二路/四路 are NOT fixed to player1/player2**.

- If player1 chooses road 2 and player2 chooses road 4:
  - `road2Player = 'player1'`, `road4Player = 'player2'`
  - Stage 1 starts with player1 banning (二路 first)

- If player1 chooses road 4 and player2 chooses road 2:
  - `road2Player = 'player2'`, `road4Player = 'player1'`
  - Stage 1 starts with player2 banning (二路 first)

This is implemented via `getBPSequence()` which takes actual player IDs as parameters and substitutes them into the BP templates.

**BP Sequence Storage:**
- `currentRound.bpSequence` is a 2D array: `[[stage1_steps], [stage2_steps], ...]`
- Each step has `{ player: 'road2'|'road4', action: 'ban'|'pick', count: N }`
- `updateCurrentStep()` dynamically resolves road2/road4 to player1/player2 based on `this.player1.road` and `this.player2.road`

**ruleConfig 配置契约（自定义规则集中层，2026-07）：**
开局可自定义的比赛规则（阵营名 / 选边方式 / BP 顺序模板 / 植物使用上限）集中存于 `gameStore.state.ruleConfig` 单一对象，不再散落为顶级字段。约定：
1. **默认值单一事实来源**：`src/config/defaultRules.js` 聚合 `src/config/rules/{sideNames,sideSelection,bpSequence,limits,pumpkinRule,randomBan}.js`。聚合器定型后不再改动，各功能默认值在各自子文件维护。
2. **序列化整体处理**：`saveToLocalStorage` / `loadFromLocalStorage` / `getSyncPayload` / `applySyncState` 对 `ruleConfig` 整体存取（`{ ...defaultRules, ...(state.ruleConfig||{}) }` 深合并默认值，向后兼容）。**新增配置项禁止在这四个函数里逐字段列举**——只改对应 `rules/` 子文件即可自动获得持久化 + 多人同步。
3. **并行协作锚点**：`gameStore.js` getters 区有 `// A-ANCHOR`（maxPlantUsage，功能4）与 `// B-ANCHOR`（sideName，功能1）占位注释；开发者 A/B 在各自锚点下新增 getter，避免冲突。规则编辑器分两个组件：`SideRulesEditor.vue`（B，阵营名称/选边方式，渲染于 GameSetup 与 RoomSetup 主页）与 `BPRulesEditor.vue`（A，BP 流程/上限，2026-07 迁入「配置管理」弹窗 `PlantManager/index.vue` 的「BP 流程」tab，主页不再直接渲染）。
4. **解耦**：`bpSequence` 模板始终用 `road2`/`road4` 占位符；`sideNames` 仅影响显示文案；两者通过 road 数值（2/4）桥接。

完整分工方案与数据结构见 `docs/CUSTOM-RULES-PARALLEL-PLAN.md`。

**阵营名称自定义（功能1，2026-07）：**
- `ruleConfig.sideNames = { road2: '二路', road4: '四路' }`，仅影响显示文案，不影响 BP 模板逻辑。
- `gameStore.sideName(road)` getter：road 数值（2/4）→ 显示名；各显示点（GameSetup 选路按钮、RoundResult 败者/胜者选路区、PlayerInfo 头像标签、PositionSetup 道路标签）统一改用此 getter。
- 配置入口：`SideRulesEditor.vue` 两个文本输入（≤8 字符）。

**选边方式自定义（功能3，2026-07）：**
- `ruleConfig.sideSelection = { initialMode, initialPicker, loserPickMode }`。
  - `initialMode`：`'mutual'`（双方互斥，默认）/ `'assigned'`（指定 `initialPicker` 单方选路，对手自动取相反）/ `'random'`（系统随机分配，隐藏选路 UI）。
  - `loserPickMode`：`'loser'`（败者选，默认）/ `'winner'`（胜者选）/ `'keep'`（不换边，直接进入下一局）。
- `gameStore.initGame` 按 `initialMode` 分配初始 road（mutual 用 UI 传入值；assigned/random 在 store 内决定）。
- `gameStore.applyNextRoundSideSelection({ loser, winner, pickerRoad })` 集中处理小局结束后的选边三分支，**内部保证「先同时更新双方 road 再 startRound」**（选边卡死修复约束，见上）。`RoundResult.vue` 统一委托此 action，不再直接写 `player.road`。

## Customization Points

**Custom Plants (via UI):**
The application supports importing custom plants through the PlantManager UI:

- **Supported Image Formats**: PNG, JPG/JPEG, WEBP
- **Image Requirements**:
  - Original file size: Maximum 2MB
  - Auto-compression: Images automatically resized to 100×100 pixels
  - Compressed format: JPEG at 70% quality
  - Compressed size limit: Maximum 500KB
- **Storage**: Images stored as Blob objects in IndexedDB
- **Export/Import**: Custom plants can be exported to JSON (images as Base64) and imported across devices

Access custom plant management through the "配置管理" (Config Manager) dialog's "植物库" tab.

**配置管理弹窗结构（2026-07 重构）**:两个 tab ——「植物库」（浏览/管理全部内置+自定义植物，`PlantLibrary mode="global"`）与「比赛预设」（`ConfigManager`，预设 = 植物卡组 + BP 流程规则）。原独立的「BP 流程」tab 已删（与预设编辑器的 BP 流程子 tab 重叠）；赛前改当前对局 BP 规则改走 GameSetup/RoomSetup 的「BP 规则」按钮 → 全局 `BPRulesDialog`（`BPRulesEditor` 原模式，改 `store.ruleConfig`，不存预设）。比赛预设内置一个不可改、不可删的「默认预设」（`DEFAULT_CONFIG_ID='config_default'`，`ensureDefaultPreset` 注入并置顶，可加载/导出/复制；`duplicateConfig` 复制为可编辑副本），作为用户创建第一个预设的起点。

**Built-in Plant Data:**
Edit `src/data/plants.js` to replace placeholder images/data:
```javascript
{
  id: 'peashooter',
  name: '豌豆射手',
  image: '/actual/path/to/peashooter.png',  // Replace this
  description: '向前方发射豌豆',
  type: 'shooter'
}
```

**Tailwind Colors:**
Custom colors defined in `tailwind.config.js`:
- `plant-green` - Primary action color
- `ban-red` - Ban action color
- `pick-blue` - Pick action color

**南瓜头特殊规则:**

- **判断方式**: 通过植物 ID 为 `'pumpkin'` 或植物名称为 `'南瓜头'` 来识别
- **效果**: Pick 阶段选择南瓜头不消耗 BP 步骤，允许选手继续选择
- **限制**: 仍受使用次数限制（最多 2 次），需通过 `canPick()` 验证
- **生效范围**: 仅在 Pick 阶段生效，Ban 阶段按原有逻辑处理
- **实现位置**:
  - `src/utils/validators.js:206-220` (isPumpkin 函数 - 支持 ID 和名称判断)
  - `src/stores/gameStore.js:115-117` (isPumpkinPlant getter)
  - `src/stores/gameStore.js:271-274` (confirmSelection 函数中的特殊处理)
  - `src/stores/gameStore.js:543` (migrateLegacyPumpkinProtection 迁移逻辑)

**自定义南瓜头植物**:
用户可以通过「配置管理」弹窗的"植物库"tab 添加自定义植物，如果将植物名称设置为 "南瓜头"，即使植物 ID 不是 `'pumpkin'`，也会触发南瓜头特殊规则。

**全局永久禁用（globalBan）预设步骤（2026-07）:**

BP 流程模板（`ruleConfig.bpSequence`）的步骤 `action` 除 `'ban'`/`'pick'` 外，新增 `'globalBan'`：在**指定时机**自动抽取植物进入全局永久禁用（`globalBans`），实现"预设步骤抽取永 ban"。与开局 `randomBanPlants()`（一次性随机 N 个，由 `ruleConfig.randomBan` 配置、默认 5；详见下方「开局随机永久禁用可配」）互补——globalBan 可在 BP 流程任意位置插入、可多步、数量可配。

- **数据结构**：`{ player: 'system', action: 'globalBan', count: N }`
  - `player: 'system'`：占位，不归属任何阵营；`getBPSequence` 的 `convertTemplate` 仅替换 `road2`/`road4`，其余原样透传（`src/utils/bpRules.js`）
  - `count`：该步抽取数量（池不足时抽满为止，不重复）
- **自动执行（状态机）**：`gameStore._processAutoSteps()` 在 `startRound` 末尾与 `moveToNextStep` 推进后循环检测——若当前步为 globalBan，调用 `_drawGlobalBans(count)` 从未禁用池（`getAllPlantsSync()` 排除 `globalBans` + 当小局 `bans`）随机抽取并入 `globalBans`，再 `_advanceOneStep` 推进；连续多个 globalBan 逐步执行，停在下一个手动步骤或进入 positioning。`moveToNextStep` 已重构为 `_advanceOneStep` + `_processAutoSteps`。
- **多人一致性**：globalBan 步骤无选手归属、无点击确认，必须由**权威方（local/host）**单方抽取并 `syncState` 广播，避免各端随机数不一致；`player`/`spectator` 端 `_processAutoSteps` no-op，状态由 host 被动同步（沿用 `randomBanPlants` 的权威方模式）。`_processAutoSteps` 仅在确实处理过自动步骤时才落盘+同步，普通推进零额外 I/O。
- **UI**：
  - `PlantSelector`：globalBan 步骤 `availablePlants` 返回 `[]`，网格为空、确认按钮禁用，避免选手误触
  - `StageIndicator`：`action='globalBan'` 显示「系统 / 全局禁用」，与 ban 共用 ban-red 色系
  - `BPRulesEditor`：action 下拉新增「全局禁用」选项；选中时 player 锁定为 system、count 标签改显「抽取」；校验放宽 `action∈[ban,pick,globalBan]`，commit 强制 globalBan 步骤 `player='system'`
- **持久化/同步**：globalBan 是 bpSequence 步骤的 action 取值，嵌在 `ruleConfig.bpSequence` 内整体存取，**无需改** save/load/sync 四函数（符合「ruleConfig 配置契约」）；抽取结果写入顶级 `globalBans`，随 `getSyncPayload`/`applySyncState` 同步。回归测试：`src/stores/__tests__/gameStore.globalBan.spec.js`。

**局内临时抽取永 ban（手动触发，2026-07）:**

与预设版互补的「临时起意」入口——比赛进行中（BP 流程内）由裁判/host 点按钮从未禁用池随机抽 **1 个**植物入 `globalBans`，无需赛前改模板。

| 维度 | 预设 globalBan 步骤 | 局内手动抽取（本节） |
|---|---|---|
| 配置时机 | 赛前 BP 模板 | 局内按需 |
| 触发方式 | 流程自动 | 裁判/host 手动点按钮 |
| 单次数量 | `count` 可配 | 固定 1 |
| 抽取逻辑 | `_processAutoSteps` → `_drawGlobalBans` | `drawRandomGlobalBan` → `_drawGlobalBans(1)` |

- **实现**（`src/stores/gameStore.js`）：
  - `drawRandomGlobalBan()`：权威方（local/host）守卫 → 复用 `_drawGlobalBans(1)`（池空返回 `{ok:false,reason:'empty'}` 并回滚刚压入的快照）→ 落盘 + `syncState` → 返回 `{ok,plantId}`
  - `_drawGlobalBans` 返回 drawn 数组，供手动版复用（状态机调用不接收返回值，向后兼容）
- **权限**：走「局内干预」路径（不走 `isRuleEditable`），仅 `local`/`host`（`connStore.roomMode==='local' || myRole==='host'`）；`player`/`spectator` 返回 `not-authority`。UI 层 `BanPickView.vue` 据此隐藏「抽取永禁」按钮。
- **时机**：仅 `gameStatus === 'banning'`（站位/结算/结束阶段隐藏按钮）。
- **撤销**：手动抽取的撤销**统一由通用撤销 `undoLastAction` 承担**（见下方「通用撤销」段）——抽取前压栈、`lastActor='system'`，撤销时整体恢复 `globalBans`。原 `undoLastManualGlobalBan` action 已删除；`lastManualGlobalBan` 字段保留仅为旧存档/混版本向后兼容（新版本恒为 null，不再写入）。
- **UI**：`src/views/BanPickView.vue` 底部按钮栏「抽取永禁」(danger/`Dices`) + 「撤销」(secondary/`Undo2`，通用撤销)；反馈用 `useToast`（success/warning/info），顶部永久禁用栏基于响应式 `globalBans` 自动刷新（无需 `triggerPlantCacheUpdate`）。
- **持久化/同步**：抽取结果写顶级 `globalBans`，随 `getSyncPayload`/`applySyncState` 同步。回归测试：`src/stores/__tests__/gameStore.drawGlobalBan.spec.js`（抽取语义）+ `gameStore.undo.spec.js`（撤销语义）。

**通用撤销（Undo Stack，2026-07）:**

BP 流程内所有用户操作（ban / pick / 南瓜 pick / 手动抽取永禁）统一可撤销，解决「点错只能整局重来」的痛点。采用**操作前快照压栈 + 撤销时整体 pop 恢复**（不用逐操作写反向逻辑——南瓜保护索引重映射过复杂）。

- **数据结构**（`src/stores/gameStore.js` state）：
  - `undoStack: []`：操作前快照栈，上限 30。每快照含 `currentRound`（全量深拷贝：含南瓜保护/索引/extraPick/step/stage）、`globalBans`、`plantUsage`、`pumpkinUsage`、`gameStatus`。
  - `lastActor: null`：最近一次可撤销操作的执行者（`'player1' | 'player2' | 'system' | null`），用于精确判定选手撤销权。
- **实现**（`src/stores/gameStore.js`）：
  - `_pushUndoSnapshot()` / `_buildUndoSnapshot()`：压栈 + 构造深拷贝快照（上限 30，超出 shift 最旧）。
  - `undoLastAction()`：权限 + 阶段 + 空栈校验 → pop 快照整体恢复 → 强制 `selectedPlant=null`、`lastActor=null` → 调 `updateCurrentStep()`（仅重算指针）→ 落盘 + `syncState`。返回 `{ok, undone, reason}`，`undone` 供 UI toast（`_describeUndone` 据前后 diff 推断撤了 ban/pick/globalBan）。
  - **压栈时机**：`confirmSelection` 头部（canPick 校验已提前到压栈前，避免失败留无效快照）与 `drawRandomGlobalBan`（抽取失败时回滚快照）；自动步骤 `_processAutoSteps` 与开局 `randomBanPlants` 不单独压栈。
- **权限（`lastActor` 模型，关键）**：不用 `isMyTurn` 判定选手撤销权——选手做完操作后 `currentPlayer` 已推进到对手，`isMyTurn` 恒 false，导致选手永远无法撤销自己刚点错的操作。改用 `lastActor`：观众拒；裁判（local/host）永真；**选手仅当 `lastActor === myAssignedPlayer`**（撤销自己刚做的操作，回合回退给自己重做）。连续撤多步由裁判发起。
- **范围**：仅当前小局——`startRound` 清空 `undoStack` 与 `lastActor`；`gameStatus !== 'banning'`（站位/结算）时 `undoLastAction` 返回 `wrong-phase`。
- **不触发自动步骤**：撤销只调 `updateCurrentStep()`（重算 currentPlayer/action），不调 `_advanceOneStep`/`_processAutoSteps`——即使撤销后 `action==='globalBan'` 也不会被自动重抽，快照内 `globalBans` 整体恢复即正确。
- **多人一致性**：撤销走标准 `syncState` 广播（`getSyncPayload` 含 `undoStack`/`lastActor`），其他人 `applySyncState` 整体覆盖。撤销**不需重新随机**（只恢复快照），故绕开多人随机数一致性问题——选手撤销也安全，无需权威方单点执行。
- **UI**：`src/views/BanPickView.vue` 底部「撤销」按钮（`v-if="gameStatus==='banning' && canUndo"`，角标显示还可撤销步数 N）；`canUndo` computed 据 `lastActor`/权限判定，权限不满足时隐藏。
- **持久化/同步**：`undoStack`/`lastActor` 是顶级运行时状态字段，按 `globalBans`/`plantUsage` 同模式加入 save/load/sync 四函数（非 ruleConfig 配置项，不享受整体存取契约）；旧存档/旧 payload 无这两个字段时降级为 `[]`/`null`。回归测试：`src/stores/__tests__/gameStore.undo.spec.js`。

**WebRTC Network Configuration:**

The project supports both default PeerJS public servers and self-hosted servers for improved connectivity:

**Configuration File:** `src/config/webrtc.config.js`

```javascript
export default {
  debug: 2,

  // PeerJS 服务器配置（可选，用于自建服务器）
  peerjs: {
    host: 'your-domain.com',    // 您的服务器域名或 IP
    port: 9000,                  // PeerJS 端口
    path: '/peerjs',
    secure: true                 // 使用 HTTPS
  },

  // ICE 服务器配置
  config: {
    iceServers: [
      // 公共 STUN 服务器（免费，用于 NAT 穿透）
      { urls: 'stun:stun.l.google.com:19302' },

      // 自建 TURN 服务器（可选，用于中继）
      // {
      //   urls: 'turn:your-domain.com:3478',
      //   username: 'your-username',
      //   credential: 'your-password'
      // }
    ]
  }
}
```

**Deployment:**

For production deployment with public internet access, consider deploying self-hosted PeerJS and TURN servers:

- **PeerJS Server**: Replaces public signaling server, improves stability
- **TURN Server**: Provides relay for restricted networks (enterprise/school)
- **Estimated Cost**: ~30-50 元/月 for 1核2GB 阿里云 ECS

See `docs/SERVER-SETUP.md` for complete deployment instructions.

**机器特定信息与安全待办**：生产部署的真实 IP/域名/`aa_nginx` 路径等机器特定信息见本地 `CLAUDE.local.md`（已 gitignore，不进仓库）。公开待办（不含敏感值）：① `src/config/webrtc.config.js`、`server/lobby-server.js` 的真实域名与 TURN 凭据需迁到本地加载；② TURN 凭据明文已进入 git 历史，需轮换。详情见 `CLAUDE.local.md`。

**Connection Success Rates:**

| Network Type | Without TURN | With TURN |
|--------------|-------------|-----------|
| Local LAN    | 100%        | 100%      |
| Home Network | 80-90%      | 95%+      |
| Enterprise   | 40-60%      | 90%+      |

## Rules Implementation

**Implemented:**
- ✅ Dynamic BP order based on road selection
- ✅ Mutual exclusion in road selection (players can't choose same road)
- ✅ Toggle road selection (click to deselect)
- ✅ **Same-round duplicate picks** - 选手可以在同一小局中选择同一植物多次（最多2次），但对手已选的植物不可选
  - 实现位置：`src/stores/gameStore.js:69-107` (availablePlants getter)
  - 验证逻辑：`src/utils/validators.js:142-187` (canPick 函数)
  - UI显示：植物卡片和阵容区域会显示总使用次数（历史+当前小局）
- ✅ Usage limit tracking (max 2 times per plant per player, **including same-round picks**)
- ✅ Cannot pick opponent's already-selected plants
- ✅ Global bans (5 plants per match)
- ✅ Score tracking (大局先到 4 小局胜)
- ✅ Loser picks road for next round
- ✅ First-round special case: if loser chose road initially, no re-selection needed
- ✅ Custom plant management (add, edit, delete, export, import)
- ✅ IndexedDB storage for custom plants with memory cache
- ✅ 南瓜头特殊规则（Pick 阶段选择南瓜头不消耗 BP 步骤；可由 `ruleConfig.pumpkinRule.enabled` 开关在赛前启停，默认开启，关闭时南瓜当作普通植物处理——消耗 BP 步骤、受 maxPlantUsage 上限约束、计入 plantUsage）
- ✅ **阵营名称自定义**（功能1）：`ruleConfig.sideNames` 可改默认「二路/四路」，`gameStore.sideName(road)` 统一映射显示
- ✅ **选边方式自定义**（功能3）：初始选边（双方互斥/指定一方/随机）+ 小局后选边权（败者选/胜者选/不换边），由 `ruleConfig.sideSelection` 驱动
- ✅ **开局随机永久禁用可配**（`ruleConfig.randomBan`）：开关（`enabled` 默认开启）+ 数量（`count` 默认 5）；`enabled=false` 则开局不禁用（`globalBans` 为空）。开局一次性抽取入 `globalBans`，与 BP 流程内的 globalBan 预设步骤 / 手动抽取互补。配置入口：BPRulesEditor（赛前「BP 规则」弹窗 / 比赛预设编辑器）；默认值子文件 `src/config/rules/randomBan.js`；回归测试：`src/stores/__tests__/gameStore.randomBan.spec.js`
- ✅ **预设全局永久禁用步骤**（globalBan）：BP 模板步骤 action 可为 `'globalBan'`，流程进行到该步时由系统自动从未禁用池随机抽取 `count` 个植物并入 `globalBans`（跨小局永久生效），无需选手点击；详见下方「全局永久禁用（globalBan）预设步骤」
- ✅ **局内临时抽取永禁**（手动触发，2026-07）：BP 流程进行中，裁判/host 可点「抽取永禁」按钮从未禁用池随机抽 1 个植物入 `globalBans`；撤销由通用 `undoLastAction` 统一承担（不再有专门的「撤销抽取」）。与预设版互补，详见下方「局内临时抽取永 ban（手动触发）」
- ✅ **通用撤销 / Undo Stack**（2026-07）：BP 流程内所有用户操作（ban / pick / 南瓜 pick / 手动抽取永禁）统一可撤销。采用操作前快照压栈 + 撤销时整体 pop 恢复；权限用 `lastActor` 模型（裁判随时可撤、选手可撤自己刚做的操作）；仅当前小局可撤（startRound 清栈）；撤销不触发自动步骤、不重新随机（多人安全）。详见下方「通用撤销（Undo Stack）」

**Not Yet Implemented:**
- ⚠️ 巅峰对决 mode (3:3 tiebreaker)

## Testing Flows

**Complete Game Flow:**
1. Start dev server: `npm run dev`
2. Enter two player names, select roads (one 2路, one 4路)
3. Verify BP sequence starts with correct player (二路选手 first)
4. Complete all 4 stages (20 total ban/pick actions: 4+6+6+4)
5. Set up positions (placeholder for now)
6. Click "完成小局" to end round
7. Select round winner
8. Verify loser can select road for next round
9. Verify scores update correctly

**Road Selection Edge Cases:**
- Player1 selects 2路, then tries to select 4路 → should toggle
- Player1 has 2路 selected, Player2's 2路 button should be disabled
- Deselecting a road should re-enable it for the other player

## Browser Compatibility

Modern browsers with ES6+ support: Chrome, Firefox, Edge, Safari.

LocalStorage is used for persistence - clearing browser data wipes everything; clicking "重置游戏" clears game progress but **keeps the currently-applied BP/rule config (`ruleConfig`)** so the next match starts with the same BP flow (see Round Flow / `resetGame`).

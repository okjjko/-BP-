# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing & Quality Assurance

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

- `src/utils/roomManager.js` - WebRTC P2P connection manager using PeerJS
  - Host creates room with invite code (6-char alphanumeric)
  - Players/spectators join via invite code
  - Star topology: all clients connect to host, host broadcasts state updates
  - Message types: `stateUpdate`, `customPlants`, `gameStart`, `identityAssigned`
  - **WebRTC Configuration**: Uses STUN/TURN servers for NAT traversal (configured in `src/config/webrtc.config.js`)
  - **ICE State Monitoring**: Real-time connection status feedback via `iceStateChange` events
  - **Connection Status Display**: Visual indicator in RoomSetup.vue showing connection state

- `src/config/webrtc.config.js` - WebRTC server configuration
  - PeerJS server settings (host, port, path, secure)
  - ICE servers list (STUN/TURN)
  - Connection timeout and retry settings
  - `lobby` block: 公共房间目录服务地址、心跳/列表刷新间隔
  - See `docs/SERVER-SETUP.md` for deployment instructions

- `server/lobby-server.js` - **公共房间目录服务（lobby，可选增强层）**
  - 维护临时"公共房间目录"：房主可开"对所有人开放"的房间，其他人从列表一键加入（省去邀请码传递）
  - **不参与 P2P 数据传输**：加入时仍复用 `roomManager.joinRoom(inviteCode)`，WebRTC 架构零改动
  - 内存存储 + TTL 自动清理（无心跳 60s 过期）；零运行时依赖（Node 原生 http）
  - API：登记/查询/心跳/注销（见 `server/README.md`），nginx 反代到 `https://your-domain.com/lobby`
  - lobby 任何故障都降级为私密房间（仍可用邀请码），不阻断 BP
  - 前端封装：`src/utils/lobbyApi.js`（registerRoom/listRooms/heartbeat/unregisterRoom）

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
1. **默认值单一事实来源**：`src/config/defaultRules.js` 聚合 `src/config/rules/{sideNames,sideSelection,bpSequence,limits}.js`。聚合器定型后不再改动，各功能默认值在各自子文件维护。
2. **序列化整体处理**：`saveToLocalStorage` / `loadFromLocalStorage` / `getSyncPayload` / `applySyncState` 对 `ruleConfig` 整体存取（`{ ...defaultRules, ...(state.ruleConfig||{}) }` 深合并默认值，向后兼容）。**新增配置项禁止在这四个函数里逐字段列举**——只改对应 `rules/` 子文件即可自动获得持久化 + 多人同步。
3. **并行协作锚点**：`gameStore.js` getters 区有 `// A-ANCHOR`（maxPlantUsage，功能4）与 `// B-ANCHOR`（sideName，功能1）占位注释；开发者 A/B 在各自锚点下新增 getter，避免冲突。`GameSetup.vue` 的规则配置区由 `SideRulesEditor.vue`（B）与 `BPRulesEditor.vue`（A）两个子组件分担。
4. **解耦**：`bpSequence` 模板始终用 `road2`/`road4` 占位符；`sideNames` 仅影响显示文案；两者通过 road 数值（2/4）桥接。

完整分工方案与数据结构见 `docs/CUSTOM-RULES-PARALLEL-PLAN.md`。

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

Access custom plant management through the "植物管理" (Plant Management) interface.

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
用户可以通过植物管理界面添加自定义植物，如果将植物名称设置为 "南瓜头"，即使植物 ID 不是 `'pumpkin'`，也会触发南瓜头特殊规则。

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
- ✅ 南瓜头特殊规则（Pick 阶段选择南瓜头不消耗 BP 步骤）

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

LocalStorage is used for persistence - clearing browser data or clicking "重置游戏" resets everything.

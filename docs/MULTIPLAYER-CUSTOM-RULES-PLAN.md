# 多人模式自定义规则机制 — 双人并行开发规划

## Context（背景与目标）

上一阶段（单机）已完成 `ruleConfig` 四项自定义功能（阵营名 / 选边方式 / BP 顺序 / 植物使用上限），并已合入 master（`e5cebec`）。但**多人对战未接入**自定义：

- **同步数据通道已就绪**（Phase 0）：`ruleConfig` 已在 `getSyncPayload()` / `applySyncState()`，能随 `stateUpdate` 同步。
- **但缺四件事**：
  1. host 开局跳过配置 UI——`GameSetup.handleRoomStart`（host 路径）直接 `startGame()`，host 根本看不到 `SideRulesEditor`/`BPRulesEditor`，`ruleConfig` 全程默认值。
  2. 编辑器无权限控制——选手/观众打开也能改（grep `RulesEditor/` 目录 `connStore`/`myRole`/`disabled` 零匹配）。
  3. 改 `ruleConfig` 不触发同步——编辑器直接写 `store.ruleConfig`，不像 action 那样调 `syncState()`，host 改了也不广播。
  4. 进行中改规则会破坏对局——`bpSequence`/`maxPlantUsage` 是结构性的，对局中改会让已生成的 `currentRound.bpSequence` 和已 pick 植物超限。

本阶段补齐多人自定义的完整闭环：**赛前 host 配置入口 + 权限控制 + 变更同步 + 规则锁定 + 客户端只读展示**。

约束：两名开发者双分支并行，合并冲突最小。沿用上一阶段的 worktree 经验（**手动 `git worktree add` 基于 master**，不用 isolation，规避 `origin/main` 陈旧导致基线错误的坑）。

---

## 关键现状（已核对）

- **host 流程**：`RoomSetup.vue` 创建房间（`createRoom`）→ 显示邀请码 + 连接状态 + 已连接用户 → 点"开始对战"（`confirmStart`，行 766）→ `emit('startGame', {mode:'host'})` → `GameSetup.handleRoomStart`（行 247）host 路径直接 `startGame()`（行 279），硬编码 `player1Road=2, player2Road=4`（行 275-276）。
- **赛前入口最佳插入点**：`RoomSetup.vue` host 面板，`inviteCode` 显示后、`confirmStart` 按钮前（行 176-245 的 `.room-info` 区块内）。此时 `gameStatus` 仍是 `'setup'`（未 startGame）。
- **选手端**：`RoomSetup.handleGameStart`（行 922）收到 gameStart → `initGame` → 之后靠 `handleStateUpdate` 接收 host 状态（含 ruleConfig）。选手端在 `BanPickView` 看对战，在 `RoomSetup.waiting-section`（行 356）等开始。
- **同步机制**：`connectionStore.syncState()`（host 用 `broadcastState`，客户端用 `sendStateUpdate`）；`handleStateUpdate` 用 `version <= stateVersion` 防自身回环，但挡不住跨客户端扩散。
- **`isMyTurn`**：host 永远 `true`，选手按 `currentPlayer === myAssignedPlayer` 判定。
- **`gameStatus` 流转**：`setup → banning → positioning → result → banning(下一局) → ... → finished`。赛前 = `setup`。

---

## 契约（C/D 共同依赖，双方必须遵守）

1. **`store.isRuleEditable`**（C 在 gameStore 新增 getter，D 只读）：
   ```js
   isRuleEditable: (state) => state.gameStatus === 'setup'
   ```
   含义：只有赛前（未开始游戏）可改规则。对局开始后全员锁定（含 host）。MVP 不区分"结构性/安全字段"，统一 setup 可改——最简单、最安全。

2. **`canEditRules`**（C 在编辑器内部计算，D 不传 props）：
   ```js
   const canEditRules = computed(() =>
     (connStore.roomMode === 'local' || connStore.myRole === 'host') && store.isRuleEditable
   )
   ```
   编辑器内所有输入控件 `:disabled="!canEditRules"`；锁定时显示"规则已锁定（对局进行中）"提示。

3. **变更同步（防回环的关键设计）**：**不用 watcher 自动 syncState**。编辑器在 host/local 改 `ruleConfig` 后，**显式**调一次同步：
   ```js
   // 编辑器内，每次写回 ruleConfig 后
   if (connStore.roomMode === 'host') connStore.syncState()
   ```
   - host 是唯一能改 `ruleConfig` 的人（选手/观众 `canEditRules=false`）→ 客户端永远不会主动改 ruleConfig → `applySyncState` 更新的 ruleConfig 不会被任何客户端回播 → **天然无回环**，不需要 `_applyingRemote` 标志。
   - local 模式不 syncState（`syncState` 内部 `roomMode==='local'` 直接 return）。

4. **首次同步时机**：host 在 RoomSetup 设好 ruleConfig → 点"开始对战" → `GameSetup.handleRoomStart` → `startGame()` → `initGame()` 末尾的 `syncState()`（gameStore 行 186）会广播完整状态（含 ruleConfig）→ 选手 `applySyncState` 覆盖默认值。故无需额外广播机制。

---

## 文件所有权矩阵

| 文件 | 所有者 | 说明 |
|---|---|---|
| `src/stores/connectionStore.js` | **C** | 仅当需要时微调（MVP 防回环方案不依赖改它，C 可不改；如改仅限 syncState 相关注释/健壮性） |
| `src/stores/gameStore.js` | **C**（限定区域） | 新增 `isRuleEditable` getter（放 A/B 锚点之外的 getter 区，新建 `// MP-ANCHOR`）；**不改** applySyncState/getSyncPayload 的 ruleConfig 整体处理逻辑（已就绪） |
| `src/components/RulesEditor/SideRulesEditor.vue` | **C** | 加 `canEditRules` + `:disabled` + 锁定提示；改 ruleConfig 后显式 syncState |
| `src/components/RulesEditor/BPRulesEditor.vue` | **C** | 同上 |
| `src/components/RoomSetup.vue` | **D** | host 面板（`.room-info` 区块）嵌入 `<SideRulesEditor/>`+`<BPRulesEditor/>`，仅 host 可见 |
| `src/components/GameSetup.vue` | **D**（限定） | `handleRoomStart` host 路径：确认不破坏 ruleConfig（initGame 已保留）；`random`/`assigned` 模式下选手端 host 自动分配逻辑语义确认 |
| `src/components/RulesEditor/RulesSummary.vue` | **D**（新建） | 只读规则摘要组件（阵营名/选边模式/BP模板阶段数/使用上限） |
| `src/views/BanPickView.vue` | **D** | 头部引入 `<RulesSummary/>`（所有人可见，只读） |

> **编辑器与 RoomSetup 的解耦**：D 在 RoomSetup `import` 并放置编辑器组件，**不改编辑器内部**；C 改编辑器内部（加 disabled/syncState）。两者通过"编辑器自行读 connStore 判断 canEditRules"解耦，D 无需给编辑器传 props → 零冲突。

---

## gameStore.js 编辑约定

- **C 只在 `// MP-ANCHOR`（C 新建）处加 `isRuleEditable` getter**，不碰 A/B 锚点、序列化函数、actions。
- **D 完全不改 gameStore.js**（只读 `store.ruleConfig`、`store.isRuleEditable`）。

---

## 开发者 C：同步与权限机制层（挑战 ①②③）

1. `gameStore.js`：新增 `// MP-ANCHOR` + `isRuleEditable: (state) => state.gameStatus === 'setup'` getter。
2. `SideRulesEditor.vue` / `BPRulesEditor.vue`：
   - 引入 `useConnectionStore`，算 `canEditRules`（见契约 2）。
   - 所有输入控件 `:disabled="!canEditRules"`；锁定时（`!isRuleEditable`）顶部加灰色提示"规则已锁定（对局进行中）"。
   - 每次写回 `store.ruleConfig.*` 后，`if (connStore.roomMode === 'host') connStore.syncState()`（见契约 3）。
   - **向后兼容**：单机（local）模式下 `canEditRules` 退化为 `isRuleEditable`，行为与现状一致；多人 host 赛前可改、对局中锁定。
3. 验证 `connectionStore.syncState()` 在 `roomMode==='host'` 时确实 `broadcastState`（现状已如此，确认即可，不强制改）。

## 开发者 D：入口与展示层（挑战 ④⑤）

1. `RoomSetup.vue`：在 host 面板 `.room-info` 区块（邀请码显示后、"开始对战"按钮前）嵌入：
   ```vue
   <div v-if="role === 'host' && inviteCode" class="rules-config-section ...">
     <SideRulesEditor />
     <BPRulesEditor />
   </div>
   ```
   仅 host 面板渲染（选手/观众面板不渲染）。host 此时 `gameStatus==='setup'` → 编辑器可改。
2. `GameSetup.vue` `handleRoomStart` host 路径：核对 `startGame()` → `initGame()` 保留 `ruleConfig`（不重置），且 `initGame` 末尾 `syncState` 广播含 ruleConfig；如 `random`/`assigned` 模式下 host 自动分配的 2/4 需调整为尊重 `initialMode`（initGame 已处理，D 仅确认 handleRoomStart 传参不冲突）。**不破坏现有 local 流程**。
3. 新建 `src/components/RulesEditor/RulesSummary.vue`：只读展示 `store.ruleConfig`——阵营名（`sideName(2)`/`sideName(4)`）、选边模式（initialMode/loserPickMode 文案化）、BP 模板（阶段数 + 总步数）、使用上限（`maxPlantUsage`）。纯展示，无输入。
4. `BanPickView.vue`：在头部信息概览区（`StageIndicator` 附近，行 13-15）引入 `<RulesSummary />`，所有角色可见。

---

## 验证

**单分支自测**：
- `npm run build` 通过。
- C：单机模式编辑器赛前可改、开始游戏后锁定（disabled + 提示）；多人 host 赛前改 ruleConfig 后 `syncState` 被调用（可加临时 console.log 确认，提交前移除）。
- D：host 在 RoomSetup 看到并配置规则；选手端 BanPickView 显示 `RulesSummary`；`RulesSummary` 数据来自同步的 ruleConfig。
- **回归**：单机四项自定义功能仍正常；选边不卡背景。

**合并后整体验证**（主控做）：
- 完整多人流程：host 创建房间 → 配置规则 → 选手加入 → 开始 → 选手端 BanPickView 规则摘要正确 → 对局中所有人编辑器锁定。
- **防回环**：host 赛前连改几次规则，控制台不出现同步风暴（stateVersion 不应无限递增）。
- `npm run test:multiplayer:headed`（若可跑）。

---

## 交付节奏

1. 本计划文档已提交到 master 并 push（含本文件），作为 C/D 契约。
2. 主控**手动** `git worktree add` 两个 worktree（基于 master，规避 isolation baseRef 坑）：
   - `dev-c` → 分支 `feature/multiplayer-sync-perms`
   - `dev-d` → 分支 `feature/multiplayer-entry-display`
3. C、D 并行开发（互不阻塞，仅依赖本契约）。
4. 主控合并两分支到 master（预期 `gameStore.js` 的 `// MP-ANCHOR` 新增行可能小冲突，trivial），build + 多人回归验证 + push。

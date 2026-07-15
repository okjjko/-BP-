# 比赛流程自定义拓展 — 双人并行开发规划

## Context（背景与目标）

当前 BP 工具的比赛流程规则大量硬编码：阵营名固定为「二路/四路」、BP 顺序固定为 4 阶段 20 步模板、选边方式固定为「初始双方互斥选 + 每轮败者选」、每选手每植物使用上限固定为 2 次。本次需求要**把这些规则全部改为开局可自定义**，共四项：

1. **阵营名称自定义**（默认「二路/四路」可改）
2. **BP 流程顺序自定义**（预设模板 + 可视化编辑器）
3. **选边方式自定义**（初始选边可改指定一方/随机；败者选边可切为胜者选/不换边）
4. **整局大场植物使用上限自定义**（每名选手独立计数，上限值可配，默认 2）

核心约束：**两名开发者各自开分支并行开发，且合并冲突最小**。

经过对 `gameStore.js`、`bpRules.js`、`validators.js`、`GameSetup.vue`、`RoundResult.vue` 等核心文件的完整分析，冲突的根源集中在两处：
- `gameStore.js` 的 `saveToLocalStorage` / `loadFromLocalStorage` / `applySyncState` / `getSyncPayload` 四个序列化函数**逐字段列举**——任何新增配置项都要改这 4 处。
- `GameSetup.vue` 是开局配置的唯一入口——四项配置都倾向在此加 UI。

因此本规划的核心策略是：**先合入一个轻量「配置骨架」到 main，把这两处冲突根源一次性消除**，之后两人各自拉分支，靠「文件所有权 + gameStore 行级编辑区域约定」实现近乎零冲突并行。

---

## 关键现状（已核对的事实）

- `player1.road` / `player2.road` 是数值 `2`/`4`；`road2Player`/`road4Player` getter 据此判定阵营。
- BP 模板在 `bpRules.js` 用 `'road2'`/`'road4'` 占位符，`getBPSequence(road2Player, road4Player)` 替换为 `player1/player2`，返回 2D 数组 `[[stage1 步骤], ...]`，每步 `{ player, action, count? }`。
- `winThreshold` 是已有的可配置样板：state 字段 → GameSetup 下拉 → 4 个序列化函数逐字段 → `isGameOver(...)` 读取 → 随多人 `stateUpdate` 同步。**新配置项应复用这套路径**。
- `validators.canPick(plantId, playerId, gameState)` 内部硬编码 `totalUsage >= 2` 和文案「2次」，未接收上限参数（但 `gameState` 是完整 state，未来可从中读 `ruleConfig`）。
- `gameStore.availablePlants` getter 内联硬编码 `>= 2`（普通植物与南瓜头各一处）。
- `RoundResult.vue` 的 `confirmRoadSelection` **直接写 `store.player1.road`**（绕过 `selectRoad` action），且必须「先同时更新败者+胜者双方 road 再 `startRound`」（见 `CLAUDE.md`「选边卡死修复」）。
- 多人模式 host 在 `GameSetup.vue` 自动分配 `player1Road=2 / player2Road=4`（行 235-236）。
- 路由页 `RoundResult.vue` 根必须是真实 `<div>`（BaseDialog 的 Teleport 约束，见 `CLAUDE.md`）。

---

## 数据契约：`ruleConfig`（Phase 0 定义，A/B 共同依赖）

所有自定义项集中存入 `gameStore.state.ruleConfig` 单一对象。**这是 A/B 并行解耦的关键**——两人各自负责不同子树，互不依赖对方实现。

```javascript
ruleConfig: {
  // —— 开发者 B 负责 ——
  sideNames: { road2: '二路', road4: '四路' },        // 阵营显示名（功能1）
  sideSelection: {                                       // 选边方式（功能3）
    initialMode: 'mutual',     // 'mutual'(双方互斥,现状) | 'assigned'(指定一方选) | 'random'(随机)
    initialPicker: 'player1',  // initialMode='assigned' 时生效
    loserPickMode: 'loser',    // 'loser'(败者选,现状) | 'winner'(胜者选) | 'keep'(不换边)
  },

  // —— 开发者 A 负责 ——
  bpSequence: [                                           // BP 顺序模板（功能2），与现有 STAGE_x_TEMPLATE 同构
    [ { player: 'road2', action: 'ban' }, /* ...stage1 */ ],
    [ /* stage2 */ ], [ /* stage3 */ ], [ /* stage4 */ ],
  ],
  limits: {                                               // 使用上限（功能4）
    maxPlantUsage: 2,          // 每名选手每株植物上限
  },
}
```

**解耦要点**：`bpSequence` 模板始终用 `'road2'`/`'road4'` 占位符；`sideNames` 只决定显示文案；两者通过 road 数值（2/4）桥接。A 的 BP 模板编辑器与 B 的阵营名编辑器互不感知。

---

## Phase 0：配置骨架 PR（先合入 main，约半天）

**目的**：消除 `gameStore.js` 序列化函数和 `GameSetup.vue` 入口的冲突根源。完成后两人拉分支，加配置字段时**这 4 个序列化函数永远不再改动**。

### 0.1 新建 `src/config/rules/`（默认值拆分到独立文件）
- `src/config/rules/sideNames.js` — 导出 `{ road2: '二路', road4: '四路' }`（B 后续填充/扩展）
- `src/config/rules/sideSelection.js` — 导出选边模式默认值（B 后续填充）
- `src/config/rules/bpSequence.js` — 导出现有 4 阶段模板（从 `bpRules.js` 现有 `STAGE_x_TEMPLATE` 提取，保持占位符 `road2/road4`）（A 后续扩展为多模板）
- `src/config/rules/limits.js` — 导出 `{ maxPlantUsage: 2 }`（A 后续填充）
- `src/config/defaultRules.js` — **聚合器**，import 上述 4 个，`export default { sideNames, sideSelection, bpSequence, limits }`

> 聚合器在 Phase 0 写好后**不再改动**；A/B 各自只改自己的 `rules/` 子文件 → 消除默认值定义区冲突。

### 0.2 `src/stores/gameStore.js`
- state 顶部 `import defaultRules from '@/config/defaultRules'`，新增 `ruleConfig: JSON.parse(JSON.stringify(defaultRules))`。
- **4 个序列化函数整体处理 `ruleConfig`**（这是消除未来冲突的关键）：
  - `saveToLocalStorage()`：对象内加 `ruleConfig: this.ruleConfig`
  - `loadFromLocalStorage()`：`this.ruleConfig = { ...defaultRules, ...(state.ruleConfig||{}) }`（深合并默认值，向后兼容旧存档）
  - `getSyncPayload()`：加 `ruleConfig: this.ruleConfig`
  - `applySyncState(gameState)`：`this.ruleConfig = { ...defaultRules, ...(gameState.ruleConfig||{}) }`
- **预留两个 getter 占位注释**（行级约定，见下文「gameStore 编辑区域约定」），供 A/B 各自填充实现，避免在同一物理位置增删行造成冲突。

### 0.3 `src/components/GameSetup.vue`
- 在「大局获胜所需小局数」下拉（行 139-149）下方，新增「规则配置区」容器，内含两个**空壳子组件占位**：
  ```vue
  <div class="rules-section space-y-4">
    <SideRulesEditor />   <!-- B 填充：阵营名 + 选边方式 -->
    <BPRulesEditor />     <!-- A 填充：BP 模板 + 使用上限 -->
  </div>
  ```
- 子组件直接 `v-model` 绑定到 `store.ruleConfig.xxx`（ruleConfig 已在 state，无需经 `initGame` 参数传递；`initGame` 不读写 ruleConfig）。
- Phase 0 建两个空壳文件 `src/components/RulesEditor/SideRulesEditor.vue`、`BPRulesEditor.vue`（仅渲染占位 + 声明 props）。

### 0.4 文档
- 同步更新 `CLAUDE.md`：记录 `ruleConfig` 契约、4 个序列化函数「整体处理 ruleConfig」的约定、`config/rules/` 目录职责。提醒未来新增配置项**不要**在序列化函数里逐字段列举。

> **验收**：`npm run dev` 跑通完整流程，旧 localStorage 存档能正常加载（深合并默认值生效），多人同步 ruleConfig 正常。此 PR 合入 main 后，两人各自 `git checkout -b` 拉分支。

---

## 文件所有权矩阵（最小冲突核心）

| 文件 | 所有者 | 说明 |
|---|---|---|
| `src/config/rules/bpSequence.js` | **A** | 默认 BP 模板 |
| `src/config/rules/limits.js` | **A** | 使用上限默认 |
| `src/config/defaultRules.js` | 骨架 | Phase 0 定型，**A/B 都不改** |
| `src/config/rules/sideNames.js` | **B** | 阵营名默认 |
| `src/config/rules/sideSelection.js` | **B** | 选边模式默认 |
| `src/utils/bpRules.js` | **A** | `getBPSequence` 支持自定义模板；`STAGE_NAMES` 动态化 |
| `src/utils/validators.js` | **A** | `canPick` 从 `gameState.ruleConfig.limits.maxPlantUsage` 读上限，文案动态化 |
| `src/components/RulesEditor/BPRulesEditor.vue` | **A** | 预设模板选择 + 可视化编辑器 |
| `src/components/PlantSelector.vue` | **A** | `/2` → `/{{ store.maxPlantUsage }}` |
| `src/components/UsedPlants.vue` | **A** | `/2次` → 动态 |
| `src/components/StageIndicator.vue` | **A** | 阶段数/阶段名随自定义序列动态化 |
| `src/components/GameSetup.vue` | **B** | 初始选边 UI 按 `initialMode` 切换；选路按钮文字改用 `sideNames`；**A 不碰主体** |
| `src/components/RoundResult.vue` | **B** | 败者选边按 `loserPickMode` 切换；「2路/4路」「甲/乙」改用 `sideNames`/选手名 |
| `src/components/PlayerInfo.vue` | **B** | 阵营名显示 |
| `src/components/PositionSetup.vue` | **B** | 阵营名显示 |
| `src/components/BanArea.vue` | **B** | 阵营名显示 |
| `src/components/PickArea.vue` | **B** | 阵营名显示；**顺手**把使用次数 `/2` 改 `/{{ store.maxPlantUsage }}`（A 仅提供 getter，不碰此文件） |
| `src/components/RulesEditor/SideRulesEditor.vue` | **B** | 阵营名输入 + 选边方式配置 UI |
| `src/stores/gameStore.js` | **共享**（行级约定，见下） | 仅两人各自区域 |

> 唯一「双方相关但由一方独占」的文件是 `PickArea.vue`：B 重构阵营名显示时，一并把使用次数显示参数化（A 只新增 `store.maxPlantUsage` getter）。如此 A 完全不碰 `PickArea.vue`。

---

## `gameStore.js` 行级编辑区域约定（共享文件的冲突隔离）

两人都改 `gameStore.js`，但严格限定在不同区域：

**A 的编辑区域：**
- `getters.availablePlants`：`>= 2`（行 94、97）与南瓜头 `>= 2`（行 106）→ 读 `this.ruleConfig.limits.maxPlantUsage`
- `actions.startRound`：`getBPSequence(road2, road4)`（行 188）→ 改为用 `this.ruleConfig.bpSequence` 模板生成（`getBPSequence` 新增模板入参，默认值=内置模板保持向后兼容）
- 新增 getter `maxPlantUsage`（便捷访问 `this.ruleConfig.limits.maxPlantUsage`）
- 新增 getter `currentBPTemplate`（返回当前生效模板，供 `StageIndicator` 使用）
- `confirmSelection` 内 `canPick(plantId, player, this.$state)` 调用**无需改**（`canPick` 已能从 `gameState.ruleConfig` 读上限）

**B 的编辑区域：**
- 新增 getter `sideName: (state) => (road) => road === 2 ? state.ruleConfig.sideNames.road2 : road === 4 ? state.ruleConfig.sideNames.road4 : ''`
- `actions.initGame`：按 `ruleConfig.sideSelection.initialMode` 处理初始 road（`'random'` 随机分配；`'assigned'` 用 `initialPicker`；`'mutual'` 保持现状用 UI 传入值）
- 新增/调整选边逻辑：败者选边按 `loserPickMode` 分支（`'loser'`/`'winner'`/`'keep'`）。可封装为 `actions.applyNextRoundSideSelection()`，供 `RoundResult.vue` 调用，集中「先同时更新双方 road 再 startRound」的约束

**约定**：两人均在各自 getter/action 区域**新增行**或修改**自己标记的现有行**，不触碰对方区域。Phase 0 在 getter 区预留两行占位注释（`// A: maxPlantUsage`、`// B: sideName`）作为锚点。新增行的 git 合并冲突概率极低。

---

## 开发者 A：分支 `feature/custom-bp-and-limits`（功能 2 + 4）

**功能 2（BP 顺序自定义 — 预设模板 + 可视化编辑器）**
1. `src/config/rules/bpSequence.js`：定义内置预设模板集（含现状 4 阶段模板作为默认，另备 1-2 个变体）。
2. `src/utils/bpRules.js`：`getBPSequence(template, road2Player, road4Player)` 增加模板入参（默认内置模板）；`STAGE_NAMES` 改为按模板阶段数动态生成「阶段 N」。
3. `src/stores/gameStore.js`：`startRound` 读 `this.ruleConfig.bpSequence` 模板生成序列；新增 `currentBPTemplate` getter。
4. `src/components/RulesEditor/BPRulesEditor.vue`：实现编辑器——预设模板下拉选择 + 阶段列表（每阶段可增删，每步可调 ban/pick、执行阵营 road2/road4、count），编辑结果写回 `ruleConfig.bpSequence`。提供「重置为默认」「校验（至少 1 阶段、每步有效）」。
5. `src/components/StageIndicator.vue`：阶段数与阶段名不再硬编码 4，改为遍历当前序列。

**功能 4（使用上限自定义 — 每选手独立计数，值可配）**
1. `src/config/rules/limits.js`：`{ maxPlantUsage: 2 }`。
2. `src/utils/validators.js`：`canPick` 内 `totalUsage >= 2` → `totalUsage >= (gameState.ruleConfig?.limits?.maxPlantUsage ?? 2)`，文案「2次」动态化。
3. `src/stores/gameStore.js`：`availablePlants` getter 两处 `>= 2`、南瓜头 `>= 2` 改读 `this.ruleConfig.limits.maxPlantUsage`；新增 `maxPlantUsage` getter。
4. `BPRulesEditor.vue` 内附「同种植物使用上限」数值输入（1~N），写回 `ruleConfig.limits.maxPlantUsage`。
5. `src/components/PlantSelector.vue`、`UsedPlants.vue`：`/2`、`/2次` 改为 `/{{ store.maxPlantUsage }}`。

---

## 开发者 B：分支 `feature/custom-sides-and-selection`（功能 1 + 3）

**功能 1（阵营名称自定义）**
1. `src/config/rules/sideNames.js`：`{ road2: '二路', road4: '四路' }`。
2. `src/stores/gameStore.js`：新增 `sideName(road)` getter。
3. `SideRulesEditor.vue`：两个文本输入（road2 名 / road4 名），写回 `ruleConfig.sideNames`。
4. 显示层替换硬编码「二路/四路/2路/4路/甲/乙」为 `store.sideName(road)` 或选手 `id`：
   - `GameSetup.vue` 选路按钮（行 67、82、119、134）
   - `RoundResult.vue` 败者选路区（行 82、97）及默认名 `player1Name/player2Name`（行 153-154 的 '甲'/'乙' fallback 保留为兜底）
   - `PlayerInfo.vue`、`PositionSetup.vue`、`BanArea.vue`、`PickArea.vue` 中的阵营/路文字

**功能 3（选边方式自定义）**
1. `src/config/rules/sideSelection.js`：`{ initialMode:'mutual', initialPicker:'player1', loserPickMode:'loser' }`。
2. `SideRulesEditor.vue`：初始选边模式单选（双方互斥/指定一方/随机）+ 败者选边模式单选（败者选/胜者选/不换边），写回 `ruleConfig.sideSelection`。
3. `src/stores/gameStore.js`：
   - `initGame` 按 `initialMode` 分配初始 road（`random` 用确定性分配；`assigned` 用 `initialPicker` 对侧自动填；`mutual` 保持现状）。
   - 新增 `applyNextRoundSideSelection()`：封装败者选边三分支（loser/winner/keep），**内部保证「先同时更新双方 road 再 startRound」**（`CLAUDE.md` 选边卡死约束）。
4. `src/components/GameSetup.vue`：初始选边 UI 按 `initialMode` 切换——`mutual` 显示双方互斥按钮（现状）；`assigned` 显示单方选路；`random` 隐藏选路（提交后系统分配）。多人 host 自动分配逻辑（行 235-236）随 `initialMode` 调整。
5. `src/components/RoundResult.vue`：`confirmRoadSelection` 改调 `store.applyNextRoundSideSelection()`；UI 按 `loserPickMode` 切换（败者选显示败者选路按钮；胜者选显示胜者选路；keep 直接「下一小局」无选路）。保持根 `<div>` + BaseDialog 结构（路由 Teleport 约束）。

---

## 冲突最小化策略小结

1. **配置骨架先行**：4 个序列化函数整体处理 `ruleConfig` 后，A/B 加字段零改动序列化层。
2. **默认值拆文件**：`config/rules/` 按功能分文件，聚合器定型不动。
3. **配置 UI 子组件化**：`GameSetup.vue` 主体由 B 独占，A 仅填 `BPRulesEditor.vue`。
4. **共享 store 行级约定**：A/B 在 `gameStore.js` 各自标记的 getter/action 区域编辑，Phase 0 留占位锚点。
5. **跨方文件归一方**：`PickArea.vue` 的「使用次数显示」由重构它的 B 一并参数化，A 不碰。

预期合并冲突仅可能出现在 `gameStore.js` 的新增行（getter 区相邻新增），git 通常自动合并；如冲突也是 trivial 的 import/新增行，5 分钟内解决。

---

## 验证

**单分支自测（各自 PR 前）：**
- `npm run dev` 走完整流程：开局配置 → BP → 站位 → 结算 → 下一局 → 大局结束。
- A：切换 BP 预设模板并自定义阶段/步数，确认 `startRound` 按新模板生成序列、`StageIndicator` 阶段数正确；改 `maxPlantUsage` 为 3，确认 pick 第 3 次仍可选、第 4 次禁用，`PlantSelector`/`UsedPlants` 显示 `/3`。
- B：改阵营名为「红方/蓝方」，确认所有显示点统一；切换 `initialMode=random` 开局自动分配、`loserPickMode=winner/keep` 败者结算页行为正确且**不卡在背景**（选边卡死回归）。
- 旧 localStorage 存档加载正常（深合并默认值）；`npm run test:quick` 通过；E2E 选择器若因文案变化失配需同步更新（参考历史 commit `cad2748`）。

**合并后整体验证：**
- 两人分支均基于 Phase 0 后的 main，合并顺序无关；合入后跑 `npm run test`（Playwright）与 `npm run test:multiplayer:headed`（多人同步：确认 `ruleConfig` 随 `stateUpdate` 正确同步到选手端）。
- 关键回归点：选边后不卡背景（commit `cea0c44` 修复项）、南瓜头特殊规则仍生效、多人 host 自动分配选边。

---

## 交付节奏

1. **Phase 0 骨架 PR** → review → 合入 main（半天，串行）。
2. A、B 同时从最新 main 拉分支，并行开发（互不阻塞，仅依赖 Phase 0 契约）。
3. 两个特性 PR 独立 review、合并；冲突预期极小。

# 待办事项（TODO）

> 最近更新：2026-07-22
> 集中记录尚未实现的功能、优化与重构。完成项请移至文末「已完成」或直接删除。
> 架构与契约细节以 `CLAUDE.md` 为准（如 `ruleConfig` 配置契约、动态 player-road 映射、多人 ws 协议）。

---

## 一、动效（长期推进）

> 动效优化散落于项目各处，需细水长流地逐步推进，**本节长期常驻 TODO**。
> 发掘到新的动效需求时，按「页面 / 组件」或「交互场景」追加为子项（编号沿用 1.x）。
> 完成项移至文末「已完成」（如 1.1 ban/pick 植物动画）。

（待发掘——发现新动效点后在此填充）

---

## 二、配置管理模块（架构重构）

> 整体实施规划见 [配置管理模块实施规划.md](配置管理模块实施规划.md)。
> §2.1（统一入口）与 §2.3（植物包预设）已落地，详见文末「已完成」。本节仅剩 §2.2 的遗留项。

### 2.2 SideRulesEditor 是否并入预设（遗留待决）
- **现状**：BP 流程/上限编辑器（`BPRulesEditor.vue`）已于 2026-07 迁入「配置管理」弹窗的比赛预设编辑器（见已完成 §2.2）；但**阵营名 / 选边方式编辑器（`SideRulesEditor.vue`）仍就地渲染于 `GameSetup.vue:185` 与 `RoomSetup.vue:242` 主页**，未纳入预设体系。
- **待决**：是否也把 `SideRulesEditor` 并入预设，让"阵营名 + 选边方式"也能存为多套预设并切换。倾向于**保留现状**——阵营名/选边是每局常调的轻量项，留在开房入口就地编辑更顺手；除非出现"多套阵营命名方案需要快速切换"的真实诉求，否则不迁。
- **注意**：无论是否迁移，底层数据仍走单一事实来源 `ruleConfig`（`sideNames` / `sideSelection`），存储 / 持久化 / 多人同步逻辑不变；`bpSequence` 模板仍保持 `road2`/`road4` 占位符。

---

## 三、BP 流程新功能

### 3.1 重置本小局
- **目标**：在 BP 进行中提供"重置当前小局"，清空本局 ban/pick 记录、回到本局起点（不改变大局比分与已结束小局）。
- **现状**：`gameStore.js` 仅有 `resetGame()`（整个 `$reset`，全量重置），**无**重置本小局的 action。
- **涉及**：`src/stores/gameStore.js`（新增 action）、`BanPickView` / `StageIndicator.vue`（按钮）。
- **注意**：与通用撤销（§3.2，已实现）区分——撤销回退单步，重置回退整局；重置会清空 `undoStack`。多人模式下需广播重置事件并校验权限（仅 host 可触发，走 `usePermission().canControlMatch`，详见已完成「按钮级权限管理」）。

### 3.3 空 ban（跳过 ban）
- **目标**：允许选手在 ban 步选择"空 ban"，消耗该 ban 步但不实际禁用任何植物。
- **涉及**：`src/utils/bpRules.js`、`src/utils/validators.js`、`src/components/PlantSelector.vue`（提供"空 ban"按钮）。
- **注意**：**仅 ban 步允许空 ban；pick 步暂不允许空 pick**（如后续需开放再议）；空 ban 的步进与 `bpSequence` 计数需保持一致；空 ban 也应作为一步压入 `undoStack`（可撤销）。

### 3.4 倒计时思考时间限制（可开关）
- **目标**：为每一步操作加入倒计时，**超时后自动从当前可选植物中随机 ban/pick 一个**；可在配置中开关并设置时长。
- **涉及**：`ruleConfig` 新增项（如 `timer: { enabled, secondsPerStep }`，遵循「新增配置项只改 `rules/` 子文件」契约 → 新建 `src/config/rules/timer.js`）、`gameStore.js`（随机选择逻辑复用 `availablePlants` / `canPick` / `canBan`）、倒计时 UI 组件。
- **注意**：随机候选范围须与该步可用植物一致（已 ban / 对手已 pick / 达上限者排除）；多人模式下须以服务器 / host 端时间为准，避免各端计时漂移与随机结果不一致（沿用 globalBan 的权威方抽取模式）。

---

## 四、游戏模式

### 4.1 巅峰对决（3:3 平局 tiebreaker）
- **目标**：大局比分 3:3 时进入巅峰对决决胜局，决出最终胜负。
- **现状**：**未实现**——`CLAUDE.md`「Not Yet Implemented」与 `README.md` 均标注，当前遇到 3:3 需手动处理。
- **涉及**：`src/stores/gameStore.js`（胜负判定 / 大局结束逻辑）、`src/components/GameVictory.vue`（或新增决胜页）、`winThreshold` 与决胜局规则配置（走 `ruleConfig` 契约）。

---

## 已完成

### 2.1 统一「配置管理」模块入口 ✅（2026-07）
- `src/components/PlantManager/index.vue` 为统一入口（Teleport 模态弹窗，标题「配置管理」），两 tab：「植物库」（`PlantLibrary mode="global"`，读写全局 IndexedDB）+「比赛预设」（`ConfigManager`）。
- 多套预设 + "当前选中"已落地：localStorage `bpPlantConfigs` 存预设列表与 `activeConfigId`；内置不可删的「默认预设」（`DEFAULT_CONFIG_ID='config_default'`，`ensureDefaultPreset` 注入并置顶）。
- 注：入口形态为**弹窗**（非独立路由页面），但达成 TODO「独立页面或抽屉」的集中入口目标；赛前改当前对局 BP 规则另走 GameSetup/RoomSetup 的「BP 规则」按钮 → 全局 `BPRulesDialog`。

### 2.2 BP 流程自定义迁移至配置管理模块 ✅（2026-07，BPRulesEditor 部分）
- `BPRulesEditor.vue`（BP 顺序模板 / 植物使用上限）已迁入「配置管理」弹窗的比赛预设编辑器，作为预设的「BP 流程」子 tab，可保存为多套预设并选其一。
- 遗留：`SideRulesEditor.vue`（阵营名 / 选边方式）按现行设计**保留在 GameSetup/RoomSetup 主页**就地编辑，未并入预设——见 §2.2（遗留待决）。

### 2.3 植物管理模块迁移至配置管理模块 ✅（2026-07）
- 植物包预设从 PlantManager 子组件提升到统一「配置管理」弹窗的「植物库」tab，与规则预设并列（`PlantLibrary mode="global"`）。
- 预设/存储逻辑：每套预设含 `{ plants, hiddenBuiltinPlants }`，加载时清空 IndexedDB 重写；植物库本体仍是 IndexedDB 单 store（`customPlants`），未按 pack 改库结构。
- 多人模式：host 仅广播当前选中植物包内容（复用 `customPlants` 消息），协议层无改动。

### 3.2 撤回上一步（通用撤销 / Undo Stack）✅（2026-07）
- BP 流程内所有用户操作（ban / pick / 南瓜 pick / 手动抽取永禁）统一可撤销：操作前快照压栈（上限 30）+ 撤销时整体 pop 恢复。
- 权限用 `lastActor` 模型（裁判随时可撤、选手可撤自己刚做的操作、观众不可撤）；仅当前小局可撤（`startRound` 清栈）。
- 撤销不触发自动步骤、不重新随机 → 多人安全（走标准 `syncState` 广播，无需权威方单点执行）。
- 回归测试：`src/stores/__tests__/gameStore.undo.spec.js`；详见 `CLAUDE.md`「通用撤销（Undo Stack）」。

### 按钮级权限管理（§4.1）✅（2026-07）
- 新增 `src/composables/usePermission.js` 收敛散落各处的权限判断（`roomMode==='local'||myRole==='host'` 等 11+ 处重复），提供语义化原语：`isAuthority` / `canBP` / `canSetPosition(player)` / `canControlMatch` / `canDrawGlobalBan` / `canManageConfig` / `canSelectSide` / `canUndo`。
- **权限矩阵**：local/host 为裁判权威（全能）；spectator 只读（`isViewOnly`，所有操作禁用）；player 受限——ban/pick 仅本人回合（`canBP`）、站位仅自己方（`canSetPosition`）、选路按 `loserPickMode` 归属者（`canSelectSide`）、撤销按 `lastActor` 模型（`canUndo`）；流程控制（完成小局/选胜者/下一局/重置）与配置编辑（仅赛前）归裁判。
- **双层防御**：UI 层按钮 `v-if`/`:disabled` 接 `usePermission`；裸奔 action（`finishRound`/`setRoundWinner`/`resetGame`/`applyNextRoundSideSelection`/`selectRoad`/`returnToPositioning`）与站位写操作（新增 `setPositionAt`/`clearPositionAt`/`movePosition`，收敛 `PositionSetup` 原直接改 state 的操作）内部加权限校验，无权返回 `{ ok:false, reason:'not-allowed' }`。
- 回归测试：`src/composables/__tests__/usePermission.spec.js`（权限矩阵）+ `src/stores/__tests__/gameStore.permissions.spec.js`（action 双层防御）。

### 1.1 ban/pick 植物动画优化 ✅（2026-07-19）
- 实现「选中弹跳 → 跨组件飞行 → 落定（BanArea 盖章 / PickArea 弹跳）→ 选择器禁用渐变 + 一闪色边」的完整动效弧线。
- 飞行用纯 DOM overlay + `getBoundingClientRect`（零依赖），强 ease-out 缓动（先快后慢、平稳停在目标）。
- 新增：`src/composables/usePlantFlight.js`、`src/components/animation/PlantFlightOverlay.vue`、`uiStore.flightState`、`animations.css` 的 `selectPulse`/`banFlash`/`pickFlash`/`banStamp`。
- 遵循 design-system「去发光去脉冲」；`prefers-reduced-motion` 自动降级；多人模式仅操作方本地飞行。
- 两个精致度微调点暂留（视需要再优化）：① 飞行克隆体尺寸未缩放到终点尺寸；② 真实项 enter 与克隆体淡出的衔接重影。

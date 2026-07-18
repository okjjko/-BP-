# 待办事项（TODO）

> 最近更新：2026-07-19
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

### 2.1 新增统一「配置管理」模块
- **目标**：新增一个集中入口（独立页面或抽屉），作为所有"开局前 / 赛间可配置"能力的**编辑与选择**入口；支持保存多套配置预设，并标记"当前选中"的那套。
- **涉及**：新增 `src/components/ConfigManager/`（或路由视图）、路由表、导航入口按钮；配置预设的持久化（localStorage / IndexedDB）。
- **注意**：开房间入口（`GameSetup.vue`）的流程配置项**保留不删**，改为读取配置模块中"当前选中"的配置（详见 §2.2）；底层数据仍走单一事实来源 `ruleConfig`（见 `CLAUDE.md`「ruleConfig 配置契约」）。

### 2.2 BP 流程自定义模块迁移至配置管理模块
- **现状**：BP 顺序模板 / 植物使用上限由 `src/components/BPRulesEditor.vue` 承担；阵营名 / 选边由 `SideRulesEditor.vue` 承担，入口都在 `GameSetup.vue`。
- **目标**：将 `BPRulesEditor.vue` 与 `SideRulesEditor.vue` 的**编辑能力**迁入配置管理模块，作为其下的「比赛规则」子区，可保存为多套预设并选其一。
- **注意（迁移方式有变）**：`GameSetup.vue` 开房间入口处的流程配置项**保留不删**，但不再就地独立编辑，改为**读取并展示配置模块中当前选中的配置**（可只读展示，或仅提供"切换选中预设"）；`ruleConfig` 存储 / 持久化 / 多人同步逻辑不变；`bpSequence` 模板仍保持 `road2`/`road4` 占位符。

### 2.3 植物管理模块迁移至配置管理模块
- **现状（预设层已实现）**：`src/data/plantConfigs.js` + `src/components/PlantManager/ConfigManager.vue` 已实现**多套"植物包"预设 + 当前选中**（localStorage `bpPlantConfigs` 存预设列表与 `activeConfigId`，每套含 `plants` + `hiddenBuiltinPlants`；加载时清空 IndexedDB 重写）。植物库本体仍是 IndexedDB 单 store（`customPlants`），无需按 pack 改库结构。
- **目标**：把植物包预设管理从 PlantManager 子组件提升到统一「配置管理模块」（§2.1），与 §2.2 规则预设并列；预设/存储逻辑保持不变。
- **注意**：多人模式下**只下发当前选中植物包的内容**（host 广播加载后的 `{ plants, hiddenBuiltinPlants }`，复用现有 `customPlants` 消息）——协议层无需改动。
- **详见**：[配置管理模块实施规划.md](配置管理模块实施规划.md)。

---

## 三、BP 流程新功能

### 3.1 重置本小局
- **目标**：在 BP 进行中提供"重置当前小局"，清空本局 ban/pick 记录、回到本局起点（不改变大局比分与已结束小局）。
- **涉及**：`src/stores/gameStore.js`（新增 action）、`BanPickView` / `StageIndicator.vue`（按钮）。
- **注意**：多人模式下需广播重置事件并校验权限（仅 host 可触发，权限见 §4.1）。

### 3.2 撤回上一步
- **目标**：撤销最近一次 ban/pick（含南瓜头特殊步的回退处理），回到上一步操作方。
- **涉及**：`src/stores/gameStore.js`（引入操作历史栈）、`src/utils/validators.js`、`src/components/PlantSelector.vue`。
- **注意**：需可追溯的操作历史；多人模式下需同步并防止并发冲突；与 §3.1 重置区分（撤回=回退一步，重置=回退整局）。

### 3.3 空 ban（跳过 ban）
- **目标**：允许选手在 ban 步选择"空 ban"，消耗该 ban 步但不实际禁用任何植物。
- **涉及**：`src/utils/bpRules.js`、`src/utils/validators.js`、`src/components/PlantSelector.vue`（提供"空 ban"按钮）。
- **注意**：**仅 ban 步允许空 ban；pick 步暂不允许空 pick**（如后续需开放再议）；空 ban 的步进与 `bpSequence` 计数需保持一致。

### 3.4 倒计时思考时间限制（可开关）
- **目标**：为每一步操作加入倒计时，**超时后自动从当前可选植物中随机 ban/pick 一个**；可在配置中开关并设置时长。
- **涉及**：`ruleConfig` 新增项（如 `timer: { enabled, secondsPerStep }`，遵循「新增配置项只改 `rules/` 子文件」契约）、`gameStore.js`（随机选择逻辑复用 `availablePlants` / `canPick` / `canBan`）、倒计时 UI 组件。
- **注意**：随机候选范围须与该步可用植物一致（已 ban / 对手已 pick / 达上限者排除）；多人模式下须以服务器 / host 端时间为准，避免各端计时漂移与随机结果不一致。

---

## 四、多人对战权限细化

### 4.1 按钮级权限管理（按身份）
- **目标**：按身份（host / player / spectator）统一控制按钮可用性：
  - **host**：全部权限（重置游戏、选择胜利方、重置本小局、广播开局等）。
  - **player**：仅本人回合内的操作（ban/pick、站位、败者/胜者选路等）。
  - **spectator**：只读，禁用绝大多数操作按钮。
- **涉及**：`src/stores/connectionStore.js`（`isMyTurn` / 身份 getter 已存在，需扩展为通用权限判断）、各操作按钮组件（建议抽 `usePermission` composable 统一封装 `:disabled` / `v-if`）。
- **关键受控按钮**：重置游戏、选择胜利方、重置本小局（§3.1）、撤回（§3.2）、广播开局、空 ban（§3.3）等。

---

## 已完成

### 1.1 ban/pick 植物动画优化 ✅（2026-07-19）
- 实现「选中弹跳 → 跨组件飞行 → 落定（BanArea 盖章 / PickArea 弹跳）→ 选择器禁用渐变 + 一闪色边」的完整动效弧线。
- 飞行用纯 DOM overlay + `getBoundingClientRect`（零依赖），强 ease-out 缓动（先快后慢、平稳停在目标）。
- 新增：`src/composables/usePlantFlight.js`、`src/components/animation/PlantFlightOverlay.vue`、`uiStore.flightState`、`animations.css` 的 `selectPulse`/`banFlash`/`pickFlash`/`banStamp`。
- 遵循 design-system「去发光去脉冲」；`prefers-reduced-motion` 自动降级；多人模式仅操作方本地飞行。
- 两个精致度微调点暂留（视需要再优化）：① 飞行克隆体尺寸未缩放到终点尺寸；② 真实项 enter 与克隆体淡出的衔接重影。

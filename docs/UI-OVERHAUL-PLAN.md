# UI/UX 大改版实施计划（专业克制向）

> 目标：把当前"霓虹游戏 UI"改造为"专业赛事 BP 工具"观感，同时修复可访问性与若干真实 bug。
> 方向基调：**去发光 / 去脉冲 / emoji→SVG / 统一设计系统 / 补齐 a11y**。
> 本文档供**多个 AI 窗口并行执行**使用：每个工作流（Stream）独占一组文件，互不冲突。

---

## 0. 执行总览

整个改版分三个阶段，**严格按顺序**：

```
Phase 0  基座（Foundation）  ── 串行，单人/单窗口 ── 必须最先合并
   │
   ▼  产出共享原语 + 设计令牌后，下面 8 条可全并行
Phase 1  组件迁移（Streams S1~S8）  ── 并行，每个窗口一组文件
   │
   ▼
Phase 2  集成与验证  ── 串行，单人 ── 合并 / 测试 / 一致性收尾
```

**为什么必须 Phase 0 先行**：所有组件迁移都依赖新的颜色令牌、字体、`BaseButton`/`BaseDialog`/`useToast`/图标库。基座没建好就并行，各窗口会各自造轮子并产生冲突。

---

## Phase 0 — 基座（串行 · 单窗口 · 最先合并）

> 负责人窗口代号：**F0**
> 原则：只做"基础设施"与"全局"，**不碰任何业务组件**（`components/*.vue`、`views/*.vue`）的内部逻辑/样式——那些留给 S1~S8。
> 验收：`npm run dev` 能跑；下方"共享契约"中列出的原语全部可用。

### F0 任务清单

| # | 文件 | 改动 |
|---|------|------|
| F0-1 | `tailwind.config.js` | ① 补齐缺失令牌：`pick-blue-dark`、`pick-red`（或统一改用 `ban-red` 表示红方，详见 F0-2）。② 统一色板到设计系统值（见下文"设计令牌"）。③ `theme.extend.fontFamily` 加 `sans: ['Inter', ...]`、`mono: ['Fira Code', ...]`。 |
| F0-2 | **配色语义统一** | 确立：`player1 = 蓝方(pick-blue)` / `player2 = 红方(ban-red)`。废弃 `pick-red`，红方一律用 `ban-red`。全仓 `grep` 确认无残留 `pick-red` / `pick-blue-dark` 未定义引用。 |
| F0-3 | `index.html` | `<head>` 加 Google Fonts：Inter（400/500/600/700/800）+ Fira Code（400/500/600/700）。加 `<link rel="preconnect">`。 |
| F0-4 | `src/style.css` | ① `body`/`#app` `font-family` 改为 `'Inter', 'Microsoft YaHei', ...`。② 收敛 `glass-panel`/`glass-card` 透明度与模糊（专业向：提高不透明度、降模糊，见下文"去发光标准"）。③ 保留并确保 `prefers-reduced-motion` 兜底（已在 `animations.css`，确认覆盖）。 |
| F0-5 | `src/components/ui/BaseButton.vue` | **新建**统一按钮。props：`variant: primary/secondary/danger/ghost`、`size: sm/md/lg`、`loading`、`icon`(slot)。统一圆角 `rounded-lg`、单层阴影、`focus-visible:ring-2 ring-offset-2`、`disabled` 态、`cursor-pointer`。 |
| F0-6 | `src/components/ui/BaseDialog.vue` | **新建**模态基座：`role="dialog" aria-modal`、**焦点陷阱**、**Esc 关闭**、打开时聚焦、关闭回焦、`<slot>`。供 RoundResult/GameVictory/PlantManager 复用。 |
| F0-7 | `src/composables/useToast.js` + `src/components/ui/ToastContainer.vue` | **新建**轻量 toast，替代 `alert()`。`useToast().error(msg)` / `.success()` / `.info()`。 |
| F0-8 | `src/composables/useConfirm.js` | **新建**确认弹窗（基于 BaseDialog），替代 `confirm()`。返回 Promise<boolean>。 |
| F0-9 | 图标库 | `npm i lucide-vue-next`。**约定**：所有图标一律用 lucide 线性图标，统一 `:size="20"`。 |
| F0-10 | `src/App.vue` | ① 加 `<a class="sr-only focus:not-sr-only ..." href="#main">跳到主内容</a>` skip-link。② `<main id="main">` 包裹 `<router-view>`。③ 背景降噪：去掉两个 `blur-[100px]` 浮动光球的 `animate-float`（改静态或移除），保留极淡渐变。 |
| F0-11 | `src/main.js` | 引入 toast 容器挂载（若用全局）或确认 Pinia/plugin 注册方式。 |
| F0-12 | `src/styles/design-system.md` | 与代码**同步**最终色板/字体/圆角/阴影规范（CLAUDE.md 强制要求文档同步）。 |
| F0-13 | `CLAUDE.md` | 在"Key Files & Responsibilities"补 `components/ui/` 原语说明。 |

### 设计令牌（F0 产出的最终值，所有人遵守）

```
色板（5 语义色 + 中性阶）
  蓝方/选择  pick-blue   #3B82F6   (neon #60A5FA 仅极弱点缀，不再大面积)
  红方/禁用  ban-red     #EF4444
  绿/确认    plant-green #22C55E
  金/胜利    仅结算页    #F59E0B
  中性       bg #0B1220 / 卡 slate-900 #111827 / 边 slate-700/600 / 文 slate-200 / 次文 slate-400
字体  UI: Inter   数字/比分/序号: Fira Code + tabular-nums
圆角  卡片 rounded-xl(12) · 按钮 rounded-lg(8) · 标签 rounded-md(6)
阴影  单层 0 4px 12px rgba(0,0,0,.3)；发光仅"当前操作"一处
动效  150–250ms 微交互；脉冲全场 ≤1 处；彩带/光球一次性（非 infinite）
图标  lucide-vue-next 线性图标，禁 emoji
身份色  player1=蓝方→pick-blue系 / player2=红方→ban-red系（整局稳定）；道路(2路/4路)仅作文字标签，不参与配色
阶段色  ban=红 / pick=蓝（动作语义，与选手身份正交的第三轴，保留）
```

### 去发光/去脉冲标准（F0 定，S1~S8 执行）

- `text-shadow-glow` / `drop-shadow-[0_0_*]` / `shadow-[0_0_*px_*]`：**默认删除**；仅"当前回合焦点"（StageIndicator 当前操作条）保留单一发光。
- `animate-pulse`：全场仅保留 StageIndicator 当前操作提示这一处；其余（BanArea 头部点、永久禁用点、同步态点、南瓜保护、进度条 shimmer）改静态。
- `animate-float`/`animate-ping`：背景装饰类移除；`animate-ping`（当前选手圆点）可保留 1 处或改静态。
- `infinite` 装饰动画（彩带）：改为一次性播放后停止。

---

## Phase 1 — 并行组件迁移（8 条工作流）

> 每条工作流一个 AI 窗口。**硬性规则**：只改本工作流列出的文件；只读消费 Phase 0 原语与令牌。
> 开始前：`git pull` / 基于已合并的 Phase 0 分支建分支。

### 工作流总览

| 工作流 | 独占文件 | 主题 | 依赖 F0 原语 |
|--------|----------|------|--------------|
| **S1 Shell** | `src/views/BanPickView.vue` | 主界面骨架、地标、底部按钮 emoji | BaseButton, Icon |
| **S2 Indicator** | `src/components/StageIndicator.vue` | 阶段/进度/当前操作、唯一保留的发光 | Icon |
| **S3 Selector** | `src/components/PlantSelector.vue` | 植物网格、ARIA、alert→toast、focus 环 | BaseButton, useToast, Icon |
| **S4 侧栏** | `BanArea.vue` `PickArea.vue` `UsedPlants.vue` | 禁用/阵容/历史面板、修 `pick-red` bug | Icon |
| **S5 选手/站位** | `PlayerInfo.vue` `PositionSetup.vue` | 选手卡、站位、比分布尔可访问性 | Icon |
| **S6 设置页** | `GameSetup.vue` `RoomSetup.vue` | 设置/房间、3 处 alert、选路 a11y | BaseButton, useConfirm, Icon |
| **S7 结算页** | `RoundResult.vue` `GameVictory.vue` | 结算/胜利、改 BaseDialog 焦点陷阱、彩带一次性 | BaseDialog, BaseButton, Icon |
| **S8 植物管理** | `src/components/PlantManager/*` | 模块内 14+ alert/confirm、焦点管理 | BaseDialog, useToast, useConfirm, Icon |

> 若窗口不足 8 个，建议合并：S1+S2、S5+S4、S6+RoomSetup 内的连接逻辑——但**不要合并到同一文件被两个窗口改**。

### 各工作流详细任务

#### S1 — Shell（BanPickView.vue）
- 底部三按钮：`⚔️完成本小局` `🌱植物管理` `↺重置游戏` → lucide `Swords` / `Sprout` / `RotateCcw` + `BaseButton`。
- `confirm('确定要重置游戏吗')` → `useConfirm()`。
- 容器根加语义（已被 App.vue 的 `<main>` 包裹，本文件无需再加，但确保无裸 `div` 滥用）。
- 头部信息栏 / 全局状态栏：去冗余发光，统一卡片圆角与边框。
- 永久禁用区两个 `animate-pulse` 圆点 → 静态。
- `min-h-0`/12 栅格保持响应式（验证 lg 与移动端）。
- **验收**：三按钮可键盘聚焦、有 focus 环；重置走应用内弹窗；无 emoji。

#### S2 — Indicator（StageIndicator.vue）
- 保留为**全场唯一发光焦点**：当前操作条可留单层 glow + 单处 pulse/ping。
- 进度条 `from-pick-blue-dark`（F0 已补令牌）→ 验证渐变正常；或按新令牌重写 `progressBarClass`。
- `getRoleIcon` 的 `👑/🎮/👀` → lucide `Crown` / `Gamepad2` / `Eye`。
- 同步状态 `⟳/⚠/✓` → lucide `RefreshCw`/`TriangleAlert`/`Check`（syncing 的 `⟳` 旋转改图标旋转）。
- `role="progressbar"` 已有，确认 `aria-valuenow/min/max` 正确；`stageClass` 文字对比度达标。
- **验收**：pick 阶段进度条不再透明渐变；角色/同步图标为 SVG；当前操作焦点清晰且唯一发光。

#### S3 — Selector（PlantSelector.vue）
- 标题 `🚫禁用阶段` `✅选择阶段` → lucide `Ban` / `CheckCircle`（颜色保留语义）。
- `alert('请先选择一个植物')` → `useToast().error()`。
- 网格 a11y 修正：`role="listbox"` 下子元素改 `role="option"` + `aria-selected`，或改 `role="grid"`；禁用项 `aria-disabled`。
- 每个植物按钮加 `focus-visible:ring-2`。
- 使用次数角标 `aria-hidden` 已有（保留）。
- hover `scale-110` 评估：若抖动则降为 `scale-105` + 仅边框高亮。
- **验收**：键盘可遍历选中、回车确认；focus 环可见；读屏能识别选中/禁用态；无 alert。

#### S4 — 侧栏（BanArea.vue / PickArea.vue / UsedPlants.vue）
- **修 bug**：`UsedPlants.vue:6` `bg-pick-red` → `bg-ban-red`（红方语义，参见 Contract「配色正典」）。
- BanArea 头部 `animate-pulse` 圆点 → 静态；hover 旋转装饰评估保留与否（专业向建议去 `rotate`）。
- PickArea：拖拽项无键盘替代 → 加 `aria-roledescription="可拖拽项"` + 提示文字；10 点指示器补 `aria-label`（`已选 N/10`）。
- 使用次数色（黄1/红2）+ 数字角标已有，确保**不仅靠颜色**（保留数字）。
- 重复植物序号提示评估可读性。
- **验收**：红方历史圆点正确着色；无脉冲；拖拽有 AT 提示。

#### S5 — 选手/站位（PlayerInfo.vue / PositionSetup.vue）
- **【配色正典·必做】PlayerInfo 头像/pip 改按选手身份色**（当前是全仓唯一按「道路」上色的异类，违反正典）：
  - 头像渐变（行 6-8）：删除 `isRoad2 ? from-blue-900… : from-purple-900…`，改为按 `props.player`：player1→`pick-blue` 系渐变、player2→`ban-red` 系渐变。
  - 分数 pip（行 31-32）：`isRoad2 ? bg-blue-400 : bg-purple-400` → 按 player：player1→`pick-blue` 系、player2→`ban-red` 系。
  - `roadText`（"2路"/"4路"）文字**保留**作信息显示，但不再驱动任何颜色。
  - 移除仅用于配色的 `isRoad2`（改后若无其它用途）。
  - 验证：player1 走 4 路时头像仍为蓝、分数 pip 仍为蓝。
- PlayerInfo 比分 pip 序列：补 `aria-label="X 比 N"`，pip 仅作视觉。
- 名字/路 `drop-shadow-md` 收敛。
- PositionSetup `confirm`（1 处）→ `useConfirm`；其行 10 竖条已是按选手（pick-blue/ban-red），保持，仅 `*-neon` 收敛为基色。
- 触控目标 ≥44px（站位格）。
- **验收**：头像/pip 按 player1=蓝/player2=红；比分可读屏读出；站位可键盘操作；无原生弹窗；**无 purple 用于选手身份**。

#### S6 — 设置页（GameSetup.vue / RoomSetup.vue）
- GameSetup 标题渐变文字评估（霓虹绿→霓虹蓝）：专业向建议降饱和为 `pick-blue`→`plant-green` 中性渐变或纯色。
- 3 处 `alert`（选手不足/请输入ID/请选路）→ `useToast`/`useConfirm`。
- `🌱植物管理` → `Sprout` 图标 + BaseButton。
- 装饰 SVG（右上播放图标）评估保留。
- 选路按钮 a11y：加 `aria-pressed`；触控目标≥44px。
- RoomSetup（需通读后补）：连接/心跳 UI、加入房间流程的 loading 态、公开房间列表 a11y。
- **验收**：无 alert；选路键盘可达；标题不刺眼；加入房间有 loading。

#### S7 — 结算页（RoundResult.vue / GameVictory.vue）
- 用 **BaseDialog** 重写外层，获得焦点陷阱/Esc/回焦。
- `🔵/🔴` → 纯色圆点（无 emoji）；`🏆` → lucide `Trophy`；`🔄` → `RefreshCw`。
- **【配色正典】RoundResult 败者选路按钮**（行 66-89，2 路/4 路选中态均 `bg-blue-600`）：改为败者身份色 `loser === 'player1' ? pick-blue 系 : ban-red 系`，不再按路上色、不用 purple。
- `confirm('确定要重新开始')` → `useConfirm`。
- GameVictory 彩带：`infinite` → **一次性播完停止**；金色光晕/光效收敛。
- 标题 `胜利!`/`VICTORY` 渐变评估降饱和。
- **验收**：对话框焦点受控、Esc 可关；彩带不无限跑；无 emoji/confirm。

#### S8 — 植物管理（PlantManager/*）
- 该模块 `alert/confirm` 最多（ConfigManager 14、ImportExport 10、index 15、PlantForm 7 等）→ 系统性替换为 `useToast`/`useConfirm`。
- 模态用 BaseDialog 重构，获得焦点管理。
- 表单 `<label for>` 已有，补 focus 环；图片上传反馈。
- 导入导出操作加 loading 态。
- **验收**：模块内 0 处原生 alert/confirm；模态焦点受控；导入导出有进度反馈。

---

## 共享契约（Contract）—— 防冲突的硬约束

> **每个 Phase 1 窗口开工前必须读这一节。**

### 你【可以】依赖（Phase 0 已交付，只读消费）
- 颜色令牌：`pick-blue`/`ban-red`/`plant-green`/`pick-blue-dark`/中性阶（见设计令牌）。
- `BaseButton`（`variant`/`size`/`loading`/`icon`）、`BaseDialog`（带焦点陷阱）。
- `useToast()`、`useConfirm()`。
- `lucide-vue-next` 图标。
- 字体：UI 用 Inter，数字用 `font-mono` + `tabular-nums`。
- 全局 `<main id="main">` + skip-link（App.vue 已加，**不要重复加**）。

### 你【绝对不能】改（否则与他人冲突）
- ❌ `tailwind.config.js`
- ❌ `src/style.css`、`src/styles/animations.css`
- ❌ `src/components/ui/*`、`src/composables/*`
- ❌ `src/App.vue`、`src/main.js`、`index.html`
- ❌ `src/styles/design-system.md`、`docs/UI-OVERHAUL-PLAN.md`
- ❌ 任何**不在你工作流文件清单里**的 `.vue` 文件

### 配色正典（所有 S 流必须遵守，违反即视为 bug）
- **身份轴（唯一）**：`player1 = 蓝方(pick-blue 系)` / `player2 = 红方(ban-red 系)`，整局稳定不变。
- **道路(2路/4路)**：仅作文字/标签显示，**禁止用颜色编码道路**（不得出现"2路=蓝、4路=紫"这类逻辑）。
- **ban/pick 阶段色（独立第三轴）**：`ban=红` / `pick=蓝`，用于「动作」指示（StageIndicator 当前操作条、BanArea/PickArea 标题等），与选手身份正交，保留。
- **禁止**把 purple 用作选手/道路身份色（`zombie-purple` 仅用于植物管理等非身份场景）。
- 参考异类修复点：`PlayerInfo.vue`（S5）、`RoundResult.vue` 选路按钮（S7）、`UsedPlants.vue:6` `pick-red`（S4）。

### 通用 Do / Don't
- ✅ emoji 一律换 lucide 图标
- ✅ 所有可交互元素加 `cursor-pointer` + `focus-visible:ring-2`
- ✅ 删除冗余 `text-shadow-glow` / `drop-shadow` / `shadow-glow`（除当前操作焦点）
- ✅ `animate-pulse` 仅在你被明确允许的那一处保留
- ❌ 不要新增颜色令牌；缺色找 F0（或改用现有令牌）
- ❌ 不要用 `alert()`/`confirm()`/`prompt()`

---

## Phase 2 — 集成与验证（串行 · 单窗口）

> 负责人窗口代号：**I2**。所有 S1~S8 合并后进行。

### 合并顺序
1. `F0` 分支先合并到主干。
2. S1~S8 各自基于 F0 的主干建分支 → 完成后依次合并（文件不重叠，冲突应极少；若 ui/* 接口有调整则回归测试）。
3. I2 在合并主干上做整体验证。

### 验证清单
- [ ] `npm run dev` 启动无报错、无控制台异常
- [ ] `npm run test:quick`（游戏初始化流程）通过
- [ ] `npm run test`（Playwright BP 流程）通过
- [ ] 全仓 `grep` 确认：无 `alert(`/`confirm(`/`prompt(`、无残留 emoji 图标、无 `pick-red`/未定义色类
- [ ] **对比度**：用浏览器 DevTools / axe 对每屏扫描，正文/标签 ≥4.5:1
- [ ] **键盘**：Tab 顺序合理、每屏 focus 环可见、对话框 Esc 关闭+焦点回跳
- [ ] **reduce-motion**：系统开启"减少动态效果"后，动画基本停止（确认 `animations.css` 兜底生效）
- [ ] **响应式**：375 / 768 / 1024 / 1440 四档无横向滚动、无遮挡
- [ ] 设计系统文档（`design-system.md`、`CLAUDE.md`）与代码一致

---

## 并行执行操作建议（Git 策略）

- 推荐用 **git worktree**，每个窗口一个工作目录，避免互相踩：
  ```bash
  # F0 完成、主干合并后，各窗口：
  git worktree add ../-BP--s1 -b ui-overhaul/s1-shell
  ```
- 分支命名：`ui-overhaul/foundation`、`ui-overhaul/s1-shell` … `ui-overhaul/s8-plantmgr`、`ui-overhaul/integration`。
- 每个 PR 描述里写明"改了哪些文件、替换了哪些 emoji/alert"，便于 I2 核对契约。

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| F0 令牌命名与 S 流预期不符 | F0 合并后**冻结**令牌；S 流只读消费，缺色提 issue 给 F0，不私改 config |
| 某窗口误改了他文件 | I2 合并时 `git diff` 检查文件清单是否越界，越界部分退回 |
| 去 glow 后视觉过于平淡 | S2 保留唯一焦点发光；I2 阶段按需微调，不回退全局霓虹 |
| 改动大、回归风险 | 每个 S 流独立分支 + Playwright 测试兜底；问题可单独 revert 单流 |

---

## 附录：emoji → lucide 图标对照

| emoji | 位置 | lucide |
|-------|------|--------|
| 🚫 | 禁用阶段 | `Ban` / `XOctagon` |
| ✅ | 选择阶段 | `CheckCircle` / `Check` |
| ⚔️ | 完成本小局 | `Swords` |
| 🌱 | 植物管理 | `Sprout` |
| ↺ / 🔄 | 重置/重新开始 | `RotateCcw` / `RefreshCw` |
| 👑 / 🎮 / 👂 | 角色 主办/选手/观众 | `Crown` / `Gamepad2` / `Eye` |
| 🏆 | 胜利 | `Trophy` |
| 🔵 / 🔴 | 蓝方/红方标记 | 纯色圆点（不用图标） |
| ⟳ / ⚠ / ✓ | 同步中/失败/已同步 | `RefreshCw` / `TriangleAlert` / `Check` |

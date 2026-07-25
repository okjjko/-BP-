# BP 界面手机端适配优化 — Code Agent 任务提示词

## 背景与目标

当前 BP（Ban/Pick）界面的响应式布局对手机用户（≤375px 宽度，如 iPhone X/SE）体验极差。桌面端采用三栏 grid 布局，手机端退化为纵向堆叠，但各区域**未针对窄屏重新设计信息密度和排列方式**，导致：

1. 首屏看不到任何可选植物（被头部信息区完全占满）
2. BanArea 的 5 列占位符在手机上水平溢出或被压缩到无法辨认
3. 两位玩家的 PickArea 纵向堆叠后，每项都有拖拽手柄/序号/描述等冗余信息，占据大量纵向空间
4. 永久禁用栏、两位玩家的 UsedPlants、BanArea、PlayerInfo、StageIndicator、RulesSummary 全部堆叠在植物选择器上方，需要滚动很长才能看到核心操作区
5. PlantSelector 的 3 列网格 + 底部 选中预览栏 + 顶部标题/确认按钮 占据空间不够高效

**目标：** 重新设计手机端（<768px，即 `md:` 断点以下）的 BP 界面布局，让用户在**不滚动或极少滚动**的情况下即可完成 Ban/Pick 操作。桌面端布局保持不变。

---

## 当前布局结构（BanPickView.vue）

手机端当前的元素纵向顺序（通过 CSS `order-1/2/3/4` 控制）：

### order-1：头部信息面板（glass-panel）
- 一行水平 flex：`[PlayerInfo + BanArea(player1)] [StageIndicator] [BanArea(player2) + PlayerInfo]`
- 下方：`RulesSummary`（已很紧凑，无需改动）
- **问题：**
  - BanArea 在手机上是 `grid-cols-5` 固定网格，每个 slot `w-10 h-10`（40px），5 个 slot + gap = ~230px，加上 PlayerInfo（~160px），一行需要 ~390px，超出 375px
  - 两位玩家的 PlayerInfo + BanArea 各占一侧，加上中间 StageIndicator，三列水平排列在手机上极其拥挤
  - 整个头部面板在手机上高度可能超过 200px（BanArea 含占位符 + PlayerInfo + StageIndicator）

### order-2：全局状态栏（永久禁用 + 已使用植物）
- 水平 flex：`[UsedPlants(p1)] [永久禁用区] [UsedPlants(p2)]`
- **问题：**
  - 三个区域水平排列，手机上严重压缩
  - UsedPlants 用 flex-wrap 的 tag 列表，内容多时高度不可预测
  - 永久禁用区用 40px 图标 + gap-2 的 flex-wrap

### order-3：主体操作区
- 纵向：`[PickArea(player1)] [PlantSelector] [PickArea(player2)]`
- **问题：**
  - 两个 PickArea 纵向堆叠，每个有标题 + 拖拽列表 + 底部状态，空状态时也占 ~100px
  - PlantSelector 被 PickArea 夹在中间，可见空间被严重挤压
  - PlantSelector 自身有：标题行(含确认按钮) + 3列网格 + 底部选中预览栏(64px)

### order-4：底部控制栏
- flex-wrap 的多个 BaseButton
- **问题：** 在手机上按钮换行后占据较多空间

---

## 优化方案（逐区域详细要求）

### 总体原则
- **手机端断点：`md:`（768px）以下触发手机布局，`md:` 以上保持当前桌面布局不变**
- **核心操作优先：** 植物选择器应尽可能靠近首屏，减少滚动
- **信息折叠：** 非核心信息（历史使用、规则摘要、完整 BanArea 占位符）在手机端折叠或精简
- **触摸友好：** 植物卡片最小点击区域 44x44px
- **所有改动仅影响手机端（<768px），桌面端完全不受影响**

### 1. 头部信息面板（order-1）— 大幅精简

**当前：** 三列水平 flex（PlayerInfo+BanArea | StageIndicator | BanArea+PlayerInfo）+ RulesSummary
**改为：**

#### 1.1 顶部状态条 — 紧凑单行
将 PlayerInfo 精简为一个小胶囊（只显示：道路图标 + 名字 + 分数条），两位玩家左右对称排列，中间放置阶段指示器的核心信息（阶段名 + 当前操作条）。

```
[🔵P1名字 1-3-0] [Stage2 选择 王小明 选] [🔴P2名字 0-0-4]
```

- PlayerInfo 手机端：去掉外层的 glass-panel 圆角胶囊样式，改为**极简行内元素**：一个小的道路圆形图标（`w-7 h-7`）+ 名字（`text-sm font-bold`）+ 紧凑得分条（保留现有的 score dots）。整个 PlayerInfo 在手机端变为 `inline-flex` 而非当前的块级元素。
- 两位玩家之间放置：阶段名（`text-sm`）+ 当前操作胶囊（PlayerName + Ban/Pick），来自 StageIndicator 的核心信息。
- **BanArea 从头部完全移除**，移到新的位置（见 1.2）

实现方式：在 BanPickView.vue 的手机端头部，用 `md:hidden` 写一个专门的紧凑布局，同时用 `hidden md:flex` 保留当前桌面布局。

#### 1.2 BanArea — 手机端折叠为紧凑行
- BanArea 组件在手机端不再使用 `grid-cols-5` 占位符（占位符在手机上浪费空间且无意义）
- 改为：**只显示已禁用的植物**，用水平滚动的紧凑行（`flex gap-1 overflow-x-auto`），每个已禁植物 `w-8 h-8`（32px）
- 标题简化为：`"已禁(3)"` 而非当前的 `"PlayerName 禁用"` 大字标题
- **手机端 BanArea 放在顶部状态条的下方**，两位玩家的禁用区可以合并为一行或紧凑的两行
- 位置：作为头部面板的一部分，紧跟在玩家信息行下方

### 2. 全局状态栏（order-2）— 折叠/精简

**当前：** 三列水平 flex（UsedPlants(p1) | 永久禁用 | UsedPlants(p2)）
**改为：**

- **永久禁用区保留**但精简：图标从 `w-10 h-10`（40px）缩小到 `w-7 h-7`（28px），gap 从 `gap-2` 缩小到 `gap-1`，水平排列允许换行但尽量紧凑
- **UsedPlants（历史使用）在手机端完全隐藏**，移到一个可展开的面板中（点击「查看历史」小按钮展开），或者直接隐藏（历史使用信息不是操作时的核心需求）
  - 推荐方案：手机端隐藏 UsedPlants，在底部控制栏加一个小的「历史」按钮，点击弹出 BaseDialog 展示完整的 UsedPlants 信息

### 3. 主体操作区（order-3）— 核心改造

这是最重要的改动。当前 PlantSelector 被 PickArea 夹在中间，手机端可见空间极小。

**改为：PlantSelector 置顶，PickArea 折叠到底部**

#### 3.1 PlantSelector — 手机端优化
- **手机端网格改为 4 列**（从 3 列改为 4 列，更充分利用 375px 宽度，每列约 85px 减去 gap 后约 75px，满足 44px 最小触摸区域）
- **去掉内层 padding：** 手机端 `p-5` 改为 `p-2`，减少浪费
- **标题行精简：** "禁用阶段" / "选择阶段" 标题和确认按钮合并为一行，但手机端确认按钮可以更紧凑（`size="sm"` 或自定义小按钮）
- **底部选中预览栏精简：** 当前高度 `h-16`（64px）+ `p-2`，在手机端改为**行内紧凑条**（高度 ~48px），只显示植物小图 + 名字 + 使用次数，去掉描述文字
- **植物卡片上的名称：** 当前在底部 gradient overlay 中用 `text-[10px]`，手机端可略微增大到 `text-[11px]`
- **使用次数角标：** 保持不变

#### 3.2 PickArea — 手机端折叠为底部抽屉/紧凑条
- **手机端 PickArea 不再显示完整的拖拽列表**
- 改为**紧凑的水平植物条**：类似 BanArea，只显示已选植物的图标 + 名字首字，水平排列，`w-9 h-9`（36px），允许 flex-wrap
- 底部状态栏的「已选:N」和 10 个 dot 指示器保留但更紧凑
- 拖拽功能在手机端可以**禁用**（手机端拖拽体验本身不好），改为点击选中后自动添加（或者保留拖拽但不在手机端显示拖拽视觉提示）
- **两位玩家的 PickArea 在手机端合并显示**为两个紧凑行（标题用颜色区分），而非两个完整的面板

### 4. 阶段指示器（StageIndicator）— 手机端拆分

- StageIndicator 在桌面端是一个完整的面板，在手机端**不需要独立面板**
- 其核心信息（阶段名 + 当前操作条 + 进度条）已经融入顶部状态条（见 1.1）
- **进度条**可以放在顶部状态条下方作为一个细条（`h-1.5`），或者放在植物选择器上方
- **南瓜保护提示**保持弹出式，位置不变
- 多人模式的角色徽章、回合提示、同步状态在手机端可以精简为顶部状态条内的小图标

### 5. 底部控制栏（order-4）— 紧凑化

- 按钮在手机端使用 `size="sm"` 而非 `size="lg"`
- 「配置管理」和「重置游戏」在手机端可以收纳到一个「更多」菜单（三点图标）中，减少底部按钮数量
- 保留「抽取永禁」和「撤销」为直接可见按钮（操作时常用）

### 6. RulesSummary — 保持不变
- 已经是紧凑的单行胶囊设计，flex-wrap 行为合理，无需改动

---

## 需要修改的文件

1. **`src/views/BanPickView.vue`** — 主要改动文件
   - 头部面板：新增 `md:hidden` 的紧凑手机布局
   - 全局状态栏：手机端隐藏 UsedPlants
   - 主体区域：调整手机端的 order 和布局方式
   - 底部控制栏：手机端精简

2. **`src/components/PlayerInfo.vue`** — 新增手机端紧凑形态
   - 添加 `md:hidden` 的内联紧凑版本（小图标 + 名字 + 分数 dots）

3. **`src/components/BanArea.vue`** — 手机端布局改造
   - 手机端：去掉 5 列占位符网格，改为只显示已禁植物的紧凑 flex 行
   - 标题简化

4. **`src/components/PickArea.vue`** — 手机端大幅精简
   - 手机端：禁用拖拽列表，改为紧凑的已选植物图标行
   - 底部状态保留但精简

5. **`src/components/StageIndicator.vue`** — 可能不需要改动
   - 其核心信息由 BanPickView 的手机端紧凑头部直接展示
   - StageIndicator 在手机端可以 `md:hidden` 隐藏，或者精简为只显示进度条

6. **`src/components/UsedPlants.vue`** — 无需改动组件本身
   - 在 BanPickView 中手机端隐藏即可

7. **`src/components/PlantSelector.vue`** — 手机端微调
   - 手机端 padding 缩小
   - 底部预览栏精简
   - 可选：手机端网格从 3 列改为 4 列（当前已经是 `grid-cols-3 sm:grid-cols-5`，可改为 `grid-cols-4 sm:grid-cols-5`）

---

## 技术约束

- **仅使用 Tailwind CSS 响应式类**：`md:` 前缀作为断点（768px），`md:hidden` / `hidden md:block` / `md:flex` / `flex-col md:flex-row` 等
- **不引入新的 CSS 框架或 JS 库**
- **不改变任何业务逻辑**：store、事件处理、数据流保持不变
- **不改变桌面端布局**：所有改动用 `md:` 断点守卫，`md:` 以上保持原样
- **保持动画效果**：`animate-slide-up`、`plant-select-pulse`、`plant-ban-flash` 等动画保留
- **保持 ARIA 无障碍属性**
- **保持植物飞行动画（PlantFlightOverlay）的锚点元素**：BanArea 的 `[data-ban-slot]` 和 PickArea 的 `[data-pick-slot]` 必须保留，但可以在手机端用零尺寸定位

---

## 验证标准

优化完成后，在 iPhone X 视口（375×812）下应满足：

1. ✅ 首屏（不滚动）可以看到：两位玩家信息 + 当前阶段/操作 + 进度条 + 至少 8 个可选植物（2 行×4 列）
2. ✅ BanArea 和 PickArea 不会把 PlantSelector 推到屏幕外
3. ✅ 选中一个植物后，确认按钮在首屏可见
4. ✅ 已禁用植物列表不会溢出屏幕
5. ✅ 底部操作按钮（撤销、抽取永禁等）在首屏底部可见或在一次小幅度滚动内可见
6. ✅ 所有植物卡片的触摸区域 ≥ 44×44px
7. ✅ 桌面端（≥768px）布局与改动前完全一致

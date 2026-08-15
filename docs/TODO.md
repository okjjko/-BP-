# 待办事项（TODO）

> 最近更新：2026-08-16
> 集中记录尚未实现的功能、优化与重构。完成项移至文末「已完成」或直接删除。
> 架构与契约细节以 `AGENTS.md` 为准（如 `ruleConfig` 配置契约、动态 player-road 映射、多人 ws 协议）。

---

## 一、动效（长期推进）

> 动效优化散落于项目各处，需细水长流地逐步推进，**本节长期常驻 TODO**。
> 发掘到新的动效需求时，按「页面 / 组件」或「交互场景」追加为子项（编号沿用 1.x）。

（待发掘——发现新动效点后在此填充）

---

## 二、重构与工程

### 2.1 拆分 RoomSetup.vue（约 1500 行）
- **现状**：创建/加入/重连/lobby/host 面板/选手面板集中一个组件。
- **目标**：按「host 面板 / 选手加入 / 重连流程 / lobby 集成」拆分。
- **注意**：`performReconnect` 深度耦合组件 refs（12+ 个），需先抽 `useRoomReconnect` composable（refs 参数化）或事件总线化，再拆模板；单测先行。

### 2.2 gameStore 瘦身（约 1000 行）
- **已完成**：迁移函数抽至 `utils/legacyMigrations.js`。
- **剩余**：撤销栈逻辑（`_pushUndoSnapshot`/`_buildUndoSnapshot`/`undoLastAction`/`_describeUndone`）可抽 `utils/undoStack.js`；持久化四函数（save/load/sync）可抽 `utils/gameStorePersistence.js`（注意保持 ruleConfig 整体存取契约不动）。

### 2.3 E2E 进一步去时序化
- **已完成**：断言改内容级（植物 id 集合对比）、修 strict violation / 失效日志断言 / 回合判定 / 双版本指示器误判、playwright.config 提至仓库根（不再扫 worktree 副本）。
- **剩余**：spec 内仍有约 30 处固定 `waitForTimeout`，可渐进替换为 `waitFor` 条件等待。

---

## 三、功能候选

### 3.1 消息完整性（多人）
- **现状**：版本号去重只能丢弃乱序/重复消息，检测不到丢失。
- **候选**：host 周期性全量 `syncState` 作隐式纠错（实现简单，代价是状态全量重发的带宽）。

### 3.2 巅峰对决（3:3 tiebreaker）
- 用户已拍板暂不做（`isGrandFinal` 保留不触发，遇此情况手动处理）。

### 3.3 站位规则校验补全
- `validatePosition` 的「副C/大C」校验、`validatePumpkin` 摆阵校验（当前恒真）。
- 用户已拍板暂不做；需要时先收集具体规则定义。

---

## 已完成

### 2026-08
- **空 ban（§3.3）**：`skipBanStep`——ban 步可跳过（仅回合方、可撤销），PlantSelector「跳过禁用」按钮。
- **重置本小局（§3.1）**：`resetCurrentRound`——仅裁判，清本局保留比分/历史使用/已抽永久禁用，ConfirmDialog 二次确认。
- **每步思考倒计时（§3.4）**：`ruleConfig.timer`（默认关）——权威方单点定时器，超时从可选池（排除南瓜）随机 ban/pick；`stepStartedAt` 随状态同步、其余端纯显示。
- **撤回上一步（§3.2）**：通用撤销栈（快照压栈 + `lastActor` 权限模型），早已实现，归档。
- **按钮级权限统一（§4.1）**：`composables/usePermission.js`（isReferee/isActor/isViewer/canUndo）。
- **配置管理模块（§2，核对）**：PlantManager 弹窗双 tab（植物库 + 比赛预设）、多套预设、默认预设、BPRulesDialog 全局规则编辑——规划的核心能力均已落地，原 §2 条目归档。

### 2026-07
- **1.1 ban/pick 植物动画**：飞行 overlay + 落定动效（详见 git 历史）。

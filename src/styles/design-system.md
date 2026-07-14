# BP Battle Tool - Design System

## Color Palette

### Primary Colors（与 tailwind.config.js 同步）
- **plant-green**: #22c55e (植物绿 - 确认/主要操作)
- **plant-green-dark**: #15803d (悬停加深)
- **ban-red**: #ef4444 (红方/禁用操作)
- **ban-red-dark**: #b91c1c (悬停加深)
- **pick-blue**: #3b82f6 (蓝方/选择操作)
- **pick-blue-dark**: #1e40af (悬停加深 / 渐变起点)
- **pick-red**: ❌ 已废弃，红方一律使用 `ban-red`

### Neon 强调色（仅作极弱点缀，不大面积使用）
- plant-green-neon #00ff41 / ban-red-neon #ff1744 / pick-blue-neon #00e5ff
- 规则：发光/shadow-glow 仅用于"当前操作"单一焦点；文本主色用基色而非 neon

### Semantic Colors
- **Success**: #10b981 (胜利确认)
- **Warning**: #f59e0b (警告提示)
- **Error**: #dc2626 (错误禁用)
- **Info**: #3b82f6 (信息提示)

### Status Colors
- **Used 1x**: #eab308 (黄色 - 使用1次)
- **Used 2x**: #ef4444 (红色 - 使用2次，已达上限)
- **Available**: #22c55e (绿色 - 可用)

### Neutral Colors (Dark Theme)
- **bg-primary**: #111827 (深灰背景)
- **bg-secondary**: #1f2937 (次要背景)
- **bg-tertiary**: #374151 (卡片背景)
- **border-light**: #4b5563 (边框)
- **text-primary**: #f9fafb (主要文字)
- **text-secondary**: #d1d5db (次要文字)
- **text-muted**: #9ca3af (禁用文字)

## Typography

### Font Family
- **UI 文本**: `Inter`（中文回退 微软雅黑）— `font-sans`
- **数字 / 比分 / 序号**: `Fira Code` + `tabular-nums` — `font-mono`
- 来源：`index.html` 引入 Google Fonts（含 preconnect）

### Font Sizes
- **Hero**: 2rem (32px) - 页面标题
- **H1**: 1.875rem (30px) - 组件标题
- **H2**: 1.5rem (24px) - 子标题
- **H3**: 1.25rem (20px) - 小标题
- **Body**: 1rem (16px) - 正文
- **Small**: 0.875rem (14px) - 辅助信息
- **XS**: 0.75rem (12px) - 标签

### Font Weights
- **Bold**: 700 - 标题、强调
- **Semibold**: 600 - 次要标题
- **Normal**: 400 - 正文
- **Light**: 300 - 辅助说明

## Spacing Scale
- **xs**: 0.5rem (8px)
- **sm**: 0.75rem (12px)
- **md**: 1rem (16px)
- **lg**: 1.5rem (24px)
- **xl**: 2rem (32px)
- **2xl**: 3rem (48px)

## Border Radius（与 tailwind.config.js / F0 令牌同步）
- **md**: 0.375rem (6px) - 标签 `rounded-md`
- **lg**: 0.5rem (8px) - 按钮 `rounded-lg`（BaseButton）
- **xl**: 0.75rem (12px) - 卡片/面板 `rounded-xl`（glass-panel、网格容器、StageIndicator/BanArea/PickArea 等）
- **2xl**: 1rem (16px) - 大卡片 `rounded-2xl`（GameSetup 外层等）

## Shadows
- **sm**: 0 1px 2px 0 rgb(0 0 0 / 0.05)
- **md**: 0 4px 6px -1px rgb(0 0 0 / 0.1)
- **lg**: 0 10px 15px -3px rgb(0 0 0 / 0.1)
- **xl**: 0 20px 25px -5px rgb(0 0 0 / 0.1)
- **glow**: 0 0 20px rgba(34, 197, 94, 0.3)

## Z-Index Scale
- **10**: Dropdowns, tooltips
- **20**: Modals, overlays
- **30**: Fixed headers
- **40**: Notifications
- **50**: Maximum (modals on modals)

## Component-Specific Styles

### StageIndicator
- 渐变背景
- 进度条显示
- 大字体当前步骤显示
- 脉冲动画高亮当前选手

### PlantSelector
- 卡片式植物项
- Hover 缩放效果 (scale-105)
- 选中光环效果 (ring-4)
- 禁用态灰度 + 模糊

### BanArea / PickArea
- 统一卡片样式
- 禁用植物红框
- 选择植物蓝框
- 使用次数标签颜色编码

### Buttons
- 主要操作：大尺寸 + 阴影
- 次要操作：中尺寸
- 禁用：降低不透明度 + cursor-not-allowed
- 点击反馈：transform: scale(95)

## 视觉规范（专业克制向）

> 改版方向：从"霓虹游戏 UI"收敛为"专业赛事 BP 工具"。详见 `docs/UI-OVERHAUL-PLAN.md`。

### 去发光
- 默认删除 `text-shadow-glow` / `drop-shadow-[0_0_*]` / `shadow-[0_0_*px]`
- 发光仅保留"当前操作"焦点一处（StageIndicator 当前回合条）

### 去脉冲
- `animate-pulse` 全场 ≤1 处；装饰圆点一律改静态
- `animate-float` / `animate-ping` 背景装饰移除（App.vue 已改静态）

### 图标
- 全部使用 `lucide-vue-next` 线性图标，**禁用 emoji 作 UI 图标**

### 反馈
- 禁用 `alert()` / `confirm()`，统一使用 `useToast()` / `useConfirm()`
- 模态基于 `BaseDialog`：焦点陷阱 + Esc + 回焦

### 共享原语（`src/components/ui/`）
- `BaseButton`：variant=primary/blue/danger/secondary/ghost，size=sm/md/lg，loading
- `BaseDialog`：modelValue(v-model) + 焦点陷阱 + Esc/backdrop 关闭
- `ToastContainer` + `useToast()`：success/error/warning/info（替代 alert）
- `ConfirmDialog` + `useConfirm()`：返回 `Promise<boolean>`（替代 confirm）

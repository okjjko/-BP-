# BP Battle Tool - Design System

## Color Palette

### Primary Colors
- **plant-green**: #22c55e (植物绿 - 主要操作)
- **ban-red**: #ef4444 (禁用红 - 禁用操作)
- **pick-blue**: #3b82f6 (选择蓝 - 选择操作)

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

## Border Radius
- **sm**: 0.25rem (4px) - 小标签
- **md**: 0.5rem (8px) - 卡片
- **lg**: 0.75rem (12px) - 按钮
- **xl**: 1rem (16px) - 大卡片

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

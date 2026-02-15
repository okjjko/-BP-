# Agent测试系统 - 快速参考指南

## 🚀 快速开始

### 1️⃣ 安装依赖（首次使用）

```bash
npm install
npx playwright install
```

### 2️⃣ 启动开发服务器

```bash
npm run dev
```

### 3️⃣ 运行测试

```bash
# 运行完整测试（推荐）
npm run test:agents

# 快速测试（仅游戏初始化）
npm run test:quick

# 直接运行Playwright测试
npm run test
```

## 📋 命令速查表

| 命令 | 说明 | 使用场景 |
|------|------|----------|
| `npm run test:agents` | 运行完整agent测试 | 修改代码后全面测试 |
| `npm run test:quick` | 快速测试核心功能 | 快速验证基本功能 |
| `npm run test` | Playwright测试 | 仅运行自动化测试 |
| `npm run test:headed` | 有头模式测试 | 调试测试脚本 |
| `npm run test:debug` | 调试模式测试 | 逐步调试测试 |

## 🤖 与Agent对话

### 测试员Agent

```
请帮我测试游戏初始化功能，重点关注：
1. 道路选择互斥逻辑
2. 开始游戏按钮状态
3. 玩家信息显示
```

### 错误分析师Agent

```
请分析以下问题：

问题描述：道路选择互斥失效
重现步骤：
1. 玩家1选择2路
2. 玩家2仍可选择2路

请分析根本原因并提供修复建议。
```

## 📝 手动创建测试报告

创建文件 `agents/manual-test-report.json`:

```json
{
  "testId": "MANUAL-001",
  "timestamp": "2026-02-15T10:30:00Z",
  "testType": "manual",
  "testSuite": "game-initialization",
  "results": {
    "passed": 0,
    "failed": 1,
    "skipped": 0
  },
  "issues": [
    {
      "issueId": "ISSUE-001",
      "severity": "critical",
      "title": "简短的问题标题",
      "description": "详细描述问题现象",
      "steps": ["步骤1", "步骤2", "步骤3"],
      "affectedFiles": ["src/components/GameSetup.vue"]
    }
  ]
}
```

然后运行：
```bash
node agents/test-coordinator.js --input agents/manual-test-report.json
```

## 📂 目录结构

```
agents/
├── README.md                    # 详细使用指南
├── QUICKSTART.md                # 本文件（快速参考）
├── tester-agent.md             # 测试员agent配置
├── error-analyst-agent.md      # 错误分析师agent配置
├── test-coordinator.js         # 测试协调器
├── tests/                      # 测试脚本
│   ├── playwright.config.js    # Playwright配置
│   └── example.spec.js         # 示例测试
├── test-reports/               # 测试报告（自动生成）
├── error-reports/              # 错误分析报告（自动生成）
└── screenshots/                # 测试截图（自动生成）
```

## 🎯 常见使用场景

### 场景A：修改代码后测试

```bash
# 1. 修改代码
# 2. 等待热重载完成
# 3. 运行测试
npm run test:agents

# 4. 如果发现问题，查看报告
#    - agents/test-reports/TEST-xxx.json
#    - agents/error-reports/ERROR-xxx.md
```

### 场景B：特定功能测试

```bash
# 测试游戏初始化
node agents/test-coordinator.js --suite game-init

# 测试BP流程
node agents/test-coordinator.js --suite bp-flow

# 测试植物管理
node agents/test-coordinator.js --suite plant-management
```

### 场景C：手动发现问题

```bash
# 1. 创建manual-test-report.json
# 2. 运行分析
node agents/test-coordinator.js --input agents/manual-test-report.json

# 3. 查看错误分析报告
#    agents/error-reports/ERROR-xxx.md
```

## 🔍 测试报告说明

### 测试报告（JSON格式）

位置：`agents/test-reports/TEST-xxx.json`

```json
{
  "testId": "TEST-xxx",
  "timestamp": "2026-02-15T10:30:00Z",
  "results": {
    "passed": 15,
    "failed": 2,
    "skipped": 1
  },
  "issues": [...]
}
```

### 错误分析报告（Markdown格式）

位置：`agents/error-reports/ERROR-xxx.md`

包含：
- 问题描述
- 重现步骤
- 根本原因分析
- 代码位置
- 修复建议
- 验证步骤

## ⚠️ 注意事项

1. **确保开发服务器运行**：`npm run dev` 必须在运行
2. **等待热重载完成**：修改代码后等待Vite完成重载
3. **查看最新报告**：报告按时间戳命名，查看最新的
4. **清理缓存**：遇到奇怪问题时清理浏览器缓存

## 🆘 获取帮助

```bash
# 查看协调器帮助
node agents/test-coordinator.js --help

# 查看Playwright帮助
npx playwright test --help
```

## 💡 提示

- 第一次使用会下载Chromium浏览器，需要等待几分钟
- 测试失败时会自动截图，方便调试
- 可以同时运行多个测试套件
- 报告可以分享给团队其他成员

## 📚 更多信息

详细文档请参考：[agents/README.md](agents/README.md)

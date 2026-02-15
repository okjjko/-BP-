# Agent测试系统使用指南

这是一个为BP图形化工具设计的自动化测试和错误分析系统。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    测试协调器                              │
│              (test-coordinator.js)                       │
└─────────────────┬───────────────────────────────────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│  测试员 Agent   │  │ 错误分析师 Agent  │
│ (tester-agent)  │  │(error-analyst)   │
└─────────────────┘  └──────────────────┘
         │                 │
         ▼                 ▼
    执行Playwright      生成错误报告
    自动化测试          和修复建议
         │                 │
         └────────┬────────┘
                  ▼
           测试报告 + 错误分析报告
```

## 快速开始

### 1. 安装依赖

首先需要安装Playwright用于自动化测试：

```bash
npm install --save-dev playwright @playwright/test
npx playwright install
```

### 2. 启动开发服务器

在一个终端窗口启动开发服务器：

```bash
npm run dev
```

### 3. 运行测试

在另一个终端窗口运行测试协调器：

```bash
# 基础用法
node agents/test-coordinator.js

# 指定测试类型
node agents/test-coordinator.js --type automated

# 指定测试套件
node agents/test-coordinator.js --suite game-init

# 组合使用
node agents/test-coordinator.js --type automated --suite bp-flow
```

## 使用方式

### 方式1：完整自动化（推荐用于核心功能）

适用于测试游戏初始化、BP流程等可以通过Playwright自动化的功能。

```bash
# 运行完整的自动化测试
node agents/test-coordinator.js --type automated --suite all
```

测试协调器会：
1. 启动Playwright浏览器
2. 执行测试脚本
3. 收集错误和日志
4. 生成测试报告
5. 自动调用错误分析师agent
6. 生成错误分析报告

### 方式2：混合模式（推荐用于全面测试）

适用于包含复杂交互的场景，如拖拽功能、UI体验等。

```bash
# 运行混合模式测试
node agents/test-coordinator.js --type mixed
```

测试协调器会：
1. 先运行自动化测试
2. 生成人工测试清单
3. 等待人工测试完成
4. 收集所有测试结果
5. 分析并生成报告

### 方式3：手动模式（仅生成测试清单）

适用于只想获取测试指导的情况。

```bash
# 生成测试清单
node agents/test-coordinator.js --type manual
```

## Agent工作流程

### 测试员Agent工作流程

```
1. 环境准备
   ├─ 检查开发服务器状态
   ├─ 确认热重载完成
   └─ 清空浏览器缓存

2. 自动化测试
   ├─ 启动Playwright
   ├─ 执行核心功能测试
   ├─ 截图和日志收集
   └─ 生成初步测试报告

3. 人工测试指导
   ├─ 生成测试步骤清单
   ├─ 提供反馈表单
   └─ 收集人工测试结果

4. 结果汇总
   ├─ 合并测试结果
   ├─ 标记问题严重程度
   └─ 传递给错误分析师
```

### 错误分析师Agent工作流程

```
1. 接收测试报告
   └─ 从测试员获取测试结果

2. 信息收集
   ├─ 提取错误信息
   ├─ 读取相关代码
   └─ 分析最近变更

3. 根因分析
   ├─ 5个为什么方法
   ├─ 定位问题代码
   └─ 评估影响范围

4. 生成报告
   ├─ 详细错误描述
   ├─ 重现步骤
   ├─ 修复建议
   └─ 验证步骤
```

## 测试报告位置

所有报告保存在以下目录：

```
agents/
├── test-reports/          # 测试报告（JSON格式）
│   └── TEST-xxx.json
└── error-reports/         # 错误分析报告（Markdown格式）
    └── ERROR-xxx.md
```

## 手动描述错误给错误分析师

如果你在测试过程中手动发现了问题，可以创建一个测试报告并让错误分析师分析：

### 1. 创建测试报告

创建 `agents/manual-test-report.json`:

```json
{
  "testId": "MANUAL-TEST-001",
  "timestamp": "2026-02-15T10:30:00Z",
  "testType": "manual",
  "testSuite": "game-initialization",
  "modifiedFiles": ["src/components/GameSetup.vue"],
  "results": {
    "passed": 0,
    "failed": 1,
    "skipped": 0
  },
  "issues": [
    {
      "issueId": "MANUAL-ISSUE-001",
      "severity": "critical",
      "title": "道路选择互斥失效",
      "description": "当玩家1选择2路后，玩家2仍可选择2路，导致两个玩家都选中了相同的道路",
      "steps": [
        "打开应用",
        "玩家1点击2路按钮",
        "玩家2点击2路按钮",
        "观察到两个玩家都选中了2路"
      ],
      "screenshots": [],
      "consoleErrors": [],
      "affectedFiles": ["src/components/GameSetup.vue"],
      "additionalNotes": "预期玩家2的2路按钮应该被禁用"
    }
  ]
}
```

### 2. 运行错误分析

```bash
node agents/test-coordinator.js --input agents/manual-test-report.json
```

### 3. 查看错误报告

错误分析师会生成详细的Markdown报告，包含：
- 根本原因分析
- 具体的代码位置
- 修复建议和代码示例
- 验证步骤

## 在Claude Code中使用

### 与测试员Agent对话

```
请帮我运行测试员agent，测试刚刚修改的游戏初始化功能。
重点关注：道路选择互斥逻辑是否正常工作。
```

### 与错误分析师Agent对话

```
请扮演错误分析师agent，分析以下测试报告：

[粘贴测试报告内容]

要求：
1. 分析根本原因
2. 定位具体的代码位置
3. 提供修复建议
4. 给出验证步骤
```

### 完整工作流示例

```
你：我刚刚修改了GameSetup.vue的道路选择逻辑，
    请帮我测试一下。

Claude：好的，我会启动测试员agent来测试这个功能。

[运行测试...]

Claude：测试员发现了一个问题：
- 道路选择互斥逻辑没有生效
- 两个玩家可以选择相同的道路

你：请让错误分析师分析这个问题。

Claude：正在调用错误分析师agent...

[分析代码...]

Claude：错误分析完成：

根本原因：isRoadSelectedByOther函数没有正确判断其他玩家的选择状态。

代码位置：src/components/GameSetup.vue:45-50

修复建议：[提供具体的代码修改方案]

验证步骤：[列出验证步骤]

你：按照建议修复了代码，请再次测试。

Claude：好的，再次运行测试...

[测试通过]

Claude：✅ 问题已修复！所有测试通过。
```

## 常见使用场景

### 场景1：修改代码后测试

```bash
# 1. 修改代码
# 2. 等待热重载完成
# 3. 运行测试
node agents/test-coordinator.js --suite all
```

### 场景2：特定功能测试

```bash
# 只测试BP流程
node agents/test-coordinator.js --suite bp-flow
```

### 场景3：发现Bug后分析

```bash
# 1. 创建manual-test-report.json
# 2. 运行分析
node agents/test-coordinator.js --input agents/manual-test-report.json
```

## 自定义测试脚本

你可以创建自定义的Playwright测试脚本：

创建 `agents/tests/custom-test.js`:

```javascript
import { test, expect } from '@playwright/test';

test('自定义测试示例', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // 添加你的测试逻辑
  await page.fill('#player1-input', 'Player A');
  await page.click('button:has-text("2路")');

  // 验证结果
  const buttonDisabled = await page.isDisabled('button:has-text("2路")');
  expect(buttonDisabled).toBeTruthy();
});
```

## 注意事项

1. **开发服务器必须运行**：测试前确保 `npm run dev` 正在运行
2. **热重载完成**：修改代码后等待Vite热重载完成再运行测试
3. **清理缓存**：如果遇到奇怪的问题，尝试清理浏览器缓存
4. **截图保存**：测试失败时会自动截图，保存在 `agents/screenshots/` 目录

## 进阶使用

### 集成到Git工作流

创建 `package.json` 脚本：

```json
{
  "scripts": {
    "test:agents": "node agents/test-coordinator.js --suite all",
    "test:quick": "node agents/test-coordinator.js --suite game-init",
    "pre-commit": "node agents/test-coordinator.js --type automated"
  }
}
```

### 与CI/CD集成

可以在GitHub Actions或其他CI系统中运行：

```yaml
- name: 运行Agent测试
  run: |
    npm run dev &
    sleep 10
    npm run test:agents
```

## 获取帮助

```bash
node agents/test-coordinator.js --help
```

## 反馈和改进

如果你有任何改进建议或发现问题，请告诉我！

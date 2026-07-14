/**
 * Playwright测试示例
 * 用于测试BP图形化工具的核心功能
 *
 * 运行：npx playwright test agents/tests/example.spec.js
 */

import { test, expect } from '@playwright/test';
import { selectLocalMode, initGame } from '../helpers/test-helpers.js';

// 测试配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('游戏初始化测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // 清空localStorage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // 选择本地对战模式
    await selectLocalMode(page);
  });

  test('应该能够输入两个玩家ID', async ({ page }) => {
    // 输入玩家1的ID
    await page.fill('#player1-input', '玩家A');

    // 输入玩家2的ID
    await page.fill('#player2-input', '玩家B');

    // 验证输入成功
    const player1Value = await page.inputValue('#player1-input');
    const player2Value = await page.inputValue('#player2-input');

    expect(player1Value).toBe('玩家A');
    expect(player2Value).toBe('玩家B');
  });

  test('道路选择应该互斥', async ({ page }) => {
    // 新版选路按钮在输入选手 ID 后才出现（v-if="playerName"）
    await page.fill('#player1-input', '玩家A');
    await page.fill('#player2-input', '玩家B');
    await page.waitForTimeout(300);

    // 玩家1选择2路
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();

    // 等待状态更新
    await page.waitForTimeout(100);

    // 检查玩家2的2路按钮是否禁用
    await expect(road2Buttons[1]).toBeDisabled();

    // 截图
    await page.screenshot({ path: 'agents/screenshots/road-selection-mutex.png' });
  });

  test('应该能够切换道路选择', async ({ page }) => {
    // 新版选路按钮在输入选手 ID 后才出现
    await page.fill('#player1-input', '玩家A');
    await page.waitForTimeout(300);

    // 玩家1选择2路
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(100);

    // 玩家1再次点击2路，应该取消选择
    await road2Buttons[0].click();
    await page.waitForTimeout(100);

    // 验证2路按钮不再被选中
    const isSelected = await road2Buttons[0].getAttribute('class');
    expect(isSelected).not.toContain('bg-pick-blue');
  });

  test('选择道路后应该能够开始游戏', async ({ page }) => {
    // 输入玩家ID
    await page.fill('#player1-input', '玩家A');
    await page.fill('#player2-input', '玩家B');

    // 选择道路
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    const road4Buttons = await page.locator('button:has-text("4路")').all();
    await road2Buttons[0].click();
    await road4Buttons[1].click();

    // 点击开始对战
    await page.click('button[type="submit"]:has-text("开始对战")');

    // 等待页面跳转
    await page.waitForTimeout(1000);

    // 验证进入游戏页面（StageIndicator 根元素）
    await expect(page.locator('[role="region"][aria-label="当前游戏阶段"]')).toBeVisible();
  });
});

test.describe('BP流程测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // 使用辅助函数快速初始化游戏
    await initGame(page, {
      player1: '玩家A',
      player2: '玩家B',
      player1Road: 2,
      player2Road: 4
    });
  });

  test('Stage 1应该从二路选手开始禁用', async ({ page }) => {
    // 等待BP页面加载（StageIndicator 根元素）
    const stageRegion = page.locator('[role="region"][aria-label="当前游戏阶段"]');
    await stageRegion.waitFor();

    // 检查当前阶段显示与操作玩家（整段文本）
    // stageName="阶段一：禁用"；currentPlayerName 显示选手 ID（player1=二路=先手）
    const stageText = await stageRegion.textContent();
    expect(stageText).toContain('阶段一');
    expect(stageText).toContain('玩家A');
  });

  test('应该能够禁用植物', async ({ page }) => {
    // 等待植物选择器加载（PlantSelector 网格）
    await page.waitForSelector('div[role="listbox"] button');

    // 点击第一个植物进行禁用
    await page.click('div[role="listbox"] button >> nth=0');
    await page.waitForTimeout(200);

    // 新版需点击"确认禁用"按钮完成禁用
    await page.locator('button:has-text("确认")').first().click();
    await page.waitForTimeout(300);

    // 验证植物被禁用（BanArea 根元素为 role=region，禁用项内含 img）
    const bannedCount = await page.locator('[role="region"][aria-label$="禁用的植物"] img').count();
    expect(bannedCount).toBeGreaterThan(0);

    // 截图
    await page.screenshot({ path: 'agents/screenshots/ban-plant.png' });
  });

  test('不能选择对手已选的植物', async ({ page }) => {
    // 这个测试需要完成Stage 1，进入Stage 2
    // 由于需要多步操作，这里只是示例框架

    // TODO: 完成Stage 1的4个禁用
    // TODO: 进入Stage 2
    // TODO: 尝试选择对手已选植物
    // TODO: 验证选择失败
  });
});

test.describe('状态持久化测试', () => {
  test('刷新页面后应该恢复状态', async ({ page }) => {
    // 该测试无 beforeEach 导航，需先打开页面
    await page.goto(BASE_URL);
    // 使用辅助函数初始化游戏
    await initGame(page);

    // 执行一些BP操作
    await page.click('div[role="listbox"] button >> nth=0');
    await page.waitForTimeout(200);
    // 新版需点击"确认禁用"按钮完成禁用
    await page.locator('button:has-text("确认")').first().click();
    await page.waitForTimeout(300);

    // 刷新页面
    await page.reload();

    // 验证状态恢复
    await page.waitForSelector('[role="region"][aria-label="当前游戏阶段"]');
    const bannedCount = await page.locator('[role="region"][aria-label$="禁用的植物"] img').count();
    expect(bannedCount).toBeGreaterThan(0);
  });
});

test.describe('自定义植物管理测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await selectLocalMode(page);
  });

  test('应该能够打开植物管理界面', async ({ page }) => {
    // 点击植物管理按钮
    await page.click('button:has-text("植物管理")');

    // 验证植物管理界面打开（PlantManager 基于 BaseDialog，role=dialog）
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('应该能够添加自定义植物', async ({ page }) => {
    // 打开植物管理
    await page.click('button:has-text("植物管理")');

    // 点击新建植物按钮
    await page.click('button:has-text("新建植物")');

    // 填写植物信息
    await page.fill('#plant-name', '测试植物');
    await page.fill('#plant-desc', '这是一个测试植物');

    // 上传图片（这里需要实际的图片文件）
    // await page.setInputFiles('#plant-image', 'test-image.png');

    // 点击保存
    // await page.click('button:has-text("保存")');

    // 验证植物添加成功
    // await expect(page.locator('.plant-item:has-text("测试植物")')).toBeVisible();
  });
});

test.describe('错误捕获测试', () => {
  test('应该捕获并记录控制台错误', async ({ page }) => {
    const errors = [];

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await selectLocalMode(page);

    // 执行一些操作
    await page.fill('#player1-input', '玩家A');
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();

    // 等待一下，让JavaScript错误有机会发生
    await page.waitForTimeout(1000);

    // 如果有错误，记录到报告
    if (errors.length > 0) {
      console.log('发现控制台错误:', errors);
      // 这些错误会被包含在测试报告中
    }
  });
});

/**
 * 生成测试报告的辅助函数
 */
async function generateTestReport(page, testInfo) {
  return {
    testId: `TEST-${Date.now()}`,
    timestamp: new Date().toISOString(),
    testType: 'automated',
    testSuite: testInfo.title,
    results: {
      passed: testInfo.ok ? 1 : 0,
      failed: testInfo.ok ? 0 : 1,
      skipped: 0
    },
    issues: testInfo.ok ? [] : [{
      issueId: `ISSUE-${Date.now()}`,
      severity: 'major',
      title: testInfo.title,
      description: testInfo.error?.message || '测试失败',
      steps: [],
      screenshots: [testInfo.attachments.map(a => a.path)],
      consoleErrors: [],
      affectedFiles: []
    }]
  };
}

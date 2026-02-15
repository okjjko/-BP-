/**
 * 基础功能测试
 * 基于实际DOM结构
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('基础功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
  });

  test('页面应该能够正常加载', async ({ page }) => {
    // 检查标题
    const title = await page.textContent('h1');
    expect(title).toContain('PvZ B/P 对战');

    // 截图
    await page.screenshot({ path: 'agents/screenshots/01-page-loaded.png' });
  });

  test('应该能够输入玩家ID', async ({ page }) => {
    // 输入玩家1
    await page.fill('#player1-input', '测试玩家A');
    const player1Value = await page.inputValue('#player1-input');
    expect(player1Value).toBe('测试玩家A');

    // 等待玩家2输入框出现
    await page.waitForSelector('#player2-input', { timeout: 3000 });

    // 输入玩家2
    await page.fill('#player2-input', '测试玩家B');
    const player2Value = await page.inputValue('#player2-input');
    expect(player2Value).toBe('测试玩家B');

    await page.screenshot({ path: 'agents/screenshots/02-player-names-entered.png' });
  });

  test('应该能够选择道路', async ({ page }) => {
    // 输入玩家名称
    await page.fill('#player1-input', '玩家A');
    await page.waitForTimeout(500);
    await page.fill('#player2-input', '玩家B');
    await page.waitForTimeout(500);

    // 玩家1选择2路（点击第一个"2路"按钮）
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(200);

    // 验证玩家1的2路按钮被选中（检查class）
    const player1Road2Class = await road2Buttons[0].getAttribute('class');
    expect(player1Road2Class).toContain('bg-pick-blue');

    // 玩家2选择4路
    const road4Buttons = await page.locator('button:has-text("4路")').all();
    await road4Buttons[1].click();
    await page.waitForTimeout(200);

    // 验证玩家2的4路按钮被选中（玩家2使用红色主题）
    const player2Road4Class = await road4Buttons[1].getAttribute('class');
    expect(player2Road4Class).toContain('bg-ban-red');

    await page.screenshot({ path: 'agents/screenshots/03-roads-selected.png' });
  });

  test('道路选择应该互斥', async ({ page }) => {
    // 输入玩家名称
    await page.fill('#player1-input', '玩家A');
    await page.waitForTimeout(500);
    await page.fill('#player2-input', '玩家B');
    await page.waitForTimeout(500);

    // 玩家1选择2路
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(200);

    // 检查玩家2的2路按钮是否被禁用
    const isDisabled = await road2Buttons[1].isDisabled();
    expect(isDisabled).toBeTruthy();

    // 检查禁用按钮的样式
    const player2Road2Class = await road2Buttons[1].getAttribute('class');
    expect(player2Road2Class).toContain('cursor-not-allowed');

    await page.screenshot({ path: 'agents/screenshots/04-road-mutex.png' });
  });

  test('应该能够取消道路选择', async ({ page }) => {
    // 输入玩家名称
    await page.fill('#player1-input', '玩家A');
    await page.waitForTimeout(500);

    // 玩家1选择2路
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(200);

    // 再次点击取消选择
    await road2Buttons[0].click();
    await page.waitForTimeout(200);

    // 验证取消后样式改变
    const player1Road2Class = await road2Buttons[0].getAttribute('class');
    expect(player1Road2Class).not.toContain('bg-pick-blue');

    await page.screenshot({ path: 'agents/screenshots/05-road-toggle.png' });
  });

  test('选择道路后应该能够开始游戏', async ({ page }) => {
    // 输入玩家名称并选择道路
    await page.fill('#player1-input', '玩家A');
    await page.waitForTimeout(500);
    await page.fill('#player2-input', '玩家B');
    await page.waitForTimeout(500);

    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(200);

    const road4Buttons = await page.locator('button:has-text("4路")').all();
    await road4Buttons[1].click();
    await page.waitForTimeout(200);

    // 点击开始对战按钮
    await page.click('button[type="submit"]:has-text("开始对战")');

    // 等待页面变化或路由变化
    await page.waitForTimeout(1000);

    // 检查是否有全局禁用提示或游戏开始
    const globalBanText = await page.textContent('body');
    console.log('页面内容:', globalBanText.substring(0, 200));

    await page.screenshot({ path: 'agents/screenshots/06-game-started.png' });
  });

  test('应该能够捕获控制台错误', async ({ page }) => {
    const errors = [];

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 执行一些操作
    await page.fill('#player1-input', '测试玩家');
    await page.waitForTimeout(500);

    // 点击各种按钮
    const road2Buttons = await page.locator('button:has-text("2路")').all();
    await road2Buttons[0].click();
    await page.waitForTimeout(500);

    // 检查是否有错误
    if (errors.length > 0) {
      console.log('发现控制台错误:', errors);
      throw new Error(`发现 ${errors.length} 个控制台错误: ${errors.join(', ')}`);
    }
  });
});

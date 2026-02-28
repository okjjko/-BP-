/**
 * 公共测试辅助函数
 * 用于处理RoomSetup和应用初始化流程
 */

import { expect } from '@playwright/test';

/**
 * 选择本地对战模式
 * 等待RoomSetup显示 → 点击"本地对战" → 等待GameSetup显示
 *
 * @param {Page} page - Playwright页面对象
 */
export async function selectLocalMode(page) {
  // 等待RoomSetup显示
  await page.waitForSelector('.mode-selection', { timeout: 5000 });

  // 点击"本地对战"按钮
  await page.click('button:has-text("🏠 本地对战")');

  // 等待GameSetup显示
  await page.waitForSelector('#player1-input', { timeout: 3000 });

  // 验证进入本地模式
  const player1Input = page.locator('#player1-input');
  await expect(player1Input).toBeVisible();
}

/**
 * 快速初始化游戏（用于需要进入BP阶段的测试）
 * 自动选择本地对战 → 输入玩家 → 选择道路 → 开始游戏 → 等待BP阶段
 *
 * @param {Page} page - Playwright页面对象
 * @param {Object} options - 配置选项
 * @param {string} options.player1 - 玩家1名称，默认'玩家A'
 * @param {string} options.player2 - 玩家2名称，默认'玩家B'
 * @param {number} options.player1Road - 玩家1道路，默认2
 * @param {number} options.player2Road - 玩家2道路，默认4
 */
export async function initGame(page, options = {}) {
  const {
    player1 = '玩家A',
    player2 = '玩家B',
    player1Road = 2,
    player2Road = 4
  } = options;

  // 选择本地对战模式
  await selectLocalMode(page);

  // 输入玩家1
  await page.fill('#player1-input', player1);
  await page.waitForTimeout(300);

  // 输入玩家2
  await page.fill('#player2-input', player2);
  await page.waitForTimeout(300);

  // 选择道路
  const road2Buttons = await page.locator('button:has-text("2路")').all();
  const road4Buttons = await page.locator('button:has-text("4路")').all();

  if (player1Road === 2) {
    await road2Buttons[0].click();
  } else {
    await road4Buttons[0].click();
  }
  await page.waitForTimeout(200);

  if (player2Road === 4) {
    await road4Buttons[1].click();
  } else {
    await road2Buttons[1].click();
  }
  await page.waitForTimeout(200);

  // 点击开始对战
  await page.click('button[type="submit"]:has-text("开始对战")');

  // 等待Vue状态更新和组件渲染
  await page.waitForTimeout(1500);

  // 等待进入BP阶段 - 使用正确的选择器
  // StageIndicator 组件的根元素有 role="region" 和 aria-label="当前游戏阶段"
  await page.waitForSelector('[role="region"][aria-label="当前游戏阶段"]', { timeout: 10000 });

  console.log('✅ 成功进入BP阶段');
}

/**
 * 等待并验证阶段指示器
 *
 * @param {Page} page - Playwright页面对象
 * @param {string} expectedStage - 期望的阶段文本
 */
export async function waitForStage(page, expectedStage) {
  await page.waitForSelector('[role="region"][aria-label="当前游戏阶段"]', { timeout: 5000 });

  const stageIndicator = page.locator('[role="region"][aria-label="当前游戏阶段"]');
  const stageText = await stageIndicator.textContent();
  expect(stageText).toContain(expectedStage);
}

/**
 * 选择一个植物（用于BP阶段测试）
 *
 * @param {Page} page - Playwright页面对象
 * @param {number} index - 植物索引（从0开始）
 */
export async function selectPlant(page, index = 0) {
  // 等待植物选择器显示 - PlantSelector 在 v-if="gameStatus === 'banning'" 时显示
  await page.waitForSelector('div[role="listbox"] button', { timeout: 5000 });

  // 获取所有植物卡片
  const plantCards = await page.locator('div[role="listbox"] button').all();

  console.log(`🌱 总共 ${plantCards.length} 个植物可选，选择第 ${index + 1} 个`);

  // 点击指定植物
  await plantCards[index].click();
  await page.waitForTimeout(500);

  // 确认选择
  const confirmButton = page.locator('button:has-text("确认选择"), button:has-text("确认")').first();
  if (await confirmButton.isVisible({ timeout: 1000 })) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
    console.log('✅ 植物选择已确认');
  } else {
    console.log('⚠️ 未找到确认按钮，可能已自动确认');
  }
}

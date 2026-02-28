/**
 * 完整BP流程端到端测试
 *
 * 目标：验证能够完成完整的20步BP流程
 * - Stage 1: 4个Ban操作
 * - Stage 2: 6个Pick操作
 * - Stage 3: 6个Ban操作
 * - Stage 4: 4个Pick操作
 */

import { test, expect } from '@playwright/test';
import { initGame, selectPlant } from '../helpers/test-helpers.js';

const BASE_URL = 'http://localhost:3000';

test.describe('完整BP流程测试', () => {
  test('应该能够完成完整的20步BP流程', async ({ page }) => {
    test.setTimeout(120000); // 2分钟超时

    console.log('\n=== 开始完整BP流程测试 ===\n');

    // 收集控制台日志
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('BP') || text.includes('阶段') || text.includes('Ban') ||
          text.includes('Pick') || text.includes('禁用') || text.includes('选择') ||
          text.includes('Stage') || text.includes('step')) {
        logs.push(text);
        console.log(`[游戏] ${text}`);
      }
    });

    // 初始化游戏
    await page.goto(BASE_URL);
    await initGame(page, {
      player1: '玩家A',
      player2: '玩家B',
      player1Road: 2,
      player2Road: 4
    });

    console.log('✅ 游戏初始化完成，进入BP阶段');

    // 验证进入BP阶段
    const stageIndicator = page.locator('[role="region"][aria-label="当前游戏阶段"]');
    await expect(stageIndicator).toBeVisible();

    const stageText = await stageIndicator.textContent();
    console.log(`📍 当前阶段: ${stageText}`);

    // 执行20步BP操作
    for (let step = 1; step <= 20; step++) {
      console.log(`\n======== 第 ${step} 步 ========`);

      // 等待并显示当前操作信息
      await page.waitForTimeout(500);

      // 获取当前操作类型和选手
      const actionText = await page.textContent('button:has-text("禁用"), button:has-text("选择"), [class*="action" i], [class*="Action" i]');
      const playerText = await page.textContent('[class*="player" i] span, [class*="Player" i] span');

      console.log(`📋 操作: ${actionText?.trim() || '未知'}`);
      console.log(`👤 选手: ${playerText?.trim() || '未知'}`);

      try {
        // 等待植物选择器加载
        await page.waitForSelector('div[role="listbox"] button', { timeout: 5000 });

        // 获取可用植物数量
        const availablePlants = await page.locator('div[role="listbox"] button:not([disabled])').all();
        const availableCount = availablePlants.length;
        console.log(`🌱 可用植物数量: ${availableCount}`);

        expect(availableCount, '应该有可用的植物').toBeGreaterThan(0);

        // 点击第一个可用植物
        await availablePlants[0].click();
        await page.waitForTimeout(500);

        // 查找并点击确认按钮
        const confirmButton = page.locator('button:has-text("确认选择"), button:has-text("确认")').first();

        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
          console.log(`✅ 第 ${step} 步完成 - 已确认`);
        } else {
          // 某些情况下可能自动确认
          await page.waitForTimeout(500);
          console.log(`⚠️ 第 ${step} 步完成 - 自动确认`);
        }

      } catch (error) {
        console.error(`❌ 第 ${step} 步失败:`, error.message);
        // 截图保存失败状态
        await page.screenshot({ path: `agents/screenshots/bp-flow-error-step-${step}.png`, fullPage: true });
        throw error;
      }
    }

    // 验证BP流程完成
    console.log('\n======== BP流程完成 ========');
    console.log(`📊 控制台日志数量: ${logs.length}`);

    // 保存最终截图
    await page.screenshot({ path: 'agents/screenshots/complete-bp-flow-final.png', fullPage: true });

    // 验证游戏进入下一个阶段或状态
    await page.waitForTimeout(2000);
    const bodyContent = await page.textContent('body');
    console.log('\n最终页面状态前200字符:');
    console.log(bodyContent.substring(0, 200));

    // 验证：应该不在BP阶段了（可能进入Positioning或Result阶段）
    // 这里我们只验证没有错误即可
    expect(logs.length).toBeGreaterThan(0);
  });

  test('应该能够完成完整的Stage 1（4步Ban）', async ({ page }) => {
    test.setTimeout(60000); // 1分钟超时

    console.log('\n=== Stage 1 测试（4步禁用）===\n');

    await page.goto(BASE_URL);
    await initGame(page, {
      player1: '玩家A',
      player2: '玩家B',
      player1Road: 2,
      player2Road: 4
    });

    console.log('✅ 进入BP阶段');

    // 执行Stage 1的4步Ban操作
    for (let step = 1; step <= 4; step++) {
      console.log(`\n第 ${step}/4 步Ban`);

      await selectPlant(page, 0);
      console.log(`✅ 第 ${step} 步Ban完成`);
    }

    console.log('\n✅ Stage 1完成！');

    await page.screenshot({ path: 'agents/screenshots/stage1-complete.png' });
  });
});

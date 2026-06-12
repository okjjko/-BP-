/**
 * 南瓜头逻辑测试
 *
 * 规则：
 * - 选南瓜不消耗 BP 步骤，获得 1 次额外选择（被保护的植物）
 * - 可连续选多个南瓜，remaining 累加
 * - 每名玩家大局最多用 2 次（跨小分累计）
 * - 同一小分中一方用了，对手不可选
 *
 * 测试用例：
 * - TC1: 连续选 2 次南瓜 + 选 2 个被保护植物（均应成功）
 * - TC2: 选手 A 选了南瓜后，选手 B 不可选（本轮互斥）
 * - TC3: 小分 1 用南瓜，小分 2 还能再用（跨小分累计 2 次）
 * - TC4: 已用 2 次南瓜，第 3 次不可选（达到上限）
 */

import { test, expect } from '@playwright/test';
import { initGame, selectLocalMode } from '../helpers/test-helpers.js';

const BASE_URL = 'http://localhost:3000';

/**
 * 等待 $debugStore 挂载完成
 */
async function waitForDebugStore(page) {
  await page.waitForFunction(() => !!window.$debugStore, { timeout: 10000 });
}

/**
 * 通过植物名称选择指定植物并确认
 */
async function selectPlantByName(page, plantName) {
  await page.waitForSelector('div[role="listbox"] button', { timeout: 5000 });

  const plantButton = page.locator(`div[role="listbox"] button:has-text("${plantName}")`).first();
  await expect(plantButton).toBeVisible({ timeout: 3000 });
  await plantButton.click();
  await page.waitForTimeout(300);

  const confirmButton = page.locator('button:has-text("确认禁用"), button:has-text("确认选择"), button:has-text("确认")').first();
  await expect(confirmButton).toBeVisible({ timeout: 2000 });
  await confirmButton.click();
  await page.waitForTimeout(800);
}

/**
 * 选择列表中的第 N 个可用植物
 */
async function selectPlantByIndex(page, index = 0) {
  await page.waitForSelector('div[role="listbox"] button', { timeout: 5000 });
  const buttons = await page.locator('div[role="listbox"] button').all();
  expect(buttons.length).toBeGreaterThan(index);
  await buttons[index].click();
  await page.waitForTimeout(300);

  const confirmButton = page.locator('button:has-text("确认禁用"), button:has-text("确认选择"), button:has-text("确认")').first();
  await expect(confirmButton).toBeVisible({ timeout: 2000 });
  await confirmButton.click();
  await page.waitForTimeout(800);
}

/**
 * 检查指定植物是否出现在可选列表中
 */
async function isPlantAvailable(page, plantName) {
  await page.waitForSelector('div[role="listbox"] button', { timeout: 5000 });
  const count = await page.locator(`div[role="listbox"] button:has-text("${plantName}")`).count();
  return count > 0;
}

/**
 * 执行 ban 操作（选第一个可用植物并确认禁用）
 */
async function doBanAction(page) {
  await selectPlantByIndex(page, 0);
}

/**
 * 执行 pick 操作，选择指定名称的植物
 */
async function doPickByName(page, plantName) {
  await selectPlantByName(page, plantName);
}

/**
 * 执行 pick 操作，选择第 N 个可用植物
 */
async function doPickByIndex(page, index = 0) {
  await selectPlantByIndex(page, index);
}

// ============================================================
// TC1: 同一选手在同一小分连续选 2 次南瓜，再选 2 个被保护植物
// ============================================================
test('TC1: 连续选2次南瓜后选2个被保护植物', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BASE_URL);
  await initGame(page, { player1: 'A', player2: 'B', player1Road: 2, player2Road: 4 });
  await waitForDebugStore(page);

  // --- Stage 1: 4 个 ban ---
  for (let i = 0; i < 4; i++) {
    await doBanAction(page);
  }

  // --- Stage 2: pick 阶段 ---
  // 步骤 1: 二路选手(player1) pick → 选第 1 个南瓜
  await doPickByName(page, '南瓜头');
  // extraPick 激活，remaining = 1

  // 再选第 2 个南瓜（不选被保护植物，直接选第二个南瓜）
  await doPickByName(page, '南瓜头');
  // extraPick.remaining 应为 2，需要选 2 个被保护植物

  // 选第 1 个被保护植物
  await doPickByIndex(page, 0);

  // 选第 2 个被保护植物
  await doPickByIndex(page, 0);

  // extraPick 清零，步骤推进到下一步
  // 验证：游戏仍在 banning 状态（BP 未结束，因为后续还有步骤）
  const gameStatus = await page.evaluate(() => {
    return window.$debugStore?.gameStatus ?? null;
  });
  expect(gameStatus).toBe('banning');
});

// ============================================================
// TC2: 选手 A 选了南瓜后，选手 B 不可选南瓜（本轮互斥）
// ============================================================
test('TC2: 一方选了南瓜后对手不可选', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(BASE_URL);
  await initGame(page, { player1: 'A', player2: 'B', player1Road: 2, player2Road: 4 });
  await waitForDebugStore(page);

  // --- Stage 1: 4 个 ban ---
  for (let i = 0; i < 4; i++) {
    await doBanAction(page);
  }

  // --- Stage 2: pick ---
  // 步骤 1: player1(二路) pick → 选南瓜
  await doPickByName(page, '南瓜头');
  // 选被保护植物
  await doPickByIndex(page, 0);

  // 步骤 2: player2(四路) pick → 验证南瓜不可选
  const pumpkinAvailable = await isPlantAvailable(page, '南瓜头');
  expect(pumpkinAvailable).toBe(false);
});

// ============================================================
// TC3: 小分 1 用南瓜，小分 2 还能再用（跨小分累计 2 次）
// ============================================================
test('TC3: 跨小分累计使用南瓜2次', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(BASE_URL);
  await initGame(page, { player1: 'A', player2: 'B', player1Road: 2, player2Road: 4 });
  await waitForDebugStore(page);

  // --- 小分 1: 完成 BP ---
  // Stage 1: 4 ban
  for (let i = 0; i < 4; i++) {
    await doBanAction(page);
  }
  // Stage 2: 6 pick，第 1 步选南瓜
  await doPickByName(page, '南瓜头');
  await doPickByIndex(page, 0); // 被保护植物
  // 剩余 5 个正常 pick
  for (let i = 0; i < 5; i++) {
    await doPickByIndex(page, 0);
  }
  // Stage 3: 6 ban
  for (let i = 0; i < 6; i++) {
    await doBanAction(page);
  }
  // Stage 4: 4 pick
  for (let i = 0; i < 4; i++) {
    await doPickByIndex(page, 0);
  }

  // BP 完成，进入站位阶段
  // 等待"完成本小分"按钮出现
  await page.waitForTimeout(800);

  // 直接通过 store 完成站位+结算+选路+开新局
  // 使用 store API 一步到位，避免复杂的 UI 拖拽交互
  await page.evaluate(() => {
    const store = window.$debugStore;
    if (!store) return;
    // 站位
    const p1Picks = store.currentRound.picks.player1;
    const p2Picks = store.currentRound.picks.player2;
    const p1Road = store.player1.road;
    const p2Road = store.player2.road;
    store.setPosition('player1', p1Road, p1Picks.map((id, i) => ({
      plantId: id, instanceId: `player1_${id}_${i}`, sourceIndex: i
    })));
    store.setPosition('player2', p2Road, p2Picks.map((id, i) => ({
      plantId: id, instanceId: `player2_${id}_${i}`, sourceIndex: i
    })));
    // 完成本小分
    store.finishRound();
    // player1 获胜
    store.setRoundWinner('player1');
    // player2 败方选路（互换：player2 选 2路）
    store.selectRoad('player2', 2);
  });
  // 等待 Vue 渲染新 BP 页面
  await page.waitForTimeout(1500);

  // 调试：检查当前状态
  const debugState = await page.evaluate(() => {
    const store = window.$debugStore;
    if (!store) return { error: 'no store' };
    return {
      gameStatus: store.gameStatus,
      roundNumber: store.currentRound?.roundNumber,
      player1Score: store.player1?.score,
      player2Score: store.player2?.score,
      pumpkinUsage: store.pumpkinUsage,
    };
  });
  console.log('TC3 debug after round transition:', JSON.stringify(debugState, null, 2));

  // --- 小分 2: 验证南瓜使用次数 ---
  const pumpkinUsage = await page.evaluate(() => {
    const store = window.$debugStore;
    return store ? (store.pumpkinUsage?.player1 ?? 0) : -1;
  });
  expect(pumpkinUsage).toBe(1);

  // store 状态正确但 UI 可能没跟着更新（直接操作 store 绕过了路由跳转）
  // 直接通过 store API 验证南瓜可用性（避免 UI 渲染时序问题）
  const pumpkinAvailableViaStore = await page.evaluate(() => {
    const store = window.$debugStore;
    if (!store) return false;
    // 模拟到达 pick 阶段时 player1 的状态
    store.currentRound.currentPlayer = 'player1';
    store.currentRound.action = 'pick';
    return store.availablePlants.some(p => store.isPumpkinPlant(p.id));
  });
  expect(pumpkinAvailableViaStore).toBe(true);
});

// ============================================================
// TC4: 已用 2 次南瓜，第 3 次不可选（达到上限）
// ============================================================
test('TC4: 使用2次后不可再选南瓜', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(BASE_URL);
  await initGame(page, { player1: 'A', player2: 'B', player1Road: 2, player2Road: 4 });
  await waitForDebugStore(page);

  // 通过 store 直接模拟使用 2 次南瓜
  await page.evaluate(() => {
    const store = window.$debugStore;
    if (store) {
      store.pumpkinUsage.player1 = 2;
      // 触发响应式更新
      store.triggerPlantCacheUpdate();
    }
  });

  // Stage 1: 4 ban
  for (let i = 0; i < 4; i++) {
    await doBanAction(page);
  }

  // Stage 2 步骤 1: player1 的南瓜使用已达上限，应不可选
  const pumpkinAvailable = await isPlantAvailable(page, '南瓜头');
  expect(pumpkinAvailable).toBe(false);
});

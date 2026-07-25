import { chromium } from 'playwright';
const BASE = 'http://localhost:3001';
const OUT = 'tmp-screenshots';
const errors = [];

async function initGame(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.mode-selection', { timeout: 8000 });
  await page.click('button:has-text("本地对战")');
  await page.waitForSelector('#player1-input', { timeout: 5000 });
  await page.fill('#player1-input', '玩家A');
  await page.waitForTimeout(250);
  await page.fill('#player2-input', '玩家B');
  await page.waitForTimeout(300);
  await page.locator('button:has-text("二路")').first().click();
  await page.waitForTimeout(150);
  await page.locator('button:has-text("四路")').last().click();
  await page.waitForTimeout(200);
  await page.click('button[type="submit"]:has-text("开始对战")');
  await page.waitForTimeout(1500);
  await page.waitForSelector('div[role="listbox"]', { timeout: 12000 });
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await initGame(page);

  const card = page.locator('div[role="listbox"] button').first();

  // 1. 长按首张植物 1.2s（模拟移动端长按手势）
  await card.click({ delay: 1200 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/mobile-longpress.png` });

  // 2. 长按之后，普通 tap 第二张（验证交互未被「卡住」，选中仍可切换）
  const card2 = page.locator('div[role="listbox"] button').nth(1);
  await card2.tap();
  await page.waitForTimeout(200);

  // 3. 点确认禁用，验证 ban 流程仍正常
  await page.locator('button:has-text("确认")').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/mobile-longpress-then-ban.png` });

  const bannedImgs = await page.locator('img[alt^="禁用植物"]').count();
  console.log('bannedImgs after longpress+tap+confirm:', bannedImgs);
  console.log('CONSOLE_ERRORS:', errors.length ? errors.join('\n') : '(none)');

  await ctx.close();
  await browser.close();
})().catch(e => { console.error('SCRIPT_FAILED:', e); process.exit(1); });

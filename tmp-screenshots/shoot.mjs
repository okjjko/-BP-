import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:3001';
const OUT = 'tmp-screenshots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const attachConsole = (page, tag) => {
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
};

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
  // 道路按钮文案来自 sideName（默认 二路/四路）
  await page.locator('button:has-text("二路")').first().click();
  await page.waitForTimeout(150);
  await page.locator('button:has-text("四路")').last().click();
  await page.waitForTimeout(200);
  await page.click('button[type="submit"]:has-text("开始对战")');
  await page.waitForTimeout(1500);
  // BanPickView 唯一标志：PlantSelector 的 listbox（避开 StageIndicator 现在的多实例）
  try {
    await page.waitForSelector('div[role="listbox"]', { timeout: 12000 });
  } catch (e) {
    await page.screenshot({ path: `${OUT}/debug-start-failed-${page.viewportSize().width}.png`, fullPage: true });
    console.log(`[debug ${page.viewportSize().width}px] url=${page.url()} listbox-not-found`);
  }
  await page.waitForTimeout(900); // 等 globalBans 抽取 + 图片渲染
}

(async () => {
  const browser = await chromium.launch();

  // ---- Mobile 375×667 (iPhone SE) ----
  const mctx = await browser.newContext({
    viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const mpage = await mctx.newPage();
  attachConsole(mpage, 'mobile');
  await initGame(mpage);
  await mpage.screenshot({ path: `${OUT}/mobile-375-initial.png` });
  // 选 + 确认禁用（验证飞行动画 + 紧凑 ban 区出现禁用项）
  await mpage.waitForSelector('div[role="listbox"] button', { timeout: 5000 });
  await mpage.locator('div[role="listbox"] button').first().click();
  await mpage.waitForTimeout(150);
  await mpage.locator('button:has-text("确认")').first().click();
  await mpage.waitForTimeout(800);
  await mpage.screenshot({ path: `${OUT}/mobile-375-after-ban.png` });
  // 点开「更多」菜单
  await mpage.locator('button:has-text("更多")').click().catch(() => {});
  await mpage.waitForTimeout(300);
  await mpage.screenshot({ path: `${OUT}/mobile-375-more-menu.png` });
  await mctx.close();

  // ---- Desktop 1280×800 ----
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await dctx.newPage();
  attachConsole(dpage, 'desktop');
  await initGame(dpage);
  await dpage.screenshot({ path: `${OUT}/desktop-1280-initial.png` });
  // desktop 也测一次 ban 飞行
  await dpage.waitForSelector('div[role="listbox"] button', { timeout: 5000 });
  await dpage.locator('div[role="listbox"] button').first().click();
  await dpage.waitForTimeout(150);
  await dpage.locator('button:has-text("确认")').first().click();
  await dpage.waitForTimeout(800);
  await dpage.screenshot({ path: `${OUT}/desktop-1280-after-ban.png` });
  await dctx.close();

  // ---- Mid-range 800×900 (校验 768–1023 段未被破坏) ----
  const wctx = await browser.newContext({ viewport: { width: 800, height: 900 } });
  const wpage = await wctx.newPage();
  attachConsole(wpage, 'w800');
  await initGame(wpage);
  await wpage.screenshot({ path: `${OUT}/width-800-initial.png` });
  await wctx.close();

  await browser.close();
  console.log('CONSOLE_ERRORS:\n' + (errors.length ? errors.join('\n') : '(none)'));
})().catch(e => { console.error('SCRIPT_FAILED:', e); process.exit(1); });

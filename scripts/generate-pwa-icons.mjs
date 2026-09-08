/**
 * 使用 Playwright 将 SVG 图标渲染为 PNG（利用已有的 @playwright/test 依赖）
 * 用法: node scripts/generate-pwa-icons.mjs
 */
import { chromium } from 'playwright'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')
const svgPath = resolve(publicDir, 'pwa-icon.svg')

const sizes = [192, 512]

async function generate() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  for (const size of sizes) {
    const outputPath = resolve(publicDir, `pwa-${size}.png`)
    await page.goto(`file://${svgPath}`)
    await page.setViewportSize({ width: size, height: size })

    // 截取 SVG 元素
    const svgEl = await page.$('svg')
    await svgEl.screenshot({ path: outputPath })

    console.log(`Generated: ${outputPath} (${size}x${size})`)
  }

  await browser.close()
  console.log('Done!')
}

generate().catch(console.error)

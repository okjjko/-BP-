/**
 * Playwright配置文件
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './agents/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // BP工具测试需要顺序执行，所以设置为1
  reporter: [
    ['html', { outputFolder: 'agents/test-results/html' }],
    ['json', { outputFile: 'agents/test-results/results.json' }],
    ['junit', { outputFile: 'agents/test-results/results.xml' }]
  ],

  use: {
    baseURL: 'http://localhost:3000', // 修改为3000端口
    actionTimeout: 10000, // 操作超时10秒
    navigationTimeout: 15000, // 导航超时15秒
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 全局超时设置
  timeout: 60000, // 单个测试60秒超时

  // 启动本地 ws hub(:8080) + 前端 vite(:3000)：用 server/dev-all.mjs 单进程拉起两个子进程
  // （绕开 concurrently 在 Windows cmd 下的引号问题；比 webServer 数组更稳）。前端经 vite /ws proxy 反代到 8080。
  webServer: {
    command: 'node server/dev-all.mjs',
    cwd: process.cwd(),
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

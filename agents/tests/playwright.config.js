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
    baseURL: 'http://localhost:5173',
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

  // 启动开发服务器
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

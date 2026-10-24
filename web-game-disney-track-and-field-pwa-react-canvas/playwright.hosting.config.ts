import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './hosting-tests',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4018/monorepo-colin/', launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node ../.github/scripts/preview-pages.mjs', url: 'http://127.0.0.1:4018/monorepo-colin/', reuseExistingServer: false },
});

import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:4017${process.env.VITE_BASE_PATH || '/'}`;
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] } },
  projects: [
    { name: 'rules', testMatch: '**/rules.spec.ts' },
    { name: 'desktop', testIgnore: '**/rules.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: '**/rules.spec.ts', use: { ...devices['Pixel 7'] } },
    { name: 'landscape', testIgnore: '**/rules.spec.ts', use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } } },
  ],
  webServer: { command: 'npm run build && npm run preview', url: baseURL, reuseExistingServer: false },
});

import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.CFS_TEST_PORT || 4015);
const baseURL = `http://127.0.0.1:${port}${process.env.VITE_BASE_PATH || '/'}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] },
  },
  projects: [
    { name: 'rules', testMatch: '**/rules.spec.ts' },
    { name: 'desktop', testIgnore: '**/rules.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone-portrait', testIgnore: '**/rules.spec.ts', use: { ...devices['Pixel 7'] } },
    { name: 'phone-landscape', testIgnore: '**/rules.spec.ts', use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});

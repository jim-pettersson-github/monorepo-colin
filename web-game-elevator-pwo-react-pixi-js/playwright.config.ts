import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:4011${process.env.VITE_BASE_PATH || '/'}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 1 : 3,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Headless Shell otherwise uses CPU-based SwiftShader on this Windows setup.
    launchOptions: { args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] },
  },
  projects: [
    { name: 'simulation', testMatch: '**/simulation.spec.ts' },
    { name: 'desktop', testIgnore: '**/simulation.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: '**/simulation.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: false,
  },
});

import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Another checkout's preview may hold 4011; ELEVATOR_TEST_PORT moves this run elsewhere.
const port = Number(process.env.ELEVATOR_TEST_PORT || 4011);
const baseURL = `http://127.0.0.1:${port}${process.env.VITE_BASE_PATH || '/'}`;
// The shared room server runs locally for the two-device test, with its own throwaway database.
const roomDatabase = resolve('test-results/room-server.sqlite');
const rules = /(simulation|together-rules)\.spec\.ts$/;
const together = /together\.spec\.ts$/;

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
    { name: 'simulation', testMatch: rules },
    { name: 'desktop', testIgnore: [rules, together], use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: [rules, together], use: { ...devices['Pixel 7'] } },
    // Shared play opens its own desktop and phone browsers; it runs last so its extra load never slows the timing-sensitive checks.
    { name: 'together', testMatch: together, dependencies: ['simulation', 'desktop', 'phone'], use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
    },
    {
      command: 'php -S 127.0.0.1:4021 -t ../game-server/public',
      url: 'http://127.0.0.1:4021/index.html',
      env: { GAME_DB: roomDatabase },
      reuseExistingServer: false,
    },
  ],
});

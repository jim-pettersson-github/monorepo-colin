import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  webServer: [
    { command: 'npm run build && npm run preview', url: baseURL, reuseExistingServer: false },
    // The shared room server, for the room-code pairing test.
    {
      command: 'php -S 127.0.0.1:4022 -t ../game-server/public',
      url: 'http://127.0.0.1:4022/api.php?a=health',
      reuseExistingServer: false,
      stderr: 'ignore',
      env: { GAME_DB: join(tmpdir(), 'sagospelen-room-test.sqlite') },
    },
  ],
});

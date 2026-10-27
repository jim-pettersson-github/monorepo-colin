import { readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.CFS_TEST_PORT || 4015);
const roomPort = Number(process.env.CFS_ROOM_PORT || 4024);
const roomServer = `http://127.0.0.1:${roomPort}/api.php`;
const baseURL = `http://127.0.0.1:${port}${process.env.VITE_BASE_PATH || '/'}`;

// Each run starts with an empty room server database, so scoreboards hold only this run's laps. The workers load this
// file again and inherit the name, so only the first load picks it and clears out earlier runs' databases.
if (!process.env.CFS_ROOM_DB) {
  const stale = `charlie-room-test-${roomPort}`;
  for (const file of readdirSync(tmpdir())) if (file.startsWith(stale) && file.includes('.sqlite')) rmSync(join(tmpdir(), file), { force: true });
  process.env.CFS_ROOM_DB = join(tmpdir(), `charlie-room-test-${roomPort}-${Date.now().toString(36)}.sqlite`);
}

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
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${port}`,
      url: baseURL,
      reuseExistingServer: false,
    },
    // The shared room server, for the room-code pairing tests.
    {
      command: `php -S 127.0.0.1:${roomPort} -t ../game-server/public`,
      url: `${roomServer}?a=health`,
      reuseExistingServer: false,
      stderr: 'ignore',
      env: { GAME_DB: process.env.CFS_ROOM_DB },
    },
  ],
});

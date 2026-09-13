import { defineConfig, devices } from '@playwright/test';

const baseURL = `http://127.0.0.1:4011${process.env.VITE_BASE_PATH || '/'}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'simulation', testMatch: '**/simulation.spec.ts' },
    { name: 'desktop', testIgnore: '**/simulation.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: '**/simulation.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run preview',
    url: baseURL,
    reuseExistingServer: false,
  },
});

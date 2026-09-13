import { test as base, expect, type Page } from '@playwright/test';

export { expect };
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.install();
    await use(page);
  },
});

export function gamePoll<T>(page: Page, read: () => Promise<T>, options: { timeout?: number; intervals?: number[]; step?: number } = {}) {
  const { step = 100, ...pollOptions } = options;
  return expect.poll(
    async () => {
      // Advance one low-frame-rate tick, within the game's catch-up limit.
      await page.clock.fastForward(step);
      return read();
    },
    { timeout: 10000, ...pollOptions, intervals: [0] },
  );
}

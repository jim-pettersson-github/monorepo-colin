import { expect, test } from '@playwright/test';

test('effects unlock on interaction, respect mute and background pause, and persist volume offline', async ({ page, context }) => {
  await page.addInitScript(() => {
    const probe = { contexts: 0, started: 0 };
    (window as unknown as { soundProbe: typeof probe }).soundProbe = probe;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts++;
      }
      override createOscillator() {
        const source = super.createOscillator();
        const start = source.start.bind(source);
        source.start = (when?: number) => {
          probe.started++;
          start(when);
        };
        return source;
      }
      override createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (when?: number, offset?: number, duration?: number) => {
          probe.started++;
          start(when, offset, duration);
        };
        return source;
      }
    };
  });
  const sounds = () => page.evaluate(() => (window as unknown as { soundProbe: { contexts: number; started: number } }).soundProbe);
  await page.goto('./');
  expect((await sounds()).contexts).toBe(0);
  await page.getByRole('button', { name: 'Stäng av ljud', exact: true }).click();
  await page.locator('.source-label select').selectOption('keyboard1');
  await page.getByRole('button', { name: 'Starta snabbmatch' }).click();
  await expect(page.getByText('Avspark!', { exact: true })).toHaveCount(0, { timeout: 6000 });
  expect((await sounds()).started).toBe(0);
  await page.getByRole('button', { name: 'Slå på ljud', exact: true }).click();
  await page.keyboard.press('k');
  await expect.poll(async () => (await sounds()).started).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fortsätt matchen/ })).toBeFocused();
  const count = (await sounds()).started;
  await page.clock.install();
  await page.clock.runFor(1500);
  expect((await sounds()).started).toBe(count);
  const slider = page.getByRole('slider', { name: 'Ljudvolym' });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < 4; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue('20');
  await page.getByRole('region', { name: 'Ljudinställningar' }).getByRole('button', { name: 'Stäng av ljud', exact: true }).click();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByText('Ljudinställningar', { exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Ljudvolym' })).toHaveValue('20');
  await expect(page.getByRole('button', { name: 'Slå på ljud', exact: true }).first()).toHaveAttribute('aria-pressed', 'false');
  expect((await sounds()).started).toBe(0);
  await context.setOffline(false);
});

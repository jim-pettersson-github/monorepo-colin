import { expect, test } from '@playwright/test';
import { createGame, defaultSettings } from '../src/game/model';

const key = 'sagospelen-event-v1';

test('four keyboard players choose separate characters, run independently and resume their saved race', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: 'Tre spelare', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Kontroll spelare/ })).toHaveCount(3);
  await page.getByRole('button', { name: 'Fyra spelare', exact: true }).click();
  await page.getByRole('button', { name: 'Spelare 4: Elsa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spelare 3: Simba', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (let i = 1; i <= 4; i++) await page.getByRole('combobox', { name: `Kontroll spelare ${i}`, exact: true }).selectOption(`keyboard${i}`);
  await page.getByRole('combobox', { name: 'Kontroll spelare 4', exact: true }).selectOption('keyboard1');
  await expect(page.getByRole('button', { name: /^Starta grenen/ })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Kontroll spelare 4', exact: true }).selectOption('keyboard4');
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await page.clock.runFor(3300);
  await page.keyboard.down('j');
  await page.keyboard.down('v');
  await page.clock.runFor(1100);
  await page.keyboard.up('j');
  await page.keyboard.up('v');
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), key);
  expect(saved.runners.map((r: { human: number }) => r.human)).toEqual([0, 1, 2, 3]);
  expect(saved.runners[0].x).toBe(0);
  expect(saved.runners[1].x).toBe(0);
  expect(saved.runners[2].x).toBeGreaterThan(5);
  expect(saved.runners[3].x).toBeGreaterThan(5);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad gren/ }).click();
  await expect(page.locator('.keyboard-controls')).toHaveCount(4);
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), key);
  expect(restored.settings.players).toBe(4);
  expect(restored.runners[3].x).toBeGreaterThanOrEqual(saved.runners[3].x);
});

test('four-player touch controls fit the screen with usable buttons', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Fyra spelare', exact: true }).click();
  await page.getByRole('button', { name: 'Välj 110 m häck', exact: true }).click();
  for (let i = 1; i <= 4; i++) await page.getByRole('combobox', { name: `Kontroll spelare ${i}`, exact: true }).selectOption('touch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await expect(page.locator('.touch-controls')).toHaveCount(4);
  for (const button of await page.locator('.touch-controls button').all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
    const bounds = await button.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(48);
    expect(bounds?.height).toBeGreaterThanOrEqual(48);
  }
  const canvas = await page.locator('.game-canvas').boundingBox();
  expect(canvas?.height).toBeGreaterThan(60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('four-player-touch.png') });
});
test('twenty events, mixed Disney cast and normal-flow start controls stay usable', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Sagospelen');
  await expect(page.locator('.preview-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Alla · 20', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(20);
  await page.getByRole('button', { name: 'Hopp · 4', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Välj Stavhopp', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Stavhopp. Nu kör vi.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spelare 1: Elsa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spelare 1: Elsa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.character-grid button')).toHaveCount(20);
  expect(await page.locator('.start-section').evaluate((n) => getComputedStyle(n).position)).toBe('static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('menu.png'), fullPage: true });
  expect(errors).toEqual([]);
});
test('twenty illustrated characters render without clipping and new choices survive a four-player save', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const portraits = page.locator('.character-grid canvas');
  await expect(portraits).toHaveCount(20);
  const coverage = await portraits.evaluateAll((canvases) =>
    canvases.map((node) => {
      const canvas = node as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Portrait canvas unavailable');
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0,
        border = 0;
      for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
          if (data[(y * canvas.width + x) * 4 + 3] < 10) continue;
          ink++;
          if (x < 2 || x >= canvas.width - 2 || y < 2 || y >= canvas.height - 2) border++;
        }
      return { ink, border };
    }),
  );
  for (const portrait of coverage) {
    expect(portrait.ink).toBeGreaterThan(2000);
    expect(portrait.border).toBe(0);
  }
  await page.getByRole('button', { name: 'Spelare 1: Buzz Lightyear', exact: true }).click();
  const picker = page.getByRole('region', { name: 'Välj figur spelare 1', exact: true });
  await expect(picker.locator('.character-intro h4')).toHaveText('Buzz Lightyear');
  await picker.screenshot({ path: info.outputPath('character-picker.png') });
  await page.getByRole('button', { name: 'Fyra spelare', exact: true }).click();
  await page.getByRole('button', { name: 'Spelare 2: Baymax', exact: true }).click();
  await page.getByRole('button', { name: 'Spelare 3: Mulan', exact: true }).click();
  await page.getByRole('button', { name: 'Spelare 4: Woody', exact: true }).click();
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), key);
  expect(saved.runners.map((runner: { character: string }) => runner.character)).toEqual(['buzz', 'baymax', 'mulan', 'woody']);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad gren/ }).click();
  await expect(page.locator('.status-player')).toContainText(['Buzz Lightyear', 'Baymax', 'Mulan', 'Woody']);
  await page.screenshot({ path: info.outputPath('new-character-race.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('two keyboard runners move independently, save on pause and restore after reload', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: 'Två spelare', exact: true }).click();
  await page.getByRole('combobox', { name: 'Kontroll spelare 1', exact: true }).selectOption('keyboard1');
  await page.getByRole('combobox', { name: 'Kontroll spelare 2', exact: true }).selectOption('keyboard2');
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.clock.runFor(3300);
  await page.keyboard.down('a');
  await page.clock.runFor(1000);
  await page.keyboard.up('a');
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  await expect(page.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeFocused();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), key);
  expect(saved.runners[0].x).toBeGreaterThan(5);
  expect(saved.runners[1].x).toBe(0);
  await page.clock.runFor(4000);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}').time, key)).toBe(saved.time);
  await page.screenshot({ path: info.outputPath('paused.png') });
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad gren/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  const restored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), key);
  expect(Math.abs(restored.runners[0].x - saved.runners[0].x)).toBeLessThan(2);
  expect(restored.time - saved.time).toBeLessThan(0.5);
});
test('touch holds run, jumps work, and backgrounding pauses without time catch-up', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: 'Välj 110 m häck', exact: true }).click();
  await page.getByRole('combobox', { name: 'Kontroll spelare 1' }).selectOption('touch');
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await page.clock.runFor(3200);
  const run = page.getByRole('button', { name: 'Spelare 1 vänster steg', exact: true });
  const b = await run.boundingBox();
  if (!b) throw new Error('No step button');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.clock.runFor(1100);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Spelare 1 hoppa', exact: true }).click();
  await page.clock.runFor(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), key);
  expect(saved.runners[0].x).toBeGreaterThan(5);
  expect(saved.runners[0].jumpV).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('touch.png') });
});
test('a finished restored event records a result and supports another event without stale dialogs', async ({ page }) => {
  const state = createGame(defaultSettings());
  state.phase = 'playing';
  state.runners.forEach((r) => {
    r.x = 99;
    r.speed = 10;
  });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key, state });
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad gren/ }).click();
  await page.clock.runFor(300);
  await expect(page.locator('.result-list')).toBeVisible();
  await page.getByRole('button', { name: 'Spela igen ↗', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('PÅ ERA PLATSER', { exact: true })).toBeVisible();
});
test('manifest, art and saves work offline inside the configured game scope', async ({ page, context, request, baseURL }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  if (!href || !baseURL) throw new Error('No manifest');
  const manifest = await (await request.get(new URL(href, baseURL).href)).json();
  expect(manifest.scope).toBe(new URL(baseURL).pathname);
  await context.setOffline(true);
  await page.reload();
  const artBytes = await page.evaluate(async () => {
    const response = await fetch('art/stadium.webp');
    if (!response.ok) throw new Error('Missing offline stadium');
    return (await response.blob()).size;
  });
  expect(artBytes).toBeGreaterThan(10000);
  await expect(page.locator('.preview-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: /^Starta grenen/ }).click();
  await page.getByRole('button', { name: 'Pausa tävlingen' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad gren/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
});

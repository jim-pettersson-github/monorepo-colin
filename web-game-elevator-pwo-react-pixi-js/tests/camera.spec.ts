import { expect, test } from '@playwright/test';
import { createGame, layout } from '../src/game/model';

test('pan from the top floor without moving Colin, recenter, then tap the ground floor', async ({ page, context }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
  saved.player.floor = 2;
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const scene = page.locator('.game-scene');
  const canvas = scene.locator('canvas');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing canvas');
  const x = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height * 0.8;
  const endY = bounds.y + bounds.height * 0.25;

  await page.mouse.move(x, startY);
  await page.mouse.wheel(0, 1800);
  await expect(scene).toHaveAttribute('data-camera', 'free');
  await expect(page.locator('main.game')).toHaveAttribute('data-floor', '2');
  await page.getByRole('button', { name: '◎ Följ Colin', exact: true }).click();
  await expect(scene).toHaveAttribute('data-camera', 'follow');

  const touch = testInfo.project.name === 'phone' ? await context.newCDPSession(page) : null;
  for (let drag = 0; drag < 4; drag++) {
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
      for (let step = 1; step <= 8; step++)
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + ((endY - startY) * step) / 8 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(x, startY);
      await page.mouse.down();
      await page.mouse.move(x, endY, { steps: 8 });
      await page.mouse.up();
    }
  }
  await expect(scene).toHaveAttribute('data-camera', 'free');
  await expect(page.locator('main.game')).toHaveAttribute('data-floor', '2');
  expect(
    await page.evaluate(() => {
      const player = JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').player;
      return [player.x, player.targetX, player.route, player.stairs];
    }),
  ).toEqual([670, null, null, null]);

  const scale = Math.min(Math.max(0.75, Math.min(1.25, bounds.width / layout.width)), bounds.height / 350);
  const cameraX =
    bounds.width > layout.width * scale
      ? (bounds.width - layout.width * scale) / 2
      : Math.max(bounds.width - layout.width * scale, Math.min(0, bounds.width / 2 - 670 * scale));
  const target = { x: cameraX + 430 * scale, y: bounds.height * 0.86 + 20 * scale };
  if (touch) await page.touchscreen.tap(bounds.x + target.x, bounds.y + target.y);
  else await canvas.click({ position: target });
  await expect(scene).toHaveAttribute('data-camera', 'follow');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const player = JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').player;
          return [player.floor, Math.round(player.x), player.stairs];
        }),
      { timeout: 14000 },
    )
    .toEqual([0, 430, null]);
  expect(errors).toEqual([]);
});

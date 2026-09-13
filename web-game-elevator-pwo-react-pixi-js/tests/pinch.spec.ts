import { expect, test } from '@playwright/test';
import { createGame } from '../src/game/model';
import { projectPoint } from '../src/game/spatial';
import { roomTap, savedPlayer } from './room-helpers';

test('pinch zooms the room with controls hidden and never becomes a walking tap', async ({ page, context }) => {
  const saved = createGame(42);
  saved.started = true;
  saved.settings.smoothCamera = false;
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('./');
  const scene = page.locator('.game-scene');
  await expect(scene.locator('canvas')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Spelkontroller' })).not.toBeVisible();
  const zoomOut = page.getByRole('button', { name: 'Zooma ut', exact: true });
  while (await zoomOut.isEnabled()) await zoomOut.click();
  await expect(scene).toHaveAttribute('data-zoom', '1');
  const touch = await context.newCDPSession(page);
  const fingers = (spread: number) => [
    { id: 1, x: 420 - spread, y: 220 },
    { id: 2, x: 420 + spread, y: 220 },
  ];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(50) });
  for (let spread = 60; spread <= 100; spread += 10) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
  await expect.poll(async () => Number(await scene.getAttribute('data-zoom'))).toBeCloseTo(2);
  await expect(scene).toHaveAttribute('data-camera', 'free');
  // Lift one finger, continue dragging, then release: none of these may issue a tap.
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id: 2, x: 520, y: 220 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x: 550, y: 230 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await scene.getAttribute('data-zoom'))).toBeCloseTo(2);

  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(100) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(30) });
  await expect(scene).toHaveAttribute('data-zoom', '1');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await savedPlayer(page)).toEqual(saved.player);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  await expect(zoomOut).toBeDisabled();
  await page.getByRole('button', { name: 'Zooma in', exact: true }).click();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await roomTap(page, projectPoint({ x: 600, depth: 0.8 }));
  await expect.poll(async () => Math.round((await savedPlayer(page)).depth * 100)).toBe(80);
});

import { cafeButton, cafeCall, cafeProject } from '../src/game/cafe-spatial';
import { createGame } from '../src/game/model';
import { expect, gamePoll, test } from './game-clock';
import { roomTap, savedPlayer, showControls } from './room-helpers';

test('cafe left of hotel is reachable from the street and keeps both floors visible', async ({ page }, testInfo) => {
  const state = createGame(42);
  state.started = true;
  state.player.place = 'outside';
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), state);
  await page.goto('./');
  await showControls(page);
  await expect(page.locator('.building-choices button')).toHaveText(['01Kaféet', '02Hotellet', '03Varuhuset', '04Gamla huset']);
  await roomTap(page, { x: 199, y: 535 }, testInfo.project.name === 'phone');
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('cafe');
  await expect(page.locator('.game-scene')).toHaveAttribute('data-floor-view', 'both');
  await expect(page.getByRole('button', { name: 'Titta på våning 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Titta på våning 2', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '→ Utgång', exact: true }).click();
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('outside');
});

test('send the glass lift, take visible stairs to meet it, block doors and restore upstairs', async ({ page }, testInfo) => {
  test.slow();
  const state = createGame(42);
  state.started = true;
  state.player.place = 'cafe';
  state.player.x = 750;
  state.player.depth = 0.2;
  state.buildings[3].people[0].floor = 1;
  await page.goto('./');
  await page.evaluate((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), state);
  await page.reload();
  await showControls(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const touch = testInfo.project.name === 'phone';
  await roomTap(page, { x: 325, y: 600 }, touch);
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-riding')).toBe('true');
  await roomTap(page, cafeButton(1, 0), touch);
  await roomTap(page, cafeProject({ x: 730, depth: 0.15 }, 1), touch);
  await gamePoll(
    page,
    async () => {
      const player = await savedPlayer(page);
      return [player.floor, player.stairs, player.targetX, player.route];
    },
    { timeout: 20000 },
  ).toEqual([1, null, null, null]);
  await expect(page.locator('.game-scene')).toHaveAttribute('data-floor-view', 'both');
  await roomTap(page, cafeCall(1), touch);
  await gamePoll(page, () => page.getByRole('button', { name: 'Gå in', exact: true }).isEnabled()).toBe(true);
  await page.locator('.game-scene canvas').screenshot({ path: testInfo.outputPath('cafe-upstairs.png') });
  await roomTap(page, { x: 337, y: 337 }, touch);
  await gamePoll(page, () => page.getByLabel('Hissens läge').textContent()).toContain('upptagen');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, () => page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).isVisible()).toBe(true);
  await roomTap(page, cafeProject({ x: 710, depth: 0.2 }, 1), touch);
  await gamePoll(page, async () => (await savedPlayer(page)).targetX).toBeNull();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  await page.reload();
  await showControls(page);
  await expect(page.locator('main.game')).toHaveAttribute('data-place', 'cafe');
  await expect(page.locator('main.game')).toHaveAttribute('data-floor', '1');
  await expect(page.locator('.game-scene')).toHaveAttribute('data-floor-view', 'both');
  await expect(page.locator('.game-scene')).toHaveAttribute('data-art', 'painted');
  await page.context().setOffline(false);
  expect(errors).toEqual([]);
});

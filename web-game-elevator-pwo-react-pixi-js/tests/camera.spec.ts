import { createGame, floorLabel } from '../src/game/model';
import { projectPoint } from '../src/game/spatial';
import { expect, gamePoll, test } from './game-clock';
import { floorTap, roomTap, savedPlayer, showControls } from './room-helpers';

for (const destination of [0, 2])
  test(`preview floor ${destination} without moving, then walk there through the stairs`, async ({ page }, testInfo) => {
    test.slow();
    const saved = createGame(42);
    saved.started = true;
    saved.settings.smoothCamera = false;
    saved.player.floor = 2 - destination;
    await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    const scene = page.locator('.game-scene');
    await expect(scene.locator('canvas')).toBeVisible();
    await showControls(page);
    await page.getByRole('button', { name: `Titta på våning ${floorLabel(destination)}`, exact: true }).click();
    await expect(scene).toHaveAttribute('data-view-floor', String(destination));
    await expect(page.locator('main.game')).toHaveAttribute('data-floor', String(2 - destination));
    expect((await savedPlayer(page)).route).toBeNull();
    // The changing passenger controls resize the canvas on arrival; taps must still line up.
    await roomTap(page, projectPoint({ x: 430, depth: 0.4 }), testInfo.project.name === 'phone');
    await gamePoll(
      page,
      async () => {
        const player = await savedPlayer(page);
        return [player.floor, Math.round(player.x), player.targetX, player.stairs];
      },
      { timeout: 14000 },
    ).toEqual([destination, 430, null, null]);
    await expect(scene).toHaveAttribute('data-view-floor', String(destination));
    await floorTap(page, 2 - destination, 510, 0.7, testInfo.project.name === 'phone');
    await gamePoll(
      page,
      async () => {
        const player = await savedPlayer(page);
        return [player.floor, Math.round(player.x), player.targetX, player.stairs];
      },
      { timeout: 14000 },
    ).toEqual([2 - destination, 510, null, null]);
    expect((await savedPlayer(page)).depth).toBeCloseTo(0.7);
    expect(errors).toEqual([]);
  });

test('zoom and drag with mouse or touch never move Colin; Follow restores the room', async ({ page, context }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  await page.goto('./');
  const scene = page.locator('.game-scene');
  await expect(scene.locator('canvas')).toBeVisible();
  await showControls(page);
  while (await page.getByRole('button', { name: 'Zooma ut', exact: true }).isEnabled())
    await page.getByRole('button', { name: 'Zooma ut', exact: true }).click();
  await page.getByRole('button', { name: 'Zooma in', exact: true }).click();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  const bounds = await scene.boundingBox();
  if (!bounds) throw new Error('Missing scene');
  const x = bounds.x + bounds.width * 0.5,
    y = bounds.y + bounds.height * 0.7;
  if (testInfo.project.name === 'phone') {
    const touch = await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 15, y: y - i * 12 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y - 96, { steps: 8 });
    await page.mouse.up();
  }
  await expect(scene).toHaveAttribute('data-camera', 'free');
  expect(await savedPlayer(page)).toMatchObject({ x: 670, depth: 0.4, targetX: null, route: null, stairs: null });
  await page.getByRole('button', { name: '◎ Följ Colin', exact: true }).click();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await expect(scene).toHaveAttribute('data-camera', 'follow');
  await roomTap(page, projectPoint({ x: 600, depth: 0.8 }), testInfo.project.name === 'phone');
  await gamePoll(page, async () => Math.round((await savedPlayer(page)).depth * 100)).toBe(80);
});

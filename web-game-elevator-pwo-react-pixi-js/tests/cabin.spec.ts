import { createGame, layout } from '../src/game/model';
import { cabinButton, cabinDoorButton, gateLever } from '../src/game/spatial';
import { expect, gamePoll, test } from './game-clock';
import { roomTap, savedPlayer } from './room-helpers';

test('choose lit back-wall buttons and visibly close/reopen doors around Colin', async ({ page }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
  saved.settings.smoothCamera = false;
  saved.player.x = layout.cabin;
  saved.player.depth = -0.18;
  saved.player.riding = true;
  for (const person of saved.buildings[0].people) {
    person.phase = 'away';
    person.timer = 90;
  }
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const canvas = page.locator('.game-scene canvas');
  await expect(canvas).toBeVisible();
  await roomTap(page, cabinButton(2), testInfo.project.name === 'phone');
  const lift = () => page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').buildings[0].lift);
  await gamePoll(page, async () => (await lift()).queue).toEqual([2]);
  await page.getByRole('button', { name: 'Stå i dörren', exact: true }).click();
  await gamePoll(page, async () => (await savedPlayer(page)).depth).toBe(0);
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, async () => (await lift()).landing.open, { timeout: 4000, intervals: [100] }).toBeLessThan(0.9);
  await gamePoll(page, async () => (await lift()).landing.open, { timeout: 4000, intervals: [100] }).toBe(1);
  expect(await lift()).toMatchObject({ position: 0, destination: null, blocked: true });
  expect(await savedPlayer(page)).toMatchObject({ x: layout.threshold, depth: 0 });
  await page.getByRole('button', { name: '↑ Trappa', exact: true }).click();
  await gamePoll(page, async () => (await lift()).destination, { timeout: 12000 }).toBe(2);
  expect(errors).toEqual([]);
});

test('old-house door buttons and gate lever work independently on a ride to floor 6', async ({ page }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
  saved.settings.smoothCamera = false;
  Object.assign(saved.player, { place: 'house', x: layout.cabin, depth: -0.18, riding: true });
  for (const person of saved.buildings[2].people) {
    person.phase = 'away';
    person.timer = 90;
  }
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  await page.goto('./');
  await expect(page.locator('.game-scene')).toHaveAttribute('data-art', 'painted');
  const touch = testInfo.project.name === 'phone';
  const lift = () => page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').buildings[2].lift);
  await roomTap(page, cabinButton(6), touch);
  await roomTap(page, cabinDoorButton(0), touch);
  await gamePoll(page, async () => (await lift()).landing.open).toBe(0);
  expect((await lift()).gate.open).toBe(1);
  expect((await lift()).position).toBe(0);
  await roomTap(page, cabinDoorButton(1), touch);
  await gamePoll(page, async () => (await lift()).landing.open).toBe(1);
  expect((await lift()).gate.open).toBe(1);
  await roomTap(page, gateLever, touch);
  await gamePoll(page, async () => (await lift()).position, { timeout: 45000 }).toBe(6);
  await gamePoll(page, async () => (await lift()).landing.open).toBe(1);
  expect((await lift()).gate.open).toBe(0);
  await page.locator('.game-scene canvas').screenshot({ path: testInfo.outputPath('house-gate-lever.png') });
  await roomTap(page, gateLever, touch);
  await gamePoll(page, async () => (await lift()).gate.open).toBe(1);
  await page.getByRole('button', { name: 'Välj våning', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Välj våning i hissen' });
  for (const name of ['Öppna dörrarna', 'Stäng dörrarna', 'Stäng grinden']) {
    const box = await panel.getByRole('button', { name, exact: true }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(48);
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
  await page.screenshot({ path: testInfo.outputPath('house-floor-controls.png') });
  await panel.getByRole('button', { name: 'Våning E', exact: true }).click();
  await panel.getByRole('button', { name: 'Stäng grinden', exact: true }).click();
  await gamePoll(page, async () => (await lift()).position, { timeout: 45000 }).toBe(0);
});

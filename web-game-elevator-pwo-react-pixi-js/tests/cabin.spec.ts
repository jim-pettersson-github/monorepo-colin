import { createGame, layout } from '../src/game/model';
import { cabinPanel } from '../src/game/spatial';
import { expect, gamePoll, test } from './game-clock';
import { roomTap, savedPlayer } from './room-helpers';

test('choose lit back-wall buttons and visibly close/reopen doors around Colin', async ({ page }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
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
  await roomTap(page, { x: cabinPanel.x, y: cabinPanel.top + 2 * cabinPanel.spacing }, testInfo.project.name === 'phone');
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

import sharp from 'sharp';
import { createGame } from '../src/game/model';
import { projectPoint } from '../src/game/spatial';
import { expect, gamePoll, test } from './game-clock';
import { roomTap, savedPlayer } from './room-helpers';

test('painted idle poses stay in place and yield to a room tap', async ({ page }, testInfo) => {
  test.slow();
  const saved = createGame(42);
  saved.started = true;
  saved.player.x = 500;
  saved.player.depth = 0.65;
  for (const building of saved.buildings) for (const person of building.people) person.floor = 1;
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const canvas = page.locator('.game-scene canvas');
  await expect(canvas).toBeVisible();
  const standing = await canvas.screenshot();
  for (const pose of ['sit', 'scratch', 'squat', 'jump']) {
    await gamePoll(page, () => page.locator('.game-scene').getAttribute('data-colin-pose')).toBe(pose);
    await page.clock.fastForward(100);
    const image = await canvas.screenshot({ path: testInfo.outputPath(`colin-${pose}.png`) });
    expect(image.equals(standing)).toBe(false);
    expect(await savedPlayer(page)).toMatchObject({ x: 500, depth: 0.65, targetX: null, route: null });
  }
  await roomTap(page, projectPoint({ x: 430, depth: 0.45 }), testInfo.project.name === 'phone');
  await gamePoll(page, async () => {
    const player = await savedPlayer(page);
    return [Math.round(player.x), player.targetX];
  }).toEqual([430, null]);
  expect(errors).toEqual([]);
});

test('reduced motion keeps Colin standing while idle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const saved = createGame(42);
  saved.started = true;
  for (const building of saved.buildings) for (const person of building.people) person.floor = 1;
  await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
  await page.goto('./');
  const canvas = page.locator('.game-scene canvas');
  await expect(canvas).toBeVisible();
  for (let frame = 0; frame < 10; frame++) await page.clock.fastForward(100);
  const standing = await canvas.screenshot();
  for (let frame = 0; frame < 100; frame++) await page.clock.fastForward(100);
  const before = await sharp(standing).raw().toBuffer();
  const after = await sharp(await canvas.screenshot())
    .raw()
    .toBuffer();
  expect(after.length).toBe(before.length);
  // Allow tiny GPU edge differences while detecting an actual pose change.
  let changed = 0;
  for (let i = 0; i < before.length; i++) if (Math.abs(before[i] - after[i]) > 12) changed++;
  expect(changed / before.length).toBeLessThan(0.001);
  await expect(page.locator('.game-scene')).toHaveAttribute('data-colin-pose', 'standing');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gamePoll(page, () => page.locator('.game-scene').getAttribute('data-colin-pose')).toBe('sit');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gamePoll(page, () => page.locator('.game-scene').getAttribute('data-colin-pose')).toBe('standing');
});

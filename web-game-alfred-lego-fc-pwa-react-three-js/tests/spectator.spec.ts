import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { Season } from '../src/game/league';
import { createSeason } from '../src/game/league';
import { createMatch } from '../src/game/model';

const seasonKey = 'alfred-fc-season-v1';
const matchKey = 'alfred-fc-match-v1';
async function openLeague(page: Page) {
  const season = createSeason('skogsby', 'easy', 60);
  season.randomState = 1200;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: seasonKey, value: season },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  return season;
}

const readSeason = (page: Page): Promise<Season> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), seasonKey);

test('league-only instant simulation shows a result, advances one round and persists without opening the pitch', async ({ page }, testInfo) => {
  await openLeague(page);
  await page.getByRole('button', { name: 'Simulera direkt', exact: true }).click();
  await page.getByRole('button', { name: 'Simulera nästa ligamatch', exact: true }).click();
  await expect.poll(async () => (await readSeason(page)).fixtures.filter((f) => f.score).length).toBe(6);
  await expect(page.locator('.game-canvas')).toHaveCount(0);
  await expect(page.locator('.last-league-result')).toContainText('Senaste resultat:');
  expect(await page.evaluate((key) => localStorage.getItem(key), matchKey)).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('simulated-result.png') });
  await page.getByRole('button', { name: 'Simulera nästa ligamatch', exact: true }).click();
  await expect.poll(async () => (await readSeason(page)).fixtures.filter((f) => f.score).length).toBe(12);
  const completed = await readSeason(page);
  await page.reload();
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  expect(await readSeason(page)).toEqual(completed);
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await expect(page.getByRole('button', { name: 'Simulera direkt', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Se matchen', exact: true })).toHaveCount(0);
});

test('watching a league fixture supports speed changes, pause, saved viewing and full-time recording', async ({ page }, testInfo) => {
  await page.clock.install();
  await openLeague(page);
  await page.getByRole('button', { name: 'Se matchen', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hastighet', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Se nästa ligamatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('region', { name: 'Matchvisning', exact: true })).toBeVisible();
  await expect(page.locator('.touch-controls')).toHaveCount(0);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.clock.runFor(1200);
  await page.getByRole('combobox', { name: 'Hastighet', exact: true }).selectOption('5');
  await page.clock.runFor(350);
  await page.screenshot({ path: testInfo.outputPath('watching-five-times.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), matchKey);
  expect(saved.watching).toBe(true);
  expect(saved.playbackSpeed).toBe(5);
  expect(saved.players[4].x).not.toBe(-0.8);
  await page.clock.runFor(8000);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').remaining, matchKey)).toBe(saved.remaining);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad matchvisning/ }).click();
  await page.clock.runFor(32);
  await expect(page.getByRole('combobox', { name: 'Hastighet', exact: true })).toHaveValue('5');
  await page.getByRole('combobox', { name: 'Hastighet', exact: true }).selectOption('1');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  // Restore a nearly finished snapshot through the normal save path.
  await page.addInitScript((key) => {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    value.phase = 'playing';
    value.remaining = 0.12;
    localStorage.setItem(key, JSON.stringify(value));
  }, matchKey);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad matchvisning/ }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: 'Till ligan', exact: true }).click();
  expect((await readSeason(page)).fixtures.filter((f) => f.score)).toHaveLength(6);
  await expect(page.locator('.last-league-result')).toBeVisible();
});

test('a slide past a nearby opponent leaves the referee silent and both players standing', async ({ page }, testInfo) => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.randomState = 0;
  state.switchWait = [2, 2];
  state.players[4].x = -10;
  state.players[4].z = -10;
  state.players[9].x = -8;
  state.players[9].z = -9.2;
  state.players[6].x = 15;
  state.players[6].z = 10;
  state.ball = { x: 14.2, z: 10, vx: 0, vz: 0, owner: 6, blocked: null, lock: 0 };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: matchKey, value: state });
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  const canvas = page.locator('.game-canvas');
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const move = (await canvas.getAttribute('data-orientation')) === 'portrait' ? 'w' : 'd';
  await page.keyboard.down(move);
  await page.keyboard.press('k');
  await page.clock.runFor(560);
  await page.keyboard.up(move);
  await expect(page.locator('.decision-announcement')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('no-contact-no-whistle.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), matchKey);
  expect(saved.phase).toBe('playing');
  expect(saved.foul).toBeNull();
  expect(saved.randomState).toBe(0);
  expect(saved.players[4].yellowCards).toBe(0);
  expect(saved.players[9].fallen).toBe(0);
});

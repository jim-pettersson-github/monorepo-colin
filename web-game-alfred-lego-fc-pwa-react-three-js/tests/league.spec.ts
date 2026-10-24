import { expect, test } from '@playwright/test';
import type { Season } from '../src/game/league';
import { nextFixture } from '../src/game/league';

test('quick match starts from a visible dock and exposes three difficulty levels', async ({ page }, testInfo) => {
  await page.goto('./');
  const start = page.getByRole('button', { name: 'Starta snabbmatch', exact: true });
  const box = await start.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error('Missing start button');
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('start-menu.png') });
  await expect(page.getByRole('combobox', { name: 'Motstånd', exact: true }).locator('option')).toHaveText(['Lätt', 'Vanlig', 'Svår']);
  await page.getByRole('combobox', { name: 'Motstånd', exact: true }).selectOption('hard');
  await start.click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || '{}').difficulty)).toBe('hard');
  await page.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Avsluta matchen?' });
  await expect(confirm).toBeVisible();
  const end = await confirm.getByRole('button', { name: 'Ja, avsluta', exact: true }).boundingBox();
  if (!end) throw new Error('Missing confirmation');
  expect(end.y).toBeGreaterThanOrEqual(0);
  expect(end.y + end.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({ path: testInfo.outputPath('exit-confirmation.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  await page.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
  await page.getByRole('button', { name: 'Ja, avsluta', exact: true }).click();
  await expect(start).toBeVisible();
});

test('a league keeps its schedule, records a round once, restores a fixture and preserves results on abandonment', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  await page.getByRole('button', { name: 'Välj Colin FF', exact: true }).click();
  await page.getByRole('combobox', { name: 'Matchlängd', exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Starta ligan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Colin FF', exact: true })).toBeVisible();
  await expect(page.locator('.league-table tbody tr')).toHaveCount(12);
  await page.getByRole('button', { name: 'Spelschema', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Visa omgång', exact: true }).locator('option')).toHaveCount(22);
  await expect(page.locator('.fixture-row')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('league-schedule.png') });
  const initial: Season = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'));
  const fixture = nextFixture(initial);
  if (!fixture) throw new Error('Missing fixture');
  await page.getByRole('button', { name: 'Spela nästa ligamatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  // Shorten the fixture through the same saved-match restoration used by players.
  await page.addInitScript((fixtureId) => {
    const key = 'alfred-fc-match-v1';
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value?.league?.fixtureId === fixtureId && value.phase === 'kickoff') {
      value.phase = 'playing';
      value.remaining = 0.12;
      value.score = [2, 0];
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, fixture.id);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad ligamatch/ }).click();
  await page.clock.runFor(300);
  await expect(page.getByRole('heading', { name: 'Colin FF vinner!', exact: true })).toBeVisible();
  // Finishing commits the round before leaving the result screen, even if the page is reloaded.
  await page.reload();
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  const completed: Season = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'));
  expect(completed.fixtures.filter((f) => f.score)).toHaveLength(6);
  expect(completed.fixtures[fixture.id].score).toEqual(fixture.home === completed.club ? [2, 0] : [0, 2]);
  const row = page.locator('.league-table tbody tr.your-club');
  await expect(row).toContainText('Colin FF');
  await expect(row.locator('td').last()).toHaveText('3');
  await page.screenshot({ path: testInfo.outputPath('league-table.png') });
  await page.getByRole('button', { name: 'Spela nästa ligamatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad ligamatch/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Avsluta matchen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Ja, avsluta', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Spela nästa ligamatch', exact: true })).toBeVisible();
  const preserved: Season = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'));
  expect(preserved).toEqual(completed);
  await page.getByRole('button', { name: 'Ny säsong', exact: true }).click();
  await page.getByRole('button', { name: 'Starta ny säsong', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Börja om ligan?' })).toBeVisible();
  await page.getByRole('button', { name: 'Behåll min säsong', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(completed);
});

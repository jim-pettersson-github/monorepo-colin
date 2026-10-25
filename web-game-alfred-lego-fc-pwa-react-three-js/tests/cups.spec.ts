import { expect, test } from '@playwright/test';
import { createCup, createCupMatch, nextCupFixture } from '../src/game/cups';
import { createSeason } from '../src/game/league';

const key = (kind: string) => `alfred-fc-cup-${kind}-v1`;

test('a saved golden-goal match displays a compact overtime clock and resumes without ending a tied match', async ({ page }, info) => {
  await page.clock.install();
  const cup = createCup('alfred', 'alfred', 'easy', 60, 1),
    match = createCupMatch(cup);
  if (!match?.cup) throw new Error('No knockout match');
  match.phase = 'playing';
  match.remaining = 0;
  match.cup.extraTime = true;
  match.cup.extraElapsed = 7.8;
  await page.addInitScript(
    ({ cup, match }) => {
      localStorage.setItem('alfred-fc-cup-alfred-v1', JSON.stringify(cup));
      localStorage.setItem('alfred-fc-match-v1', JSON.stringify(match));
    },
    { cup, match },
  );
  await page.goto('./');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: /Fortsätt sparad cupmatch/ }).click();
  await expect(page.getByRole('timer')).toHaveText('+0:07');
  await expect(page.locator('.match-ribbon')).toContainText('GYLLENE MÅL');
  await page.clock.runFor(1500);
  await expect(page.getByRole('timer')).toHaveText('+0:09');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('cup-golden-goal.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(saved.cup.extraElapsed).toBeGreaterThan(8);
  expect(saved.remaining).toBe(0);
});
test('two cups keep independent saves, group tables and the league when restarting one cup', async ({ page }, info) => {
  const season = createSeason('skogsby', 'easy', 60);
  await page.addInitScript((s) => localStorage.setItem('alfred-fc-season-v1', JSON.stringify(s)), season);
  await page.goto('./');
  await page.getByRole('button', { name: /^Cupspel/ }).click();
  await expect(page.locator('.cup-choice')).toHaveCount(3);
  await page.getByRole('button', { name: 'Välj Colin FF', exact: true }).click();
  await page.getByRole('combobox', { name: 'Matchlängd', exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Starta Alfredcupen', exact: true }).click();
  const first = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('alfred'));
  expect(first.club).toBe('skogsby');
  expect(first.duration).toBe(60);
  await page.locator('.cup-choice').filter({ hasText: 'Mästarpokalen' }).click();
  await page.getByRole('button', { name: 'Starta Mästarpokalen', exact: true }).click();
  await expect(page.locator('.cup-table tbody tr')).toHaveCount(20);
  await page.getByRole('button', { name: 'Simulera direkt', exact: true }).click();
  await page.getByRole('button', { name: 'Simulera cupmatch', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').fixtures.filter((f: { score: unknown }) => f.score).length, key('masters')),
    )
    .toBe(10);
  await expect(page.locator('.cup-table tbody tr').first()).toBeVisible();
  const second = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('masters'));
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('alfred'))).toEqual(first);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || 'null'))).toEqual(season);
  await page.screenshot({ path: info.outputPath('cups-groups.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: /^Cupspel/ }).click();
  await page.locator('.cup-choice').filter({ hasText: 'Mästarpokalen' }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('masters'))).toEqual(second);
  await page.getByRole('button', { name: 'Ny cup', exact: true }).click();
  await page.getByRole('button', { name: 'Starta Mästarpokalen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Starta om Mästarpokalen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Behåll min cup', exact: true }).last().click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('masters'))).toEqual(second);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('alfred'))).toEqual(first);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a shared-screen cup fixture restores and advances its bracket exactly once', async ({ page }, info) => {
  await page.clock.install();
  const cup = createCup('alfred', 'alfred', 'easy', 60, 42);
  await page.addInitScript((cup) => {
    if (!localStorage.getItem('alfred-fc-cup-alfred-v1')) localStorage.setItem('alfred-fc-cup-alfred-v1', JSON.stringify(cup));
  }, cup);
  await page.goto('./');
  await page.getByRole('button', { name: /^Cupspel/ }).click();
  await page.getByRole('button', { name: 'Två på samma skärm', exact: true }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.locator('.source-label select').nth(1).selectOption('keyboard2');
  await page.getByRole('button', { name: 'Spela cupmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.match-ribbon')).toContainText('Alfredcupen');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const original = nextCupFixture(cup);
  if (!original) throw new Error('No fixture');
  await page.addInitScript((id) => {
    const key = 'alfred-fc-match-v1',
      m = JSON.parse(localStorage.getItem(key) || 'null');
    if (m?.cup?.fixtureId === id) {
      m.phase = 'playing';
      m.remaining = 0.12;
      m.score = [2, 0];
      localStorage.setItem(key, JSON.stringify(m));
    }
  }, original.id);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad cupmatch/ }).click();
  await page.clock.runFor(300);
  await expect(page.getByRole('button', { name: 'Till cupen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Spela igen/ })).toHaveCount(0);
  const updated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('alfred'));
  expect(nextCupFixture(updated)?.round).toBe(original.round + 1);
  await page.getByRole('button', { name: 'Till cupen', exact: true }).click();
  await page.screenshot({ path: info.outputPath('cup-bracket.png'), fullPage: true });
  await page.getByRole('button', { name: 'Spela cupmatch', exact: true }).click();
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
  await page.getByRole('button', { name: 'Ja, avsluta', exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('alfred'))).toEqual(updated);
});

test('cup match viewing supports 5x playback and reload without changing cup results', async ({ page }) => {
  const cup = createCup('masters', 'skogsby', 'normal', 60, 12);
  await page.addInitScript((cup) => localStorage.setItem('alfred-fc-cup-masters-v1', JSON.stringify(cup)), cup);
  await page.goto('./');
  await page.getByRole('button', { name: /^Cupspel/ }).click();
  await page.locator('.cup-choice').filter({ hasText: 'Mästarpokalen' }).click();
  await page.getByRole('button', { name: 'Se matchen', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hastighet', exact: true }).selectOption('5');
  await page.getByRole('button', { name: 'Se cupmatchen', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const match = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(match.cup.runId).toBe(cup.id);
  expect(match.watching).toBe(true);
  expect(match.playbackSpeed).toBe(5);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad matchvisning/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key('masters'))).toEqual(cup);
});

test('world cup selects national teams, simulates a group round and restores a shared-screen match separately from club cups', async ({ page }, info) => {
  const clubCup = createCup('alfred', 'alfred', 'easy', 60, 8);
  await page.addInitScript((cup) => {
    if (!localStorage.getItem('alfred-fc-cup-alfred-v1')) localStorage.setItem('alfred-fc-cup-alfred-v1', JSON.stringify(cup));
  }, clubCup);
  await page.goto('./');
  await page.getByRole('button', { name: /^Cupspel/ }).click();
  await page.locator('.cup-choice').filter({ hasText: 'Världscupen' }).click();
  await expect(page.locator('.club-option')).toHaveCount(24);
  await expect(page.locator('.club-option .national-flag')).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Välj Sverige', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Matchlängd', exact: true }).selectOption('60');
  await page.getByRole('button', { name: 'Starta Världscupen', exact: true }).click();
  await expect(page.locator('.cup-groups > section')).toHaveCount(6);
  await expect(page.locator('.cup-groups tbody tr')).toHaveCount(24);
  await expect(page.getByRole('region', { name: 'Bästa grupptreor' }).locator('tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: 'Simulera direkt', exact: true }).click();
  await page.getByRole('button', { name: 'Simulera cupmatch', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-cup-world-v1') || '{}').fixtures.filter((f: { score: unknown }) => f.score).length),
    )
    .toBe(12);
  const world = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-cup-world-v1') || 'null'));
  expect(world.club).toBe('swe');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-cup-alfred-v1') || 'null'))).toEqual(clubCup);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('world-cup-groups.png'), fullPage: true });
  await page.getByRole('button', { name: 'Två på samma skärm', exact: true }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.locator('.source-label select').nth(1).selectOption('keyboard2');
  await page.getByRole('button', { name: 'Spela cupmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.match-ribbon')).toContainText('Världscupen');
  await expect(page.locator('.home-name').first()).toContainText('Sverige');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad cupmatch/ }).click();
  await expect(page.locator('.match-ribbon')).toContainText('Världscupen');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
  await page.getByRole('button', { name: 'Ja, avsluta', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-cup-world-v1') || 'null'))).toEqual(world);
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await expect(page.locator('.club-option')).toHaveCount(20);
});

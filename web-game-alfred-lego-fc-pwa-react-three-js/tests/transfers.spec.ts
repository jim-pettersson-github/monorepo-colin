import { expect, test } from '@playwright/test';
import { createCup, createCupMatch, finishCupMatch, nextCupFixture } from '../src/game/cups';
import { createLeagueMatch, createSeason } from '../src/game/league';
import { createMatch } from '../src/game/model';
import { playerPrice } from '../src/game/players';
import { createTransfers, prepareTransferMatch, squadFor } from '../src/game/transfers';

const transferKey = 'alfred-fc-transfers-v1';

test('the transfer market buys and sells fixed players with clear costs and persistent balances', async ({ page }, info) => {
  const initial = createTransfers();
  const target = squadFor(initial, 'brick').find((p) => !p.keeper && p.overall < 70);
  if (!target) throw new Error('Missing transfer target');
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await expect(page.locator('.market-window')).toContainText('Transferfönstret är öppet');
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill(target.name);
  await page.getByRole('button', { name: `Köp eller byt ${target.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: target.name, exact: true })).toBeVisible();
  await expect(dialog.getByRole('meter')).toHaveCount(5);
  await dialog.getByRole('button', { name: 'Avbryt', exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), transferKey)).toBeNull();
  await page.getByRole('button', { name: `Köp eller byt ${target.name}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Bekräfta köp', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const bought = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey);
  expect(bought.owners[target.id]).toBe('alfred');
  expect(bought.money.alfred).toBe(6000 - playerPrice(target));
  await page.reload();
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await page.getByRole('button', { name: /^Din trupp/ }).click();
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill(target.name);
  await expect(page.locator('.athlete-card')).toHaveCount(1);
  await expect(page.getByText('Skyddad från AI-köp i 3 matcher')).toBeVisible();
  await page.screenshot({ path: info.outputPath('bought-player.png'), fullPage: true });
  await page.getByRole('button', { name: `Sälj ${target.name}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Bekräfta försäljning', exact: true }).click();
  const sold = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey);
  expect(sold.owners[target.id]).toBe('brick');
  expect(sold.money.alfred).toBe(bought.money.alfred + Math.floor((playerPrice(target) * 0.8) / 50) * 50);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a top signing enters the first five and keeps its identity after kickoff and reload', async ({ page }) => {
  const initial = createTransfers();
  initial.money.alfred = 100000;
  const target = squadFor(initial, 'brick').find((p) => !p.keeper && p.overall >= 90);
  if (!target) throw new Error('Missing top player');
  await page.addInitScript(
    ({ key, initial }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
    },
    { key: transferKey, initial },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill(target.name);
  await page.getByRole('button', { name: `Köp eller byt ${target.name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Bekräfta köp', exact: true }).click();
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await page.getByRole('button', { name: /Starta snabbmatch/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(saved.lineups[0]).toContain(target.id);
  expect(saved.players.some((p: { athlete: string }) => p.athlete === target.id)).toBe(true);
  await page.getByText('Matchens spelare och betyg', { exact: true }).click();
  await expect(page.locator('.match-lineups')).toContainText(target.name);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(restored.lineups).toEqual(saved.lineups);
});

test('a completed match opens the transfer window and rewards the club only once', async ({ page }) => {
  await page.clock.install();
  const prepared = prepareTransferMatch(createTransfers(), createMatch('solo', 60));
  prepared.state.phase = 'playing';
  prepared.state.remaining = 0.1;
  prepared.state.score = [2, 0];
  await page.addInitScript(
    ({ save, state, key }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify(save));
        localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state));
      }
    },
    { save: prepared.save, state: prepared.state, key: transferKey },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await expect(page.locator('.market-window')).toContainText('Transferfönstret är stängt');
  await expect(page.getByRole('button', { name: /Köp eller byt/ }).first()).toBeDisabled();
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(400);
  await expect(page.getByRole('status').filter({ hasText: '+400 mynt för matchen' })).toBeVisible();
  await page.getByRole('button', { name: 'Öppna transferfönstret', exact: true }).click();
  await expect(page.locator('.market-window')).toContainText('Transferfönstret är öppet');
  const earned = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey);
  expect(earned.money.alfred).toBeGreaterThanOrEqual(6400);
  expect(earned.paid).toHaveLength(1);
  expect(earned.lastReward.game).toBe(400);
  await page.reload();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey)).toEqual(earned);
});

for (const kind of ['cup', 'league'] as const) {
  test(`winning a ${kind} pays its prize once and preserves it on reload`, async ({ page }) => {
    await page.clock.install();
    let cup = kind === 'cup' ? createCup('alfred', 'alfred', 'easy', 60, 5) : null;
    const season = kind === 'league' ? createSeason('alfred', 'easy', 60) : null;
    if (cup)
      while ((nextCupFixture(cup)?.round ?? 3) < 3) {
        const match = createCupMatch(cup);
        if (!match) throw new Error('Missing cup fixture');
        match.phase = 'finished';
        match.remaining = 0;
        match.score = [4, 0];
        cup = finishCupMatch(cup, match);
      }
    if (season) for (const f of season.fixtures) if (f.round < 21) f.score = f.home === 'alfred' ? [4, 0] : f.away === 'alfred' ? [0, 4] : [0, 0];
    const state = cup ? createCupMatch(cup) : season ? createLeagueMatch(season) : null;
    if (!state) throw new Error('Missing final fixture');
    const prepared = prepareTransferMatch(createTransfers(), state);
    prepared.state.phase = 'playing';
    prepared.state.remaining = 0.1;
    prepared.state.score = [4, 0];
    await page.addInitScript(
      ({ cup, season, prepared, key }) => {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify(prepared.save));
          localStorage.setItem('alfred-fc-match-v1', JSON.stringify(prepared.state));
          if (cup) localStorage.setItem('alfred-fc-cup-alfred-v1', JSON.stringify(cup));
          if (season) localStorage.setItem('alfred-fc-season-v1', JSON.stringify(season));
        }
      },
      { cup, season, prepared, key: transferKey },
    );
    await page.goto('./');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
    await page.clock.runFor(400);
    await expect(page.locator('.match-reward')).toContainText('prispengar');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey);
    expect(saved.lastReward.prize).toBe(kind === 'cup' ? 6000 : 8000);
    expect(saved.prizes).toHaveLength(1);
    await page.getByRole('button', { name: 'Öppna transferfönstret', exact: true }).click();
    await page.reload();
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), transferKey)).toEqual(saved);
  });
}

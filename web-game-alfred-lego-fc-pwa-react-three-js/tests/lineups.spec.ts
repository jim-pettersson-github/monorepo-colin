import { expect, test } from '@playwright/test';
import { createMatch } from '../src/game/model';
import { createTransfers, prepareTransferMatch, squadFor } from '../src/game/transfers';

test('choose family starters including a lower-rated player, save them and start with that exact five', async ({ page }, info) => {
  const save = createTransfers();
  const squad = squadFor(save, 'katona');
  const geza = squad.find((p) => p.name === 'Geza Katona');
  const jan = squad.find((p) => p.name === 'Jan Katona');
  if (!geza || !jan) throw new Error('Missing family players');
  await page.goto('./');
  await page.getByRole('button', { name: 'Välj IFK Katona', exact: true }).click();
  await page.getByText('Välj startfemma · IFK Katona', { exact: true }).click();
  const picker = page.locator('.lineup-picker');
  await picker.getByRole('button', { name: 'Familjen först', exact: true }).click();
  await picker.getByRole('combobox', { name: 'Startande utespelare 1', exact: true }).selectOption(geza.id);
  await expect(picker.getByRole('combobox', { name: 'Startande målvakt', exact: true })).toHaveValue(jan.id);
  const preferred = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null').lineups.katona);
  expect(preferred).toContain(geza.id);
  expect(new Set(preferred).size).toBe(5);
  await page.reload();
  await page.getByRole('button', { name: 'Välj IFK Katona', exact: true }).click();
  await page.getByText('Välj startfemma · IFK Katona', { exact: true }).click();
  await expect(picker.getByRole('combobox', { name: 'Startande utespelare 1', exact: true })).toHaveValue(geza.id);
  await page.screenshot({ path: info.outputPath('chosen-family-five.png'), fullPage: true });
  await page.getByRole('button', { name: 'Starta snabbmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const match = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(match.lineups[0]).toEqual(preferred);
  expect(match.players[1].athlete).toBe(geza.id);
  await page.getByText('Matchens spelare och betyg', { exact: true }).click();
  await expect(page.locator('.match-lineups')).toContainText('Geza Katona');
});

test('a paused substitution changes the player, survives reload and leaves the saved starting preference alone', async ({ page }, info) => {
  const prepared = prepareTransferMatch(createTransfers(), createMatch('solo', 180, 'easy', ['katona', 'petterssons']));
  prepared.state.players[1].yellowCards = 1;
  const incoming = squadFor(prepared.save, 'katona').find((p) => p.name === 'Geza Katona');
  if (!incoming) throw new Error('Missing substitute');
  await page.addInitScript(
    ({ save, state }) => {
      if (!localStorage.getItem('alfred-fc-transfers-v1')) {
        localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
        localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state));
      }
    },
    { save: prepared.save, state: prepared.state },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByText('Spelarbyten', { exact: true }).click();
  const panel = page.locator('.match-substitutions');
  await panel.getByRole('combobox', { name: 'Spelare ut', exact: true }).selectOption('1');
  await panel.getByRole('combobox', { name: 'Spelare in', exact: true }).selectOption(incoming.id);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  await panel.getByRole('button', { name: 'Genomför byte', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Bytet är klart');
  const match = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(match.lineups[0][1]).toBe(incoming.id);
  expect(match.players[1].athlete).toBe(incoming.id);
  await expect(page.locator('.home-name .yellow-card-count')).toHaveAttribute('aria-label', '1 gula kort');
  expect(match.remaining).toBe(before.remaining);
  expect(match.squads[0]).toHaveLength(10);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null').lineups)).toBeUndefined();
  await page.screenshot({ path: info.outputPath('paused-substitution.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByText('Spelarbyten', { exact: true }).click();
  await expect(page.getByRole('list', { name: 'Spelare på planen' })).toContainText('Geza Katona');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared-screen players can manage either team and goalkeeper substitutes stay in goal', async ({ page }) => {
  const prepared = prepareTransferMatch(createTransfers(), createMatch('versus', 180, 'easy', ['katona', 'petterssons']));
  const keeper = squadFor(prepared.save, 'petterssons').find((p) => p.keeper && !prepared.state.lineups?.[1].includes(p.id));
  if (!keeper) throw new Error('Missing reserve keeper');
  await page.addInitScript(
    ({ save, state }) => {
      localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
      localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state));
    },
    { save: prepared.save, state: prepared.state },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByText('Spelarbyten', { exact: true }).click();
  const panel = page.locator('.match-substitutions');
  await panel.getByRole('combobox', { name: 'Lag för bytet', exact: true }).selectOption('1');
  await panel.getByRole('combobox', { name: 'Spelare ut', exact: true }).selectOption('0');
  await expect(panel.getByRole('combobox', { name: 'Spelare in', exact: true }).locator('option')).toHaveCount(1);
  await panel.getByRole('button', { name: 'Genomför byte', exact: true }).click();
  const match = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(match.lineups[1][0]).toBe(keeper.id);
  expect(match.lineups[0]).toEqual(prepared.state.lineups?.[0]);
});

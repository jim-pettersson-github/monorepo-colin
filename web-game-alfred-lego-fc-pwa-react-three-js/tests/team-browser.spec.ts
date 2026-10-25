import { expect, test } from '@playwright/test';
import { createSeason } from '../src/game/league';
import { familyFive, pickStarter } from '../src/game/lineups';
import { createMatch } from '../src/game/model';
import { clubFootballers } from '../src/game/players';
import { buyPlayer, createTransfers, prepareTransferMatch, setLineup, squadFor } from '../src/game/transfers';

test('browse family squads, selected starters and bench stats without changing an ongoing match or club saves', async ({ page }, info) => {
  let save = createTransfers();
  const squad = squadFor(save, 'katona');
  const geza = squad.find((p) => p.name === 'Geza Katona');
  if (!geza) throw new Error('Missing family player');
  const five = pickStarter(squad, familyFive(squad), 1, geza.id);
  if (!five) throw new Error('Missing starting five');
  save = setLineup(save, 'katona', five);
  const prepared = prepareTransferMatch(save, createMatch('solo', 180, 'easy', ['katona', 'petterssons']));
  const season = createSeason('katona', 'easy', 180);
  await page.addInitScript(
    ({ prepared, season }) => {
      localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(prepared.save));
      localStorage.setItem('alfred-fc-match-v1', JSON.stringify(prepared.state));
      localStorage.setItem('alfred-fc-season-v1', JSON.stringify(season));
    },
    { prepared, season },
  );
  await page.goto('./');
  const before = await page.locator('.selected-club').allTextContents();
  await page.getByRole('button', { name: 'Lag & spelare', exact: true }).click();
  const browser = page.getByRole('region', { name: 'Lag och spelare', exact: true });
  await expect(browser.getByRole('heading', { name: 'Lag & spelare', exact: true })).toBeVisible();
  await expect(browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true }).locator('option')).toHaveCount(20);
  await expect(browser.locator('.squad-pitch .pitch-starter')).toHaveCount(5);
  await expect(browser.locator('.squad-pitch')).toContainText('Geza Katona');
  await expect(browser.locator('.squad-player-list button')).toHaveCount(10);
  await browser.getByRole('button', { name: 'Visa spelarkort för Colin Katona', exact: true }).click();
  const card = browser.getByRole('article', { name: 'Spelarkort för Colin Katona', exact: true });
  await expect(card).toContainText('Avbytare');
  await expect(card.getByRole('img', { name: 'Totalbetyg 100 av 100', exact: true })).toBeVisible();
  await expect(card.getByRole('meter')).toHaveCount(5);
  await page.screenshot({ path: info.outputPath('team-browser-family.png'), fullPage: true });
  await browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true }).selectOption('smaland');
  await expect(browser.getByRole('button', { name: 'Nästa lag →', exact: true })).toBeDisabled();
  await browser.getByRole('button', { name: '← Föregående lag', exact: true }).click();
  await expect(browser.locator('.squad-heading')).toContainText('IF Danielsson');
  await browser.getByRole('searchbox', { name: 'Sök lag eller spelare', exact: true }).fill('does-not-exist');
  await expect(browser.getByRole('status')).toHaveText('Inga lag matchar sökningen.');
  await browser.getByRole('button', { name: 'Tillbaka till menyn', exact: true }).click();
  expect(await page.locator('.selected-club').allTextContents()).toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null'))).toEqual(prepared.save);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'))).toEqual(prepared.state);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || 'null'))).toEqual(season);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('player search follows transferred ownership and the national-team catalogue shows flags and all stats', async ({ page }, info) => {
  const pele = clubFootballers.find((p) => p.name === 'Pelé');
  if (!pele) throw new Error('Missing Pelé');
  let save = createTransfers();
  save.money.danielsson = 100000;
  save = buyPlayer(save, 'danielsson', pele.id).save;
  await page.addInitScript((save) => localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save)), save);
  await page.goto('./');
  await page.getByRole('button', { name: 'Lag & spelare', exact: true }).click();
  const browser = page.getByRole('region', { name: 'Lag och spelare', exact: true });
  await browser.getByRole('searchbox', { name: 'Sök lag eller spelare', exact: true }).fill('Pele');
  await expect(browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true })).toHaveValue('danielsson');
  await expect(browser.locator('.squad-player-list button')).toHaveCount(11);
  await browser.getByRole('button', { name: 'Visa spelarkort för Pelé', exact: true }).click();
  await expect(browser.locator('.squad-player-detail')).toContainText('PRIME 1970');
  await browser.getByRole('button', { name: 'Landslag · 24', exact: true }).click();
  await expect(browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true }).locator('option')).toHaveCount(24);
  await expect(browser.locator('.squad-heading')).toContainText('Sverige');
  await expect(browser.locator('.squad-heading .national-flag')).toHaveCount(1);
  await expect(browser.locator('.squad-player-list button')).toHaveCount(10);
  await expect(browser.locator('.squad-player-detail').getByRole('meter')).toHaveCount(5);
  await browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true }).selectOption('jpn');
  await expect(browser.locator('.squad-heading')).toContainText('Japan');
  await page.screenshot({ path: info.outputPath('team-browser-national.png'), fullPage: true });
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await expect(page.getByRole('button', { name: 'Starta snabbmatch', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('inspect either match team before kickoff and its saved bench during a paused match', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Välj IFK Katona', exact: true }).click();
  await page.getByText('Matchens lag & spelare', { exact: true }).click();
  const preview = page.locator('.match-team-browser');
  await preview.getByRole('combobox', { name: 'Lag att titta på', exact: true }).selectOption('1');
  await expect(preview.locator('.squad-heading')).toContainText('IFK Göteborg');
  await preview.getByRole('combobox', { name: 'Lag att titta på', exact: true }).selectOption('0');
  await preview.getByRole('button', { name: 'Visa spelarkort för Geza Katona', exact: true }).click();
  await expect(preview.locator('.squad-player-detail')).toContainText('Avbytare');
  expect(await page.evaluate(() => localStorage.getItem('alfred-fc-transfers-v1'))).toBeNull();
  await page.getByRole('button', { name: 'Starta snabbmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  await page.getByText('Matchens lag & spelare', { exact: true }).click();
  await preview.getByRole('button', { name: 'Visa spelarkort för Geza Katona', exact: true }).click();
  await expect(preview.locator('.squad-player-detail')).toContainText('Avbytare');
  await expect(preview.locator('.squad-player-list button')).toHaveCount(10);
  await expect(preview.locator('.squad-pitch .pitch-starter')).toHaveCount(5);
  await page.screenshot({ path: info.outputPath('match-squad-browser.png') });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'))).toEqual(saved);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

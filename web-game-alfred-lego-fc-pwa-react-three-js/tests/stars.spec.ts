import { expect, test } from '@playwright/test';
import { clubs } from '../src/game/clubs';
import { createSeason, standings } from '../src/game/league';
import { clubFootballers } from '../src/game/players';
import { createTransfers, squadFor } from '../src/game/transfers';

test('prime legends and modern stars are searchable, filtered by era and shown in balanced club squads', async ({ page }, info) => {
  const pele = clubFootballers.find((p) => p.name === 'Pelé');
  if (!pele) throw new Error('Missing Pelé');
  const save = createTransfers();
  save.activeClub = pele.origin === 'alfred' ? 'brick' : 'alfred';
  await page.addInitScript((save) => localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save)), save);
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await expect(page.getByText('200 STJÄRNOR · 20 KLUBBAR · PRIME', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill('Pele');
  await expect(page.locator('.athlete-card')).toHaveCount(1);
  await expect(page.locator('.athlete-card')).toContainText('PRIME 1970');
  await expect(page.locator('.athlete-card')).toContainText('Brasilien');
  await page.getByRole('combobox', { name: 'Spelarera', exact: true }).selectOption('modern');
  await expect(page.locator('.athlete-card')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Spelarera', exact: true }).selectOption('legend');
  await expect(page.locator('.athlete-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Köp eller byt Pelé', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Prime 1970');
  await page.getByRole('button', { name: 'Avbryt', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill('');
  await page.getByRole('combobox', { name: 'Spelarera', exact: true }).selectOption('all');
  await page.getByRole('combobox', { name: 'Din klubb', exact: true }).selectOption('stockholm');
  await page.getByRole('button', { name: /^Din trupp/ }).click();
  await expect(page.locator('.athlete-card')).toHaveCount(10);
  await expect(page.locator('.athlete-card .star-prime')).toHaveCount(10);
  await page.getByRole('combobox', { name: 'Position', exact: true }).selectOption('GK');
  await expect(page.locator('.athlete-card')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Position', exact: true }).selectOption('all');
  await page.screenshot({ path: info.outputPath('prime-star-squad.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a completed lower division promotes the winners into the next saved season without changing club money', async ({ page }, info) => {
  const season = createSeason('brick', 'easy', 60);
  for (const f of season.fixtures) f.score = f.home === 'brick' ? [5, 0] : f.away === 'brick' ? [0, 5] : [1, 1];
  const save = createTransfers();
  save.money.brick = 14350;
  await page.addInitScript(
    ({ season, save }) => {
      if (!localStorage.getItem('alfred-fc-season-v1')) {
        localStorage.setItem('alfred-fc-season-v1', JSON.stringify(season));
        localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
      }
    },
    { season, save },
  );
  await page.goto('./');
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  await expect(page.locator('.league-heading')).toContainText('DIVISION 2');
  await expect(page.locator('.promotion-result')).toContainText('Uppflyttning!');
  await page.getByRole('combobox', { name: 'Visa division', exact: true }).selectOption('0');
  await expect(page.locator('.league-table caption')).toHaveText('Division 1');
  await expect(page.locator('.league-table tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Starta nästa säsong', exact: true }).click();
  await expect(page.locator('.league-heading')).toContainText('DIVISION 1');
  await expect(page.locator('.league-heading')).toContainText('SÄSONG 2');
  const next = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || 'null'));
  const lower = standings(season, season.divisions?.[1])
    .slice(0, 2)
    .map((r) => r.club);
  expect(lower.every((id) => next.divisions[0].includes(id))).toBe(true);
  expect(next.fixtures).toHaveLength(180);
  expect(next.fixtures.every((f: { score: unknown }) => f.score === null)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null').money.brick)).toBe(14350);
  await page.reload();
  await page.getByRole('button', { name: /^Divisionsspel/ }).click();
  await expect(page.locator('.league-heading')).toContainText('DIVISION 1');
  await page.screenshot({ path: info.outputPath('promoted-division.png'), fullPage: true });
});

test('the old economy upgrades without erasing money or player ownership', async ({ page }) => {
  const save = createTransfers();
  const originalIds = new Set(clubs.slice(0, 12).map((c) => c.id));
  save.owners = Object.fromEntries(clubFootballers.filter((p) => originalIds.has(p.origin as typeof save.activeClub)).map((p) => [p.id, save.owners[p.id]]));
  for (const c of clubs.slice(12)) delete save.money[c.id];
  const player = squadFor(save, 'brick').find((p) => !p.keeper);
  if (!player) throw new Error('Missing old signing');
  save.owners[player.id] = 'alfred';
  save.money.alfred = 17250;
  save.paid = ['old-payment'];
  await page.addInitScript((save) => {
    if (!localStorage.getItem('alfred-fc-transfers-v1')) localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
  }, save);
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await expect(page.locator('.club-balance strong')).toHaveText(/17\s?250 mynt/);
  await page.getByRole('button', { name: /^Din trupp/ }).click();
  await page.getByRole('searchbox', { name: 'Sök spelare eller klubb' }).fill(player.name);
  await expect(page.locator('.athlete-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Din klubb', exact: true }).selectOption('norrsken');
  const upgraded = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null'));
  expect(upgraded.owners[player.id]).toBe('alfred');
  expect(upgraded.money.alfred).toBe(17250);
  expect(upgraded.paid).toEqual(save.paid);
  expect(Object.keys(upgraded.owners)).toHaveLength(200);
  await expect(page.locator('.athlete-card')).toHaveCount(10);
  await page.reload();
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await expect(page.getByRole('combobox', { name: 'Din klubb', exact: true })).toHaveValue('norrsken');
});

test('family clubs show their requested stars and Colin Katona plays at 100', async ({ page }, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Trupp & transfers/ }).click();
  await page.getByRole('combobox', { name: 'Din klubb', exact: true }).selectOption('danielsson');
  await page.getByRole('button', { name: /^Din trupp/ }).click();
  await expect(page.locator('.athlete-card')).toHaveCount(10);
  for (const name of await page.locator('.athlete-card h2').allTextContents()) expect(name.endsWith(' Danielsson')).toBe(true);
  await expect(page.locator('.athlete-card').filter({ has: page.getByRole('heading', { name: 'Alfred Danielsson', exact: true }) })).toContainText('99');
  await page.getByRole('combobox', { name: 'Din klubb', exact: true }).selectOption('katona');
  await page.getByRole('combobox', { name: 'Spelarera', exact: true }).selectOption('family');
  await expect(page.locator('.athlete-card')).toHaveCount(6);
  await expect(page.locator('.athlete-card').filter({ has: page.getByRole('heading', { name: 'Colin Katona', exact: true }) })).toContainText('100');
  await page.screenshot({ path: info.outputPath('katona-family-players.png'), fullPage: true });
  await page.getByRole('button', { name: /^Snabbmatch/ }).click();
  await page.getByRole('button', { name: 'Välj IFK Katona', exact: true }).click();
  await page.getByRole('button', { name: 'Starta snabbmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.getByText('Matchens spelare och betyg', { exact: true }).click();
  await expect(page.locator('.match-lineups')).toContainText('Colin Katona');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

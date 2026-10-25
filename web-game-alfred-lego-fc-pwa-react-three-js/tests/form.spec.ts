import { expect, test } from '@playwright/test';
import { createLeagueMatch, createSeason } from '../src/game/league';
import { createMatch } from '../src/game/model';
import { createTransfers, prepareTransferMatch, squadFor } from '../src/game/transfers';

test('team browser shows effective form stats and the saved match keeps its bonus through pause and reload', async ({ page }, info) => {
  const save = createTransfers();
  save.form = { katona: { bonus: 2, remaining: 3 } };
  const geza = squadFor(save, 'katona').find((p) => p.name === 'Geza Katona');
  if (!geza) throw new Error('Missing family fixture');
  await page.addInitScript((save) => {
    if (!localStorage.getItem('alfred-fc-transfers-v1')) localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
  }, save);
  await page.goto('./');
  await page.getByRole('button', { name: 'Lag & spelare', exact: true }).click();
  const browser = page.getByRole('region', { name: 'Lag och spelare', exact: true });
  await browser.getByRole('combobox', { name: 'Bläddra bland lag', exact: true }).selectOption('katona');
  await expect(browser.locator('.squad-heading .team-form-badge')).toHaveText('Segerform +2 · 3 matcher kvar');
  await browser.getByRole('button', { name: 'Visa spelarkort för Geza Katona', exact: true }).click();
  const card = browser.locator('.squad-player-detail');
  await expect(card.getByRole('img', { name: 'Totalbetyg 91 av 100', exact: true })).toBeVisible();
  await expect(card).toContainText('Ordinarie betyg 89');
  const values = await card.getByRole('meter').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('value'))));
  expect(values).toEqual([geza.pace, geza.shooting, geza.passing, geza.defending, geza.goalkeeping].map((n) => Math.min(100, n + 2)));
  await page.screenshot({ path: info.outputPath('team-form-stats.png'), fullPage: true });
  await browser.getByRole('button', { name: 'Tillbaka till menyn', exact: true }).click();
  await page.getByRole('button', { name: 'Välj IFK Katona', exact: true }).click();
  await page.getByRole('button', { name: 'Starta snabbmatch', exact: true }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.player-badge.team-0 .team-form-badge')).toContainText('3 matcher kvar');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(snapshot.form[0]).toEqual(save.form.katona);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
  expect(after.form).toEqual(snapshot.form);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null').form.katona.remaining)).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const active of [false, true]) {
  test(`a completed win ${active ? 'expires the last active boost without refreshing' : 'awards form once and carries it into a rematch'}`, async ({
    page,
  }) => {
    await page.clock.install();
    const save = createTransfers();
    if (active) save.form = { alfred: { bonus: 2, remaining: 1 } };
    const prepared = prepareTransferMatch(save, createMatch('solo', 60));
    prepared.state.phase = 'playing';
    prepared.state.remaining = 0.1;
    prepared.state.score = [4, 0];
    await page.addInitScript(({ save, state }) => {
      if (!localStorage.getItem('alfred-fc-transfers-v1')) {
        localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save));
        localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state));
      }
    }, prepared);
    await page.goto('./');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
    await page.clock.runFor(400);
    await expect(page.locator('.match-reward')).toBeVisible();
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null'));
    expect(result.formResults).toHaveLength(1);
    if (active) expect(result.form.alfred).toBeUndefined();
    else {
      expect(result.form.alfred.bonus).toBe(2);
      expect(result.form.alfred.remaining).toBeGreaterThanOrEqual(1);
      expect(result.form.alfred.remaining).toBeLessThanOrEqual(3);
      await expect(page.getByRole('dialog').locator('.team-form-badge')).toContainText('Segerform +2');
    }
    await page.getByRole('button', { name: /^Spela igen/ }).click();
    await page.getByRole('button', { name: 'Pausa matchen' }).click();
    const match = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'));
    expect(match.form[0]).toEqual(result.form.alfred ?? null);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null').formResults)).toEqual(result.formResults);
  });
}

test('finishing a league round records form for background teams and survives reload without applying twice', async ({ page }) => {
  await page.clock.install();
  const season = createSeason('alfred', 'easy', 60);
  const state = createLeagueMatch(season);
  if (!state) throw new Error('Missing league fixture');
  const prepared = prepareTransferMatch(createTransfers(), state);
  prepared.state.phase = 'playing';
  prepared.state.remaining = 0.1;
  prepared.state.score = [4, 0];
  await page.addInitScript(
    ({ prepared, season }) => {
      if (!localStorage.getItem('alfred-fc-transfers-v1')) {
        localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(prepared.save));
        localStorage.setItem('alfred-fc-match-v1', JSON.stringify(prepared.state));
        localStorage.setItem('alfred-fc-season-v1', JSON.stringify(season));
      }
    },
    { prepared, season },
  );
  await page.goto('./');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(400);
  await expect(page.locator('.match-reward')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null'));
  const league = await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || 'null'));
  const games = league.fixtures.filter((f: { round: number }) => f.round === 0);
  expect(saved.formResults).toHaveLength(10);
  for (const game of games) {
    if (game.score[0] === game.score[1]) continue;
    const winner = game.score[0] > game.score[1] ? game.home : game.away;
    expect(saved.form[winner].bonus).toBe(2);
  }
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || 'null'))).toEqual(saved);
});

import { expect, test } from '@playwright/test';
import { roomServer } from './wifi-helpers';

test('choose a car and track, race, pause and return to the menu', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Nytt race' }).click();

  await expect(page.getByRole('heading', { name: 'Välj bil' })).toBeVisible();
  await page.getByRole('button', { name: 'Nästa bil' }).click();
  await expect(page.getByRole('heading', { name: 'R42' })).toBeVisible();
  await page.getByRole('button', { name: /Välj bana/ }).click();

  await page.getByRole('button', { name: /Rheinland-Ring/ }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /Starta race/ }).click();

  const hud = page.getByTestId('hud');
  await expect(page.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(hud).toHaveAttribute('data-phase', 'racing', { timeout: 8000 });
  // The minimap marks the start and finish line.
  await expect(hud.getByTestId('map-finish')).toHaveCount(1);
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => Number(await hud.getAttribute('data-speed')), { timeout: 10000 }).toBeGreaterThan(80);
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: testInfo.outputPath('race.png') });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paus' })).toBeVisible();
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(page.getByRole('heading', { name: 'Paus' })).toBeHidden();

  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Avsluta racet' }).click();
  await expect(page.getByRole('button', { name: /Snabbstart.*Spectre R42.*Rheinland-Ring.*1 varv/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('scoreboard: quick races alone and online rank together, careers apart, and a lap saved offline is sent', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'One layout is enough for the lists.');
  // The test room server keeps its database between runs, so names are unique to this run.
  const run = Date.now().toString(36);
  const rival = `Rival${run.slice(-4)}`;
  const me = `Jag${run.slice(-4)}`;
  const lap = async (lap: Record<string, unknown>) => {
    const sent = await request.post(`${roomServer}?a=lap`, {
      headers: { 'Content-Type': 'text/plain' },
      data: JSON.stringify({ game: 'charlie-fs', track: 'vaxjo', car: 'diablo', transmission: 'auto', ...lap }),
    });
    expect(sent.ok()).toBe(true);
  };
  await lap({ player: `r${run}`, name: rival, time: 10_500, online: true });
  // A faster career lap by the same player stays off the quick-race list.
  await lap({ player: `p${run}`, name: me, car: 'corvette', time: 10_100, kind: 'career' });
  await page.addInitScript(
    ({ server, run, me }) => {
      localStorage.setItem('charlie-for-speed:room-server', server);
      localStorage.setItem('charlie-for-speed:identity', JSON.stringify({ id: `p${run}`, name: me }));
      localStorage.setItem(
        'charlie-for-speed:pending-laps',
        JSON.stringify([{ track: 'vaxjo', car: 'corvette', transmission: 'manual', time: 10_400, kind: 'race', online: false }]),
      );
    },
    { server: roomServer, run, me },
  );
  await page.goto('./');
  await page.getByRole('button', { name: 'Topplistor' }).click();

  const overall = page.getByRole('region', { name: 'Totalt' });
  await expect(overall.locator('tr.me')).toContainText(me);
  await expect(overall.locator('tr.me')).toContainText('0:10.40');
  await expect(page.getByRole('region', { name: 'Banrekord' })).toContainText('Växjö Motorring');
  expect(await page.evaluate(() => localStorage.getItem('charlie-for-speed:pending-laps'))).toBeNull();
  await page.screenshot({ path: info.outputPath('scoreboard.png'), fullPage: true });

  await page
    .getByRole('region', { name: 'Banrekord' })
    .getByRole('button', { name: /Växjö Motorring/ })
    .click();
  const board = page.getByRole('region', { name: 'Topplista Växjö Motorring' });
  await expect(board.locator('tr.me')).toContainText(me);
  await expect(board.locator('tr.me')).toContainText('0:10.40');
  await expect(board.locator('tr.me')).toContainText('Ensam');
  await expect(board.locator('tr.me')).toContainText('Manuell');
  await expect(board.locator('tr').filter({ hasText: rival })).toContainText('Online');
  const names = await board.locator('tbody tr td:nth-child(2)').allTextContents();
  expect(names.indexOf(me)).toBeGreaterThanOrEqual(0);
  expect(names.indexOf(me)).toBeLessThan(names.indexOf(rival));
  await expect(board).toContainText('Du ligger på plats');
  await page.getByRole('button', { name: '7 dagar' }).click();
  await expect(board.locator('tr.me')).toContainText(me);
  await page.screenshot({ path: info.outputPath('scoreboard-track.png'), fullPage: true });
  await page
    .getByRole('button', { name: /Alla banor/ })
    .first()
    .click();
  await expect(overall).toBeVisible();

  await page.getByRole('button', { name: 'Karriär', exact: true }).click();
  const careerRecords = page.getByRole('region', { name: 'Banrekord' });
  await expect(careerRecords.getByRole('button', { name: /Växjö Motorring/ }).locator('small')).toContainText('0:10.10');
});

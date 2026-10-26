import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createCup, cupName, nextCupFixture } from '../src/game/cups';
import { createLeagueMatch, createSeason } from '../src/game/league';
import { createMatch } from '../src/game/model';
import { createTransfers, lineupFor, squadFor } from '../src/game/transfers';

const roomServer = 'http://127.0.0.1:4020/api.php';

async function devices(browser: Browser, baseURL: string | undefined, viewport: { width: number; height: number } | null) {
  if (!baseURL || !viewport) throw new Error('Missing preview configuration');
  const hostContext = await browser.newContext({ viewport });
  const guestContext = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const contexts: BrowserContext[] = [hostContext, guestContext];
  const saved = createMatch('solo');
  const season = createSeason('alfred', 'easy', 60);
  for (const context of contexts)
    await context.addInitScript(
      ({ match, league, server }) => {
        localStorage.setItem('alfred-fc:room-server', server);
        if (!localStorage.getItem('alfred-fc-match-v1')) localStorage.setItem('alfred-fc-match-v1', JSON.stringify(match));
        if (!localStorage.getItem('alfred-fc-season-v1')) localStorage.setItem('alfred-fc-season-v1', JSON.stringify(league));
      },
      { match: saved, league: season, server: roomServer },
    );
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  for (const page of [host, guest]) {
    await page.goto(baseURL);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }
  return {
    host,
    guest,
    saved,
    season,
    contexts,
    async close() {
      for (const context of contexts) await context.close();
    },
  };
}

async function enter(host: Page, guest: Page, league = false, cup: boolean | 'world' = false) {
  if (cup) {
    await host.getByRole('button', { name: /^Cupspel/ }).click();
    if (cup === 'world') await host.locator('.cup-choice').filter({ hasText: 'Världscupen' }).click();
    await host.getByRole('button', { name: 'Två online', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp cupmatch online', exact: true }).click();
  } else if (league) {
    await host.getByRole('button', { name: /^Divisionsspel/ }).click();
    await host.getByRole('button', { name: 'Två online', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp ligamatch online', exact: true }).click();
  } else await host.getByRole('button', { name: /^Spela online/ }).click();
  await guest.getByRole('button', { name: /^Spela online/ }).click();
  await host.getByRole('button', { name: cup ? 'Skapa cupmatch' : league ? 'Skapa ligamatch' : 'Skapa match', exact: false }).click();
  await guest.getByRole('button', { name: 'Anslut', exact: false }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{4}$/);
}
// The host shows a room code from the local room server; the guest types it in.
async function connect(host: Page, guest: Page, league = false, cup: boolean | 'world' = false) {
  await enter(host, guest, league, cup);
  const code = (await host.getByTestId('room-code').textContent()) ?? '';
  await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code);
  await guest.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
  for (const page of [host, guest]) await expect(page.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 30_000 });
}
async function start(host: Page, guest: Page, touch = false) {
  await host.locator('.source-label select').selectOption('keyboard1');
  await guest.locator('.source-label select').selectOption(touch ? 'touch' : 'keyboard1');
  await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
  await host.getByRole('button', { name: 'Starta onlinematch', exact: true }).click();
  for (const page of [host, guest]) await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
}
const positions = (page: Page) =>
  page.locator('.overview-player').evaluateAll((nodes) => nodes.map((node) => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))]));

test('the guest chooses its starting five from the host roster and both peers see its paused substitution', async ({ browser, baseURL, page }) => {
  test.setTimeout(90_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  try {
    const save = createTransfers();
    const squad = squadFor(save, 'brick');
    const first = squad.find((p) => !p.keeper && !lineupFor(save, 'brick').includes(p.id));
    if (!first) throw new Error('Missing guest starter');
    const guestSave = createTransfers();
    guestSave.form = { brick: { bonus: 2, remaining: 1 } };
    guestSave.owners[first.id] = 'alfred';
    save.form = { brick: { bonus: 2, remaining: 3 } };
    await host.evaluate((save) => localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save)), save);
    await host.reload();
    await guest.evaluate((save) => localStorage.setItem('alfred-fc-transfers-v1', JSON.stringify(save)), guestSave);
    await guest.reload();
    await connect(host, guest);
    await guest.getByText('Matchens lag & spelare', { exact: true }).click();
    const roster = guest.locator('.match-team-browser');
    await roster.getByRole('combobox', { name: 'Lag att titta på', exact: true }).selectOption('1');
    await expect(roster.locator('.squad-player-list')).toContainText(first.name);
    await expect(roster.locator('.squad-player-list button')).toHaveCount(10);
    await expect(roster.locator('.team-form-badge')).toHaveText('Segerform +2 · 3 matcher kvar');
    await guest.getByText('Matchens lag & spelare', { exact: true }).click();
    await guest.getByText('Välj startfemma · IFK Göteborg', { exact: true }).click();
    await guest.getByRole('combobox', { name: 'Startande utespelare 1', exact: true }).selectOption(first.id);
    await expect(guest.getByRole('combobox', { name: 'Startande utespelare 1', exact: true })).toHaveValue(first.id);
    await start(host, guest);
    for (const p of [host, guest]) await expect(p.locator('.player-badge.team-1 .team-form-badge')).toContainText('3 matcher kvar');
    await guest.getByRole('button', { name: 'Pausa matchen' }).click();
    for (const p of [host, guest]) await expect(p.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
    for (const p of [host, guest]) {
      await p.getByText('Matchens spelare och betyg', { exact: true }).click();
      await expect(p.locator('.match-lineups')).toContainText(first.name);
    }
    await guest.getByText('Spelarbyten', { exact: true }).click();
    const panel = guest.locator('.match-substitutions');
    await expect(panel.getByRole('combobox', { name: 'Lag för bytet', exact: true })).toHaveCount(0);
    await panel.getByRole('combobox', { name: 'Spelare ut', exact: true }).selectOption('1');
    const incomingId = await panel.getByRole('combobox', { name: 'Spelare in', exact: true }).inputValue();
    const incoming = squad.find((p) => p.id === incomingId);
    if (!incoming) throw new Error('Missing guest substitute');
    await panel.getByRole('button', { name: 'Genomför byte', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Bytet är klart');
    for (const p of [host, guest]) {
      await expect(p.locator('.match-lineups')).toContainText(incoming.name);
      await expect(p.locator('.match-lineups')).not.toContainText(first.name);
    }
    expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || '{}'))).toEqual(pair.saved);
    expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-transfers-v1') || '{}'))).toEqual(guestSave);
  } finally {
    await pair.close();
  }
});

test('real peers pair through the room server, play without other HTTP services, control separate teams and preserve local saves', async ({
  browser,
  baseURL,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (error) => errors.push(error.message));
  try {
    // After precaching, only the room server answers HTTP; the match itself runs directly between the peers.
    const roomOrigin = new URL(roomServer).origin;
    for (const context of pair.contexts)
      await context.route(
        (url) => url.origin !== roomOrigin,
        (route) => route.abort(),
      );
    await connect(host, guest);
    await host.screenshot({ path: testInfo.outputPath('online-connected.png'), fullPage: true });
    await start(host, guest, true);
    await expect(guest.locator('.touch-controls')).toHaveAttribute('aria-label', 'Pekkontroller spelare 2');
    await expect(host.locator('.match-ribbon')).toContainText('DU ÄR P1');
    await expect(guest.locator('.match-ribbon')).toContainText('DU ÄR P2');
    await expect(host.getByText('Avspark!', { exact: true })).toHaveCount(0, { timeout: 6000 });
    const before = await positions(host);
    const portrait = (await host.locator('.game-canvas').getAttribute('data-orientation')) === 'portrait';
    await host.keyboard.down(portrait ? 'w' : 'd');
    const stick = guest.getByRole('group', { name: 'Rörelsespak' });
    const bounds = await stick.boundingBox();
    if (!bounds) throw new Error('Missing guest stick');
    const cdp = await guest.context().newCDPSession(guest);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ id: 4, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * 0.85 }],
    });
    await expect.poll(async () => Math.abs((await positions(host))[4][0] - before[4][0])).toBeGreaterThan(1);
    await expect.poll(async () => Math.abs((await positions(host))[9][0] - before[9][0])).toBeGreaterThan(0.5);
    await host.keyboard.up(portrait ? 'w' : 'd');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await guest.getByRole('button', { name: 'Pausa matchen' }).click();
    for (const p of [host, guest]) await expect(p.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
    await expect.poll(async () => JSON.stringify(await positions(guest))).toBe(JSON.stringify(await positions(host)));
    await guest.screenshot({ path: testInfo.outputPath('online-guest-paused.png') });
    for (const p of [host, guest]) {
      expect(await p.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || '{}'))).toEqual(pair.saved);
      expect(await p.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(pair.season);
    }
    expect(errors).toEqual([]);
  } finally {
    await pair.close();
  }
});

test('room pairing supports shared pause, background blocking, resume and a disconnected peer', async ({ browser, baseURL, page }) => {
  test.setTimeout(90_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  try {
    await connect(host, guest);
    await start(host, guest);
    await guest.evaluate(() => window.dispatchEvent(new Event('blur')));
    for (const p of [host, guest]) await expect(p.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
    await expect(host.getByRole('button', { name: /Fortsätt matchen/ })).toBeDisabled();
    const time = await host.getByRole('timer').textContent();
    await guest.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(host.getByRole('button', { name: /Fortsätt matchen/ })).toBeEnabled();
    expect(await host.getByRole('timer').textContent()).toBe(time);
    await guest.getByRole('button', { name: /Fortsätt matchen/ }).click();
    for (const p of [host, guest]) await expect(p.getByRole('dialog')).not.toBeVisible();
    await guest.setViewportSize({ width: 915, height: 412 });
    await expect(guest.locator('.game-canvas')).toHaveAttribute('data-orientation', 'landscape');
    await guest.close();
    await expect(host.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible({ timeout: 6000 });
    await expect(host.getByRole('button', { name: /Fortsätt matchen/ })).toBeDisabled();
    await host.getByRole('button', { name: 'Avsluta matchen', exact: true }).click();
    await host.getByRole('button', { name: 'Ja, avsluta', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Skapa match', exact: false })).toBeVisible();
  } finally {
    await pair.close();
  }
});

test('a wrong room code shows an error, keeps the typed code for a retry and the pairing can start over', async ({ page }, testInfo) => {
  await page.addInitScript((server) => localStorage.setItem('alfred-fc:room-server', server), roomServer);
  await page.goto('./');
  await page.getByRole('button', { name: /^Spela online/ }).click();
  await page.getByRole('button', { name: 'Anslut', exact: false }).click();
  const box = page.getByRole('textbox', { name: 'Rumskod', exact: true });
  // Room codes never use 0, so this room cannot exist.
  await box.fill('0000');
  await page.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Rummet finns inte');
  await expect(box).toHaveValue('0000');
  await expect(box).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Gå med i rummet', exact: true })).toBeEnabled();
  await expect(page.getByText(/QR/)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('online-pairing.png'), fullPage: true });
  await page.getByRole('button', { name: 'Börja om kopplingen' }).click();
  await expect(page.getByRole('button', { name: 'Anslut', exact: false })).toBeVisible();
});

test('an online league fixture locks its teams, records only the host season and preserves the guest saves', async ({ browser, baseURL, page }) => {
  test.setTimeout(90_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  try {
    const fixture = createLeagueMatch(pair.season);
    if (!fixture) throw new Error('Missing league fixture');
    fixture.remaining = 0.15;
    fixture.score = [2, 1];
    await host.evaluate((state) => localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state)), fixture);
    await host.reload();
    await connect(host, guest, true);
    for (const p of [host, guest]) await expect(p.getByRole('region', { name: 'Ligamatch', exact: true })).toBeVisible();
    await expect(host.getByText('Välj lag och matchlängd', { exact: false })).toHaveCount(0);
    await start(host, guest, true);
    for (const p of [host, guest]) await expect(p.locator('.final-score')).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByText('Resultatet sparas i värdens liga.', { exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: /Spela igen/ })).toHaveCount(0);
    const completed = await host.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'));
    expect(completed.fixtures.filter((f: { score: unknown }) => f.score)).toHaveLength(10);
    expect(completed.fixtures[fixture.league?.fixtureId ?? -1].score).toEqual(
      completed.fixtures[fixture.league?.fixtureId ?? -1].home === completed.club ? [2, 1] : [1, 2],
    );
    expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(pair.season);
    expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || '{}'))).toEqual(pair.saved);
    await host.getByRole('button', { name: 'Till ligan', exact: true }).click();
    await expect(host.locator('.last-league-result')).toBeVisible();
    // Opening and cancelling the next connection does not invent another league result.
    await host.getByRole('button', { name: 'Två online', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp ligamatch online', exact: true }).click();
    await host.getByRole('button', { name: '← Till ligan', exact: true }).click();
    expect(await host.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(completed);
  } finally {
    await pair.close();
  }
});

for (const kind of ['alfred', 'world'] as const) {
  test(`an online ${kind} cup fixture shows the competition on both peers and preserves guest cup and league saves`, async ({ browser, baseURL, page }) => {
    test.setTimeout(90_000);
    const pair = await devices(browser, baseURL, page.viewportSize());
    const { host, guest } = pair;
    const own = createCup(kind, kind === 'world' ? 'swe' : 'alfred', 'easy', 60, 5),
      other = createCup(kind, kind === 'world' ? 'jpn' : 'brick', 'normal', 60, 7);
    try {
      for (const [p, cup] of [
        [host, own],
        [guest, other],
      ] as const) {
        await p.evaluate((cup) => localStorage.setItem(`alfred-fc-cup-${cup.kind}-v1`, JSON.stringify(cup)), cup);
        await p.reload();
      }
      await connect(host, guest, false, kind === 'world' ? 'world' : true);
      await expect(guest.getByRole('heading', { name: `${cupName(kind)} online.` })).toBeVisible();
      await start(host, guest);
      await expect(host.locator('.match-ribbon')).toContainText(cupName(kind));
      await host.getByRole('button', { name: 'Pausa matchen' }).click();
      await expect(guest.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
      expect(await guest.evaluate((kind) => JSON.parse(localStorage.getItem(`alfred-fc-cup-${kind}-v1`) || 'null'), kind)).toEqual(other);
      expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || 'null'))).toEqual(pair.season);
      expect(await guest.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || 'null'))).toEqual(pair.saved);
      expect(nextCupFixture(own)).toBeDefined();
    } finally {
      await pair.close();
    }
  });
}

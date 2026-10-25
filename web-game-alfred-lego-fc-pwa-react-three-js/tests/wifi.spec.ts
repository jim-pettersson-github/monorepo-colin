import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createCup, cupName, nextCupFixture } from '../src/game/cups';
import { createLeagueMatch, createSeason } from '../src/game/league';
import { createMatch } from '../src/game/model';

async function devices(browser: Browser, baseURL: string | undefined, viewport: { width: number; height: number } | null) {
  if (!baseURL || !viewport) throw new Error('Missing preview configuration');
  const hostContext = await browser.newContext({ viewport });
  const guestContext = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const contexts: BrowserContext[] = [hostContext, guestContext];
  const saved = createMatch('solo');
  const season = createSeason('alfred', 'easy', 60);
  for (const context of contexts)
    await context.addInitScript(
      ({ match, league }) => {
        if (!localStorage.getItem('alfred-fc-match-v1')) localStorage.setItem('alfred-fc-match-v1', JSON.stringify(match));
        if (!localStorage.getItem('alfred-fc-season-v1')) localStorage.setItem('alfred-fc-season-v1', JSON.stringify(league));
      },
      { match: saved, league: season },
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
    await host.getByRole('button', { name: 'Två via Wi-Fi', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp cupmatch via Wi-Fi', exact: true }).click();
  } else if (league) {
    await host.getByRole('button', { name: /^Divisionsspel/ }).click();
    await host.getByRole('button', { name: 'Två via Wi-Fi', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp ligamatch via Wi-Fi', exact: true }).click();
  } else await host.getByRole('button', { name: 'Spela via Wi-Fi' }).click();
  await guest.getByRole('button', { name: 'Spela via Wi-Fi' }).click();
  await host.getByRole('button', { name: cup ? 'Skapa cupmatch' : league ? 'Skapa ligamatch' : 'Skapa match', exact: false }).click();
  await guest.getByRole('button', { name: 'Anslut', exact: false }).click();
  await expect(host.getByRole('img', { name: 'QR-kod för matchen', exact: true })).toBeVisible();
}
async function imageTransfer(from: Page, to: Page) {
  const src = await from.locator('.connection-qr').getAttribute('src');
  if (!src) throw new Error('Missing QR image');
  await to.locator('input[type=file]').setInputFiles({ name: 'connection.png', mimeType: 'image/png', buffer: Buffer.from(src.split(',')[1], 'base64') });
}
async function paste(to: Page, code: string) {
  await to.getByRole('textbox', { name: 'Klistra in anslutningskod', exact: true }).fill(code);
  await to.getByRole('button', { name: 'Läs in koden', exact: true }).click();
}
async function connect(host: Page, guest: Page, qr = true, league = false, cup: boolean | 'world' = false) {
  await enter(host, guest, league, cup);
  if (qr) await imageTransfer(host, guest);
  else {
    await host.getByText('Visa koden som text', { exact: true }).click();
    await paste(guest, await host.getByRole('textbox', { name: 'Din matchkod', exact: true }).inputValue());
  }
  await expect(guest.getByRole('img', { name: 'QR-kod med svar till värden', exact: true })).toBeVisible();
  if (qr) await imageTransfer(guest, host);
  else {
    await guest.getByText('Visa koden som text', { exact: true }).click();
    await paste(host, await guest.getByRole('textbox', { name: 'Din svarskod', exact: true }).inputValue());
  }
  for (const page of [host, guest]) await expect(page.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 15_000 });
}
async function start(host: Page, guest: Page, touch = false) {
  await host.locator('.source-label select').selectOption('keyboard1');
  await guest.locator('.source-label select').selectOption(touch ? 'touch' : 'keyboard1');
  await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
  await host.getByRole('button', { name: 'Starta Wi-Fi-match', exact: true }).click();
  for (const page of [host, guest]) await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
}
const positions = (page: Page) =>
  page.locator('.overview-player').evaluateAll((nodes) => nodes.map((node) => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))]));

test('real peers connect through both QR images without HTTP services, control separate teams and preserve local saves', async ({
  browser,
  baseURL,
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (error) => errors.push(error.message));
  try {
    // Keep the LAN interface available to ICE/mDNS while blocking all HTTP services after precaching.
    for (const context of pair.contexts) await context.route('**/*', (route) => route.abort());
    await connect(host, guest);
    await host.screenshot({ path: testInfo.outputPath('wifi-connected.png'), fullPage: true });
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
    await guest.screenshot({ path: testInfo.outputPath('wifi-guest-paused.png') });
    for (const p of [host, guest]) {
      expect(await p.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-match-v1') || '{}'))).toEqual(pair.saved);
      expect(await p.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(pair.season);
    }
    expect(errors).toEqual([]);
  } finally {
    await pair.close();
  }
});

test('manual codes support shared pause, background blocking, resume and a disconnected peer', async ({ browser, baseURL, page }) => {
  test.setTimeout(60_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  try {
    await connect(host, guest, false);
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

test('invalid codes and denied camera permission allow retrying without losing the host code', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      };
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela via Wi-Fi' }).click();
  await page.getByRole('button', { name: 'Skapa match', exact: false }).click();
  await expect(page.locator('.connection-qr')).toBeVisible();
  const code = await page.locator('.connection-qr').getAttribute('src');
  await paste(page, 'this-is-not-an-alfred-code');
  await expect(page.getByRole('alert')).toContainText('ingen anslutningskod');
  await page.getByRole('button', { name: 'Skanna med kameran' }).click();
  await expect(page.getByRole('alert')).toContainText('Kameran kunde inte öppnas');
  expect(await page.locator('.connection-qr').getAttribute('src')).toBe(code);
  await expect(page.locator('video')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('wifi-pairing.png'), fullPage: true });
  await page.getByRole('button', { name: 'Börja om kopplingen' }).click();
  await expect(page.getByRole('button', { name: 'Anslut', exact: false })).toBeVisible();
});

test('camera scanning reads a live QR frame and releases the camera after a successful scan', async ({ page, browser, baseURL }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela via Wi-Fi' }).click();
  await page.getByRole('button', { name: 'Skapa match', exact: false }).click();
  await expect(page.locator('.connection-qr')).toBeVisible();
  const qr = await page.locator('.connection-qr').getAttribute('src');
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  try {
    await context.addInitScript((image) => {
      const target = window as unknown as { wifiCameraTrack: MediaStreamTrack };
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const drawing = canvas.getContext('2d');
        const img = new Image();
        img.src = image || '';
        await img.decode();
        const draw = () => drawing?.drawImage(img, 0, 0, 512, 512);
        draw();
        const stream = canvas.captureStream(10);
        const interval = setInterval(draw, 100);
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(interval);
          stop();
        };
        target.wifiCameraTrack = track;
        return stream;
      };
    }, qr);
    const guest = await context.newPage();
    await guest.goto(baseURL || '/');
    await guest.getByRole('button', { name: 'Spela via Wi-Fi' }).click();
    await guest.getByRole('button', { name: 'Anslut', exact: false }).click();
    await guest.getByRole('button', { name: 'Skanna med kameran' }).click();
    await expect(guest.getByRole('img', { name: 'QR-kod med svar till värden', exact: true })).toBeVisible();
    await expect(guest.locator('video')).not.toBeVisible();
    await expect.poll(() => guest.evaluate(() => (window as unknown as { wifiCameraTrack: MediaStreamTrack }).wifiCameraTrack?.readyState)).toBe('ended');
  } finally {
    await context.close();
  }
});

test('a Wi-Fi league fixture locks its teams, records only the host season and preserves the guest saves', async ({ browser, baseURL, page }) => {
  test.setTimeout(60_000);
  const pair = await devices(browser, baseURL, page.viewportSize());
  const { host, guest } = pair;
  try {
    const fixture = createLeagueMatch(pair.season);
    if (!fixture) throw new Error('Missing league fixture');
    fixture.remaining = 0.15;
    fixture.score = [2, 1];
    await host.evaluate((state) => localStorage.setItem('alfred-fc-match-v1', JSON.stringify(state)), fixture);
    await host.reload();
    await connect(host, guest, true, true);
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
    await host.getByRole('button', { name: 'Två via Wi-Fi', exact: true }).click();
    await host.getByRole('button', { name: 'Koppla upp ligamatch via Wi-Fi', exact: true }).click();
    await host.getByRole('button', { name: '← Till ligan', exact: true }).click();
    expect(await host.evaluate(() => JSON.parse(localStorage.getItem('alfred-fc-season-v1') || '{}'))).toEqual(completed);
  } finally {
    await pair.close();
  }
});

for (const kind of ['alfred', 'world'] as const) {
  test(`a QR ${kind} cup fixture shows the competition on both peers and preserves guest cup and league saves`, async ({ browser, baseURL, page }) => {
    test.setTimeout(60000);
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
      await connect(host, guest, true, false, kind === 'world' ? 'world' : true);
      await expect(guest.getByRole('heading', { name: `${cupName(kind)} via Wi-Fi.` })).toBeVisible();
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

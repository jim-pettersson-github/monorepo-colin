import { mkdirSync } from 'node:fs';
import { type Browser, expect, type Page, test } from '@playwright/test';
import { createGame } from '../src/game/model';
import { showControls } from './room-helpers';

// Pairs through the local PHP room server that Playwright starts next to the preview.
const roomServer = 'http://127.0.0.1:4021/api.php';

async function device(browser: Browser, baseURL: string | undefined, mobile: boolean) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript((server) => localStorage.setItem('colin-game:room-server', server), roomServer);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL ?? './');
  return { context, page, errors };
}

const lights = (page: Page) => page.getByRole('button', { name: /^(Tänd|Släck) ljuset$/ });

test('two devices share one building: lights, lift and doorway, each camera on its own character', async ({ browser, baseURL }, info) => {
  test.setTimeout(120000);
  mkdirSync('test-results', { recursive: true });
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    // The guest's own single-player game must stay exactly as it was.
    const own = createGame(3);
    own.started = true;
    own.player.place = 'mall';
    own.player.floor = 2;
    await guest.page.evaluate((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), own);
    await guest.page.reload();
    await guest.page.getByRole('button', { name: 'Till menyn', exact: true }).click();
    await expect(guest.page.getByRole('button', { name: 'Fortsätt', exact: true })).toBeVisible();
    const ownSave = await guest.page.evaluate(() => localStorage.getItem('colin-game-v1'));
    expect(JSON.parse(ownSave ?? '{}').player.place).toBe('mall');

    await host.page.getByRole('button', { name: /^Spela tillsammans/ }).click();
    await host.page.getByRole('button', { name: /^Jag är värd/ }).click();
    const code = host.page.getByTestId('room-code');
    await expect(code).toHaveText(/^[A-Z0-9]{4}$/);

    await guest.page.getByRole('button', { name: /^Spela tillsammans/ }).click();
    await guest.page.getByRole('button', { name: /^Jag går med/ }).click();
    await guest.page.getByLabel('Rumskod').fill((await code.textContent()) ?? '');
    await guest.page.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
    const guestGame = guest.page.locator('main.game');
    await expect(guestGame).toHaveAttribute('data-place', 'hotel', { timeout: 30000 });
    await expect(guest.page.getByRole('status').filter({ hasText: 'Colin har pausat' })).toBeVisible();

    await expect(host.page.getByText('✓ Kompis 2 – med i spelet')).toBeVisible();
    await host.page.getByRole('button', { name: 'Börja spela', exact: true }).click();
    const hostGame = host.page.locator('main.game');
    await expect(hostGame).toHaveAttribute('data-place', 'hotel');
    await showControls(host.page);
    await expect(host.page.getByRole('button', { name: 'Spela tillsammans, 2 spelare' })).toBeVisible();
    await expect(guest.page.getByRole('button', { name: 'Spela tillsammans, 2 spelare' })).toBeVisible();
    await expect(guest.page.getByRole('button', { name: /Titta på våning E/ })).toContainText('Kompis 2 här · Colin');
    await expect(guest.page.getByRole('status').filter({ hasText: 'Du är Kompis 2' })).toBeVisible();

    // The guest switches off the light; Colin's room goes dark too.
    await showControls(guest.page);
    await guest.page.getByRole('button', { name: 'Upptäck rummet' }).click();
    await guest.page.getByRole('button', { name: 'Släck ljuset' }).click();
    await showControls(host.page);
    await host.page.getByRole('button', { name: 'Upptäck rummet' }).click();
    await expect(lights(host.page)).toHaveText(/Tänd ljuset/);
    await expect(lights(guest.page)).toHaveText(/Tänd ljuset/);

    // Colin rides to floor 2. The guest's camera stays with Kompis 2, but the lift indicator follows the shared lift.
    await host.page.getByRole('button', { name: 'Hissen', exact: true }).click();
    await host.page.getByRole('button', { name: 'Gå in', exact: true }).click();
    await expect(hostGame).toHaveAttribute('data-riding', 'true', { timeout: 10000 });
    await host.page.getByRole('button', { name: 'Välj våning', exact: true }).click();
    await host.page.getByRole('button', { name: 'Våning 2', exact: true }).click();
    await expect(hostGame).toHaveAttribute('data-floor', '2', { timeout: 30000 });
    await expect(guest.page.locator('.game-scene')).toHaveAttribute('data-lift-floor', '2', { timeout: 10000 });
    await expect(guestGame).toHaveAttribute('data-floor', '0');
    await guest.page.screenshot({ path: info.outputPath('guest.png') });

    // The guest calls the lift back and holds the doorway: Colin's lift waits for Kompis 2.
    await guest.page.getByRole('button', { name: 'Hissen', exact: true }).click();
    await guest.page.getByRole('button', { name: 'Hämta hiss', exact: true }).click();
    await expect(guest.page.locator('.game-scene')).toHaveAttribute('data-lift-floor', 'E', { timeout: 30000 });
    await guest.page.getByRole('button', { name: 'Stå i dörren', exact: true }).click();
    await host.page.getByRole('button', { name: 'Välj våning', exact: true }).click();
    await host.page.getByRole('button', { name: 'Våning 3', exact: true }).click();
    await expect(host.page.getByLabel('Hissens läge')).toHaveText('Dörröppningen är upptagen', { timeout: 12000 });
    await expect(guest.page.getByLabel('Hissens läge')).toHaveText('Dörröppningen är upptagen');
    await host.page.screenshot({ path: info.outputPath('host.png') });

    // Colin stops playing together: the guest calmly returns to its own single play, save untouched.
    await host.page.getByRole('button', { name: 'Spela tillsammans, 2 spelare' }).click();
    await host.page.getByRole('button', { name: 'Sluta spela tillsammans', exact: true }).click();
    await expect(guest.page.getByText('Kontakten med Colins värld bröts. Nu spelar du själv igen.')).toBeVisible({ timeout: 15000 });
    await expect(guest.page.getByRole('button', { name: 'Fortsätt', exact: true })).toBeVisible();
    expect(await guest.page.evaluate(() => localStorage.getItem('colin-game-v1'))).toBe(ownSave);
    await expect(hostGame).toHaveAttribute('data-place', 'hotel');
    expect(await host.page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').companions)).toBeUndefined();
    expect([...host.errors, ...guest.errors]).toEqual([]);
  } finally {
    await host.context.close();
    await guest.context.close();
  }
});

test('a guest who closes the app just disappears from the host world', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  mkdirSync('test-results', { recursive: true });
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    await host.page.getByRole('button', { name: /^Spela tillsammans/ }).click();
    await host.page.getByRole('button', { name: /^Jag är värd/ }).click();
    const code = host.page.getByTestId('room-code');
    await expect(code).toHaveText(/^[A-Z0-9]{4}$/);
    await host.page.getByRole('button', { name: /^(Börja|Fortsätt) spela$/ }).click();
    // Late joiners come in while Colin is already playing.
    await guest.page.getByRole('button', { name: /^Spela tillsammans/ }).click();
    await guest.page.getByRole('button', { name: /^Jag går med/ }).click();
    await guest.page.getByLabel('Rumskod').fill((await code.textContent()) ?? '');
    await guest.page.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
    await expect(guest.page.locator('main.game')).toHaveAttribute('data-place', 'hotel', { timeout: 30000 });
    await showControls(host.page);
    await expect(host.page.getByRole('button', { name: 'Spela tillsammans, 2 spelare' })).toBeVisible();
    await guest.context.close();
    await expect(host.page.getByRole('button', { name: 'Spela tillsammans, 1 spelare' })).toBeVisible({ timeout: 20000 });
    await expect(host.page.getByRole('status').filter({ hasText: 'Kompis 2 har gått hem' })).toBeVisible();
    await host.page.getByRole('button', { name: 'Gå in', exact: true }).click();
    await expect(host.page.locator('main.game')).toHaveAttribute('data-riding', 'true', { timeout: 10000 });
    expect(host.errors).toEqual([]);
  } finally {
    await host.context.close();
  }
});

test('without a room server, playing together calmly explains that internet is needed', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Spela tillsammans/ }).click();
  await expect(page.getByRole('dialog')).toContainText('behöver internet');
  await page.getByRole('button', { name: 'Stäng' }).last().click();
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.locator('main.game')).toHaveAttribute('data-place', 'hotel');
  await expect(page.getByRole('button', { name: /^Spela tillsammans/ })).toHaveCount(0);
});

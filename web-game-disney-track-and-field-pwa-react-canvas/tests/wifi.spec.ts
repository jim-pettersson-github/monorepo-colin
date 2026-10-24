import { expect, test } from '@playwright/test';
import { createGame, defaultSettings } from '../src/game/model';
import { connect, paste, peers } from './wifi-helpers';

test('QR peers run separate athletes, synchronize pause and keep local saves', async ({ browser, baseURL }, info) => {
  test.setTimeout(60000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
  const saved = createGame(defaultSettings());
  try {
    for (const p of [host, guest]) await p.evaluate((save) => localStorage.setItem('sagospelen-event-v1', JSON.stringify(save)), saved);
    for (const p of [host, guest]) {
      await p.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await p.reload();
      await expect.poll(() => p.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      await p.context().route('**/*', (route) => route.abort());
    }
    await host.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
    await host.getByRole('button', { name: 'Skapa tävling', exact: true }).click();
    await host.getByRole('combobox', { name: 'Figur spelare 1', exact: true }).selectOption('buzz');
    await host.getByRole('combobox', { name: 'Figur spelare 2', exact: true }).selectOption('baymax');
    await connect(host, guest);
    await guest.getByRole('combobox', { name: 'Kontroll spelare 1', exact: true }).selectOption('touch');
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true }).click();
    for (const p of [host, guest]) await expect(p.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
    await expect(guest.getByRole('region', { name: 'Pekkontroller spelare 2' })).toBeVisible();
    await expect(guest.getByRole('status').filter({ hasText: 'PÅ ERA PLATSER' })).toHaveCount(0, { timeout: 5000 });
    const button = guest.getByRole('button', { name: 'Spelare 2 vänster steg', exact: true });
    const b = await button.boundingBox();
    if (!b) throw new Error('No touch step');
    await guest.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await guest.mouse.down();
    await expect.poll(async () => Number(await host.locator('.runner-status progress').nth(1).getAttribute('value'))).toBeGreaterThan(5);
    expect(Number(await host.locator('.runner-status progress').nth(0).getAttribute('value'))).toBe(0);
    await guest.mouse.up();
    await guest.getByRole('button', { name: 'Pausa tävlingen' }).click();
    for (const p of [host, guest]) await expect(p.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
    await expect.poll(() => guest.getByRole('timer').textContent()).toBe(await host.getByRole('timer').textContent());
    await guest.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(host.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeDisabled();
    await guest.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(host.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeEnabled();
    for (const p of [host, guest]) expect(await p.evaluate(() => JSON.parse(localStorage.getItem('sagospelen-event-v1') || '{}'))).toEqual(saved);
    await guest.screenshot({ path: info.outputPath('wifi-guest.png') });
    await guest.close();
    await expect(host.getByRole('button', { name: 'Fortsätt tävlingen →' })).toBeDisabled({ timeout: 6000 });
    expect(errors).toEqual([]);
  } finally {
    await group.close();
  }
});

test('four devices use separate QR exchanges and all receive the same championship', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const group = await peers(browser, baseURL);
  const { host } = group;
  try {
    await host.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
    await host.getByRole('combobox', { name: 'Antal enheter' }).selectOption('4');
    await host.getByRole('button', { name: 'Skapa tävling', exact: true }).click();
    await host.getByLabel('Tävling', { exact: true }).selectOption('championship');
    const guests = [group.guest, await group.open(true), await group.open(false)];
    for (const [i, guest] of guests.entries()) {
      if (i > 0) await host.getByRole('button', { name: `Anslut spelare ${i + 2}`, exact: true }).click();
      await connect(host, guest, true);
      await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    }
    await host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true }).click();
    for (const [i, p] of [host, ...guests].entries()) {
      await expect(p.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
      await expect(p.getByText(`WI-FI · DU ÄR P${i + 1}`, { exact: true })).toBeVisible();
      await expect(p.locator('.runner-status small').filter({ hasText: 'SPELARE' })).toHaveCount(4);
    }
    await expect(host.locator('.countdown')).toHaveCount(0, { timeout: 6000 });
    await guests[2].keyboard.down('a');
    await expect.poll(async () => Number(await host.locator('.runner-status progress').nth(3).getAttribute('value'))).toBeGreaterThan(5);
    expect(Number(await host.locator('.runner-status progress').nth(0).getAttribute('value'))).toBe(0);
    await guests[2].keyboard.up('a');
    await guests[2].getByRole('button', { name: 'Pausa tävlingen' }).click();
    for (const p of [host, ...guests]) await expect(p.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  } finally {
    await group.close();
  }
});

test('wrong-game codes and camera denial leave pairing retryable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await page.goto('./');
  await page.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
  await page.getByRole('button', { name: 'Skapa tävling', exact: true }).click();
  await expect(page.locator('.connection-qr')).toBeVisible();
  await paste(page, 'AFC1.P.abc');
  await expect(page.getByRole('alert')).toContainText('ingen anslutningskod');
  await page.getByRole('button', { name: 'Skanna med kameran', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Kameran kunde inte öppnas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

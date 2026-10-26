import { expect, test } from '@playwright/test';
import { createGame, defaultSettings } from '../src/game/model';
import { connect, onlyRoomServer, peers } from './wifi-helpers';

test('online peers run separate athletes, synchronize pause and keep local saves', async ({ browser, baseURL }, info) => {
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
      await onlyRoomServer(p);
    }
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await host.getByRole('combobox', { name: 'Löpstil', exact: true }).selectOption('hold');
    await connect(host, guest);
    // The host picks their own figure; the guest picks theirs on their own device.
    await host.getByRole('button', { name: 'Spelare 1: Buzz Lightyear', exact: true }).click();
    await guest.getByRole('button', { name: 'Spelare 2: Baymax', exact: true }).click();
    await expect(host.getByRole('list', { name: 'Figurer' })).toContainText('Baymax');
    await expect(guest.getByRole('list', { name: 'Figurer' })).toContainText('Buzz Lightyear');
    await guest.getByRole('combobox', { name: 'Kontroll spelare 1', exact: true }).selectOption('touch');
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta spelet', exact: true }).click();
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

test('four devices join one room and all receive the same championship', async ({ browser, baseURL }) => {
  test.setTimeout(90000);
  const group = await peers(browser, baseURL);
  const { host } = group;
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await host.getByRole('combobox', { name: 'Löpstil', exact: true }).selectOption('hold');
    await host.getByRole('button', { name: /^Sexkamp/ }).click();
    const guests = [group.guest, await group.open(true), await group.open(false)];
    for (const guest of guests) {
      await connect(host, guest);
      await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    }
    await host.getByRole('button', { name: 'Starta spelet', exact: true }).click();
    for (const [i, p] of [host, ...guests].entries()) {
      await expect(p.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
      await expect(p.getByText(`ONLINE · DU ÄR P${i + 1}`, { exact: true })).toBeVisible();
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

test('archery forwards held aim and the shot to the host over online multiplayer', async ({ browser, baseURL }, info) => {
  test.setTimeout(60000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await host.getByRole('button', { name: 'Välj Bågskytte', exact: true }).click();
    await connect(host, guest);
    await guest.getByRole('combobox', { name: 'Kontroll spelare 1', exact: true }).selectOption('keyboard1');
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta spelet', exact: true }).click();
    await expect(guest.locator('.countdown')).toHaveCount(0, { timeout: 6000 });
    await guest.keyboard.down('d');
    await new Promise((resolve) => setTimeout(resolve, 650));
    await guest.keyboard.up('d');
    await guest.keyboard.press('Space');
    await expect(host.locator('.status-player').nth(1)).toContainText(/\d+,\d{2} p/, { timeout: 4000 });
    await expect(guest.locator('.status-player').nth(1)).toContainText(/\d+,\d{2} p/);
    await expect.poll(() => guest.locator('.status-player').nth(1).textContent()).toBe(await host.locator('.status-player').nth(1).textContent());
    await expect(host.locator('.status-player').nth(0)).toContainText('Redo');
    await guest.screenshot({ path: info.outputPath('archery-wifi.png') });
    await guest.getByRole('button', { name: 'Pausa tävlingen' }).click();
    await expect(host.getByRole('dialog', { name: 'Vi tar en paus.' })).toBeVisible();
  } finally {
    await group.close();
  }
});

test('after the last result the online host starts a sexkamp with the same players', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'The flow is the same on every layout.');
  test.setTimeout(120000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await host.getByRole('button', { name: 'Välj 100 meter', exact: true }).click();
    await host.getByRole('combobox', { name: 'Löpstil', exact: true }).selectOption('hold');
    await connect(host, guest);
    await guest.getByRole('combobox', { name: 'Kontroll spelare 1', exact: true }).selectOption('keyboard1');
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta spelet', exact: true }).click();
    for (const p of [host, guest]) await expect(p.locator('.countdown')).toHaveCount(0, { timeout: 8000 });
    for (const p of [host, guest]) await p.keyboard.down('a');
    const next = host.getByRole('button', { name: /^Spela .* ↗$/ });
    await expect(next).toBeVisible({ timeout: 60000 });
    for (const p of [host, guest]) await p.keyboard.up('a');
    await expect(guest.getByText('Väntar på att värden fortsätter tävlingen.')).toBeVisible();
    await host.getByRole('combobox', { name: 'Nästa tävling', exact: true }).selectOption('championship');
    await host.getByRole('button', { name: 'Spela sexkamp ↗', exact: true }).click();
    // Both devices are back on the start line of the championship's first event, still connected.
    for (const p of [host, guest]) await expect(p.getByRole('dialog')).toBeHidden({ timeout: 10000 });
    await expect(guest.getByText(/ONLINE · DU ÄR P2/)).toBeVisible();
    await expect(host.getByText(/Gren 1 av 6|1 \/ 6|100 m/).first()).toBeVisible();
  } finally {
    await group.close();
  }
});

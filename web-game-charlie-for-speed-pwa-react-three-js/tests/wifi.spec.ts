import { expect, test } from '@playwright/test';
import { newCareer } from '../src/game/career';
import { connect, paste, peers } from './wifi-helpers';

test('QR peers drive separate cars with local cameras, shared pause and preserved career', async ({ browser, baseURL }, info) => {
  test.setTimeout(90000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  const career = newCareer();
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const p of [host, guest]) await p.evaluate((save) => localStorage.setItem('charlie-for-speed:career', JSON.stringify(save)), career);
    for (const p of [host, guest]) {
      await p.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await p.reload();
      await expect.poll(() => p.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      await p.context().route('**/*', (route) => route.abort());
    }
    await host.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await connect(host, guest);
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true }).click();
    for (const p of [host, guest]) await expect(p.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
    await expect(guest.getByText('WI-FI · DU ÄR P2', { exact: true })).toBeVisible();
    await expect(host.getByTestId('hud')).toHaveAttribute('data-phase', 'racing', { timeout: 12000 });
    await guest.keyboard.down('ArrowUp');
    await expect.poll(async () => Number(await guest.getByTestId('hud').getAttribute('data-speed')), { timeout: 10000 }).toBeGreaterThan(20);
    expect(Number(await host.getByTestId('hud').getAttribute('data-speed'))).toBeLessThan(8);
    await guest.keyboard.up('ArrowUp');
    await guest.getByRole('button', { name: 'Pausa', exact: true }).click();
    for (const p of [host, guest]) await expect(p.getByRole('heading', { name: 'Paus', exact: true })).toBeVisible();
    await guest.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(host.getByRole('button', { name: 'Fortsätt', exact: true })).toBeDisabled();
    await guest.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(host.getByRole('button', { name: 'Fortsätt', exact: true })).toBeEnabled();
    for (const p of [host, guest]) expect(await p.evaluate(() => JSON.parse(localStorage.getItem('charlie-for-speed:career') || '{}'))).toEqual(career);
    await guest.screenshot({ path: info.outputPath('wifi-race-paused.png') });
    await host.getByRole('button', { name: 'Starta om', exact: true }).click();
    for (const p of [host, guest]) {
      await expect(p.getByRole('heading', { name: 'Paus', exact: true })).not.toBeVisible();
      await expect(p.getByTestId('hud')).toHaveAttribute('data-phase', 'countdown');
    }
    await guest.close();
    await expect(host.getByRole('button', { name: 'Fortsätt', exact: true })).toBeDisabled({ timeout: 7000 });
    expect(errors).toEqual([]);
  } finally {
    await group.close();
  }
});

test('manual codes connect and changed host settings require a fresh ready confirmation', async ({ browser, baseURL }) => {
  test.setTimeout(60000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  try {
    await host.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await connect(host, guest, true);
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true })).toBeEnabled();
    await host.getByLabel('Varv', { exact: true }).selectOption('1');
    await expect(host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true })).toBeDisabled();
    await expect(guest.getByRole('button', { name: 'Jag är redo', exact: true })).toBeEnabled();
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true })).toBeEnabled();
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
  await page.getByRole('button', { name: /^Jag är värd/ }).click();
  await expect(page.locator('.connection-qr')).toBeVisible();
  await paste(page, 'SGO1.P.abc');
  await expect(page.getByRole('alert')).toContainText('ingen anslutningskod');
  await page.getByRole('button', { name: 'Skanna med kameran', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Kameran kunde inte öppnas');
});

test('three devices race together and each guest picks their own car', async ({ browser, baseURL }, info) => {
  test.setTimeout(120000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  const third = await group.open(true);
  const errors: string[] = [];
  for (const p of [host, guest, third]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    await host.getByRole('button', { name: /^Spela via Wi-Fi/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();

    await connect(host, guest);
    await guest.getByLabel('Din bil').selectOption('arrow');
    await expect(host.getByText('Spelare 2: Lynx Arrow')).toBeVisible();
    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();

    await host.getByRole('button', { name: 'Bjud in spelare 3', exact: true }).click();
    await connect(host, third);
    await expect(third.getByRole('heading', { name: 'Ansluten som spelare 3' })).toBeVisible();
    await third.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await expect(host.getByText('Alla är redo!')).toBeVisible();
    await host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true }).click();

    for (const p of [host, guest, third]) await expect(p.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
    await expect(third.getByText('WI-FI · DU ÄR P3', { exact: true })).toBeVisible();
    await expect(third.getByTestId('hud')).toHaveAttribute('data-phase', 'racing', { timeout: 12000 });
    await third.keyboard.down('ArrowUp');
    await expect.poll(async () => Number(await third.getByTestId('hud').getAttribute('data-speed')), { timeout: 10000 }).toBeGreaterThan(20);
    expect(Number(await host.getByTestId('hud').getAttribute('data-speed'))).toBeLessThan(8);
    expect(Number(await guest.getByTestId('hud').getAttribute('data-speed'))).toBeLessThan(8);
    await third.screenshot({ path: info.outputPath('wifi-three-players.png') });
    expect(errors).toEqual([]);
  } finally {
    await group.close();
  }
});

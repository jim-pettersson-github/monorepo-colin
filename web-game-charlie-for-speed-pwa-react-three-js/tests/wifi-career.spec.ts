import { expect, type Page, test } from '@playwright/test';
import { codeOf, paste, peers } from './wifi-helpers';

// Pairs with copied codes, the fallback for phones that cannot scan each other's QR images.
async function pairByCode(host: Page, guest: Page) {
  await guest.getByRole('button', { name: /^Jag går med/ }).click();
  await paste(guest, await codeOf(host, 'Din matchkod'));
  await paste(host, await codeOf(guest, 'Din svarskod'));
  await expect(guest.getByText(/Enheterna är anslutna!/)).toBeVisible({ timeout: 15000 });
  await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
  await host.getByRole('button', { name: 'Öppna sessionen', exact: true }).click();
}

test('Wi-Fi career: shared session, own shopping, a race and resuming with progress kept', async ({ browser, baseURL }) => {
  test.setTimeout(150000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    await host.getByRole('button', { name: /^Wi-Fi-karriär/ }).click();
    await host.getByLabel('Ditt namn').fill('Charlie');
    await host.getByLabel('Sessionens namn').fill('Fredag');
    await host.getByRole('button', { name: 'Skapa och bjud in', exact: true }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();

    await guest.getByRole('button', { name: /^Wi-Fi-karriär/ }).click();
    await guest.getByLabel('Ditt namn').fill('Alva');
    await guest.getByRole('button', { name: 'Gå med i en session', exact: true }).click();
    await pairByCode(host, guest);

    for (const p of [host, guest]) await expect(p.getByRole('heading', { name: 'Fredag' })).toBeVisible();
    await guest.getByRole('button', { name: 'Bilhandlare', exact: true }).click();
    await guest.getByRole('button', { name: 'Köp 18 000 kr', exact: true }).click();
    await expect(guest.getByTestId('money')).toHaveText('7 000 kr');
    await expect(host.getByRole('cell', { name: 'Lynx Arrow' })).toBeVisible();
    await host.getByRole('button', { name: 'Bilhandlare', exact: true }).click();
    await host.getByRole('button', { name: 'Köp 21 000 kr', exact: true }).click();

    await host.getByRole('button', { name: 'Turneringar', exact: true }).click();
    await host.getByRole('button', { name: 'Starta cupen', exact: true }).first().click();
    await guest.getByRole('button', { name: 'Turneringar', exact: true }).click();
    await expect(guest.getByText('Väntar på att värden startar deltävling 1.')).toBeVisible();
    await host.getByRole('button', { name: /Kör deltävling 1\/3: Smålandsslingan/ }).click();

    for (const p of [host, guest]) await expect(p.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
    await expect(guest.getByText('WI-FI · DU ÄR P2', { exact: true })).toBeVisible();
    await expect(guest.getByTestId('hud')).toHaveAttribute('data-phase', 'racing', { timeout: 12000 });
    await guest.keyboard.down('ArrowUp');
    await expect.poll(async () => Number(await guest.getByTestId('hud').getAttribute('data-speed')), { timeout: 10000 }).toBeGreaterThan(20);
    await guest.keyboard.up('ArrowUp');

    await host.getByRole('button', { name: 'Pausa', exact: true }).click();
    await host.getByRole('button', { name: 'Avsluta racet', exact: true }).click();
    await expect(host.getByRole('button', { name: /Kör deltävling 1\/3/ })).toBeVisible();
    await expect(guest.getByText('Väntar på att värden startar deltävling 1.')).toBeVisible();

    await host.getByRole('button', { name: /Spara och avsluta/ }).click();
    await expect(host.getByText('Charlie, Alva')).toBeVisible();
    await expect(guest.getByText('Anslutningen till värden bröts.')).toBeVisible({ timeout: 10000 });
    await guest.getByRole('button', { name: /Meny/ }).click();

    await host.getByRole('button', { name: 'Fortsätt som värd', exact: true }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await guest.getByRole('button', { name: 'Gå med i en session', exact: true }).click();
    await pairByCode(host, guest);
    await expect(guest.getByTestId('money')).toHaveText('7 000 kr');
    await guest.getByRole('button', { name: 'Turneringar', exact: true }).click();
    await expect(guest.getByText('Väntar på att värden startar deltävling 1.')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await group.close();
  }
});

test('Wi-Fi career: a late player joins from the hub and starts from scratch', async ({ browser, baseURL }) => {
  test.setTimeout(120000);
  const group = await peers(browser, baseURL);
  const { host, guest } = group;
  const late = await group.open(true);
  try {
    await host.getByRole('button', { name: /^Wi-Fi-karriär/ }).click();
    await host.getByLabel('Ditt namn').fill('Charlie');
    await host.getByRole('button', { name: 'Skapa och bjud in', exact: true }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await guest.getByRole('button', { name: /^Wi-Fi-karriär/ }).click();
    await guest.getByLabel('Ditt namn').fill('Alva');
    await guest.getByRole('button', { name: 'Gå med i en session', exact: true }).click();
    await pairByCode(host, guest);
    await guest.getByRole('button', { name: 'Bilhandlare', exact: true }).click();
    await guest.getByRole('button', { name: 'Köp 18 000 kr', exact: true }).click();

    await host.getByRole('button', { name: 'Bjud in en spelare till', exact: true }).click();
    await late.getByRole('button', { name: /^Wi-Fi-karriär/ }).click();
    await late.getByLabel('Ditt namn').fill('Cleo');
    await late.getByRole('button', { name: 'Gå med i en session', exact: true }).click();
    await late.getByRole('button', { name: /^Jag går med/ }).click();
    await paste(late, await codeOf(host, 'Din matchkod'));
    await paste(host, await codeOf(late, 'Din svarskod'));

    await expect(late.getByRole('heading', { name: 'Wi-Fi-karriär' })).toBeVisible({ timeout: 15000 });
    await expect(late.getByTestId('money')).toHaveText('25 000 kr');
    await expect(host.getByRole('cell', { name: 'Cleo' })).toBeVisible();
    await expect(guest.getByRole('cell', { name: 'Cleo' })).toBeVisible();
    await expect(guest.getByTestId('money')).toHaveText('7 000 kr');
  } finally {
    await group.close();
  }
});

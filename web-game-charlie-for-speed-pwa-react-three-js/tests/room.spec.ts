import { type Browser, expect, type Page, test } from '@playwright/test';

const roomServer = `http://127.0.0.1:${process.env.CFS_ROOM_PORT || 4024}/api.php`;

// Each device gets its own browser context that talks to the local room server.
async function device(browser: Browser, url: string, mobile: boolean, server = roomServer) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript((server) => localStorage.setItem('charlie-for-speed:room-server', server), server);
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

async function joinByCode(page: Page, code: string) {
  await page.getByRole('button', { name: /^Spela online/ }).click();
  await page.getByRole('button', { name: /^Jag går med/ }).click();
  await page.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
}

test('room code: three devices join at once and race', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(120000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guests = [await device(browser, baseURL, true), await device(browser, baseURL, true)];
  const errors: string[] = [];
  for (const p of [host, ...guests]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await expect(host.getByText('WI-FI ELLER INTERNET · EN ENHET PER SPELARE')).toBeVisible();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    const code = (await host.getByTestId('room-code').textContent()) ?? '';
    expect(code).toMatch(/^[A-Z0-9]{4}$/);

    // Both guests type the code at the same time; the second waits for the next free place.
    await Promise.all(guests.map((guest) => joinByCode(guest, code)));
    for (const guest of guests) {
      await expect(guest.getByText('Enheterna är anslutna!')).toBeVisible({ timeout: 30000 });
      await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    }
    await expect(host.getByText(/Spelare 3 – Ansluten · Redo/)).toBeVisible();
    await expect(host.getByText(/Spelare 4 – Väntar på att någon skriver rumskoden/)).toBeVisible();

    await host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true }).click();
    for (const p of [host, ...guests]) await expect(p.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
    await expect(guests[1].getByText(/WI-FI · DU ÄR P\d/)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    for (const p of [host, ...guests]) await p.context().close();
  }
});

test('room code: a wrong code says so, and a missing server falls back to QR', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  if (!baseURL) throw new Error('No preview URL');
  const guest = await device(browser, baseURL, true);
  const offline = await device(browser, baseURL, false, 'http://127.0.0.1:9/api.php');
  try {
    await joinByCode(guest, 'ZZZZ');
    await expect(guest.getByRole('alert')).toHaveText('Rummet finns inte. Kolla koden.');

    await offline.getByRole('button', { name: /^Spela online/ }).click();
    await offline.getByRole('button', { name: /^Jag är värd/ }).click();
    await expect(offline.getByText(/Spelservern svarar inte.*Para ihop med QR-koden istället/)).toBeVisible({ timeout: 15000 });
    await expect(offline.locator('.connection-qr')).toBeVisible();
  } finally {
    for (const p of [guest, offline]) await p.context().close();
  }
});

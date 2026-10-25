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

async function joinByCode(page: Page, code: string, name = '') {
  await page.getByRole('button', { name: /^Spela online/ }).click();
  if (name) await page.getByRole('textbox', { name: 'Ditt namn', exact: true }).fill(name);
  await page.getByRole('button', { name: /^Jag går med/ }).click();
  await page.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
}

test('room code: three devices join at once, see each other in the lobby and race', async ({ browser, baseURL }, info) => {
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
    await host.getByRole('textbox', { name: 'Ditt namn', exact: true }).fill('Charlie');
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    const code = (await host.getByTestId('room-code').textContent()) ?? '';
    expect(code).toMatch(/^[A-Z0-9]{4}$/);

    // Both guests type the code at the same time; the second waits for the next free place.
    await Promise.all(guests.map((guest, index) => joinByCode(guest, code, ['Alva', 'Cleo'][index])));
    for (const guest of guests) {
      await expect(guest.getByText('Enheterna är anslutna!')).toBeVisible({ timeout: 30000 });
      await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    }
    await expect(host.getByText(/Spelare 3 \((Alva|Cleo)\) – Ansluten · Redo/)).toBeVisible();
    await expect(host.getByText(/Spelare 4 – Väntar på att någon skriver rumskoden/)).toBeVisible();

    // Everyone sees the same lobby, with names and who is ready.
    const lobby = guests[0].getByRole('list', { name: 'Spelare i rummet' });
    await expect(lobby.getByRole('listitem')).toHaveCount(3);
    await expect(lobby).toContainText('Charlie – värd');
    await expect(lobby).toContainText('Alva (du) – Redo ✓');
    await expect(lobby).toContainText('Cleo – Redo ✓');

    // Closing the open place keeps everyone's Redo, so the race can still start.
    await host.getByRole('button', { name: 'Avbryt inbjudan', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Starta Wi-Fi-tävling', exact: true })).toBeEnabled();

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

test('room code: a network that blocks direct contact gets a clear message and the room reopens', async ({ browser, playwright, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(150000);
  if (!baseURL) throw new Error('No preview URL');
  // Without UDP and without a relay, the two browsers cannot reach each other, as on strict mobile networks.
  const blockedBrowser = await playwright.chromium.launch({ args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] });
  const host = await device(browser, baseURL, false);
  const blocked = await device(blockedBrowser, baseURL, true);
  const guest = await device(browser, baseURL, true);
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    const code = (await host.getByTestId('room-code').textContent()) ?? '';

    await joinByCode(blocked, code);
    await expect(blocked.getByRole('alert')).toContainText('Enheterna fick ingen kontakt via internet', { timeout: 60000 });
    await expect(blocked.getByRole('textbox', { name: 'Rumskod', exact: true })).toHaveValue(code);
    await expect(host.getByText(/Rummet är öppet igen/)).toBeVisible({ timeout: 60000 });

    await joinByCode(guest, code);
    await expect(guest.getByText('Enheterna är anslutna!')).toBeVisible({ timeout: 30000 });
    await expect(host.getByText(/Spelare 2 – Ansluten/)).toBeVisible();
  } finally {
    for (const p of [host, blocked, guest]) await p.context().close();
    await blockedBrowser.close();
  }
});

test('game list: a hosted game is listed, a guest joins with one tap and the host can kick them', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(90000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    await host.getByRole('button', { name: /^Spela online/ }).click();
    await host.getByRole('textbox', { name: 'Ditt namn', exact: true }).fill('Listo');
    await host.getByRole('button', { name: /^Jag är värd/ }).click();
    await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{4}$/);

    await guest.getByRole('button', { name: /^Spela online/ }).click();
    await guest.getByRole('button', { name: /^Jag går med/ }).click();
    const listed = guest.getByRole('list', { name: 'Öppna spel' }).getByRole('listitem').filter({ hasText: 'Listos spel' });
    await expect(listed).toContainText('Växjö Motorring · 3 varv · klass C', { timeout: 10000 });
    await guest.screenshot({ path: info.outputPath('game-list.png') });
    await listed.getByRole('button', { name: /^Gå med · 1\/8/ }).click();
    await expect(guest.getByText('Enheterna är anslutna!')).toBeVisible({ timeout: 30000 });

    await host.screenshot({ path: info.outputPath('host-lobby.png'), fullPage: true });
    await host.getByRole('button', { name: 'Sparka', exact: true }).click();
    await expect(guest.getByRole('alert')).toContainText('Värden tog bort dig från spelet.', { timeout: 10000 });
    await expect(guest.getByRole('heading', { name: 'Öppna spel' })).toBeVisible();
    await expect(host.getByText(/Spelare 2 – Ansluten/)).toHaveCount(0);

    // Taking the game off the list hides it; the room code still works.
    await host.getByRole('checkbox', { name: /Visa i listan över öppna spel/ }).uncheck();
    await expect(listed).toHaveCount(0, { timeout: 10000 });
  } finally {
    for (const p of [host, guest]) await p.context().close();
  }
});

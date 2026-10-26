import { type Browser, expect, test } from '@playwright/test';

const roomServer = 'http://127.0.0.1:4020/api.php';

async function device(browser: Browser, url: string, mobile: boolean) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 412, height: 915 } : { width: 1280, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript((server) => localStorage.setItem('alfred-fc:room-server', server), roomServer);
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

test('room code: the guest types the host code and both start the match', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(90000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  const errors: string[] = [];
  for (const p of [host, guest]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    for (const p of [host, guest]) await p.getByRole('button', { name: /^Spela online/ }).click();
    await expect(host.getByText('TVÅ ENHETER · ONLINE')).toBeVisible();
    await host.getByRole('button', { name: 'Skapa match', exact: false }).click();
    await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{4}$/);
    const code = (await host.getByTestId('room-code').textContent()) ?? '';
    await expect(host.getByText(/QR/)).toHaveCount(0);

    await guest.getByRole('button', { name: 'Anslut', exact: false }).click();
    await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
    for (const p of [host, guest]) await expect(p.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 30000 });

    await guest.getByRole('button', { name: 'Jag är redo', exact: true }).click();
    await host.getByRole('button', { name: 'Starta onlinematch', exact: true }).click();
    for (const p of [host, guest]) await expect(p.locator('canvas').first()).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    for (const p of [host, guest]) await p.context().close();
  }
});

test('without an override the host uses the hosted room server and can retry calmly when it cannot be reached', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://games.charliecare.se/**', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto('./');
  await page.getByRole('button', { name: /^Spela online/ }).click();
  await page.getByRole('button', { name: 'Skapa match', exact: false }).click();
  await expect(page.getByText('Det gick inte att skapa ett rum just nu.', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Spelservern svarar inte');
  expect(requests.some((url) => url.startsWith('https://games.charliecare.se/api.php?a=create'))).toBe(true);
  await expect(page.getByTestId('room-code')).toHaveCount(0);
  await expect(page.getByText(/QR/)).toHaveCount(0);

  // Once the server answers again, Försök igen opens a room.
  await page.unroute('https://games.charliecare.se/**');
  await page.evaluate((server) => localStorage.setItem('alfred-fc:room-server', server), roomServer);
  await page.getByRole('button', { name: 'Försök igen', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{4}$/);
  await expect(page.getByText('Det gick inte att skapa ett rum just nu.', { exact: true })).toHaveCount(0);
});

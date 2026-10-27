import { type Browser, expect, type Page, test } from '@playwright/test';

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

async function hostMatch(host: Page) {
  await host.getByRole('button', { name: /^Spela online/ }).click();
  await host.getByRole('button', { name: 'Skapa match', exact: false }).click();
  await expect(host.getByTestId('room-code')).toHaveText(/^[A-Z0-9]{4}$/);
  return (await host.getByTestId('room-code').textContent()) ?? '';
}

async function openList(guest: Page) {
  await guest.getByRole('button', { name: /^Spela online/ }).click();
  await guest.getByRole('button', { name: 'Anslut', exact: false }).click();
}

test('match list: a hosted match is listed, the guest joins with one tap and the host can send them away', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(90000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    const code = await hostMatch(host);
    // Five minutes marks this host's match: the other online tests host default or league and cup lengths.
    await host.getByText('Välj lag och matchlängd', { exact: false }).click();
    await host.getByRole('combobox', { name: 'Matchlängd', exact: true }).selectOption('300');
    await openList(guest);
    const listed = guest.getByRole('list', { name: 'Öppna matcher' }).getByRole('listitem').filter({ hasText: 'Onlinematch' }).filter({ hasText: '· 5 min' });
    await expect(listed).toHaveCount(1, { timeout: 10000 });
    await guest.screenshot({ path: info.outputPath('match-list.png'), fullPage: true });
    await listed.getByRole('button', { name: /^Gå med · 1\/2/ }).click();
    for (const p of [host, guest]) await expect(p.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 30000 });
    expect(await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).count()).toBe(0);

    // A full match leaves the list.
    const other = await device(browser, baseURL, true);
    try {
      await openList(other);
      await expect(other.getByText(/Inga öppna matcher|Gå med ·/).first()).toBeVisible({ timeout: 10000 });
      await expect(other.locator('.game-list li').filter({ hasText: '· 5 min' })).toHaveCount(0);
    } finally {
      await other.context().close();
    }

    await host.getByRole('button', { name: 'Sparka kompisen', exact: true }).click();
    await expect(guest.getByRole('alert')).toContainText('Värden tog bort dig från matchen.', { timeout: 10000 });
    await expect(guest.getByRole('heading', { name: 'Öppna matcher' })).toBeVisible();
    await expect(host.getByText('Du tog bort kompisen. Rummet är öppet igen.')).toBeVisible();
    await expect(host.getByTestId('room-code')).toHaveText(code);
    // The kicked guest is not sent straight back in.
    await expect(guest.getByText('Enheterna är anslutna!', { exact: true })).toHaveCount(0);

    // Taking the match off the list hides it; the room code still works.
    await host.getByRole('checkbox', { name: /Visa i listan över öppna matcher/ }).uncheck();
    await expect(listed).toHaveCount(0, { timeout: 10000 });
  } finally {
    for (const p of [host, guest]) await p.context().close();
  }
});

test('join progress: the guest sees each step and the time, and the list is hidden meanwhile', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(90000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    // Slow answers on both sides, so each step stays on screen long enough to see.
    await guest.route('**/api.php?a=reply*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await host.route('**/api.php?a=answer*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    const code = await hostMatch(host);
    await openList(guest);
    await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();

    const progress = guest.getByTestId('join-progress');
    const steps = progress.getByRole('list', { name: 'Går med' });
    await expect(steps.locator('[aria-current="step"]')).toHaveText('Svarar värden');
    await expect(guest.getByRole('heading', { name: 'Öppna matcher' })).toHaveCount(0);
    await expect(guest.getByText('Går med i matchen', { exact: true })).toBeVisible();
    await expect(progress).toContainText(/\d+ s/);
    await guest.screenshot({ path: info.outputPath('join-answering.png') });

    await expect(steps.locator('[aria-current="step"]')).toHaveText('Kopplar upp mot värden', { timeout: 10000 });
    await expect(steps.getByRole('listitem').first()).toHaveClass(/done/);
    await guest.screenshot({ path: info.outputPath('join-connecting.png') });

    await expect(guest.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(progress).toHaveCount(0);
  } finally {
    for (const p of [host, guest]) await p.context().close();
  }
});

test('room code: when the host leaves the lobby, the guest is told the host left', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'Pairing is the same on every layout.');
  test.setTimeout(60000);
  if (!baseURL) throw new Error('No preview URL');
  const host = await device(browser, baseURL, false);
  const guest = await device(browser, baseURL, true);
  try {
    const code = await hostMatch(host);
    await openList(guest);
    await guest.getByRole('textbox', { name: 'Rumskod', exact: true }).fill(code);
    await guest.getByRole('button', { name: 'Gå med i rummet', exact: true }).click();
    for (const p of [host, guest]) await expect(p.getByText('Enheterna är anslutna!', { exact: true })).toBeVisible({ timeout: 30000 });

    await host.getByRole('button', { name: 'Börja om kopplingen', exact: true }).click();
    await expect(guest.getByRole('alert')).toContainText('Värden lämnade matchen', { timeout: 15000 });
    await expect(guest.getByRole('alert')).not.toContainText('överföra speldata');
  } finally {
    for (const p of [host, guest]) await p.context().close();
  }
});

test('the online lobby shows the version both devices need', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /^Spela online/ }).click();
  await expect(page.getByText(/^Version \d{4}-\d{2}-\d{2} · \w+ · båda måste ha samma version/)).toBeVisible();
});

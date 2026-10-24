import { expect, test } from '@playwright/test';

const games = [
  ['colin-elevator/', 'Colins hissäventyr'],
  ['alfred-fc/', 'Alfred FC'],
  ['charlie-fs/', 'Charlie for Speed'],
  ['sagospelen/', 'Sagospelen'],
];
test('root selector launches all four independent games with separate scopes', async ({ page, request, baseURL }, info) => {
  if (!baseURL) throw new Error('No preview');
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Vad vill du spela idag?' })).toBeVisible();
  await expect(page.locator('.games>a')).toHaveCount(4);
  await page.screenshot({ path: info.outputPath('game-selector.png'), fullPage: true });
  for (const [path, title] of games) {
    const target = new URL(path, baseURL).href;
    await page.goto(target);
    await expect(page).toHaveTitle(title);
    await expect
      .poll(() =>
        page.evaluate(async () => ({
          scope: (await navigator.serviceWorker.getRegistration(location.href))?.scope,
          active: !!(await navigator.serviceWorker.getRegistration(location.href))?.active,
        })),
      )
      .toEqual({ scope: target, active: true });
    const manifest = await (await request.get(new URL('manifest.webmanifest', target).href)).json();
    expect(manifest.scope).toBe(new URL(target).pathname);
  }
});
test('a cached root selector never replaces a game navigation and preserves elevator saves', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.getByRole('link', { name: /Spela hisspelet/ }).click();
  await expect(page).toHaveTitle('Colins hissäventyr');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('colin-game-v1'))).not.toBeNull();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const save = await page.evaluate(() => localStorage.getItem('colin-game-v1'));
  await page.goto('./');
  await page.getByRole('link', { name: /Till arenan/ }).click();
  await expect(page).toHaveTitle('Sagospelen');
  await page.goto('./');
  expect(await page.evaluate(() => localStorage.getItem('colin-game-v1'))).toBe(save);
  await page.getByRole('link', { name: /Spela hisspelet/ }).click();
  await expect(page.locator('main.game')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') || '{}').started)).toBe(true);
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.games>a')).toHaveCount(4);
});
test('legacy art-study bookmarks route to the relocated elevator app', async ({ page }) => {
  await page.goto('./?view=art');
  await expect(page).toHaveURL(/colin-elevator\/\?view=art$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

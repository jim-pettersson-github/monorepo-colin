import { expect, test } from '@playwright/test';

test('title screen renders without horizontal overflow', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Charlie for Speed');
  await expect(page.getByRole('heading', { name: 'Charlie for Speed' })).toBeVisible();
  await expect(page.locator('.showroom')).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: testInfo.outputPath('title.png') });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('manifest and app links stay within the configured base path', async ({ page, request, baseURL }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  if (!href || !baseURL) throw new Error('Missing manifest or base URL');
  const response = await request.get(new URL(href, baseURL).href);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  const base = new URL(baseURL).pathname;
  expect(manifest).toMatchObject({ name: 'Charlie for Speed', short_name: 'Charlie for Speed', start_url: base, scope: base });
  await expect(page.getByRole('link', { name: 'Charlie for Speed startsida' })).toHaveAttribute('href', base);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, new URL(href, baseURL)).href);
    expect(iconResponse.ok()).toBe(true);
  }
});

test('the installed shell reloads offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Charlie for Speed' })).toBeVisible();
  await page.getByRole('button', { name: /Snabbstart/ }).click();
  await expect(page.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
  await context.setOffline(false);
});

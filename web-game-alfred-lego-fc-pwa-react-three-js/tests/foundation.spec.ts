import { expect, test } from '@playwright/test';

test('Alfred menu renders and stays usable after resizing', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Alfred FC');
  await expect(page.getByRole('heading', { name: 'Dags för avspark.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('button', { name: 'Starta snabbmatch' })).toBeVisible();
  await expect(page.locator('.render-error')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Colins hissar|hissäventyr/i);
  await page.screenshot({ path: testInfo.outputPath('foundation.png'), fullPage: true });

  const initial = page.viewportSize();
  if (!initial) throw new Error('Missing test viewport');
  await page.setViewportSize({ width: initial.height, height: initial.width });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect
    .poll(() =>
      page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => Math.abs(canvas.width / canvas.height - canvas.clientWidth / canvas.clientHeight)),
    )
    .toBeLessThan(0.02);
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
  expect(manifest).toMatchObject({ name: 'Alfred FC', short_name: 'Alfred FC', start_url: base, scope: base, orientation: 'any' });
  await expect(page.getByRole('link', { name: 'Alfred FC startsida' })).toHaveAttribute('href', base);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, new URL(href, baseURL)).href);
    expect(iconResponse.ok()).toBe(true);
  }
});

test('the installed foundation reloads offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dags för avspark.' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Starta snabbmatch' }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad solomatch/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await context.setOffline(false);
});

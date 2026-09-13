import { expect, test } from '@playwright/test';

test('boots the illustrated menu and opens a keyboard-accessible information panel', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Colins');
  await expect(page.locator('.scene')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spela', exact: true })).toBeEnabled();

  const about = page.getByRole('button', { name: 'Om spelet' });
  await about.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stäng' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(about).toBeFocused();
  await about.click();
  await page.getByRole('button', { name: 'Stäng' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('precaches the whole game, plays offline, and resumes an offline save', async ({ page, context }) => {
  test.slow();
  await page.goto('./');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active?.state !== 'activated') {
      await new Promise<void>((resolve) =>
        registration.active?.addEventListener('statechange', () => {
          if (registration.active?.state === 'activated') resolve();
        }),
      );
    }
  });
  await page.close();
  await context.setOffline(true);

  const offline = await context.newPage();
  await offline.goto('./');
  await expect(offline.getByRole('heading', { level: 1 })).toContainText('Colins');
  await expect(offline.locator('.scene')).toHaveAttribute('aria-busy', 'false');
  await expect(offline.locator('canvas')).toBeVisible();
  await offline.getByRole('button', { name: 'Om spelet' }).click();
  await expect(offline.getByRole('dialog')).toBeVisible();
  await offline.getByRole('button', { name: 'Stäng', exact: true }).click();
  await offline.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(offline.locator('.game-scene canvas')).toBeVisible();
  await offline.getByRole('button', { name: '→ Utgång', exact: true }).click();
  await expect(offline.locator('main.game')).toHaveAttribute('data-place', 'outside');
  await offline.getByRole('button', { name: 'Varuhuset', exact: true }).click();
  await expect(offline.locator('main.game')).toHaveAttribute('data-place', 'mall');
  await offline.reload();
  await expect(offline.locator('main.game')).toHaveAttribute('data-place', 'mall');
  await expect(offline.locator('.game-scene canvas')).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('a failed art download can be retried before the painted world starts', async ({ page }) => {
  let blocked = true;
  await page.route('**/painted/*.webp', (route) => (blocked ? route.abort() : route.continue()));
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.getByText('Bilderna kunde inte laddas.')).toBeVisible();
  await expect(page.locator('.game-scene canvas')).toHaveCount(0);
  blocked = false;
  await page.getByRole('button', { name: 'Försök igen' }).click();
  await expect(page.locator('.game-scene')).toHaveAttribute('data-art', 'painted');
  await expect(page.locator('.game-scene canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Gå in', exact: true }).click();
  await expect(page.locator('main.game')).toHaveAttribute('data-riding', 'true');
});

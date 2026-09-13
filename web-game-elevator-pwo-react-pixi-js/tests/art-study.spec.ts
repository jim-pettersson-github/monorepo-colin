import { expect, test } from '@playwright/test';

test('art comparison loads three local images, enlarges accessibly, and leaves saves untouched', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('colin-game-v1', 'review-save-untouched'));
  await page.goto('./?view=art');
  await expect(page.getByRole('heading', { name: 'Tre sätt att se Colin.' })).toBeVisible();
  const images = page.locator('.art-study-card img');
  await expect(images).toHaveCount(3);
  await expect.poll(() => images.evaluateAll((items) => items.every((item) => (item as HTMLImageElement).naturalWidth > 1000))).toBe(true);
  const enlarge = page.getByRole('button', { name: 'Förstora En värld av lera' });
  await enlarge.click();
  await expect(page.getByRole('dialog', { name: 'En värld av lera' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(enlarge).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('colin-game-v1'))).toBe('review-save-untouched');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

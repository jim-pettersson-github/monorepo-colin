import { expect, test } from '@playwright/test';
import { showControls } from './room-helpers';

test('fullscreen covers the whole app and survives entering the game', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Helskärm', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
  await expect(page.getByRole('button', { name: 'Avsluta helskärm' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await showControls(page);
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Inställningar' })).toBeVisible();
  await page.getByRole('button', { name: 'Stäng inställningar' }).click();
  await page.getByRole('button', { name: 'Avsluta helskärm' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await showControls(page);
  await expect(page.getByRole('button', { name: 'Helskärm', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('main.game')).toHaveAttribute('data-floor', '0');
});

test('a refused fullscreen request leaves the game usable and allows another attempt', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen denied'));
  });
  await page.getByRole('button', { name: 'Helskärm', exact: true }).click();
  await expect(page.locator('.fullscreen-error')).toHaveText('Helskärm kunde inte ändras. Försök igen.');
  await expect(page.getByRole('button', { name: 'Helskärm', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.requestFullscreen = Element.prototype.requestFullscreen;
  });
  await page.getByRole('button', { name: 'Helskärm', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Helskärm', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.locator('.game-scene canvas')).toBeVisible();
});

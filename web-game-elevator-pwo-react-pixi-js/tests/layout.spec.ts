import { expect, test } from '@playwright/test';

test('phone rotation keeps the room, touch controls, and settings usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Spela', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await expect(page.locator('.game-scene canvas')).toBeVisible();

  for (const viewport of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 390, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(async () => {
        const room = await page.locator('.game-scene canvas').boundingBox();
        const controls = await page.getByRole('region', { name: 'Spelkontroller' }).boundingBox();
        if (!room || !controls) return false;
        return (
          room.height >= 250 &&
          room.width >= 320 &&
          room.y + room.height <= viewport.height + 1 &&
          (viewport.width > viewport.height ? room.x + room.width <= controls.x + 1 : room.y + room.height <= controls.y + 1)
        );
      })
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const button = page.getByRole('button', { name: 'Hämta hiss', exact: true });
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator('main.game')).toHaveAttribute('data-floor', '0');

    await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stäng inställningar' })).toBeInViewport();
    await page.getByRole('button', { name: 'Stäng inställningar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
});

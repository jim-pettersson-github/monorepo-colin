import { expect, test } from '@playwright/test';
import { roomSpace } from '../src/game/spatial';
import { showControls } from './room-helpers';

test('phone rotation keeps the room, touch controls, and settings usable', async ({ page }) => {
  test.slow();
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
    const landscape = viewport.width > viewport.height;
    await expect
      .poll(async () => {
        const room = await page.locator('.game-scene canvas').boundingBox();
        if (!room) return false;
        if (landscape) return Math.abs(room.width - viewport.width) <= 1 && Math.abs(room.height - viewport.height) <= 1 && room.x === 0 && room.y === 0;
        const controls = await page.getByRole('region', { name: 'Spelkontroller' }).boundingBox();
        return !!controls && room.height >= 250 && room.y + room.height <= controls.y + 1;
      })
      .toBe(true);
    if (landscape) {
      await expect(page.getByRole('region', { name: 'Spelkontroller' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Zooma in', exact: true })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Zooma ut', exact: true })).toBeInViewport();
      const before = await page.locator('.game-scene canvas').boundingBox();
      const scale = Math.min(viewport.width / roomSpace.width, viewport.height / roomSpace.height);
      await expect
        .poll(async () => Number(await page.locator('.game-scene').getAttribute('data-zoom')) * scale * roomSpace.width)
        .toBeGreaterThanOrEqual(viewport.width - 1);
      await showControls(page);
      expect(await page.locator('.game-scene canvas').boundingBox()).toEqual(before);
      const panel = await page.getByRole('region', { name: 'Spelkontroller' }).boundingBox();
      const toggle = await page.locator('.controls-toggle').boundingBox();
      expect(panel && toggle && panel.y >= 0 && panel.y + panel.height <= toggle.y).toBeTruthy();
      await page.getByRole('button', { name: '× Dölj kontroller', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Spelkontroller' })).not.toBeVisible();
      expect(await page.locator('.game-scene canvas').boundingBox()).toEqual(before);
    }
    await expect(page.getByRole('button', { name: 'Zooma in', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Zooma ut', exact: true })).toBeInViewport();
    await showControls(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    const button = page.getByRole('button', { name: 'Hämta hiss', exact: true });
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await expect(page.locator('main.game')).toHaveAttribute('data-floor', '0');

    await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stäng inställningar' })).toBeInViewport();
    await page.getByRole('button', { name: 'Stäng inställningar' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    if (landscape) await page.getByRole('button', { name: '× Dölj kontroller', exact: true }).click();
  }
});

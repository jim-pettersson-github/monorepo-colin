import { expect, type Page } from '@playwright/test';
import { projectPoint, roomSpace } from '../src/game/spatial';

export async function showControls(page: Page) {
  await expect(page.locator('main.game')).toBeVisible();
  const toggle = page.locator('.controls-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

export async function roomTap(page: Page, point: { x: number; y: number }, touch = false) {
  await showControls(page);
  const zoomOut = page.getByRole('button', { name: 'Zooma ut', exact: true });
  while (await zoomOut.isEnabled()) await zoomOut.click();
  await expect(page.locator('.game-scene')).toHaveAttribute('data-zoom', '1');
  const toggle = page.locator('.controls-toggle');
  const floating = await toggle.isVisible();
  if (floating) await toggle.click();
  const canvas = page.locator('.game-scene canvas');
  // Touchscreen.tap has no actionability wait; measure only after layout settles.
  await canvas.click({ trial: true });
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing game canvas');
  const scale = Math.min(bounds.width / roomSpace.width, bounds.height / roomSpace.height);
  const target = { x: (bounds.width - roomSpace.width * scale) / 2 + point.x * scale, y: (bounds.height - roomSpace.height * scale) / 2 + point.y * scale };
  if (touch) await page.touchscreen.tap(bounds.x + target.x, bounds.y + target.y);
  else await canvas.click({ position: target });
  if (floating) await toggle.click();
}

export async function floorTap(page: Page, floor: number, x: number, depth: number, touch = false) {
  await showControls(page);
  await page.getByRole('button', { name: `Titta på våning ${floor}`, exact: true }).click();
  await roomTap(page, projectPoint({ x, depth }), touch);
}

export const savedPlayer = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').player);

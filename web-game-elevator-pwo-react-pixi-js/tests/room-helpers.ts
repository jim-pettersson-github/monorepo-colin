import type { Page } from '@playwright/test';
import { projectPoint, roomSpace } from '../src/game/spatial';

export async function roomTap(page: Page, point: { x: number; y: number }, touch = false) {
  const canvas = page.locator('.game-scene canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing game canvas');
  const scale = Math.min(bounds.width / roomSpace.width, bounds.height / roomSpace.height);
  const target = { x: (bounds.width - roomSpace.width * scale) / 2 + point.x * scale, y: (bounds.height - roomSpace.height * scale) / 2 + point.y * scale };
  if (touch) await page.touchscreen.tap(bounds.x + target.x, bounds.y + target.y);
  else await canvas.click({ position: target });
}

export async function floorTap(page: Page, floor: number, x: number, depth: number, touch = false) {
  await page.getByRole('button', { name: `Titta på våning ${floor}`, exact: true }).click();
  await roomTap(page, projectPoint({ x, depth }), touch);
}

export const savedPlayer = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}').player);

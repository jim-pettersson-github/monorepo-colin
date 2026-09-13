import { expect, test } from '@playwright/test';

test('depth study walks nearer and farther without changing game saves', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('colin-game-v1', 'depth-study-save-sentinel'));
  await page.goto('./?view=depth');
  const stage = page.locator('.depth-stage');
  await expect(page.getByRole('button', { name: 'Kom närmare', exact: true })).toBeEnabled();
  const canvas = stage.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing depth canvas');
  const tap = async (x: number, y: number) => {
    if (testInfo.project.name === 'phone') await page.touchscreen.tap(bounds.x + (x / 1448) * bounds.width, bounds.y + (y / 1086) * bounds.height);
    else await canvas.click({ position: { x: (x / 1448) * bounds.width, y: (y / 1086) * bounds.height } });
  };
  await tap(520, 680);
  await expect(stage).toHaveAttribute('data-pose', 'standing', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-scale', '76');
  await tap(540, 1010);
  await expect.poll(async () => Number(await stage.getAttribute('data-scale')), { timeout: 8000 }).toBeGreaterThan(120);
  await expect(stage).toHaveAttribute('data-pose', 'standing');
  expect(await page.evaluate(() => localStorage.getItem('colin-game-v1'))).toBe('depth-study-save-sentinel');
});

test('reach for a lit button, enter behind doors, and reopen them by standing on the sill', async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?view=depth');
  const stage = page.locator('.depth-stage');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await expect(stage).toHaveAttribute('data-door', 'Stängd');
  await page.getByRole('button', { name: 'Tryck på hissknappen', exact: true }).click();
  await expect(stage).toHaveAttribute('data-pose', 'reaching', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-lit', 'true');
  await expect(stage).toHaveAttribute('data-door', 'Öppen');
  await page.getByRole('button', { name: 'Gå in i hissen', exact: true }).click();
  await expect(stage).toHaveAttribute('data-position', 'Inne i hissen', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-pose', 'standing');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await expect(stage).toHaveAttribute('data-door', 'Stängd');
  await page.getByRole('button', { name: 'Öppna dörrarna', exact: true }).click();
  await expect(stage).toHaveAttribute('data-door', 'Öppen');
  await page.getByRole('button', { name: 'Stå i dörröppningen', exact: true }).click();
  await expect(stage).toHaveAttribute('data-position', 'På tröskeln', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-pose', 'standing');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await expect(stage).toHaveAttribute('data-door', 'Öppnas igen');
  await page.getByRole('button', { name: 'Gå ut på golvet', exact: true }).click();
  await expect(stage).toHaveAttribute('data-pose', 'standing', { timeout: 8000 });
  await expect(stage).toHaveAttribute('data-position', 'I rummet');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await expect(stage).toHaveAttribute('data-door', 'Stängd');
  expect(errors).toEqual([]);
});

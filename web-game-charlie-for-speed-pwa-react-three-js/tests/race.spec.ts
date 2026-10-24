import { expect, test } from '@playwright/test';

test('choose a car and track, race, pause and return to the menu', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Nytt race' }).click();

  await expect(page.getByRole('heading', { name: 'Välj bil' })).toBeVisible();
  await page.getByRole('button', { name: 'Nästa bil' }).click();
  await expect(page.getByRole('heading', { name: 'XK Coupé' })).toBeVisible();
  await page.getByRole('button', { name: /Välj bana/ }).click();

  await page.getByRole('button', { name: /Rheinland-Ring/ }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: /Starta race/ }).click();

  const hud = page.getByTestId('hud');
  await expect(page.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(hud).toHaveAttribute('data-phase', 'racing', { timeout: 8000 });
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  await expect.poll(async () => Number(await hud.getAttribute('data-speed')), { timeout: 10000 }).toBeGreaterThan(80);
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: testInfo.outputPath('race.png') });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paus' })).toBeVisible();
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(page.getByRole('heading', { name: 'Paus' })).toBeHidden();

  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Avsluta racet' }).click();
  await expect(page.getByRole('button', { name: /Snabbstart.*Albion XK Coupé.*Rheinland-Ring.*1 varv/ })).toBeVisible();
  expect(errors).toEqual([]);
});

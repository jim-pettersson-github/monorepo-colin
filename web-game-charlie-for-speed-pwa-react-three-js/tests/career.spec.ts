import { expect, test } from '@playwright/test';

test('career: buy a car, upgrade it, enter a cup and start the first race', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: /Karriär/ }).click();
  await page.getByRole('button', { name: 'Starta karriären' }).click();

  const money = page.getByTestId('money');
  await expect(money).toHaveText('25 000 kr');
  await page.getByRole('button', { name: 'Köp 18 000 kr' }).click();
  await expect(money).toHaveText('7 000 kr');

  await page.getByRole('button', { name: 'Garage', exact: true }).click();
  await page.getByRole('button', { name: 'Uppgradera motor' }).click();
  await expect(money).toHaveText('3 000 kr');
  await expect(page.getByRole('img', { name: 'Steg 1 av 3' })).toBeVisible();

  await page.getByRole('button', { name: 'Rivaler' }).click();
  await expect(page.getByRole('cell', { name: 'Klaus' })).toBeVisible();

  await page.getByRole('button', { name: 'Turneringar' }).click();
  await expect(page.getByText('Vinn Supercupen först.')).toBeVisible();
  await page.getByRole('button', { name: 'Anmäl dig' }).first().click();
  await page.screenshot({ path: testInfo.outputPath('cup.png') });
  await page.getByRole('button', { name: /Kör deltävling 1\/3: Smålandsslingan/ }).click();
  await page.getByLabel('Ditt namn').fill('Testare');
  await page.getByRole('button', { name: 'Kör', exact: true }).click();

  await expect(page.locator('.race-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByTestId('hud')).toHaveAttribute('data-phase', 'racing', { timeout: 8000 });
  await page.getByRole('button', { name: 'Pausa' }).click();
  await page.getByRole('button', { name: 'Avsluta racet' }).click();

  await expect(page.getByRole('button', { name: /Kör deltävling 1\/3/ })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Karriär/ }).click();
  await expect(page.getByTestId('money')).toHaveText('3 000 kr');
  await expect(page.getByRole('button', { name: /Kör deltävling 1\/3/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('career hub never scrolls sideways', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Karriär/ }).click();
  await page.getByRole('button', { name: 'Starta karriären' }).click();
  for (const tab of ['Bilhandlare', 'Garage', 'Turneringar', 'Rivaler']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});

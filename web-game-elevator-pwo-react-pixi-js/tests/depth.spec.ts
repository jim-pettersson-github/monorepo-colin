import { expect, gamePoll, test } from './game-clock';

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
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('standing');
  await gamePoll(page, () => stage.getAttribute('data-scale'), { step: 50 }).toBe('76');
  await tap(540, 1010);
  await gamePoll(page, async () => Number(await stage.getAttribute('data-scale')), { timeout: 8000, step: 50 }).toBeGreaterThan(120);
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('standing');
  expect(await page.evaluate(() => localStorage.getItem('colin-game-v1'))).toBe('depth-study-save-sentinel');
});

test('reach for a lit button, enter behind doors, and reopen them by standing on the sill', async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?view=depth');
  const stage = page.locator('.depth-stage');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Stängd');
  await page.getByRole('button', { name: 'Tryck på hissknappen', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('reaching');
  await gamePoll(page, () => stage.getAttribute('data-lit'), { step: 50 }).toBe('true');
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Öppen');
  await page.getByRole('button', { name: 'Gå in i hissen', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-position'), { step: 50 }).toBe('Inne i hissen');
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('standing');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Stängd');
  await page.getByRole('button', { name: 'Öppna dörrarna', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Öppen');
  await page.getByRole('button', { name: 'Stå i dörröppningen', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-position'), { step: 50 }).toBe('På tröskeln');
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('standing');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Öppnas igen');
  await page.getByRole('button', { name: 'Gå ut på golvet', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-pose'), { step: 50 }).toBe('standing');
  await gamePoll(page, () => stage.getAttribute('data-position'), { step: 50 }).toBe('I rummet');
  await page.getByRole('button', { name: 'Stäng dörrarna', exact: true }).click();
  await gamePoll(page, () => stage.getAttribute('data-door'), { step: 50 }).toBe('Stängd');
  expect(errors).toEqual([]);
});

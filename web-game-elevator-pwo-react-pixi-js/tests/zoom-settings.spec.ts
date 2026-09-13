import { createGame } from '../src/game/model';
import { expect, gamePoll, test } from './game-clock';
import { showControls } from './room-helpers';

test('chosen zoom survives rotation, floor previews, houses, menu, and reload', async ({ page }) => {
  const saved = createGame(42);
  saved.started = true;
  await page.addInitScript((state) => {
    if (!localStorage.getItem('colin-game-v1')) localStorage.setItem('colin-game-v1', JSON.stringify(state));
  }, saved);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const scene = page.locator('.game-scene');
  await expect(scene.locator('canvas')).toBeVisible();
  await expect(scene).toHaveAttribute('data-zoom', '1');
  await page.getByRole('button', { name: 'Zooma in', exact: true }).click();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await showControls(page);
  await page.getByRole('button', { name: 'Titta på våning 2', exact: true }).click();
  await expect(scene).toHaveAttribute('data-view-floor', '2');
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await page.getByRole('button', { name: '◎ Följ Colin', exact: true }).click();
  await expect(scene).toHaveAttribute('data-view-floor', '0');
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  for (const [label, place] of [
    ['Varuhuset', 'mall'],
    ['Gamla huset', 'house'],
    ['Hotellet', 'hotel'],
  ]) {
    await page.getByRole('button', { name: '→ Utgång', exact: true }).click();
    await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('outside');
    await expect(scene).toHaveAttribute('data-zoom', '1.5');
    await page.getByRole('button', { name: label, exact: true }).click();
    await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe(place);
    await expect(scene).toHaveAttribute('data-zoom', '1.5');
  }
  await page.getByRole('button', { name: 'Till menyn', exact: true }).click();
  await page.getByRole('button', { name: 'Fortsätt', exact: true }).click();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await page.reload();
  await expect(scene.locator('canvas')).toBeVisible();
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scene).toHaveAttribute('data-zoom', '1.5');
});

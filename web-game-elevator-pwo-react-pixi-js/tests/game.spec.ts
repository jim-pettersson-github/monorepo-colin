import { layout } from '../src/game/model';
import { expect, gamePoll, test } from './game-clock';
import { floorTap, roomTap, savedPlayer, showControls } from './room-helpers';

test('walk upstairs, return to the entrance, and use the separate outside door', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await showControls(page);
  await expect(page.locator('.game-scene canvas')).toBeVisible();
  await floorTap(page, 1, 430, 0.4);
  await gamePoll(
    page,
    async () => {
      const player = await savedPlayer(page);
      return [player.floor, Math.round(player.x), player.targetX, player.stairs];
    },
    { timeout: 20000 },
  ).toEqual([1, 430, null, null]);
  await page.getByRole('button', { name: '↓ Till entrén', exact: true }).click();
  await gamePoll(
    page,
    async () => {
      const player = await savedPlayer(page);
      return [player.floor, Math.round(player.x), player.targetX, player.stairs];
    },
    { timeout: 20000 },
  ).toEqual([0, layout.exit, null, null]);
  await roomTap(page, { x: 1210, y: 350 });
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('outside');
});
test('help a passenger, block the doorway, take the stairs, and resume the saved game', async ({ page }) => {
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await showControls(page);
  const game = page.locator('main.game');
  await expect(game).toHaveAttribute('data-place', 'hotel');
  await expect(page.locator('.game-scene canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Hjälp Liv till våning 2' }).click();
  await gamePoll(page, () => page.getByRole('button', { name: 'Hjälp Liv till våning 2' }).isVisible()).toBe(false);
  await page.getByRole('button', { name: 'Gå in', exact: true }).click();
  await gamePoll(page, () => game.getAttribute('data-riding')).toBe('true');
  await page.getByRole('button', { name: 'Välj våning', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Våning 0', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Välj våning', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Välj våning', exact: true }).click();
  await page.getByRole('button', { name: 'Våning 2', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Välj våning i hissen' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Stå i dörren' }).click();
  await gamePoll(page, () => page.getByLabel('Hissens läge').textContent()).toContain('upptagen');
  // Colin is now in the doorway, outside the cabin; the explicit ground target clears it.
  await page.getByRole('button', { name: '↑ Trappa', exact: true }).click();
  await gamePoll(page, () => game.getAttribute('data-floor')).toBe('1');
  await gamePoll(page, () => page.getByText('I trappan ↑', { exact: true }).isVisible()).toBe(false);
  await page.getByRole('button', { name: '↑ Trappa', exact: true }).click();
  await gamePoll(page, () => game.getAttribute('data-floor')).toBe('2');
  await gamePoll(page, () => page.getByText('I trappan ↑', { exact: true }).isVisible()).toBe(false);
  await gamePoll(
    page,
    () =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}');
        return [saved.buildings?.[0]?.lift.position, saved.buildings?.[0]?.people[0]?.phase];
      }),
    { timeout: 18000 },
  ).toEqual([2, 'returning']);
  await page.reload();
  await showControls(page);
  await expect(game).toHaveAttribute('data-place', 'hotel');
  await expect(game).toHaveAttribute('data-floor', '2');
  await expect(page.locator('.game-scene canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('explore lights and signs, stop the alarm sample, and visit the old gate lift', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await page.getByRole('button', { name: 'Spela', exact: true }).click();
  await showControls(page);
  await page.getByRole('button', { name: 'Upptäck rummet' }).click();
  await page.getByRole('button', { name: 'Släck ljuset' }).click();
  await gamePoll(page, () => page.getByRole('button', { name: 'Tänd ljuset' }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Varningsskylt' }).click();
  await gamePoll(page, () => page.getByRole('dialog', { name: 'Akta dörrarna' }).isVisible()).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Prova larmljud' }).click();
  await gamePoll(page, () => page.getByRole('button', { name: 'Stoppa ljudprov' }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Stoppa ljudprov' }).click();
  await expect(page.getByRole('button', { name: 'Prova larmljud' })).toBeVisible();
  await page.getByRole('button', { name: '→ Utgång', exact: true }).click();
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('outside');
  await page.getByRole('button', { name: 'Gamla huset' }).click();
  await gamePoll(page, () => page.locator('main.game').getAttribute('data-place')).toBe('house');
  await page.getByRole('button', { name: 'Hissen', exact: true }).click();
  await page.getByRole('button', { name: 'Stäng dörren', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Öppna dörren', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stäng grinden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Öppna grinden', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inställningar' }).click();
  await expect(page.getByRole('slider', { name: /^Hissljud/ })).toBeVisible();
  await expect(page.getByRole('slider', { name: /^Larmljud/ })).toBeVisible();
  await page.getByLabel('Alla ljud av').check();
  await page.getByRole('button', { name: 'Stäng inställningar' }).click();
  await page.reload();
  await showControls(page);
  await expect(page.locator('main.game')).toHaveAttribute('data-place', 'house');
  await page.getByRole('button', { name: 'Inställningar' }).click();
  await expect(page.getByLabel('Alla ljud av')).toBeChecked();
  await page.getByRole('button', { name: 'Börja om från entrén' }).click();
  await page.getByRole('button', { name: 'Fortsätt mitt spel' }).click();
  await expect(page.locator('main.game')).toHaveAttribute('data-place', 'house');
  await page.getByRole('button', { name: 'Börja om från entrén' }).click();
  await page.getByRole('button', { name: 'Ja, börja om' }).click();
  await expect(page.locator('main.game')).toHaveAttribute('data-place', 'hotel');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

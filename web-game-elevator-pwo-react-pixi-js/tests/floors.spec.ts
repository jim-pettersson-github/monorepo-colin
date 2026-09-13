import { buildings, createGame, floorLabel, floors, layout } from '../src/game/model';
import { expect, gamePoll, test } from './game-clock';
import { floorTap, savedPlayer, showControls } from './room-helpers';

for (const building of buildings) {
  test(`${building.id} exposes every floor and keeps previews separate from Colin`, async ({ page }, testInfo) => {
    test.slow();
    const saved = createGame(42);
    saved.started = true;
    saved.settings.smoothCamera = false;
    saved.player.place = building.id;
    for (const b of saved.buildings)
      for (const person of b.people) {
        person.phase = 'away';
        person.timer = 90;
      }
    await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    const scene = page.locator('.game-scene');
    await expect(scene).toHaveAttribute('data-art', 'painted');
    await showControls(page);
    await expect(page.locator('.floor-overview button')).toHaveCount(building.rooms.length);
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const floor of floors(building.id)) {
        await showControls(page);
        const button = page.getByRole('button', { name: `Titta på våning ${floorLabel(floor)}`, exact: true });
        await button.click();
        await expect(scene).toHaveAttribute('data-view-floor', String(floor));
        await expect(scene).toHaveAttribute('data-exit', String(floor === 0));
        expect((await savedPlayer(page)).floor).toBe(0);
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(48);
        if (viewport.width > viewport.height) await page.locator('.controls-toggle').click();
        await page.locator('.game-scene canvas').screenshot({ path: testInfo.outputPath(`${building.id}-${floor}-${viewport.width}.png`) });
      }
    }
    await showControls(page);
    await floorTap(page, building.rooms.length - 1, 430, 0.4, testInfo.project.name === 'phone');
    await gamePoll(page, async () => (await savedPlayer(page)).floor, { timeout: 45000 }).toBe(building.rooms.length - 1);
    await gamePoll(page, async () => (await savedPlayer(page)).route).toBeNull();
    await page.getByRole('button', { name: 'Titta på våning E', exact: true }).click();
    await page.getByRole('button', { name: '◎ Följ Colin', exact: true }).click();
    await expect(scene).toHaveAttribute('data-view-floor', String(building.rooms.length - 1));
    await expect(page.getByRole('button', { name: '↑ Trappa', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '↓ Till entrén', exact: true }).click();
    await gamePoll(page, async () => (await savedPlayer(page)).floor, { timeout: 45000 }).toBe(0);
    expect(errors).toEqual([]);
  });

  test(`${building.id} selects the highest floor and reports the moving elevator during another-floor preview`, async ({ page }) => {
    test.slow();
    const saved = createGame(42);
    saved.started = true;
    saved.player.place = building.id;
    saved.player.x = layout.cabin;
    saved.player.depth = -0.18;
    saved.player.riding = true;
    for (const b of saved.buildings)
      for (const person of b.people) {
        person.phase = 'away';
        person.timer = 90;
      }
    await page.addInitScript((state) => localStorage.setItem('colin-game-v1', JSON.stringify(state)), saved);
    await page.goto('./');
    await showControls(page);
    await page.getByRole('button', { name: 'Välj våning', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Välj våning i hissen' });
    await expect(panel.locator('.floor-buttons button')).toHaveCount(building.rooms.length);
    await expect(page.getByRole('button', { name: 'Våning E', exact: true })).toBeFocused();
    const top = building.rooms.length - 1;
    for (const button of await panel.locator('.floor-buttons button').all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(48);
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
    await page.getByRole('button', { name: `Våning ${top}`, exact: true }).click();
    if (building.manual) {
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: 'Stäng grinden', exact: true }).click();
    }
    await expect(panel).not.toBeVisible();
    await page.getByRole('button', { name: 'Titta på våning E', exact: true }).click();
    const scene = page.locator('.game-scene');
    await expect(scene).toHaveAttribute('data-indicator', building.id);
    await gamePoll(page, () => scene.getAttribute('data-lift-floor'), { timeout: 45000 }).toBe(String(top));
    await expect(scene).toHaveAttribute('data-view-floor', '0');
  });
}

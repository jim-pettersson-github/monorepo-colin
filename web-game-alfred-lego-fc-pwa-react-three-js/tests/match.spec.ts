import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { MatchState } from '../src/game/model';
import { createMatch, FIELD } from '../src/game/model';

const saveKey = 'alfred-fc-match-v1';
async function seed(page: Page, mode: 'solo' | 'versus' = 'versus', remaining = 180) {
  const state = createMatch(mode);
  state.phase = 'playing';
  state.phaseTime = 0;
  state.remaining = remaining;
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: saveKey, value: state },
  );
  return state;
}
const savedState = (page: Page): Promise<MatchState> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), saveKey);

test('the camera scrolls across the larger pitch and keeps a live overview', async ({ page }, testInfo) => {
  const state = await seed(page);
  state.players[4].x = 5;
  state.players[4].z = 8;
  state.players[9].x = 10;
  state.players[9].z = 11;
  state.ball = { x: 5.8, z: 8, vx: 0, vz: 0, owner: 4, blocked: null, lock: 0 };
  // Replace the initial fixture before navigation; all game input still uses the public controls.
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: state });
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.locator('.source-label select').nth(1).selectOption('keyboard2');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  const canvas = page.locator('.game-canvas');
  await expect(canvas).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('img', { name: 'Planöversikt med spelarna och bollen' })).toBeVisible();
  await expect(page.locator('.overview-player')).toHaveCount(10);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const startX = Number(await canvas.getAttribute('data-camera-x'));
  const portrait = (await canvas.getAttribute('data-orientation')) === 'portrait';
  await page.keyboard.down(portrait ? 'w' : 'd');
  await page.clock.runFor(1400);
  await page.keyboard.up(portrait ? 'w' : 'd');
  expect(Number(await canvas.getAttribute('data-camera-x'))).toBeGreaterThan(startX + 3);
  await page.screenshot({ path: testInfo.outputPath('larger-pitch-follow.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect((await savedState(page)).players[4].x).toBeGreaterThan(12);
});

test('a penalty can be awarded, aimed, restored and scored with keyboard or touch', async ({ page }, testInfo) => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.randomState = 1000;
  state.switchWait = [2, 2];
  state.players[4].x = -FIELD.penaltySpot;
  state.players[6].x = -FIELD.penaltySpot - 2;
  state.players[6].z = 0;
  state.players[4].z = 0;
  state.players[9].x = 15;
  state.players[9].z = 10;
  state.ball = { x: 14.2, z: 10, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: saveKey, value: state },
  );
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  const touch = testInfo.project.name !== 'desktop';
  await page
    .locator('.source-label select')
    .nth(1)
    .selectOption(touch ? 'touch' : 'keyboard2');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const portrait = (await page.locator('.game-canvas').getAttribute('data-orientation')) === 'portrait';
  const slideKey = portrait ? 's' : 'a';
  await page.keyboard.down(slideKey);
  await page.keyboard.press('k');
  await page.clock.runFor(560);
  await page.keyboard.up(slideKey);
  await expect(page.locator('.decision-announcement strong')).toHaveText('Straff!');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect((await savedState(page)).phase).toBe('penalty');
  await page.reload();
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page
    .locator('.source-label select')
    .nth(1)
    .selectOption(touch ? 'touch' : 'keyboard2');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(1900);
  await expect(page.locator('.penalty-hint')).toContainText('Sikta med rörelsekontrollen');
  const clock = await page.getByRole('timer').textContent();
  await page.clock.runFor(3000);
  await expect(page.getByRole('timer')).toHaveText(clock || '');
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const joystick = await page.locator('.joystick').boundingBox();
    if (!joystick) throw new Error('Missing joystick');
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: joystick.x + joystick.width * (portrait ? 0.95 : 0.5), y: joystick.y + joystick.height * (portrait ? 0.5 : 0.95), id: 1 }],
    });
    await page.clock.runFor(450);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.keyboard.down('ArrowDown');
    await page.clock.runFor(450);
    await page.keyboard.up('ArrowDown');
  }
  await page.screenshot({ path: testInfo.outputPath('penalty-aim.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const aimed = await savedState(page);
  expect(aimed.phase).toBe('penalty-ready');
  expect(aimed.players[aimed.foul?.taker ?? -1].facingZ).toBeGreaterThan(0.5);
  await page.reload();
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page
    .locator('.source-label select')
    .nth(1)
    .selectOption(touch ? 'touch' : 'keyboard2');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.penalty-hint')).toBeVisible();
  await page.clock.runFor(32);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  if (touch) await page.getByRole('button', { name: 'Skjut / glidtackla' }).tap();
  else await page.keyboard.press('.');
  await page.clock.runFor(900);
  await expect(page.locator('.score')).toHaveText('0:1');
  await expect(page.getByText('MÅÅÅL!', { exact: true })).toBeVisible();
});

test('two keyboards move independently, pause freezes time, and rotation keeps the match', async ({ page }, testInfo) => {
  const initial = await seed(page);
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.locator('.source-label select').nth(1).selectOption('keyboard2');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  const portrait = (await page.locator('.game-canvas').getAttribute('data-orientation')) === 'portrait';
  await page.keyboard.down('d');
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(350);
  await page.keyboard.up('d');
  await page.keyboard.up('ArrowDown');
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const paused = await savedState(page);
  expect(portrait ? paused.players[4].z : paused.players[4].x).toBeGreaterThan((portrait ? initial.players[4].z : initial.players[4].x) + 0.5);
  if (portrait) expect(paused.players[9].x).toBeLessThan(initial.players[9].x - 0.5);
  else expect(paused.players[9].z).toBeGreaterThan(initial.players[9].z + 0.5);
  await page.clock.runFor(8000);
  expect((await savedState(page)).remaining).toBe(paused.remaining);
  await page.getByRole('button', { name: /Fortsätt matchen/ }).click();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Missing viewport');
  await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await page.clock.runFor(200);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-orientation', portrait ? 'landscape' : 'portrait');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('match-rotated.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect((await savedState(page)).remaining).toBeGreaterThan(paused.remaining - 1);
});

test('two gamepads retain separate slots and a disconnect pauses safely', async ({ page }) => {
  await seed(page);
  await page.clock.install();
  await page.addInitScript(() => {
    const target = window as unknown as { testPads: (Gamepad | null)[] };
    target.testPads = [0, 1].map(
      (index) =>
        ({
          index,
          id: `Test controller ${index + 1}`,
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        }) as unknown as Gamepad,
    );
    Object.defineProperty(navigator, 'getGamepads', { value: () => target.testPads });
  });
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await expect(page.getByText('2 anslutna handkontroller')).toBeVisible();
  await page.locator('.source-label select').nth(0).selectOption('pad:0');
  await page.locator('.source-label select').nth(1).selectOption('pad:1');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.evaluate(() => {
    const target = window as unknown as { testPads: Gamepad[] };
    (target.testPads[0].axes as number[])[0] = 1;
    (target.testPads[1].axes as number[])[1] = 1;
  });
  await page.clock.runFor(300);
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const moved = await savedState(page);
  expect(Math.hypot(moved.players[4].x + 0.8, moved.players[4].z)).toBeGreaterThan(0.5);
  expect(Math.hypot(moved.players[9].x - 6 * FIELD.scale, moved.players[9].z)).toBeGreaterThan(0.5);
  await page.getByRole('button', { name: /Fortsätt matchen/ }).click();
  await page.evaluate(() => {
    (window as unknown as { testPads: (Gamepad | null)[] }).testPads[0] = null;
  });
  await page.clock.runFor(50);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Handkontrollen för spelare 1 kopplades från/)).toBeVisible();
  await expect(page.locator('dialog .source-label select').nth(1)).toHaveValue('pad:1');
  await expect(page.getByRole('button', { name: /Fortsätt matchen/ })).toBeDisabled();
  await page.locator('dialog .source-label select').nth(0).selectOption('keyboard1');
  await page.getByRole('button', { name: /Fortsätt matchen/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('touch movement and passing work together, then backgrounding saves a resumable match', async ({ page }, testInfo) => {
  await seed(page, 'solo');
  await page.clock.install();
  await page.goto('./');
  await page.locator('.source-label select').selectOption('touch');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.getByRole('button', { name: 'Passa', exact: true })).toBeVisible();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const joystick = await page.locator('.joystick').boundingBox();
  const pass = await page.getByRole('button', { name: 'Passa', exact: true }).boundingBox();
  if (!joystick || !pass) throw new Error('Missing touch controls');
  const finger = { x: joystick.x + joystick.width * 0.85, y: joystick.y + joystick.height * 0.5, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
  await page.clock.runFor(200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger, { x: pass.x + pass.width / 2, y: pass.y + pass.height / 2, id: 2 }] });
  await page.clock.runFor(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const saved = await savedState(page);
  expect(saved.ball.blocked).toBe(4);
  expect(Math.hypot(saved.players[4].x + 0.8, saved.players[4].z)).toBeGreaterThan(0.3);
  await page.getByRole('button', { name: /Fortsätt matchen/ }).click();
  await page.screenshot({ path: testInfo.outputPath('match-touch.png') });
  await page.reload();
  await expect(page.getByRole('button', { name: /Fortsätt sparad solomatch/ })).toBeVisible();
});

test('full time shows the result and supports a rematch', async ({ page }) => {
  await seed(page, 'solo', 0.12);
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(300);
  await expect(page.getByRole('heading', { name: 'Oavgjort!' })).toBeVisible();
  await page.getByRole('button', { name: /Spela igen/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('3:00');
});

test('twelve selectable teams follow the match, save and rematch', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.goto('./');
  await expect(page.locator('.club-grid button')).toHaveCount(12);
  await page.getByRole('button', { name: 'Välj Norrköping FC', exact: true }).click();
  await page.locator('.selected-club').nth(1).click();
  await page.getByRole('button', { name: 'Välj Värnamo FF', exact: true }).click();
  await expect(page.locator('.selected-club').nth(0)).toContainText('Norrköping FC');
  await expect(page.locator('.selected-club').nth(1)).toContainText('Värnamo FF');
  // Selecting the other side's club swaps the pair, keeping two different teams.
  await page.getByRole('button', { name: 'Välj Norrköping FC', exact: true }).click();
  await expect(page.locator('.selected-club').nth(0)).toContainText('Värnamo FF');
  await page.getByRole('button', { name: 'Välj Värnamo FF', exact: true }).click();
  await page.getByRole('button', { name: 'Starta snabbmatch' }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.home-name.team-name')).toHaveText('Norrköping FC');
  await expect(page.locator('.away-name.team-name')).toHaveText('Värnamo FF');
  await expect(page.locator('.home-name.team-name')).toHaveCSS('color', 'rgb(243, 202, 89)');
  await page.screenshot({ path: testInfo.outputPath('selected-teams.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  expect((await savedState(page)).clubs).toEqual(['solstad', 'draken']);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.home-name.team-name')).toHaveText('Norrköping FC');
  // Finish the saved fixture through its normal restoration path, then rematch.
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  await page.addInitScript((key) => {
    const state = JSON.parse(localStorage.getItem(key) || '{}');
    state.phase = 'playing';
    state.remaining = 0.1;
    localStorage.setItem(key, JSON.stringify(state));
  }, saveKey);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(300);
  await page.getByRole('button', { name: /Spela igen/ }).click();
  await expect(page.locator('.home-name.team-name')).toHaveText('Norrköping FC');
  await expect(page.locator('.away-name.team-name')).toHaveText('Värnamo FF');
});

test('earlier two-team saves restore with the original clubs', async ({ page }) => {
  const legacy = createMatch('solo');
  const oldState = JSON.parse(JSON.stringify(legacy));
  for (const point of [...oldState.players, oldState.ball]) {
    point.x /= FIELD.scale;
    point.z /= FIELD.scale;
  }
  for (const key of ['clubs', 'randomState', 'restartProtection', 'foul', 'pitchScale']) delete oldState[key];
  for (const player of oldState.players) {
    for (const key of ['slide', 'slideX', 'slideZ', 'slideHit', 'fallen', 'yellowCards', 'stuck']) delete player[key];
  }
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: saveKey, value: oldState });
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.home-name.team-name')).toHaveText('Alfred FF');
  await expect(page.locator('.away-name.team-name')).toHaveText('IFK Göteborg');
});

test('a slide tackle visibly moves, wins the ball, knocks down the opponent and survives saving', async ({ page }, testInfo) => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.players[4].x = -2;
  state.players[4].z = 0;
  state.players[9].x = 1;
  state.players[9].z = 0;
  state.ball = { x: 0.2, z: 0, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: saveKey, value: state },
  );
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: '02 Två spelare' }).click();
  await page.locator('.source-label select').nth(0).selectOption('keyboard1');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.keyboard.press('k');
  await page.clock.runFor(280);
  await page.screenshot({ path: testInfo.outputPath('slide-tackle.png') });
  await page.getByRole('button', { name: 'Pausa matchen' }).click();
  const saved = await savedState(page);
  expect(saved.ball.owner).toBe(4);
  expect(saved.players[4].slide).toBeGreaterThan(0.2);
  expect(saved.players[4].x).toBeGreaterThan(-1);
  expect(saved.players[9].fallen).toBeGreaterThan(0.8);
  expect(saved.players[4].yellowCards).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await page.clock.runFor(20);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
});

test('the AI scores from a crowded goalmouth without getting stuck', async ({ page }, testInfo) => {
  const state = createMatch('solo', 180, 'hard');
  state.randomState = 0;
  state.phase = 'playing';
  state.players[9].x = -FIELD.halfLength + 5;
  state.players[9].z = 0;
  state.players[6].x = -FIELD.halfLength + 5;
  state.players[6].z = 0;
  state.ball = { x: -FIELD.halfLength + 4.2, z: 0, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
    },
    { key: saveKey, value: state },
  );
  await page.clock.install();
  await page.goto('./');
  await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
  await page.clock.runFor(800);
  await expect(page.locator('.score')).toHaveText('0:1');
  await expect(page.getByText('MÅÅÅL!', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ai-goal.png') });
});

for (const outcome of [
  { seed: 0, phase: 'yellow-card', title: 'Gult kort!' },
  { seed: 1000, phase: 'free-kick', title: 'Frispark!' },
]) {
  test(`a missed slide displays ${outcome.phase} and restores the stoppage`, async ({ page }, testInfo) => {
    const state = createMatch('versus');
    state.phase = 'playing';
    state.randomState = outcome.seed;
    state.switchWait = [2, 2];
    state.players[6].x = 15;
    state.players[6].z = 10;
    state.players[4].x = -10;
    state.players[4].z = -10;
    state.players[9].x = -8;
    state.players[9].z = -8.4;
    state.ball = { x: 14.2, z: 10, vx: 0, vz: 0, owner: 6, blocked: null, lock: 0 };
    await page.addInitScript(
      ({ key, value }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
      },
      { key: saveKey, value: state },
    );
    await page.clock.install();
    await page.goto('./');
    await page.getByRole('button', { name: '02 Två spelare' }).click();
    await page.locator('.source-label select').nth(0).selectOption('keyboard1');
    await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-rendered', 'true');
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.keyboard.press('k');
    await page.clock.runFor(560);
    await expect(page.locator('.decision-announcement strong')).toHaveText(outcome.title);
    await page.screenshot({ path: testInfo.outputPath(`${outcome.phase}.png`) });
    await page.getByRole('button', { name: 'Pausa matchen' }).click();
    const saved = await savedState(page);
    expect(saved.phase).toBe(outcome.phase);
    expect(saved.foul?.team).toBe(1);
    expect(saved.players[4].yellowCards).toBe(outcome.phase === 'yellow-card' ? 1 : 0);
    await page.reload();
    await page.getByRole('button', { name: /Fortsätt sparad/ }).click();
    await expect(page.locator('.decision-announcement strong')).toHaveText(outcome.title);
    if (outcome.phase === 'free-kick') {
      await page.clock.runFor(1900);
      await expect(page.locator('.decision-announcement')).toHaveCount(0);
      await page.keyboard.press('.');
      await page.clock.runFor(40);
      await page.getByRole('button', { name: 'Pausa matchen' }).click();
      expect((await savedState(page)).ball.blocked).toBe(saved.foul?.taker);
    }
  });
}

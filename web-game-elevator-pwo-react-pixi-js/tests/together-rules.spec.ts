import { expect, test } from '@playwright/test';
import { type Command, createGame, layout } from '../src/game/model';
import { companionCommand, createCompanion, followWorld, guestMessage, readCommand, readWorld, sharedWorld } from '../src/game/shared';
import { command, createUI, step } from '../src/game/simulation';
import { parseSave, saveGame, saveKey } from '../src/game/storage';

function hosted() {
  const state = createGame(7);
  state.started = true;
  const ui = createUI();
  const companion = createCompanion(state, 1);
  state.companions = [companion];
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.ceil(seconds * 60); i++) step(state, ui, 1 / 60);
  };
  const guest = (action: Command, seconds = 2) => {
    companionCommand(state, companion, action);
    tick(seconds);
  };
  const message = () => JSON.parse(JSON.stringify(guestMessage(sharedWorld(state, ui), companion, false, [])));
  return { state, ui, companion, tick, guest, message };
}

test('guest commands are rebuilt from known fields only', () => {
  expect(readCommand({ type: 'call', extra: 'x' })).toEqual({ type: 'call' });
  expect(readCommand({ type: 'walk', x: 300, floor: 2, depth: 0.4, junk: true })).toEqual({ type: 'walk', x: 300, floor: 2, depth: 0.4 });
  expect(readCommand({ type: 'landing', target: 1 })).toEqual({ type: 'landing', target: 1 });
  expect(readCommand({ type: 'enter', building: 'mall' })).toEqual({ type: 'enter', building: 'mall' });
  for (const bad of [
    null,
    'call',
    { type: 'teleport' },
    { type: 'walk', x: Number.NaN },
    { type: 'floor', floor: 1.5 },
    { type: 'invite', id: 9 },
    { type: 'stairs', direction: 2 },
  ])
    expect(readCommand(bad)).toBeNull();
});

test('a companion shares the lift, doorway and lights with Colin, and everyone sees the same world', () => {
  const { state, ui, companion, tick, guest, message } = hosted();
  const lift = state.buildings[0].lift;
  expect(companion.player).toMatchObject({ place: 'hotel', floor: 0, riding: false });

  // The companion switches the light; Colin's own world shows it.
  guest({ type: 'light' }, 3);
  expect(state.buildings[0].lights[0]).toBe(false);
  expect(companion.ui.notice).toContain('släckta');
  expect(ui.notice).not.toContain('släckta');

  // Colin rides upstairs; the companion's call brings the lift back down for them.
  command(state, ui, { type: 'board' });
  tick(4);
  expect(state.player.riding).toBe(true);
  command(state, ui, { type: 'floor', floor: 2 });
  tick(20);
  expect(lift.position).toBe(2);
  guest({ type: 'call' }, 1);
  expect(lift.queue).toEqual([0]);
  expect(companion.ui.reach).toMatchObject({ type: 'call', building: 'hotel', floor: 0 });

  // Standing in the doorway holds the doors for everyone, exactly as Colin can.
  tick(20);
  expect(lift.position).toBe(0);
  guest({ type: 'threshold' }, 4);
  expect(companion.player).toMatchObject({ x: layout.threshold, depth: 0 });
  command(state, ui, { type: 'floor', floor: 3 });
  tick(12);
  expect(lift.blocked).toBe(true);
  expect(lift.destination).toBeNull();
  expect(lift.position).toBe(0);
  guest({ type: 'walk', x: 500, depth: 0.5 }, 3);
  tick(10);
  expect(lift.blocked).toBe(false);
  expect(lift.destination ?? lift.position).toBe(3);

  // The guest's view: its own character is state.player, Colin is a companion in slot 0.
  const world = readWorld(message(), 1, createGame(0).settings);
  expect(world).not.toBeNull();
  if (!world) return;
  expect(world.state.slot).toBe(1);
  expect(world.state.player).toEqual(JSON.parse(JSON.stringify(companion.player)));
  expect(world.state.companions?.map((other) => other.slot)).toEqual([0]);
  expect(world.state.companions?.[0].player.riding).toBe(true);
  expect(world.state.buildings[0].lights[0]).toBe(false);
  expect(world.you.notice).not.toMatch(/\bColin tar\b/);
});

test('guests glide between world messages and reject tampered ones', () => {
  const { state, tick, guest, message } = hosted();
  const settings = createGame(0).settings;
  const first = readWorld(message(), 1, settings);
  if (!first) throw new Error('Missing world');
  const display = structuredClone(first.state);
  guest({ type: 'walk', x: 450, depth: 0.4 }, 0.4);
  const next = readWorld(message(), 1, settings);
  if (!next) throw new Error('Missing world');
  followWorld(display, next.state, 1 / 60);
  expect(display.player.x).toBeGreaterThan(next.state.player.x);
  expect(display.player.x).toBeLessThan(first.state.player.x);
  for (let i = 0; i < 120; i++) followWorld(display, next.state, 1 / 60);
  expect(display.player.x).toBe(next.state.player.x);
  expect(display.settings).toEqual(settings);

  const tampered = message();
  tampered.buildings[0].lift.position = 99;
  expect(readWorld(tampered, 1, settings)).toBeNull();
  expect(readWorld({ ...message(), players: [] }, 1, settings)).toBeNull();
  expect(readWorld(message(), 2, settings)).toBeNull();
  tick(1);
  expect(JSON.stringify(message()).length).toBeLessThan(8000);
  expect(state.companions).toHaveLength(1);
});

test('shared play never reaches the saves', () => {
  const { state, guest } = hosted();
  guest({ type: 'light' }, 3);
  const store = new Map<string, string>();
  saveGame({ getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }, state);
  const saved = parseSave(store.get(saveKey) ?? null);
  expect(saved?.companions).toBeUndefined();
  expect(saved?.slot).toBeUndefined();
  expect(saved?.buildings[0].lights[0]).toBe(false);
  expect(saved?.player).toEqual(state.player);
});

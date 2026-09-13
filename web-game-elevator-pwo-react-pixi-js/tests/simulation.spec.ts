import { expect, test } from '@playwright/test';
import { worldAction } from '../src/game/interaction';
import { type Command, createGame, currentBuilding, floorY, layout, playerLevel } from '../src/game/model';
import { GameSession } from '../src/game/session';
import { command, createUI, requestFloor, step } from '../src/game/simulation';
import { backupKey, loadGame, parseSave, saveGame, saveKey } from '../src/game/storage';

function setup() {
  const state = createGame(42);
  const ui = createUI();
  const tick = (seconds: number) => {
    for (let i = 0; i < Math.ceil(seconds * 60); i++) step(state, ui, 1 / 60);
  };
  const act = (action: Command, seconds = 2) => {
    command(state, ui, action);
    tick(seconds);
  };
  return { state, ui, tick, act };
}

test('ride or step out and take the stairs while the lift completes its own journey', () => {
  const { state, ui, tick, act } = setup();
  act({ type: 'board' });
  expect(state.player.riding).toBe(true);
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  expect(ui.panel).toBeNull();
  expect(currentBuilding(state)?.lift.dwell).toBe(5);
  act({ type: 'leave' });
  expect(state.player.riding).toBe(false);
  expect(state.buildings[0].lift.queue).toEqual([2]);
  act({ type: 'stairs', direction: 1 }, 6);
  act({ type: 'stairs', direction: 1 }, 3.2);
  expect(state.player.floor).toBe(2);
  expect(state.buildings[0].lift.position).toBeLessThan(2);
  tick(10);
  expect(state.buildings[0].lift.position).toBe(2);
  expect(state.buildings[0].lift.landing.open).toBe(1);
});

test('entering a closing doorway reopens it; standing there is indefinitely repeatable', () => {
  const { state, tick, act } = setup();
  const lift = state.buildings[0].lift;
  state.player.x = layout.threshold - 50;
  requestFloor(state.buildings[0], 2);
  tick(5.2);
  expect(lift.landing.open).toBeLessThan(1);
  act({ type: 'threshold' }, 2);
  expect(state.player.x).toBe(layout.threshold);
  expect(lift.blocked).toBe(true);
  expect(lift.landing.open).toBe(1);
  tick(30);
  expect(lift.position).toBe(0);
  act({ type: 'leave' }, 0.8);
  expect(lift.dwell).toBeGreaterThan(4);
  tick(17);
  expect(lift.position).toBe(2);
});

test('requests are FIFO, deduplicated, and do not reverse an active journey', () => {
  const { state, tick } = setup();
  const building = state.buildings[0];
  requestFloor(building, 2);
  tick(2);
  const dwell = building.lift.dwell;
  requestFloor(building, 2);
  expect(building.lift.dwell).toBe(dwell);
  tick(5);
  expect(building.lift.destination).toBe(2);
  requestFloor(building, 1);
  requestFloor(building, 0);
  requestFloor(building, 1);
  expect(building.lift.queue).toEqual([1, 0]);
  tick(11);
  expect(building.lift.position).toBe(2);
  tick(30);
  expect(building.lift.position).toBe(0);
  expect(building.lift.queue).toEqual([]);
});

test('closed doors block walking; a new destination cancels an unperformed interaction', () => {
  const { state, act, tick } = setup();
  const lift = state.buildings[0].lift;
  lift.landing = { open: 0, target: 0 };
  lift.gate = { open: 0, target: 0 };
  act({ type: 'walk', x: layout.cabin });
  expect(state.player.x).toBeLessThan(layout.threshold);
  expect(state.player.riding).toBe(false);
  act({ type: 'light' }, 0.05);
  act({ type: 'walk', x: 200 });
  tick(3);
  expect(state.buildings[0].lights).toEqual([true, true, true]);
  expect(state.player.x).toBe(200);
});

test('manual gate and landing door both interlock; Colin can send a passenger and stay outside', () => {
  const { state, ui, act, tick } = setup();
  state.player.place = 'house';
  const building = state.buildings[2];
  act({ type: 'invite', id: 0 }, 6);
  expect(building.people[0].phase).toBe('riding');
  act({ type: 'board' }, 3);
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  act({ type: 'leave' });
  act({ type: 'gate' });
  tick(8);
  expect(building.lift.position).toBe(0);
  expect(building.lift.gate.open).toBe(0);
  expect(building.lift.landing.open).toBe(1);
  act({ type: 'landing' });
  tick(11);
  expect(building.lift.position).toBe(2);
  expect(state.player.floor).toBe(0);
  expect(building.people[0].phase).toBe('riding');
  act({ type: 'stairs', direction: 1 }, 6);
  act({ type: 'stairs', direction: 1 }, 3.2);
  act({ type: 'landing' }, 3);
  act({ type: 'gate' }, 4);
  expect(['leaving', 'returning']).toContain(building.people[0].phase);
});

test('passengers board one at a time and never operate the lift themselves', () => {
  const { state, tick, act } = setup();
  act({ type: 'invite', id: 0 }, 1.3);
  act({ type: 'invite', id: 1 }, 7);
  tick(20);
  const building = state.buildings[0];
  expect(building.people.every((person) => person.phase === 'riding')).toBe(true);
  expect(building.lift.position).toBe(0);
  expect(building.lift.queue).toEqual([]);
  requestFloor(building, 2);
  tick(21);
  expect(building.people[0].phase).toBe('returning');
  expect(building.people[1].phase).toBe('riding');
  expect(building.people[1].wanted).toBe(1);
});

test('all buildings keep moving off screen and every floor keeps its own lights and doors', () => {
  const { state, act, tick } = setup();
  act({ type: 'light' });
  act({ type: 'roomDoor' });
  requestFloor(state.buildings[0], 2);
  act({ type: 'exit' });
  expect(state.player.place).toBe('outside');
  act({ type: 'enter', building: 'mall' }, 2);
  tick(20);
  expect(state.player.place).toBe('mall');
  expect(state.buildings[0].lift.position).toBe(2);
  expect(state.buildings[0].lights).toEqual([false, true, true]);
  expect(state.buildings[0].roomDoors).toEqual([true, false, false]);
});

test('standing beside the shaft on another floor does not block a passenger below', () => {
  const { state, tick } = setup();
  state.player.floor = 1;
  state.player.x = layout.threshold;
  state.buildings[0].people[0].phase = 'waiting';
  tick(8);
  expect(state.buildings[0].people[0].phase).toBe('riding');
  expect(state.buildings[0].lift.blocked).toBe(false);
});

test('save/restore retains a mid-flight ride and validates corrupt snapshots with backup recovery', () => {
  const { state, ui, act, tick } = setup();
  state.started = true;
  act({ type: 'board' });
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  tick(8);
  expect(playerLevel(state)).toBeGreaterThan(0);
  expect(playerLevel(state)).toBeLessThan(2);
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      stored.set(key, value);
    },
  };
  expect(saveGame(storage, state)).toBe(true);
  expect(loadGame(storage).state).toEqual(state);
  tick(1);
  expect(saveGame(storage, state)).toBe(true);
  expect(stored.has(backupKey)).toBe(true);
  stored.set(saveKey, '{broken');
  expect(loadGame(storage).state).toEqual(parseSave(stored.get(backupKey) ?? null));
  expect(loadGame(storage).message).toContain('återställts');
  expect(parseSave(JSON.stringify({ ...state, version: 99 }))).toBeNull();
  state.buildings[0].lift.gate.open = 1;
  expect(parseSave(JSON.stringify(state))).toBeNull();
});

test('backgrounding and settings pause every lift and resume without clock catch-up or replaying alarms', () => {
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      stored.set(key, value);
    },
  };
  const session = new GameSession(storage);
  session.state.started = true;
  requestFloor(session.state.buildings[0], 2);
  requestFloor(session.state.buildings[1], 1);
  for (let i = 0; i < 8 * 60; i++) session.advance(1 / 60);
  session.ui.alarmRemaining = 2;
  session.pause(false, true);
  const paused = structuredClone(session.state);
  session.advance(3600);
  expect(session.state).toEqual(paused);
  expect(session.ui.alarmRemaining).toBe(0);
  expect(loadGame(storage).state).toEqual(paused);
  session.pause(true, false);
  session.advance(60);
  expect(session.state).toEqual(paused);
  session.pause(false);
  session.advance(1 / 60);
  expect(session.state.time - paused.time).toBeCloseTo(1 / 60);
  expect(session.state.buildings[0].lift.position).toBeGreaterThan(paused.buildings[0].lift.position);
  expect(session.state.buildings[1].lift.position).toBeGreaterThan(paused.buildings[1].lift.position);
});

test('every entry floor has separate stairwell and outside doors', () => {
  for (const place of ['hotel', 'mall', 'house'] as const) {
    const { state, act } = setup();
    state.player.place = place;
    const stairs = worldAction(state, { x: 105, y: floorY(0) - 100 });
    expect(stairs).toEqual({ type: 'stairs', direction: 1 });
    act(stairs as Command, 6);
    expect(state.player.floor).toBe(1);
    expect(state.player.place).toBe(place);
    act({ type: 'walk', floor: 0, x: 215 }, 5);
    const exit = worldAction(state, { x: 215, y: floorY(0) - 170 });
    expect(exit).toEqual({ type: 'exit' });
    act(exit as Command);
    expect(state.player.place).toBe('outside');
  }
});

test('a tap on another floor takes the stairs through all intermediate floors and reaches the selected spot', () => {
  const { state, act } = setup();
  const target = worldAction(state, { x: 430, y: floorY(2) + 20 });
  expect(target).toEqual({ type: 'walk', floor: 2, x: 430 });
  act(target as Command, 10);
  expect(state.player).toMatchObject({ floor: 2, x: 430, route: null, stairs: null, place: 'hotel' });
  act({ type: 'walk', floor: 0, x: 330 }, 10);
  expect(state.player).toMatchObject({ floor: 0, x: 330, route: null, stairs: null, place: 'hotel' });
});

test('retargeting during a flight finishes that flight before reversing; same-floor taps cancel a pending route', () => {
  const { state, act, tick } = setup();
  act({ type: 'walk', floor: 2, x: 430 }, 3);
  expect(state.player.stairs?.to).toBe(1);
  act({ type: 'walk', floor: 0, x: 370 }, 0.1);
  expect(state.player.stairs?.to).toBe(1);
  tick(8);
  expect(state.player).toMatchObject({ floor: 0, x: 370, stairs: null });
  act({ type: 'walk', floor: 2, x: 430 }, 0.1);
  act({ type: 'walk', floor: 0, x: 400 }, 5);
  expect(state.player).toMatchObject({ floor: 0, x: 400, route: null });
});

test('routes survive save/restore and older saves load without a route', () => {
  const { state, act } = setup();
  act({ type: 'walk', floor: 2, x: 430 }, 3);
  const restored = parseSave(JSON.stringify(state));
  expect(restored).toEqual(state);
  if (!restored) throw new Error('Route save did not restore');
  for (let i = 0; i < 8 * 60; i++) step(restored, createUI(), 1 / 60);
  expect(restored.player).toMatchObject({ floor: 2, x: 430, route: null });
  const legacy = createGame();
  expect(parseSave(JSON.stringify({ ...legacy, player: { ...legacy.player, route: undefined } }))?.player.route).toBeNull();
  expect(parseSave(JSON.stringify({ ...state, player: { ...state.player, route: { floor: 3, x: 400 } } }))).toBeNull();
});

test('a floor tap during an elevator ride waits for arrival before taking the stairs', () => {
  const { state, ui, act, tick } = setup();
  act({ type: 'board' });
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  tick(8);
  act({ type: 'walk', floor: 0, x: 400 }, 0.2);
  expect(state.player.riding).toBe(true);
  expect(state.player.stairs).toBeNull();
  expect(state.player.route?.floor).toBe(0);
  tick(20);
  expect(state.player).toMatchObject({ floor: 0, x: 400, riding: false, stairs: null, route: null });
});

test('version-1 saves migrate doorway occupants, riders, and routes without changing outdoor positions', () => {
  const old = { ...createGame(42), version: 1 };
  for (const building of old.buildings) for (const person of building.people) person.x = 240 + person.id * 75;
  old.player.x = 550;
  const blocked = parseSave(JSON.stringify(old));
  expect(blocked?.player.x).toBe(layout.threshold);
  if (!blocked) throw new Error('Legacy save failed');
  step(blocked, createUI(), 1 / 60);
  expect(blocked.buildings[0].lift.blocked).toBe(true);
  expect(parseSave(JSON.stringify(blocked))).toEqual(blocked);

  old.player.x = 726;
  old.player.riding = true;
  old.player.route = { floor: 2, x: 700 };
  old.player.targetX = 475;
  old.buildings[0].people[0].x = 595;
  old.buildings[0].people[0].phase = 'riding';
  const rider = parseSave(JSON.stringify(old));
  expect(rider?.player).toMatchObject({ x: layout.cabin, riding: true, targetX: 750, route: { floor: 2, x: 975 } });
  expect(rider?.buildings[0].people[0].x).toBe(870);

  old.player.place = 'outside';
  old.player.x = 630;
  old.player.riding = false;
  old.player.targetX = 380;
  old.player.route = { floor: 0, x: 700 };
  expect(parseSave(JSON.stringify(old))?.player).toMatchObject({ x: 630, targetX: 380, route: { floor: 0, x: 700 } });
});

test('the expanded corridor keeps alarm, light, call buttons, and cabin hit targets aligned', () => {
  const state = createGame(42);
  for (const place of ['hotel', 'mall', 'house'] as const) {
    state.player.place = place;
    expect(worldAction(state, { x: 703, y: floorY(0) - 175 })).toEqual({ type: 'alarm' });
    expect(worldAction(state, { x: 703, y: floorY(0) - 95 })).toEqual({ type: 'alarm' });
    expect(worldAction(state, { x: 625, y: floorY(0) - 100 })).toEqual({ type: 'light' });
    expect(worldAction(state, { x: 773, y: floorY(0) - 100 })).toEqual({ type: 'call' });
    expect(worldAction(state, { x: layout.cabin, y: floorY(0) - 100 })).toEqual({ type: 'board' });
    expect(worldAction(state, { x: layout.threshold, y: floorY(0) + 15 })).toEqual({ type: 'threshold' });
  }
});

test('the taller painted passengers can be invited by tapping their number bubbles', () => {
  const state = createGame(42);
  const person = state.buildings[0].people[0];
  expect(worldAction(state, { x: person.x, y: floorY(0) - 178 })).toEqual({ type: 'invite', id: person.id });
});

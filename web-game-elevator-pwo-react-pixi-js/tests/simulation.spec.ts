import { expect, test } from '@playwright/test';
import { type Command, createGame, currentBuilding, layout, playerLevel } from '../src/game/model';
import { actorBounds } from '../src/game/room-art';
import { roomAction } from '../src/game/room-interaction';
import { GameSession } from '../src/game/session';
import { command, createUI, requestFloor, step } from '../src/game/simulation';
import { cabinPanel, doorClearance, projectPoint } from '../src/game/spatial';
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

test('zoom preference migrates old saves and rejects invalid values without discarding other settings', () => {
  const state = createGame(42);
  const old = JSON.parse(JSON.stringify(state));
  delete old.settings.cameraZoom;
  expect(parseSave(JSON.stringify(old))?.settings).toEqual(state.settings);
  state.settings.cameraZoom = 1.73;
  expect(parseSave(JSON.stringify(state))?.settings).toEqual(state.settings);
  for (const cameraZoom of [0, 3, null, '1.5']) {
    old.settings.cameraZoom = cameraZoom;
    expect(parseSave(JSON.stringify(old))).toBeNull();
  }
});

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
  state.player.depth = 0.1;
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
  expect(state.player.depth).toBeGreaterThan(0);
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
  act({ type: 'invite', id: 0 }, 8);
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
  act({ type: 'roomDoor' }, 4);
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
    const stairs = roomAction(state, { x: 240, y: 300 }, 0);
    expect(stairs).toEqual({ type: 'stairs', direction: 1 });
    act(stairs as Command, 6);
    expect(state.player.floor).toBe(1);
    expect(state.player.place).toBe(place);
    act({ type: 'walk', floor: 0, x: layout.exit, depth: 0.3 }, 8);
    const exit = roomAction(state, { x: 1210, y: 350 }, 0);
    expect(exit).toEqual({ type: 'exit' });
    act(exit as Command);
    expect(state.player.place).toBe('outside');
  }
});

test('a tap on another floor takes the stairs through all intermediate floors and reaches the selected spot', () => {
  const { state, act } = setup();
  const target = roomAction(state, projectPoint({ x: 430, depth: 0.4 }), 2);
  expect(target).toMatchObject({ type: 'walk', floor: 2, x: 430 });
  act(target as Command, 11);
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
  old.player.route = { floor: 2, x: 700, depth: 0.3 };
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
  old.player.route = { floor: 0, x: 700, depth: 0.3 };
  expect(parseSave(JSON.stringify(old))?.player).toMatchObject({ x: 630, targetX: 380, route: { floor: 0, x: 700 } });
});

test('perspective room art keeps alarm, light, call buttons, and cabin hit targets aligned', () => {
  const state = createGame(42);
  for (const building of state.buildings) for (const person of building.people) person.phase = 'away';
  for (const place of ['hotel', 'mall', 'house'] as const) {
    state.player.place = place;
    expect(roomAction(state, { x: 488, y: 329 }, 0)).toEqual({ type: 'alarm' });
    expect(roomAction(state, { x: 577, y: 420 }, 0)).toEqual({ type: 'light' });
    expect(roomAction(state, { x: 654, y: 416 }, 0)).toEqual({ type: 'call' });
    expect(roomAction(state, { x: 950, y: 300 }, 0)).toEqual({ type: 'board' });
    expect(roomAction(state, { x: 900, y: 640 }, 0)).toEqual({ type: 'threshold' });
  }
});

test('the taller painted passengers can be invited by tapping their number bubbles', () => {
  const state = createGame(42);
  const person = state.buildings[0].people[0];
  const bounds = actorBounds(person);
  expect(roomAction(state, { x: bounds.x, y: bounds.y - bounds.height - 22 }, 0)).toEqual({ type: 'invite', id: person.id });
});

test('version-2 saves gain depth and crossing waypoints while keeping progress and settings', () => {
  const old = { ...createGame(42), version: 2 };
  old.started = true;
  old.player.x = layout.cabin;
  old.player.riding = true;
  old.player.targetX = 750;
  old.player.intent = { type: 'leave' };
  old.player.route = { floor: 0, x: 400, depth: 0.3 };
  old.settings.muted = true;
  old.buildings[1].lights[2] = false;
  const restored = parseSave(JSON.stringify(old));
  expect(restored?.version).toBe(3);
  expect(restored?.player).toMatchObject({ riding: true, depth: -0.18, targetDepth: 0.3, route: { floor: 0, x: 400, depth: 0.3 } });
  expect(restored?.player.waypoints).toHaveLength(2);
  expect(restored?.settings.muted).toBe(true);
  expect(restored?.buildings[1].lights[2]).toBe(false);
  expect(parseSave(JSON.stringify(restored))).toEqual(restored);
  if (!restored) throw new Error('Missing migrated save');
  for (let i = 0; i < 5 * 60; i++) step(restored, createUI(), 1 / 60);
  expect(restored.player).toMatchObject({ x: 400, depth: 0.3, riding: false, targetX: null });
  expect(parseSave(JSON.stringify({ ...restored, player: { ...restored.player, depth: NaN } }))).toBeNull();
  expect(parseSave(JSON.stringify({ ...restored, player: { ...restored.player, waypoints: [{ x: 825, depth: -5 }] } }))).toBeNull();
});

test('depth separates walking in front of the lift from occupying its doorway', () => {
  const { state, act, tick } = setup();
  act({ type: 'walk', x: layout.threshold, depth: 0.7 }, 3);
  requestFloor(state.buildings[0], 1);
  tick(7);
  expect(state.buildings[0].lift.blocked).toBe(false);
  expect(state.buildings[0].lift.destination).toBe(1);
  expect(state.player.riding).toBe(false);
  expect(state.player.depth).toBe(0.7);
});

test('opening the floor panel while entering finishes boarding and keeps save snapshots valid', () => {
  const { state, ui, act, tick } = setup();
  act({ type: 'board' }, 1.5);
  expect(state.player.riding).toBe(true);
  expect(state.player.targetX).not.toBeNull();
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 1 });
  tick(1);
  expect(state.player).toMatchObject({ x: layout.cabin, depth: -0.18, targetX: null, riding: true });
  expect(parseSave(JSON.stringify(state))).toEqual(state);
  tick(12);
  expect(state.buildings[0].lift.position).toBe(1);
});

test('the visible cabin panel stays clickable between floors while other floor previews remain destinations', () => {
  const { state, ui, act, tick } = setup();
  act({ type: 'board' });
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  tick(11);
  expect(state.buildings[0].lift.destination).toBe(2);
  expect(roomAction(state, { x: 950, y: 300 }, Math.round(playerLevel(state)))).toEqual({ type: 'panel' });
  expect(roomAction(state, { x: 950, y: 300 }, 0)).toMatchObject({ type: 'walk', floor: 0 });
});

for (const place of ['hotel', 'mall', 'house'] as const)
  test(`${place} doors approach a stationary Colin, reverse before touching him, and can repeat`, () => {
    const { state, ui, act, tick } = setup();
    state.player.place = place;
    const building = currentBuilding(state);
    if (!building) throw new Error('Missing building');
    for (const person of building.people) person.phase = 'away';
    act({ type: 'threshold' }, 3);
    const lift = building.lift;
    const action = { type: place === 'house' ? 'gate' : 'landing' } as const;
    for (let repeat = 0; repeat < 2; repeat++) {
      command(state, ui, action);
      tick(0.25);
      const door = place === 'house' ? lift.gate : lift.landing;
      expect(door.target).toBe(0);
      expect(door.open).toBeLessThan(0.9);
      expect(lift.blocked).toBe(true);
      expect(state.player).toMatchObject({ x: layout.threshold, depth: 0, targetX: null });
      for (let i = 0; i < 90; i++) {
        tick(1 / 60);
        expect(door.open).toBeGreaterThanOrEqual(doorClearance(state.player, place === 'house'));
        expect(lift.destination).toBeNull();
      }
      expect(door.open).toBe(1);
      expect(door.target).toBe(1);
      expect(parseSave(JSON.stringify(state))).toEqual(state);
    }
    act({ type: 'leave' }, 2);
    act(action, 2);
    expect((place === 'house' ? lift.gate : lift.landing).open).toBe(0);
  });

test('back-wall numbered buttons select a floor only after boarding and remain deduplicated', () => {
  const { state, ui, act } = setup();
  const point = { x: cabinPanel.x, y: cabinPanel.top + 2 * cabinPanel.spacing };
  expect(roomAction(state, point, 0)).toEqual({ type: 'board' });
  command(state, ui, { type: 'floor', floor: 2 });
  expect(state.buildings[0].lift.queue).toEqual([]);
  act({ type: 'board' }, 3);
  const action = roomAction(state, point, 0);
  expect(action).toEqual({ type: 'floor', floor: 2 });
  if (!action) throw new Error('Missing button action');
  command(state, ui, action);
  command(state, ui, action);
  expect(state.buildings[0].lift.queue).toEqual([2]);
  expect(ui.panel).toBeNull();
});

test('queued automatic doors retry closing while blocked and depart only after Colin steps away', () => {
  const { state, tick, act } = setup();
  const lift = state.buildings[0].lift;
  act({ type: 'threshold' }, 3);
  requestFloor(state.buildings[0], 2);
  let reversals = 0;
  for (let i = 0; i < 20 * 60; i++) {
    const target = lift.landing.target;
    tick(1 / 60);
    if (target === 0 && lift.landing.target === 1) reversals++;
    expect(lift.position).toBe(0);
    expect(lift.landing.open).toBeGreaterThanOrEqual(doorClearance(state.player));
  }
  expect(reversals).toBeGreaterThanOrEqual(2);
  act({ type: 'leave' }, 2);
  tick(17);
  expect(lift.position).toBe(2);
});

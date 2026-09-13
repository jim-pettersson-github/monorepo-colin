import { expect, test } from '@playwright/test';
import { GameAudio } from '../src/game/audio';
import { buildings, type Command, createGame, currentBuilding, floorCount, floors, layout, playerLevel, stairDuration } from '../src/game/model';
import { actorBounds } from '../src/game/room-art';
import { roomAction } from '../src/game/room-interaction';
import { GameSession } from '../src/game/session';
import { command, createUI, requestFloor, step } from '../src/game/simulation';
import { cabinButton, cabinDoorButton, doorClearance, gateLever, projectPoint } from '../src/game/spatial';
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

test('older save versions reset the whole game instead of migrating or restoring a backup', () => {
  for (const version of [1, 2, 3]) {
    const old = { ...createGame(42), version, started: true };
    old.player.floor = 2;
    old.settings.liftVolume = 0.9;
    const backup = createGame(99);
    backup.started = true;
    const storage = { getItem: (key: string) => JSON.stringify(key === saveKey ? old : backup), setItem: () => {} };
    expect(parseSave(JSON.stringify(old))).toBeNull();
    const session = new GameSession(storage);
    expect(session.state.version).toBe(4);
    expect(session.state.started).toBe(false);
    expect(session.state.player).toEqual(createGame().player);
    expect(session.state.settings).toEqual(createGame().settings);
    expect(session.storageMessage).toContain('uppdaterats');
    expect(loadGame({ ...storage, getItem: (key) => (key === saveKey ? '{broken' : JSON.stringify(old)) }).state).toBeNull();
  }
});

test('motor audio fades, changes timbre with buildings and stops on arrival, mute and backgrounding', () => {
  const audio = new GameAudio();
  const scheduled: Array<{ frequency: { value: number }; stops: number[] }> = [];
  const gain = () => ({
    gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelAndHoldAtTime() {} },
    connect(target: unknown) {
      return target;
    },
    disconnect() {},
  });
  audio.context = {
    currentTime: 10,
    state: 'running',
    suspend: async () => {},
    createGain: gain,
    createOscillator: () => {
      const node = {
        frequency: { value: 0 },
        stops: [] as number[],
        type: 'sine',
        onended: null,
        connect(target: unknown) {
          return target;
        },
        disconnect() {},
        start() {},
        stop(time: number) {
          this.stops.push(time);
        },
      };
      scheduled.push(node);
      return node;
    },
  } as unknown as AudioContext;
  audio.liftGain = gain() as unknown as GainNode;
  audio.alarmGain = gain() as unknown as GainNode;
  const state = createGame(42);
  state.buildings[0].lift.destination = 9;
  audio.sync(state, false, 0);
  expect(scheduled.map((node) => node.frequency.value)).toEqual([82.5, 330]);
  audio.sync(state, false, 0);
  expect(scheduled).toHaveLength(2);
  state.player.place = 'house';
  state.buildings[2].lift.destination = 6;
  audio.sync(state, false, 0);
  expect(scheduled[0].stops).toEqual([10.2]);
  expect(scheduled.slice(2).map((node) => node.frequency.value)).toEqual([55, 220]);
  state.buildings[2].lift.destination = null;
  audio.sync(state, false, 0);
  expect(audio.motor).toBeNull();
  state.buildings[2].lift.destination = 6;
  audio.sync(state, false, 0);
  state.settings.muted = true;
  audio.sync(state, false, 0);
  expect(audio.motor).toBeNull();
  expect(audio.liftGain.gain.value).toBe(0);
  state.settings.muted = false;
  audio.sync(state, false, 0);
  audio.pause();
  expect(audio.motor).toBeNull();
  expect(scheduled.at(-1)?.stops).toEqual([10]);
  audio.sync(state, false, 0);
  state.player.place = 'outside';
  audio.sync(state, false, 0);
  expect(audio.motor).toBeNull();
  expect(audio.alarmGain.gain.value).toBe(state.settings.alarmVolume);
});

test('building-specific bounds apply to buttons, routes, queues, passengers and saves', () => {
  expect(buildings.map((building) => floorCount(building.id))).toEqual([10, 5, 7]);
  for (const definition of buildings) {
    const { state, ui } = setup();
    state.player.place = definition.id;
    state.player.riding = true;
    state.player.depth = -0.18;
    state.player.x = layout.cabin;
    const building = currentBuilding(state);
    if (!building) throw new Error('Missing building');
    for (const person of building.people) person.phase = 'away';
    for (const floor of floors(building.id)) {
      expect(roomAction(state, cabinButton(floor), 0)).toEqual({ type: 'floor', floor });
      requestFloor(building, floor);
    }
    expect(building.lift.queue).toEqual(floors(building.id).slice(1));
    for (const floor of [-1, floorCount(building.id), 1.5, NaN]) {
      expect(requestFloor(building, floor)).toBe(false);
      command(state, ui, { type: 'walk', floor, x: 400 });
      expect(state.player.route).toBeNull();
    }
    state.player.riding = false;
    state.player.depth = 0.3;
    state.player.floor = floorCount(building.id) - 1;
    expect(roomAction(state, { x: 1210, y: 350 }, state.player.floor)).toBeNull();
    expect(roomAction(state, { x: 240, y: 300 }, state.player.floor)).toEqual({ type: 'stairs', direction: -1 });
    building.lights[state.player.floor] = false;
    building.people[0].wanted = state.player.floor;
    expect(parseSave(JSON.stringify(state))).toEqual(state);
    for (const field of ['floor', 'wanted'] as const) {
      const invalid = structuredClone(state);
      const invalidBuilding = invalid.buildings.find((b) => b.id === building.id);
      if (!invalidBuilding) throw new Error('Missing building');
      invalidBuilding.people[0][field] = floorCount(building.id);
      expect(parseSave(JSON.stringify(invalid))).toBeNull();
    }
    state.player.floor = floorCount(building.id);
    expect(parseSave(JSON.stringify(state))).toBeNull();
  }
});

test('long stair routes accelerate gently, visit every floor and retain active duration when retargeted', () => {
  expect(stairDuration(1)).toBe(3);
  expect(stairDuration(2)).toBeCloseTo(3 / 1.1);
  expect(stairDuration(9)).toBe(3 / 1.6);
  const { state, ui, tick } = setup();
  state.player.x = layout.stairs;
  state.player.depth = 0.025;
  command(state, ui, { type: 'walk', floor: 9, x: 430, depth: 0.4 });
  tick(0.1);
  expect(state.player.stairs?.duration).toBe(3 / 1.6);
  const saved = parseSave(JSON.stringify(state));
  expect(saved).toEqual(state);
  if (!saved) throw new Error('Missing saved stairs');
  const visited = new Set<number>();
  for (let i = 0; i < 30 * 60; i++) {
    tick(1 / 60);
    visited.add(state.player.floor);
  }
  expect([...visited]).toEqual(floors('hotel'));
  expect(state.player).toMatchObject({ floor: 9, x: 430, depth: 0.4, route: null, stairs: null });
  command(state, ui, { type: 'walk', floor: 0, x: 430 });
  tick(2);
  const active = structuredClone(state.player.stairs);
  expect(active).not.toBeNull();
  command(state, ui, { type: 'walk', floor: 9, x: 440 });
  expect(state.player.stairs).toEqual(active);
  tick(10);
  expect(state.player).toMatchObject({ floor: 9, x: 440, stairs: null, route: null });
  for (let i = 0; i < 30 * 60; i++) step(saved, createUI(), 1 / 60);
  expect(saved.player).toMatchObject({ floor: 9, x: 430, route: null, stairs: null });
});

test('current saves require valid zoom settings', () => {
  const state = createGame(42);
  const old = JSON.parse(JSON.stringify(state));
  delete old.settings.cameraZoom;
  expect(parseSave(JSON.stringify(old))).toBeNull();
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
  expect(state.buildings[0].lights.every(Boolean)).toBe(true);
  expect(state.player.x).toBe(200);
});

test('manual gate interlocks with automatic landing doors; Colin can send a passenger and stay outside', () => {
  const { state, ui, act, tick } = setup();
  state.player.place = 'house';
  const building = state.buildings[2];
  act({ type: 'invite', id: 0 }, 8);
  expect(building.people[0].phase).toBe('riding');
  act({ type: 'board' }, 3);
  command(state, ui, { type: 'panel' });
  command(state, ui, { type: 'floor', floor: 2 });
  act({ type: 'leave' });
  tick(8);
  expect(building.lift.position).toBe(0);
  expect(building.lift.landing.open).toBe(1);
  act({ type: 'gate' });
  tick(13);
  expect(building.lift.gate.open).toBe(0);
  expect(building.lift.landing.open).toBe(1);
  expect(building.lift.position).toBe(2);
  expect(state.player.floor).toBe(0);
  expect(building.people[0].phase).toBe('riding');
  act({ type: 'stairs', direction: 1 }, 6);
  act({ type: 'stairs', direction: 1 }, 3.2);
  act({ type: 'gate' }, 4);
  expect(['leaving', 'returning']).toContain(building.people[0].phase);
});

test('old-house controls reach floor 6 with only the gate operated manually, then return to E', () => {
  const { state, ui, act, tick } = setup();
  state.player.place = 'house';
  const lift = state.buildings[2].lift;
  act({ type: 'board' }, 3);
  expect(roomAction(state, cabinDoorButton(0), 0)).toEqual({ type: 'landing', target: 0 });
  act({ type: 'floor', floor: 6 }, 8);
  expect(lift.position).toBe(0);
  act({ type: 'gate', target: 0 }, 34);
  expect(lift).toMatchObject({ position: 6, destination: null, landing: { open: 1 }, gate: { open: 0 } });
  expect(roomAction(state, gateLever, 6)).toEqual({ type: 'gate' });
  act({ type: 'gate', target: 1 });
  act({ type: 'gate', target: 1 });
  expect(lift.gate.open).toBe(1);
  act({ type: 'floor', floor: 0 });
  act({ type: 'gate', target: 0 }, 40);
  expect(lift).toMatchObject({ position: 0, destination: null, landing: { open: 1 }, gate: { open: 0 } });
  lift.landing = { open: 0, target: 0 };
  requestFloor(state.buildings[2], 0);
  tick(2);
  expect(lift.landing.open).toBe(1);
  expect(lift.gate.open).toBe(0);
  lift.landing = { open: 0.5, target: 0 };
  command(state, ui, { type: 'gate', target: 1 });
  tick(2);
  expect(lift.landing.open).toBe(0);
  expect(lift.gate.open).toBe(1);
  act({ type: 'landing', target: 1 });
  expect(lift.landing.open).toBe(1);
  expect(parseSave(JSON.stringify(state))).toEqual(state);
});

test('old-house arrow buttons operate only the outer doors and the lever operates only the gate', () => {
  const { state, act, tick } = setup();
  state.player.place = 'house';
  act({ type: 'board' }, 3);
  const lift = state.buildings[2].lift;
  for (const target of [0, 1, 0] as const) {
    const action = roomAction(state, cabinDoorButton(target), 0);
    expect(action).toEqual({ type: 'landing', target });
    if (action) act(action);
    expect(lift.landing.open).toBe(target);
    expect(lift.gate.open).toBe(1);
  }
  for (const target of [0, 1, 0] as const) {
    act({ type: 'gate', target });
    expect(lift.gate.open).toBe(target);
    expect(lift.landing.open).toBe(0);
  }
  // Reproduce the reported save: closed gate, open outer door, queued floors, no obstruction.
  state.player.x = layout.threshold;
  state.player.depth = -0.085;
  lift.landing = { open: 1, target: 1 };
  lift.queue = [2, 4];
  lift.dwell = 0;
  tick(2);
  expect(lift.landing.open).toBe(0);
  expect(lift.destination).toBe(2);
  tick(35);
  expect(lift.position).toBe(4);
});

test('operating the gate while boarding does not strand Colin in the threshold', () => {
  const { state, ui, tick } = setup();
  state.player.place = 'house';
  command(state, ui, { type: 'board' });
  for (let i = 0; i < 180 && !state.player.riding; i++) tick(1 / 60);
  expect(state.player.intent?.type).toBe('board');
  command(state, ui, { type: 'floor', floor: 6 });
  command(state, ui, { type: 'gate', target: 0 });
  tick(3);
  expect(state.player).toMatchObject({ x: layout.cabin, depth: -0.18, intent: null });
  // Obstruction can reopen the gate; the next deliberate close is still usable.
  command(state, ui, { type: 'gate', target: 0 });
  tick(40);
  expect(state.buildings[2].lift.position).toBe(6);
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

test('all buildings keep moving off screen and every floor keeps its own lights', () => {
  const { state, act, tick } = setup();
  act({ type: 'light' });
  act({ type: 'walk', x: layout.exit, depth: 0.3 }, 4);
  requestFloor(state.buildings[0], 2);
  act({ type: 'exit' });
  expect(state.player.place).toBe('outside');
  act({ type: 'enter', building: 'mall' }, 2);
  tick(20);
  expect(state.player.place).toBe('mall');
  expect(state.buildings[0].lift.position).toBe(2);
  expect(state.buildings[0].lights).toEqual([false, ...Array(9).fill(true)]);
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

test('routes survive save/restore and incomplete routes are rejected', () => {
  const { state, act } = setup();
  act({ type: 'walk', floor: 2, x: 430 }, 3);
  const restored = parseSave(JSON.stringify(state));
  expect(restored).toEqual(state);
  if (!restored) throw new Error('Route save did not restore');
  for (let i = 0; i < 8 * 60; i++) step(restored, createUI(), 1 / 60);
  expect(restored.player).toMatchObject({ floor: 2, x: 430, route: null });
  const legacy = createGame();
  expect(parseSave(JSON.stringify({ ...legacy, player: { ...legacy.player, route: undefined } }))).toBeNull();
  expect(parseSave(JSON.stringify({ ...state, player: { ...state.player, route: { floor: 10, x: 400, depth: 0.3 } } }))).toBeNull();
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
  const point = cabinButton(2);
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

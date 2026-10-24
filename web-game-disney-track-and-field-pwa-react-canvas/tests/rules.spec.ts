import { expect, test } from '@playwright/test';
import { GameInput } from '../src/game/input';
import type { Commands, EventId, GameState } from '../src/game/model';
import {
  championshipEvents,
  createGame,
  defaultSettings,
  events,
  jumpEvent,
  neutral,
  nextAttempt,
  nextEvent,
  obstacleCount,
  obstaclePosition,
  raceScale,
  stationaryEvent,
} from '../src/game/model';
import { Session } from '../src/game/session';
import { step } from '../src/game/simulation';
import { loadGame, recordResults, SAVE_KEY, saveGame, validGame, validSettings } from '../src/game/storage';

function auto(s: GameState): Commands {
  const r = s.runners[0];
  const count = obstacleCount(s.event);
  if (events.find((e) => e.id === s.event)?.type === 'run' && !count) return { ...neutral(), hold: true };
  return {
    feet: [],
    hold: true,
    action:
      count > 0
        ? r.hurdle < count && obstaclePosition(s.event, r.hurdle) - r.x < r.speed * raceScale(s.event) * 0.34 && r.jump === 0
        : stationaryEvent(s.event)
          ? s.time > 2.8
          : jumpEvent(s.event) && r.landingWindow > 0
            ? true
            : r.x > 17.2 && !r.launched,
  };
}
function complete(s: GameState) {
  for (let i = 0; i < 16000 && s.phase !== 'results' && s.phase !== 'attempt-result'; i++) step(s, [auto(s), neutral()]);
  return s;
}
for (const event of events)
  test(`${event.name} completes with valid scores and a usable human result`, () => {
    const s = createGame({ ...defaultSettings(), event: event.id });
    for (let attempt = 0; attempt < (event.type === 'run' ? 1 : 3); attempt++) {
      complete(s);
      expect(s.runners[0].result, `${event.id} attempt ${attempt}`).not.toBeNull();
      expect(validGame(s), event.id).toBe(true);
      if (s.phase === 'attempt-result') nextAttempt(s);
    }
    expect(s.phase).toBe('results');
    expect(s.runners.every((r) => r.done)).toBe(true);
    const before = structuredClone(s);
    step(s, [auto(s), neutral()]);
    expect(s).toEqual(before);
  });
test('the catalogue contains twenty individual events and no relays', () => {
  expect(events).toHaveLength(20);
  expect(new Set(events.map((e) => e.id)).size).toBe(20);
  expect(events.filter((e) => e.type === 'run')).toHaveLength(12);
});
test('alternating steps accelerate, repeated same-foot taps do not, and holding works only in assist mode', () => {
  const run = (assist: boolean, pattern: 'repeat' | 'alternate' | 'hold') => {
    const s = createGame({ ...defaultSettings(), assist });
    s.phase = 'playing';
    for (let i = 0; i < 300; i++)
      step(s, [
        { feet: pattern !== 'hold' && i % 12 === 0 ? [pattern === 'alternate' ? (((i / 12) % 2) as 0 | 1) : 0] : [], hold: pattern === 'hold', action: false },
        neutral(),
      ]);
    return s.runners[0].x;
  };
  expect(run(false, 'alternate')).toBeGreaterThan(run(false, 'repeat') * 5);
  expect(run(true, 'hold')).toBeGreaterThan(40);
  expect(run(false, 'hold')).toBe(0);
});
test('a missed hurdle slows the runner while a timed jump clears it', () => {
  const run = (jump: boolean) => {
    const s = createGame({ ...defaultSettings(), event: 'hurdles' });
    s.phase = 'playing';
    s.runners[0].x = 10;
    s.runners[0].speed = 10;
    for (let i = 0; i < 30; i++) step(s, [{ feet: [], hold: true, action: jump && i === 0 }, neutral()]);
    return s.runners[0];
  };
  expect(run(false).stumble).toBeGreaterThan(0);
  expect(run(true).stumble).toBe(0);
});
test('field events detect overrunning the line and tresteg rewards the two extra landing actions', () => {
  const foul = createGame({ ...defaultSettings(), event: 'javelin' });
  foul.phase = 'playing';
  for (let i = 0; i < 240; i++) step(foul, [{ ...neutral(), hold: true }, neutral()]);
  expect(foul.runners[0].foul).toBe(true);
  expect(foul.runners[0].result).toBeNull();
  const triple = createGame({ ...defaultSettings(), event: 'tripleJump' });
  complete(triple);
  expect(triple.runners[0].hops).toBe(3);
  expect(triple.runners[0].result).toBeGreaterThan(18);
});
test('the six-event individual championship preserves points across events and cannot award twice', () => {
  const s = createGame({ ...defaultSettings(), championship: true });
  for (const event of championshipEvents) {
    expect(s.event).toBe(event);
    for (let trial = 0; trial < 3 && s.phase !== 'results'; trial++) {
      complete(s);
      if (s.phase === 'attempt-result') nextAttempt(s);
    }
    expect(s.phase).toBe('results');
    expect(s.points[0]).toBeGreaterThan(0);
    const pts = [...s.points];
    step(s, [neutral(), neutral()]);
    expect(s.points).toEqual(pts);
    nextEvent(s);
  }
  expect(s.round).toBe(5);
  expect(s.phase).toBe('results');
  expect(s.points[0]).toBeLessThanOrEqual(30);
  expect(validGame(s)).toBe(true);
});
test('abandoned input times out safely and long races finish in less than a minute of arcade time', () => {
  const stopped = createGame(defaultSettings());
  for (let i = 0; i < 5000 && stopped.phase !== 'results'; i++) step(stopped, [neutral(), neutral()]);
  expect(stopped.runners[0].result).toBeNull();
  for (const event of ['marathon', 'raceWalk', 'distance10000'] as EventId[]) {
    const s = createGame({ ...defaultSettings(), event });
    complete(s);
    expect(s.time).toBeLessThan(65);
    expect(s.runners[0].x).toBeCloseTo(events.find((e) => e.id === event)?.distance ?? 0);
  }
});
test('pause and foreground loss freeze time without catching up', () => {
  const input = { start() {}, stop() {}, available: () => true, consume: () => [{ ...neutral(), hold: true }, neutral()] } as unknown as GameInput;
  const s = new Session(createGame(defaultSettings()), input);
  s.state.phase = 'playing';
  s.advance(0.1);
  s.setForeground(false);
  const paused = structuredClone(s.state);
  s.advance(60);
  expect(s.state).toEqual(paused);
  s.resume();
  expect(s.paused).toBe(true);
  s.setForeground(true);
  s.resume();
  s.advance(0.1);
  expect(s.state.time - paused.time).toBeLessThanOrEqual(0.11);
});
test('saves recover their backup, reject corrupt snapshots and keep separate assist records', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => entries.set(k, v) },
  });
  try {
    const s = createGame(defaultSettings());
    saveGame(s);
    saveGame(s);
    entries.set(SAVE_KEY, 'bad');
    expect(loadGame()).toEqual(s);
    expect(validGame({ ...s, runners: [] })).toBe(false);
    expect(validGame({ ...s, time: NaN })).toBe(false);
    complete(s);
    recordResults(s);
    expect(entries.get('sagospelen-records-v1')).toContain('sprint100:hold');
    expect(entries.has('alfred-fc-match-v1')).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('four gamepads use separate stable slots and disconnection pauses without reassigning players', () => {
  const desc = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const pads: (Gamepad | null)[] = [0, 1, 2, 3].map(
    (index) =>
      ({
        index,
        id: `Controller ${index}`,
        connected: true,
        buttons: Array.from({ length: 12 }, () => ({ pressed: false })),
        axes: [],
        mapping: 'standard',
      }) as unknown as Gamepad,
  );
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
  try {
    const input = new GameInput();
    input.poll();
    input.start(['pad:0', 'pad:1', 'pad:2', 'pad:3'], 4);
    if (!pads[1]) throw new Error('No pad');
    (pads[1].buttons[0] as { pressed: boolean }).pressed = true;
    input.poll();
    const commands = input.consume();
    expect(commands[0].feet).toEqual([]);
    expect(commands[1].feet).toEqual([0]);
    expect(commands[1].hold).toBe(true);
    if (!pads[3]) throw new Error('No fourth pad');
    (pads[3].buttons[1] as { pressed: boolean }).pressed = true;
    input.poll();
    const next = input.consume();
    expect(next[1].feet).toEqual([]);
    expect(next.map((c) => c.action)).toEqual([false, false, false, true]);
    let disconnected = 0;
    input.onDisconnect = () => disconnected++;
    pads[3] = null;
    input.poll();
    expect(disconnected).toBe(1);
    expect(input.sources).toEqual(['pad:0', 'pad:1', 'pad:2', 'pad:3']);
    expect(input.available('pad:1')).toBe(true);
  } finally {
    if (desc) Object.defineProperty(navigator, 'getGamepads', desc);
    else Reflect.deleteProperty(navigator, 'getGamepads');
  }
});
test('two touch runners hold and release their own steps independently', () => {
  const input = new GameInput();
  input.start(['touch', 'touch'], 2);
  input.press(0, 0, true);
  input.press(1, 1, true);
  const a = input.consume();
  expect(a.slice(0, 2).map((c) => c.hold)).toEqual([true, true]);
  input.press(0, 0, false);
  const b = input.consume();
  expect(b.slice(0, 2).map((c) => c.hold)).toEqual([false, true]);
  input.stop();
  expect(input.consume().every((c) => !c.hold && !c.action)).toBe(true);
});

test('three and four humans have independent lanes and complete with no unintended AI', () => {
  for (const players of [3, 4] as const) {
    const s = createGame({ ...defaultSettings(), players });
    s.phase = 'playing';
    expect(s.runners.map((r) => r.human)).toEqual(players === 3 ? [0, 1, 2, null] : [0, 1, 2, 3]);
    for (let i = 0; i < 60; i++) step(s, [neutral(), neutral(), { ...neutral(), hold: true }, neutral()]);
    expect(s.runners[2].x).toBeGreaterThan(5);
    expect(s.runners[0].x).toBe(0);
    expect(s.runners[1].x).toBe(0);
    if (players === 4) expect(s.runners[3].x).toBe(0);
    for (let i = 0; i < 1000; i++)
      step(
        s,
        Array.from({ length: 4 }, () => ({ ...neutral(), hold: true })),
      );
    expect(s.phase).toBe('results');
    expect(s.runners.every((r) => r.result !== null)).toBe(true);
    expect(validGame(s)).toBe(true);
  }
});

test('four-player input keeps touches and their releases separate', () => {
  const input = new GameInput();
  input.start(['touch', 'touch', 'touch', 'touch'], 4);
  for (let i = 0; i < 4; i++) input.press(i, i % 2, true);
  expect(input.consume().map((c) => c.hold)).toEqual([true, true, true, true]);
  input.press(2, 0, false);
  input.press(3, 2, true);
  const commands = input.consume();
  expect(commands.map((c) => c.hold)).toEqual([true, true, false, true]);
  expect(commands.map((c) => c.action)).toEqual([false, false, false, true]);
  input.stop();
  expect(input.consume().every((c) => !c.hold && !c.action)).toBe(true);
});

test('four-player settings reject shared physical controls and duplicate characters but accept shared touch', () => {
  const s = { ...defaultSettings(), players: 4 as const };
  expect(validSettings(s)).toBe(true);
  expect(validSettings({ ...s, sources: ['keyboard1', 'keyboard2', 'keyboard3', 'keyboard1'] })).toBe(false);
  expect(validSettings({ ...s, sources: ['pad:0', 'pad:1', 'pad:2', 'pad:0'] })).toBe(false);
  expect(validSettings({ ...s, sources: ['touch', 'touch', 'touch', 'touch'] })).toBe(true);
  expect(validSettings({ ...s, characters: ['mickey', 'stitch', 'elsa', 'mickey'] })).toBe(false);
  expect(validSettings({ ...s, sources: ['keyboard1', 'keyboard2'] })).toBe(false);
});

test('legacy two-slot saves restore and gain slots for players three and four', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const legacy = createGame({ ...defaultSettings(), players: 2, characters: ['mickey', 'stitch'], sources: ['keyboard1', 'keyboard2'] });
  legacy.phase = 'playing';
  legacy.runners[1].x = 12;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => (k === SAVE_KEY ? JSON.stringify(legacy) : null) },
  });
  try {
    const loaded = loadGame();
    expect(loaded?.settings.characters).toHaveLength(4);
    expect(loaded?.settings.sources).toEqual(['keyboard1', 'keyboard2', 'keyboard3', 'keyboard4']);
    expect(loaded?.runners).toEqual(legacy.runners);
    expect(validGame(loaded)).toBe(true);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

import { NetworkPlay } from '../src/game/network-play';
import type { PeerLink } from '../src/game/peer-link';

test('network controls keep edge actions once, pause all peers and reject stale round input', () => {
  type Command = { hold: boolean; action: boolean };
  type State = { x: number };
  class Link {
    status = 'connected';
    error = '';
    other?: Link;
    messages = new Set<(v: unknown) => void>();
    statuses = new Set<() => void>();
    send(v: unknown) {
      for (const listener of this.other?.messages ?? []) listener(structuredClone(v));
      return true;
    }
    onMessage(f: (v: unknown) => void) {
      this.messages.add(f);
      return () => {
        this.messages.delete(f);
      };
    }
    subscribe(f: () => void) {
      this.statuses.add(f);
      return () => {
        this.statuses.delete(f);
      };
    }
    close() {
      this.status = 'closed';
      for (const f of this.other?.statuses ?? []) f();
    }
  }
  const a = new Link(),
    b = new Link();
  a.other = b;
  b.other = a;
  let received: State = { x: 0 };
  const options = {
    snapshot: () => ({ x: 12 }),
    apply: (s: State) => {
      received = s;
    },
    validState: (s: unknown): s is State => !!s && typeof s === 'object' && 'x' in s && typeof s.x === 'number' && Number.isFinite(s.x),
    validCommand: (c: unknown): c is Command =>
      !!c && typeof c === 'object' && 'hold' in c && typeof c.hold === 'boolean' && 'action' in c && typeof c.action === 'boolean',
    neutral: () => ({ hold: false, action: false }),
    merge: (p: Command, n: Command) => ({ hold: n.hold, action: p.action || n.action }),
    afterConsume: (c: Command) => ({ ...c, action: false }),
    clear: () => {},
    changed: () => {},
  };
  const host = new NetworkPlay({ ...options, connections: [{ slot: 1, link: a as unknown as PeerLink }], localSlot: 0 });
  const guest = new NetworkPlay({ ...options, connections: [{ slot: 1, link: b as unknown as PeerLink }], localSlot: 1 });
  guest.tick(0.05, { hold: true, action: true }, true);
  expect(host.consume(1)).toEqual({ hold: true, action: true });
  expect(host.consume(1)).toEqual({ hold: true, action: false });
  host.tick(0.05, { hold: false, action: false }, true);
  expect(received.x).toBe(12);
  guest.setForeground(false);
  expect(host.paused).toBe(true);
  expect(host.canResume).toBe(false);
  expect(guest.paused).toBe(true);
  guest.setForeground(true);
  host.resume();
  expect(host.paused).toBe(false);
  expect(guest.paused).toBe(false);
  expect(host.consume(1).hold).toBe(false);
  host.nextRound();
  b.send({ kind: 'input', epoch: 0, command: { hold: true, action: true }, ready: true });
  expect(host.consume(1)).toEqual({ hold: false, action: false });
  b.send({ kind: 'input', epoch: 1, command: { hold: true, action: true }, ready: true });
  expect(host.consume(1).action).toBe(true);
  b.send({ kind: 'input', epoch: 1, command: { hold: 'bad', action: true }, ready: true });
  expect(host.consume(1).action).toBe(false);
  host.close();
  guest.close();
});

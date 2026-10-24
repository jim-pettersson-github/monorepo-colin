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
import { loadGame, recordResults, SAVE_KEY, saveGame, validGame } from '../src/game/storage';

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

test('gamepad steps use separate stable slots and disconnection pauses without reassigning players', () => {
  const desc = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const pads: (Gamepad | null)[] = [0, 1].map(
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
    input.start(['pad:0', 'pad:1'], 2);
    if (!pads[1]) throw new Error('No pad');
    (pads[1].buttons[0] as { pressed: boolean }).pressed = true;
    input.poll();
    const commands = input.consume();
    expect(commands[0].feet).toEqual([]);
    expect(commands[1].feet).toEqual([0]);
    expect(commands[1].hold).toBe(true);
    input.poll();
    expect(input.consume()[1].feet).toEqual([]);
    let disconnected = 0;
    input.onDisconnect = () => disconnected++;
    pads[0] = null;
    input.poll();
    expect(disconnected).toBe(1);
    expect(input.sources).toEqual(['pad:0', 'pad:1']);
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
  expect(a.map((c) => c.hold)).toEqual([true, true]);
  input.press(0, 0, false);
  const b = input.consume();
  expect(b.map((c) => c.hold)).toEqual([false, true]);
  input.stop();
  expect(input.consume().every((c) => !c.hold && !c.action)).toBe(true);
});

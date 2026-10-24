import type { EventId, GameState, Settings } from './model';
import { championshipEvents, characters, events } from './model';
export const SAVE_KEY = 'sagospelen-event-v1';
const validId = (id: unknown) => characters.some((c) => c.id === id);
const validEvent = (id: unknown) => events.some((e) => e.id === id);
export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const s = value as Settings;
  return (
    validEvent(s.event) &&
    typeof s.championship === 'boolean' &&
    [1, 2].includes(s.players) &&
    Array.isArray(s.characters) &&
    s.characters.length === 2 &&
    s.characters.every(validId) &&
    s.characters[0] !== s.characters[1] &&
    Array.isArray(s.sources) &&
    s.sources.length === 2 &&
    s.sources.every((s) => typeof s === 'string' && /^(keyboard[12]|touch|pad:\d{1,2})$/.test(s)) &&
    (s.players === 1 || s.sources[0] !== s.sources[1] || s.sources[0] === 'touch') &&
    ['easy', 'normal', 'hard'].includes(s.difficulty) &&
    typeof s.assist === 'boolean'
  );
}
const bounded = (n: unknown, a: number, b: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
export function validGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameState;
  if (
    s.version !== 1 ||
    !validSettings(s.settings) ||
    !validEvent(s.event) ||
    !Number.isInteger(s.round) ||
    !bounded(s.round, 0, 5) ||
    s.event !== (s.settings.championship ? championshipEvents[s.round] : s.settings.event) ||
    !Number.isInteger(s.attempt) ||
    !bounded(s.attempt, 0, 2) ||
    !['countdown', 'playing', 'attempt-result', 'results'].includes(s.phase) ||
    !bounded(s.countdown, 0, 3) ||
    !bounded(s.time, 0, 70) ||
    typeof s.awarded !== 'boolean'
  )
    return false;
  if (!Array.isArray(s.points) || s.points.length !== 4 || !s.points.every((p) => Number.isInteger(p) && bounded(p, 0, 30))) return false;
  if (!Array.isArray(s.runners) || s.runners.length !== 4 || new Set(s.runners.map((r) => r?.character)).size !== 4) return false;
  const run = events.find((e) => e.id === s.event)?.type === 'run';
  if ((run && (s.attempt !== 0 || s.phase === 'attempt-result')) || (s.phase === 'results') !== s.awarded) return false;
  return s.runners.every(
    (r, i) =>
      r &&
      validId(r.character) &&
      r.human === (i < s.settings.players ? i : null) &&
      (i >= s.settings.players || r.character === s.settings.characters[i]) &&
      [r.done, r.launched, r.foul].every((b) => typeof b === 'boolean') &&
      bounded(r.x, 0, 42200) &&
      bounded(r.speed, 0, 12) &&
      bounded(r.rhythm, 0, 1) &&
      [-1, 0, 1].includes(r.lastFoot) &&
      bounded(r.lastStep, -1, 70) &&
      bounded(r.stumble, 0, 1.2) &&
      bounded(r.jump, 0, 3) &&
      bounded(r.jumpV, -15, 7) &&
      Number.isInteger(r.hurdle) &&
      bounded(r.hurdle, 0, 12) &&
      (r.finish === null || bounded(r.finish, 0, 20000)) &&
      (r.result === null || bounded(r.result, 0, 20000)) &&
      bounded(r.flightX, 0, 200) &&
      bounded(r.flightY, -2, 100) &&
      bounded(r.flightVx, 0, 35) &&
      bounded(r.flightVy, -50, 35) &&
      bounded(r.aiNext, 0, 2) &&
      Number.isInteger(r.hops) &&
      bounded(r.hops, 0, 3) &&
      bounded(r.landingWindow, 0, 0.26) &&
      bounded(r.peak, 0, 100) &&
      bounded(r.takeoffQuality, 0, 1) &&
      Array.isArray(r.attempts) &&
      r.attempts.length < 4 &&
      r.attempts.every((n) => n === null || bounded(n, 0, 200)) &&
      (s.phase === 'playing' || s.phase === 'countdown' || r.done),
  );
}
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
export function loadGame(): GameState | null {
  for (const key of [SAVE_KEY, `${SAVE_KEY}-backup`]) {
    const value = read(key);
    if (validGame(value)) return value;
  }
  return null;
}
export function saveGame(state: GameState) {
  try {
    if (!validGame(state)) return;
    const old = read(SAVE_KEY);
    if (validGame(old)) localStorage.setItem(`${SAVE_KEY}-backup`, JSON.stringify(old));
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* Storage is optional. */
  }
}
export function clearGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(`${SAVE_KEY}-backup`);
  } catch {
    /* Storage is optional. */
  }
}
export function loadSettings(): Settings | null {
  const s = read('sagospelen-settings-v1');
  return validSettings(s) ? s : null;
}
export function saveSettings(s: Settings) {
  try {
    if (validSettings(s)) localStorage.setItem('sagospelen-settings-v1', JSON.stringify(s));
  } catch {
    /* Storage is optional. */
  }
}
export type Records = Partial<Record<string, { value: number; character: string }>>;
export function loadRecords(): Records {
  const raw = read('sagospelen-records-v1');
  const result: Records = {};
  if (raw && typeof raw === 'object')
    for (const [key, value] of Object.entries(raw)) {
      const v = value as { value: number; character: string };
      if (events.some((e) => key === `${e.id}:hold` || key === `${e.id}:rhythm`) && v && bounded(v.value, 0, 20000) && validId(v.character)) result[key] = v;
    }
  return result;
}
export const recordKey = (event: EventId, assist: boolean) => `${event}:${assist ? 'hold' : 'rhythm'}`;
export function recordResults(s: GameState) {
  if (s.phase !== 'results') return;
  const records = loadRecords();
  const key = recordKey(s.event, s.settings.assist);
  const run = events.find((e) => e.id === s.event)?.type === 'run';
  for (const r of s.runners) {
    if (r.human === null || r.result === null) continue;
    const old = records[key];
    if (!old || (run ? r.result < old.value : r.result > old.value)) records[key] = { value: r.result, character: r.character };
  }
  try {
    localStorage.setItem('sagospelen-records-v1', JSON.stringify(records));
  } catch {
    /* Keep the current result visible. */
  }
}

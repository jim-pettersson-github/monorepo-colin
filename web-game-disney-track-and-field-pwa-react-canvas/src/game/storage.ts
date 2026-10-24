import type { EventId, GameState, Settings } from './model';
import { allEvents, characters, defaultSettings, events, programme, separateControls, skillEvent } from './model';
export const SAVE_KEY = 'sagospelen-event-v1';
const validId = (id: unknown) => characters.some((c) => c.id === id);
const validEvent = (id: unknown) => allEvents.some((e) => e.id === id);
export function validSettings(value: unknown): value is Settings {
  if (!value || typeof value !== 'object') return false;
  const s = value as Settings;
  return (
    (s.runningStyleVersion === undefined || s.runningStyleVersion === 2) &&
    validEvent(s.event) &&
    typeof s.championship === 'boolean' &&
    [1, 2, 3, 4].includes(s.players) &&
    Array.isArray(s.characters) &&
    s.characters.length >= Math.max(2, s.players) &&
    s.characters.length <= 4 &&
    s.characters.every(validId) &&
    new Set(s.characters).size === s.characters.length &&
    Array.isArray(s.sources) &&
    s.sources.length >= Math.max(2, s.players) &&
    s.sources.length <= 4 &&
    s.sources.every((s) => typeof s === 'string' && /^(keyboard[1234]|touch|pad:\d{1,2})$/.test(s)) &&
    separateControls(s.sources, s.players) &&
    ['easy', 'normal', 'hard'].includes(s.difficulty) &&
    typeof s.assist === 'boolean'
  );
}
function expandSettings(settings: Settings): Settings {
  const ids = [...settings.characters];
  for (const c of characters) if (ids.length < 4 && !ids.includes(c.id)) ids.push(c.id);
  const sources = [...settings.sources];
  const defaults = defaultSettings().sources;
  while (sources.length < 4) sources.push(defaults[sources.length]);
  return { ...settings, characters: ids, sources };
}
const bounded = (n: unknown, a: number, b: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= a && n <= b;
export function validGame(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GameState;
  if (
    s.programme !== undefined &&
    (!Array.isArray(s.programme) || s.programme.length !== 6 || new Set(s.programme).size !== 6 || !s.programme.every(validEvent))
  )
    return false;
  if (
    s.version !== 1 ||
    !validSettings(s.settings) ||
    !validEvent(s.event) ||
    !Number.isInteger(s.round) ||
    !bounded(s.round, 0, 5) ||
    s.event !== (s.settings.championship ? programme(s)[s.round] : s.settings.event) ||
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
  const run = allEvents.find((e) => e.id === s.event)?.type === 'run';
  if ((run && (s.attempt !== 0 || s.phase === 'attempt-result')) || (s.phase === 'results') !== s.awarded) return false;
  return s.runners.every(
    (r, i) =>
      r &&
      validId(r.character) &&
      ((!r.skill && !skillEvent(s.event)) ||
        (!!r.skill &&
          ['ready', 'active', 'released', 'done'].includes(r.skill.stage) &&
          bounded(r.skill.aim, -50, 50) &&
          bounded(r.skill.progress, 0, 1) &&
          bounded(r.skill.balance, -2, 2) &&
          bounded(r.skill.score, 0, 100) &&
          bounded(r.skill.target, 0, 100) &&
          bounded(r.skill.elapsed, 0, 26))) &&
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
    if (validGame(value)) return { ...value, settings: expandSettings(value.settings) };
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
  return validSettings(s)
    ? expandSettings({
        ...s,
        runningStyleVersion: 2,
        assist: s.runningStyleVersion === 2 ? s.assist : false,
        event: events.some((e) => e.id === s.event) ? s.event : 'sprint100',
      })
    : null;
}
export function saveSettings(s: Settings) {
  try {
    if (validSettings(s)) localStorage.setItem('sagospelen-settings-v1', JSON.stringify({ ...s, runningStyleVersion: 2 }));
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
      if (
        allEvents.some((e) => key === `${e.id}:hold` || key === `${e.id}:rhythm` || (e.type === 'skill' && key === `${e.id}:skill`)) &&
        v &&
        bounded(v.value, 0, 20000) &&
        validId(v.character)
      )
        result[key] = v;
    }
  return result;
}
export const recordKey = (event: EventId, assist: boolean) => `${event}:${skillEvent(event) ? 'skill' : assist ? 'hold' : 'rhythm'}`;
export function recordResults(s: GameState) {
  if (s.phase !== 'results') return;
  const records = loadRecords();
  const key = recordKey(s.event, s.settings.assist);
  const run = allEvents.find((e) => e.id === s.event)?.type === 'run';
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

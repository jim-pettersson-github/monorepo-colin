import { buildings, type GameState, layout } from './model';

export const saveKey = 'colin-game-v1';
export const backupKey = 'colin-game-backup-v1';
export type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const floor = (value: unknown) => number(value, 0, 2) && Number.isInteger(value);
const flags = (value: unknown) => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'boolean');
const door = (value: unknown) => record(value) && number(value.open, 0, 1) && (value.target === 0 || value.target === 1);

function intent(value: unknown) {
  if (value === null) return true;
  if (!record(value)) return false;
  if (['call', 'board', 'leave', 'threshold', 'panel', 'light', 'roomDoor', 'exit', 'sign', 'alarm', 'landing', 'gate'].includes(String(value.type)))
    return true;
  if (value.type === 'stairs') return value.direction === -1 || value.direction === 1;
  if (value.type === 'invite') return number(value.id, 0, 2) && Number.isInteger(value.id);
  return value.type === 'enter' && buildings.some((building) => building.id === value.building);
}

export function parseSave(raw: string | null): GameState | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !record(value) ||
      ![1, 2].includes(Number(value.version)) ||
      typeof value.version !== 'number' ||
      typeof value.started !== 'boolean' ||
      !number(value.time, 0, 1e12) ||
      !number(value.random, 0, 4294967295)
    )
      return null;
    const legacy = value.version === 1;
    const width = legacy ? 780 : layout.width;
    const p = value.player;
    if (
      !record(p) ||
      !['hotel', 'mall', 'house', 'outside'].includes(String(p.place)) ||
      !floor(p.floor) ||
      !number(p.x, 0, p.place === 'outside' ? layout.outsideWidth : width) ||
      typeof p.riding !== 'boolean'
    )
      return null;
    const playerWidth = p.place === 'outside' ? layout.outsideWidth : width;
    if (p.targetX !== null && !number(p.targetX, 0, playerWidth)) return null;
    if (!intent(p.intent)) return null;
    // Older version-1 snapshots predate routes between floors.
    if (p.route === undefined) p.route = null;
    if (p.route !== null && (!record(p.route) || !floor(p.route.floor) || !number(p.route.x, 25, playerWidth - 30))) return null;
    if (
      p.stairs !== null &&
      (!record(p.stairs) ||
        !floor(p.stairs.from) ||
        !floor(p.stairs.to) ||
        !number(p.stairs.elapsed, 0, 3) ||
        Math.abs(Number(p.stairs.to) - Number(p.stairs.from)) !== 1)
    )
      return null;
    if (p.place === 'outside' && (p.riding || p.stairs !== null || p.floor !== 0 || (record(p.route) && p.route.floor !== 0))) return null;
    const settings = value.settings;
    if (
      !record(settings) ||
      !number(settings.liftVolume, 0, 1) ||
      !number(settings.alarmVolume, 0, 1) ||
      typeof settings.muted !== 'boolean' ||
      typeof settings.smoothCamera !== 'boolean'
    )
      return null;
    if (!Array.isArray(value.buildings) || value.buildings.length !== 3) return null;
    for (const [index, b] of value.buildings.entries()) {
      if (!record(b) || b.id !== buildings[index].id || !flags(b.lights) || !flags(b.roomDoors)) return null;
      const lift = b.lift;
      if (!record(lift) || !number(lift.position, 0, 2) || !(lift.destination === null || floor(lift.destination))) return null;
      if (
        !Array.isArray(lift.queue) ||
        lift.queue.length > 3 ||
        !lift.queue.every(floor) ||
        new Set(lift.queue).size !== lift.queue.length ||
        lift.queue.includes(lift.destination)
      )
        return null;
      if (!door(lift.landing) || !door(lift.gate) || !number(lift.dwell, 0, 5) || typeof lift.blocked !== 'boolean') return null;
      if (lift.destination === null && !Number.isInteger(lift.position)) return null;
      if (lift.destination !== null && ((lift.landing as { open: number }).open !== 0 || (lift.gate as { open: number }).open !== 0 || lift.blocked))
        return null;
      if (!Array.isArray(b.people) || b.people.length !== buildings[index].people.length) return null;
      for (const [personIndex, person] of b.people.entries()) {
        if (
          !record(person) ||
          person.id !== personIndex ||
          !floor(person.floor) ||
          !floor(person.wanted) ||
          !number(person.x, 0, width) ||
          !number(person.timer, -100, 100)
        )
          return null;
        if (!['idle', 'waiting', 'boarding', 'riding', 'leaving', 'returning', 'away'].includes(String(person.phase))) return null;
      }
      if (p.place === b.id && p.riding && (p.stairs !== null || Number(p.x) <= (legacy ? 570 : layout.threshold + 20))) return null;
    }
    const state = value as unknown as GameState;
    if (legacy) {
      // Keep the left-hand doors and cabin offsets; insert the new corridor space between them.
      const widen = (x: number) => x + Math.max(0, Math.min(1, (x - 300) / 25)) * 275;
      if (state.player.place !== 'outside') {
        state.player.x = widen(state.player.x);
        if (state.player.targetX !== null) state.player.targetX = widen(state.player.targetX);
        if (state.player.route) state.player.route.x = widen(state.player.route.x);
      }
      for (const building of state.buildings) for (const person of building.people) person.x = widen(person.x);
      state.version = 2;
    }
    return state;
  } catch {
    return null;
  }
}

export function loadGame(storage: Storage): { state: GameState | null; message: string } {
  try {
    const primary = storage.getItem(saveKey);
    const state = parseSave(primary);
    if (state) return { state, message: '' };
    const backup = parseSave(storage.getItem(backupKey));
    return { state: backup, message: backup ? 'En tidigare sparning har återställts.' : primary ? 'Sparningen kunde inte läsas. Ett nytt spel öppnas.' : '' };
  } catch {
    return { state: null, message: 'Spelet kan inte spara på den här enheten just nu.' };
  }
}

export function saveGame(storage: Storage, state: GameState) {
  try {
    const previous = storage.getItem(saveKey);
    if (previous && parseSave(previous)) storage.setItem(backupKey, previous);
    storage.setItem(saveKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

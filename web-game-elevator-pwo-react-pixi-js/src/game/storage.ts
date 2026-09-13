import { type BuildingId, buildings, floorCount, type GameState, layout, timing } from './model';

export const saveKey = 'colin-game-v1';
export const backupKey = 'colin-game-backup-v1';
export type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const floor = (value: unknown, count: number) => number(value, 0, count - 1) && Number.isInteger(value);
const flags = (value: unknown, count: number) => Array.isArray(value) && value.length === count && value.every((item) => typeof item === 'boolean');
const door = (value: unknown) => record(value) && number(value.open, 0, 1) && (value.target === 0 || value.target === 1);

function intent(value: unknown) {
  if (value === null) return true;
  if (!record(value)) return false;
  if (['call', 'board', 'leave', 'threshold', 'panel', 'light', 'exit', 'sign', 'alarm'].includes(String(value.type))) return true;
  if (value.type === 'landing' || value.type === 'gate') return value.target === undefined || value.target === 0 || value.target === 1;
  if (value.type === 'stairs') return value.direction === -1 || value.direction === 1;
  if (value.type === 'invite') return number(value.id, 0, 2) && Number.isInteger(value.id);
  return value.type === 'enter' && buildings.some((building) => building.id === value.building);
}

export function parseSave(raw: string | null): GameState | null {
  if (!raw || raw.length > 100_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 4 || typeof value.started !== 'boolean' || !number(value.time, 0, 1e12) || !number(value.random, 0, 4294967295))
      return null;
    const width = layout.width;
    const p = value.player;
    if (!record(p) || !['hotel', 'mall', 'house', 'outside'].includes(String(p.place))) return null;
    const count = p.place === 'outside' ? 1 : floorCount(p.place as BuildingId);
    if (
      !record(p) ||
      !['hotel', 'mall', 'house', 'outside'].includes(String(p.place)) ||
      !floor(p.floor, count) ||
      !number(p.x, 0, p.place === 'outside' ? layout.outsideWidth : width) ||
      typeof p.riding !== 'boolean'
    )
      return null;
    const playerWidth = p.place === 'outside' ? layout.outsideWidth : width;
    if (p.targetX !== null && !number(p.targetX, 0, playerWidth)) return null;
    if (
      !number(p.depth, -0.25, 1) ||
      (p.targetDepth !== null && !number(p.targetDepth, -0.25, 1)) ||
      (p.targetX === null) !== (p.targetDepth === null) ||
      !Array.isArray(p.waypoints) ||
      p.waypoints.length > 4 ||
      !p.waypoints.every((point) => record(point) && number(point.x, 0, playerWidth) && number(point.depth, -0.25, 1))
    )
      return null;
    if (!intent(p.intent)) return null;
    if (p.route !== null && (!record(p.route) || !floor(p.route.floor, count) || !number(p.route.x, 25, playerWidth - 30))) return null;
    if (record(p.route) && !number(p.route.depth, -0.25, 1)) return null;
    if (
      p.stairs !== null &&
      (!record(p.stairs) ||
        !floor(p.stairs.from, count) ||
        !floor(p.stairs.to, count) ||
        !number(p.stairs.duration, timing.stairs / 1.6, timing.stairs) ||
        !number(p.stairs.elapsed, 0, Number(p.stairs.duration)) ||
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
    if (!number(settings.cameraZoom, 1, 2.5)) return null;
    if (!Array.isArray(value.buildings) || value.buildings.length !== 3) return null;
    for (const [index, b] of value.buildings.entries()) {
      const count = buildings[index].rooms.length;
      if (!record(b) || b.id !== buildings[index].id || !flags(b.lights, count)) return null;
      const lift = b.lift;
      if (!record(lift) || !number(lift.position, 0, count - 1) || !(lift.destination === null || floor(lift.destination, count))) return null;
      if (
        !Array.isArray(lift.queue) ||
        lift.queue.length > count ||
        !lift.queue.every((value) => floor(value, count)) ||
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
          !floor(person.floor, count) ||
          !floor(person.wanted, count) ||
          !number(person.x, 0, width) ||
          !number(person.depth, -0.25, 1) ||
          !number(person.timer, -100, 100)
        )
          return null;
        if (!['idle', 'waiting', 'boarding', 'riding', 'leaving', 'returning', 'departing', 'away'].includes(String(person.phase))) return null;
      }
      if (p.place === b.id && p.riding && (p.stairs !== null || Number(p.depth) >= 0)) return null;
    }
    return value as unknown as GameState;
  } catch {
    return null;
  }
}

export function loadGame(storage: Storage): { state: GameState | null; message: string } {
  try {
    const primary = storage.getItem(saveKey);
    if (primary) {
      try {
        const header: unknown = JSON.parse(primary);
        if (record(header) && typeof header.version === 'number' && header.version < 4)
          return { state: null, message: 'Spelet har uppdaterats. Ett nytt äventyr börjar på entréplanet.' };
      } catch {
        /* A damaged current save can still use its valid backup. */
      }
    }
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

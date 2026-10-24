import { createColinIdle } from './colin-idle';
import {
  type Building,
  buildings,
  type Command,
  type Companion,
  characterName,
  type GameState,
  layout,
  maxPlayers,
  type Player,
  playerLevel,
  type Settings,
  type SoundEvent,
} from './model';
import { asPlayer, command, createUI, type SimulationUI } from './simulation';
import { validGame, validIntent } from './storage';

// Shared play is host-authoritative: guests send commands, the host runs the one simulation and streams the world.
export const worldRate = 15;

export interface SharedCharacter {
  slot: number;
  player: Player;
  reach: SimulationUI['reach'];
  idle: SimulationUI['idle'];
}
export interface WorldMessage {
  t: 'world';
  time: number;
  paused: boolean;
  buildings: Building[];
  players: SharedCharacter[];
  you: { notice: string; alarm: number; panel: SimulationUI['panel'] };
  sounds: SoundEvent[];
}
export type HostMessage = { t: 'hello'; v: 1; slot: number } | WorldMessage;
export type GuestMessage = { t: 'do'; action: Command };
export interface SharedSound {
  slot: number;
  event: SoundEvent;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => number(value, min, max) && Number.isInteger(value);
const buildingIds: readonly string[] = buildings.map((building) => building.id);

// Commands come from another device: rebuild each one from known fields only.
export function readCommand(value: unknown): Command | null {
  if (!record(value)) return null;
  if (value.type === 'walk') {
    if (
      !number(value.x, -100, 2000) ||
      (value.floor !== undefined && !integer(value.floor, 0, 9)) ||
      (value.depth !== undefined && !number(value.depth, -0.25, 1))
    )
      return null;
    return { type: 'walk', x: value.x, floor: value.floor, depth: value.depth };
  }
  if (value.type === 'floor') return integer(value.floor, 0, 9) ? { type: 'floor', floor: value.floor } : null;
  if (!validIntent(value)) return null;
  if (value.type === 'landing' || value.type === 'gate') return { type: value.type, target: value.target as 0 | 1 | undefined };
  if (value.type === 'stairs') return { type: 'stairs', direction: value.direction as -1 | 1 };
  if (value.type === 'invite') return { type: 'invite', id: value.id as number };
  if (value.type === 'enter') return { type: 'enter', building: value.building as Building['id'] };
  return { type: value.type as 'call' };
}

// A new companion arrives beside Colin, on his floor, so they can play together at once.
export function createCompanion(state: GameState, slot: number): Companion {
  const host = state.player;
  const lift = state.buildings.find((building) => building.id === host.place)?.lift;
  const floor = host.stairs?.to ?? (host.riding && lift ? Math.round(lift.position) : host.floor);
  const outside = host.place === 'outside';
  const player: Player = {
    place: host.place,
    floor: outside ? 0 : floor,
    x: outside ? Math.max(40, Math.min(layout.outsideWidth - 40, host.x + (slot % 2 ? 70 : -70) * Math.ceil(slot / 2))) : 480 + slot * 70,
    depth: outside ? 0.3 : 0.32 + slot * 0.06,
    riding: false,
    targetX: null,
    targetDepth: null,
    waypoints: [],
    intent: null,
    route: null,
    stairs: null,
  };
  const ui = createUI();
  ui.notice = `Välkommen in! Du är ${characterName(slot)}. Tryck på golvet för att gå.`;
  return { slot, player, ui };
}

export function companionCommand(state: GameState, companion: Companion, action: Command) {
  asPlayer(state, companion.player, () => command(state, companion.ui, action));
  const player = companion.player;
  // Companions stand beside Colin in the cabin instead of on the same spot.
  if (player.intent?.type === 'board' && player.targetX === layout.cabin) player.targetX -= 38 * companion.slot;
}

const rounded = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'number' ? Math.round(item * 1000) / 1000 : item)));

// The part of every world message that is the same for all guests.
export function sharedWorld(state: GameState, hostUI: SimulationUI) {
  const characters: SharedCharacter[] = [
    { slot: 0, player: state.player, reach: hostUI.reach, idle: hostUI.idle },
    ...(state.companions ?? []).map((companion) => ({ slot: companion.slot, player: companion.player, reach: companion.ui.reach, idle: companion.ui.idle })),
  ];
  return rounded({ time: state.time, buildings: state.buildings, players: characters });
}

// Guests read about themselves as "du"; the simulation's notices speak about Colin.
const personal = (notice: string) => notice.replace(/\bColin\b/g, 'Du');

export function guestMessage(world: ReturnType<typeof sharedWorld>, companion: Companion, paused: boolean, sounds: SharedSound[]): WorldMessage {
  return {
    t: 'world',
    ...world,
    paused,
    you: { notice: personal(companion.ui.notice), alarm: Math.round(companion.ui.alarmRemaining * 100) / 100, panel: companion.ui.panel },
    // Each player's alarm sample is their own; everything else in the building is heard by everyone there.
    sounds: sounds.filter(({ slot, event }) => slot === companion.slot || event.type !== 'alarm').map(({ event }) => event),
  };
}

function readReach(value: unknown): SimulationUI['reach'] {
  if (!record(value) || !buildingIds.includes(String(value.building)) || !integer(value.floor, 0, 9) || !number(value.remaining, -1, 2)) return null;
  if (typeof value.type !== 'string' || value.type.length > 12) return null;
  return { building: String(value.building), floor: value.floor, remaining: value.remaining, type: value.type };
}

function readIdle(value: unknown): SimulationUI['idle'] {
  const idle = createColinIdle();
  if (!record(value) || !number(value.elapsed, 0, 60) || !integer(value.next, 0, 3)) return idle;
  idle.elapsed = value.elapsed;
  idle.next = value.next;
  idle.action = ['sit', 'scratch', 'squat', 'jump'].includes(String(value.action)) ? (value.action as typeof idle.action) : null;
  return idle;
}

export interface GuestWorld {
  state: GameState;
  paused: boolean;
  you: WorldMessage['you'];
  reach: SimulationUI['reach'];
  sounds: SoundEvent[];
}

// Validates a world message from the host and builds this guest's view of it: its own character as state.player.
export function readWorld(value: unknown, slot: number, settings: Settings): GuestWorld | null {
  if (!record(value) || value.t !== 'world' || !number(value.time, 0, 1e12) || typeof value.paused !== 'boolean') return null;
  if (!Array.isArray(value.players) || value.players.length > maxPlayers || !Array.isArray(value.buildings) || value.buildings.length !== buildings.length)
    return null;
  const characters: Array<{ slot: number; state: GameState; entry: Record<string, unknown> }> = [];
  for (const entry of value.players) {
    if (!record(entry) || !integer(entry.slot, 0, maxPlayers - 1) || characters.some((character) => character.slot === entry.slot)) return null;
    const state = validGame({ version: 4, started: true, time: value.time, random: 0, player: entry.player, buildings: value.buildings, settings });
    if (!state) return null;
    characters.push({ slot: entry.slot, state, entry });
  }
  const own = characters.find((character) => character.slot === slot);
  const you = value.you;
  if (!own || !record(you) || typeof you.notice !== 'string' || you.notice.length > 300 || !number(you.alarm, 0, 3)) return null;
  if (you.panel !== null && you.panel !== 'floors' && you.panel !== 'sign') return null;
  if (!Array.isArray(value.sounds) || value.sounds.length > 40) return null;
  const sounds = value.sounds.filter(
    (sound): sound is SoundEvent =>
      record(sound) && ['click', 'door', 'arrival', 'alarm'].includes(String(sound.type)) && buildingIds.includes(String(sound.building)),
  );
  const state: GameState = { ...own.state, settings, slot, started: true };
  state.companions = characters
    .filter((character) => character !== own)
    .map((character) => {
      const ui = createUI();
      ui.reach = readReach(character.entry.reach);
      // Only Colin has the painted idle poses.
      if (character.slot === 0) ui.idle = readIdle(character.entry.idle);
      return { slot: character.slot, player: character.state.player, ui };
    });
  return { state, paused: value.paused, you: { notice: you.notice, alarm: you.alarm, panel: you.panel }, reach: readReach(own.entry.reach), sounds };
}

// Guests draw between the host's world messages: continuous values glide, everything else follows at once.
export function followWorld(display: GameState, target: GameState, dt: number) {
  const k = 1 - Math.exp(-Math.max(0, dt) * 14);
  const ease = (from: number, to: number, jump: number) => (Math.abs(to - from) > jump || Math.abs(to - from) < 0.001 ? to : from + (to - from) * k);
  const followPlayer = (from: Player | undefined, to: Player): Player => {
    if (!from || from.place !== to.place) return to;
    const stairs =
      to.stairs && from.stairs && from.stairs.to === to.stairs.to ? { ...to.stairs, elapsed: ease(from.stairs.elapsed, to.stairs.elapsed, 1) } : to.stairs;
    return { ...to, x: ease(from.x, to.x, 160), depth: ease(from.depth, to.depth, 0.4), stairs };
  };
  display.time = target.time;
  display.buildings = target.buildings.map((building, index) => {
    const old = display.buildings[index];
    const lift = building.lift;
    const before = old?.lift;
    return {
      ...building,
      lift: {
        ...lift,
        // A stationary lift is always exactly at its floor, so doors and boarding match the host.
        position: lift.destination === null || !before ? lift.position : ease(before.position, lift.position, 0.5),
        landing: { ...lift.landing, open: before ? ease(before.landing.open, lift.landing.open, 0.5) : lift.landing.open },
        gate: { ...lift.gate, open: before ? ease(before.gate.open, lift.gate.open, 0.5) : lift.gate.open },
      },
      people: building.people.map((person, id) => {
        const from = old?.people[id];
        return from && from.floor === person.floor ? { ...person, x: ease(from.x, person.x, 160), depth: ease(from.depth, person.depth, 0.4) } : person;
      }),
    };
  });
  display.player = followPlayer(display.player, target.player);
  display.companions = (target.companions ?? []).map((companion) => ({
    ...companion,
    player: followPlayer(display.companions?.find((old) => old.slot === companion.slot)?.player, companion.player),
  }));
}

// Floors where other characters are, for the building overview.
export function othersOnFloor(state: GameState, building: Building['id'], floor: number) {
  return (state.companions ?? [])
    .filter((companion) => companion.player.place === building && Math.round(playerLevel(state, companion.player)) === floor)
    .map((companion) => characterName(companion.slot));
}

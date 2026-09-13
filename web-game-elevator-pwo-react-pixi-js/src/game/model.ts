export const buildings = [
  { id: 'hotel', name: 'Hotellet', rooms: ['Lobbyn', 'Gästrummen', 'Frukostrummet'], manual: false, people: ['Liv', 'Bo'], tone: 660 },
  { id: 'mall', name: 'Varuhuset', rooms: ['Butikerna', 'Leksaker & böcker', 'Kaféet'], manual: false, people: ['Mia', 'Sam', 'Ali'], tone: 880 },
  { id: 'house', name: 'Gamla huset', rooms: ['Entrén', 'Lägenheterna', 'Vinden'], manual: true, people: ['Elsa', 'Nils', 'Kim'], tone: 440 },
] as const;

export type BuildingId = (typeof buildings)[number]['id'];
export type Place = BuildingId | 'outside';
export const layout = { width: 1055, corridor: 825, outsideWidth: 780, threshold: 825, cabin: 1001, stairs: 105, exit: 1015 };
export const worldWidth = (place: Place) => (place === 'outside' ? layout.outsideWidth : layout.width);
export const timing = { walk: 240, passengerWalk: 115, stairs: 3, travel: 5, door: 1, dwell: 5 };
export const definition = (id: BuildingId) => buildings.find((building) => building.id === id) ?? buildings[0];

export type Intent =
  | { type: 'call' | 'board' | 'leave' | 'threshold' | 'panel' | 'light' | 'roomDoor' | 'exit' | 'sign' | 'alarm' | 'landing' | 'gate' }
  | { type: 'stairs'; direction: -1 | 1 }
  | { type: 'invite'; id: number }
  | { type: 'enter'; building: BuildingId };
export type Command = Intent | { type: 'walk'; x: number; floor?: number; depth?: number } | { type: 'floor'; floor: number };
export interface FloorPoint {
  x: number;
  depth: number;
}

export interface Door {
  open: number;
  target: 0 | 1;
}
export interface Elevator {
  position: number;
  destination: number | null;
  queue: number[];
  landing: Door;
  gate: Door;
  dwell: number;
  blocked: boolean;
}
export interface Passenger {
  id: number;
  floor: number;
  wanted: number;
  x: number;
  depth: number;
  phase: 'idle' | 'waiting' | 'boarding' | 'riding' | 'leaving' | 'returning' | 'away';
  timer: number;
}
export interface Building {
  id: BuildingId;
  lift: Elevator;
  lights: boolean[];
  roomDoors: boolean[];
  people: Passenger[];
}
export interface Player {
  place: Place;
  floor: number;
  x: number;
  depth: number;
  riding: boolean;
  targetX: number | null;
  targetDepth: number | null;
  waypoints: FloorPoint[];
  intent: Intent | null;
  route: { floor: number; x: number; depth: number } | null;
  stairs: { from: number; to: number; elapsed: number } | null;
}
export interface Settings {
  liftVolume: number;
  alarmVolume: number;
  muted: boolean;
  smoothCamera: boolean;
  cameraZoom: number;
}
export interface GameState {
  version: 3;
  started: boolean;
  time: number;
  random: number;
  player: Player;
  buildings: Building[];
  settings: Settings;
}
export type SoundEvent = { type: 'click' | 'door' | 'arrival' | 'alarm'; building: BuildingId };

export function random(state: GameState) {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 4294967296;
}

export function createGame(seed = Date.now() >>> 0): GameState {
  return {
    version: 3,
    started: false,
    time: 0,
    random: seed,
    player: {
      place: 'hotel',
      floor: 0,
      x: 670,
      depth: 0.4,
      riding: false,
      targetX: null,
      targetDepth: null,
      waypoints: [],
      intent: null,
      route: null,
      stairs: null,
    },
    buildings: buildings.map((building) => ({
      id: building.id,
      lift: { position: 0, destination: null, queue: [], landing: { open: 1, target: 1 }, gate: { open: 1, target: 1 }, dwell: 5, blocked: false },
      lights: [true, true, true],
      roomDoors: [false, false, false],
      people: building.people.map((_name, id) => ({
        id,
        floor: id === 2 ? 1 : 0,
        wanted: id === 0 ? 2 : id === 1 ? 1 : 0,
        x: 420 + id * 90,
        depth: 0.24 + id * 0.12,
        phase: building.id === 'house' && id > 0 ? 'away' : 'idle',
        timer: 25 + id * 20,
      })),
    })),
    settings: { liftVolume: 0.35, alarmVolume: 0.2, muted: false, smoothCamera: true, cameraZoom: 1 },
  };
}

export function currentBuilding(state: GameState): Building | undefined {
  return state.buildings.find((building) => building.id === state.player.place);
}

export function playerLevel(state: GameState) {
  const player = state.player;
  if (player.stairs) return player.stairs.from + (player.stairs.to - player.stairs.from) * (player.stairs.elapsed / timing.stairs);
  return player.riding ? (currentBuilding(state)?.lift.position ?? player.floor) : player.floor;
}

export function isOpen(lift: Elevator) {
  return lift.destination === null && lift.landing.open > 0.98 && lift.gate.open > 0.98;
}

export function liftPhase(lift: Elevator) {
  if (lift.destination !== null) return 'Åker';
  if (lift.blocked) return 'Dörröppningen är upptagen';
  if (lift.landing.open < lift.landing.target || lift.gate.open < lift.gate.target) return 'Öppnar';
  if (lift.landing.open > lift.landing.target || lift.gate.open > lift.gate.target) return 'Stänger';
  if (lift.queue.length) return lift.landing.open === 0 && lift.gate.open === 0 ? 'Redo att åka' : 'Väntar';
  return 'Här kan du ta god tid på dig';
}

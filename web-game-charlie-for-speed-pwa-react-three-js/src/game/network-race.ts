import { applyUpgrades, arcadeSpec, carById, cars } from './cars';
import { GRID, HUMAN_SLOTS, validUpgrades, type WireEntrant } from './multi-career';
import { type Connection, NetworkPlay } from './network-play';
import { type CarState, type Controls, shift } from './physics';
import { createRace, type Race, type RaceSettings, resetRacer, STEP, stepRace } from './race';
import { trackDefs } from './tracks';

export const MAX_PLAYERS = GRID;

export interface RaceConfig {
  settings: RaceSettings;
  // One car per player; player 1 is the host.
  cars: string[];
  seed: number;
  // Wi-Fi career races send the whole grid: tuned cars, AI names and which player drives each place.
  entrants?: WireEntrant[];
  // Quick races: the lobby names, by player.
  names?: string[];
}

function validNames(config: RaceConfig) {
  const { names } = config;
  return (
    names === undefined || (Array.isArray(names) && names.length <= config.cars.length && names.every((name) => typeof name === 'string' && name.length <= 16))
  );
}

function validEntrants(config: RaceConfig) {
  const { entrants } = config;
  if (entrants === undefined) return true;
  return (
    Array.isArray(entrants) &&
    entrants.length === GRID &&
    entrants.every(
      (entrant) =>
        entrant &&
        typeof entrant.driverName === 'string' &&
        entrant.driverName.length > 0 &&
        entrant.driverName.length <= 16 &&
        cars.some((car) => car.id === entrant.carId) &&
        validUpgrades(entrant.upgrades) &&
        Number.isFinite(entrant.skill) &&
        entrant.skill >= 0.5 &&
        entrant.skill <= 1.2 &&
        (entrant.player === undefined || (Number.isInteger(entrant.player) && entrant.player >= 0 && entrant.player < config.cars.length)),
    ) &&
    config.cars.every(
      (carId, player) =>
        entrants.filter((entrant) => entrant.player === player).length === 1 && entrants.find((entrant) => entrant.player === player)?.carId === carId,
    ) &&
    new Set(entrants.map((entrant) => entrant.driverName)).size === GRID
  );
}

// The grid place each player drives.
export function humanSlot(config: RaceConfig, player: number) {
  return config.entrants ? config.entrants.findIndex((entrant) => entrant.player === player) : HUMAN_SLOTS[player];
}
export function validRaceConfig(value: unknown): value is RaceConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as RaceConfig;
  const s = c.settings;
  return (
    !!s &&
    trackDefs.some((t) => t.id === s.trackId) &&
    cars.some((car) => car.id === s.carId) &&
    Array.isArray(c.cars) &&
    c.cars.length >= 2 &&
    c.cars.length <= MAX_PLAYERS &&
    c.cars.every((id) => cars.some((car) => car.id === id)) &&
    c.cars[0] === s.carId &&
    validEntrants(c) &&
    validNames(c) &&
    [1, 2, 3, 5].includes(s.laps) &&
    ['easy', 'normal', 'hard'].includes(s.difficulty) &&
    ['auto', 'manual'].includes(s.transmission) &&
    Number.isInteger(c.seed) &&
    c.seed >= 0 &&
    c.seed < 2147483647
  );
}
export function createNetworkRace(config: RaceConfig, slot = 0) {
  if (config.entrants) {
    const field = config.entrants.map((entrant) => ({
      driverName: entrant.driverName,
      spec: applyUpgrades(carById(entrant.carId), entrant.upgrades),
      skill: entrant.skill,
      isPlayer: entrant.player !== undefined,
    }));
    const race = createRace({ ...config.settings }, config.seed, field);
    race.player = race.racers[humanSlot(config, slot)];
    return race;
  }
  const race = createRace({ ...config.settings }, config.seed);
  const taken = new Set(race.racers.filter((_, slot) => !HUMAN_SLOTS.slice(0, config.cars.length).includes(slot)).map((racer) => racer.driverName));
  config.cars.forEach((carId, player) => {
    const racer = race.racers[HUMAN_SLOTS[player]];
    racer.isPlayer = true;
    // Results and tags tell drivers apart by name, so a name already on the grid gets the player number.
    const wanted = config.names?.[player]?.trim() || `Spelare ${player + 1}`;
    racer.driverName = taken.has(wanted) ? `${wanted.slice(0, 13)} ${player + 1}` : wanted;
    taken.add(racer.driverName);
    racer.spec = cars.find((car) => car.id === carId) ?? cars[0];
  });
  // Quick online races share one performance range across every career class, including the AI field.
  for (const racer of race.racers) racer.spec = arcadeSpec(racer.spec);
  race.player = race.racers[HUMAN_SLOTS[slot]];
  return race;
}
interface Command {
  controls: Controls;
  reset: boolean;
  shift: number;
}
const neutral = (): Command => ({ controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, reset: false, shift: 0 });
function validCommand(value: unknown): value is Command {
  if (!value || typeof value !== 'object') return false;
  const c = value as Command;
  const input = c.controls;
  return (
    !!input &&
    [input.steer, input.throttle, input.brake].every((n) => Number.isFinite(n)) &&
    Math.abs(input.steer) <= 1 &&
    input.throttle >= 0 &&
    input.throttle <= 1 &&
    input.brake >= 0 &&
    input.brake <= 1 &&
    typeof input.handbrake === 'boolean' &&
    typeof c.reset === 'boolean' &&
    [-1, 0, 1].includes(c.shift)
  );
}
const merge = (a: Command, b: Command): Command => ({ controls: b.controls, reset: a.reset || b.reset, shift: b.shift || a.shift });
interface RacerFrame {
  state: CarState;
  lap: number;
  lapStart: number;
  lastLap: number;
  bestLap: number;
  finishTime: number;
  position: number;
}
export interface RaceFrame {
  phase: Race['phase'];
  countdown: number;
  time: number;
  finishedAt: number;
  racers: RacerFrame[];
}
const finite = (n: unknown, min = -1000000, max = 1000000): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
export function validRaceFrame(value: unknown, race: Race): value is RaceFrame {
  if (!value || typeof value !== 'object') return false;
  const f = value as RaceFrame;
  return (
    ['countdown', 'racing', 'finished'].includes(f.phase) &&
    finite(f.countdown, -STEP, 3.4) &&
    finite(f.time, 0, 200000) &&
    finite(f.finishedAt, 0, 200000) &&
    Array.isArray(f.racers) &&
    f.racers.length === 8 &&
    f.racers.every((r) => {
      const s = r?.state;
      return (
        s &&
        Object.keys(race.player.state).every((key) => {
          const k = key as keyof CarState;
          return ['surface', 'scraping', 'braking'].includes(k) || finite(s[k]);
        }) &&
        ['road', 'curb', 'grass'].includes(s.surface) &&
        typeof s.scraping === 'boolean' &&
        typeof s.braking === 'boolean' &&
        Number.isInteger(s.gear) &&
        s.gear >= 0 &&
        s.gear <= 6 &&
        Number.isInteger(s.index) &&
        s.index >= 0 &&
        s.index < race.track.path.samples.length &&
        finite(s.s, 0, race.track.path.length + 1) &&
        Number.isInteger(r.lap) &&
        finite(r.lap, -100, 20) &&
        Number.isInteger(r.position) &&
        finite(r.position, 1, 8) &&
        [r.lapStart, r.lastLap, r.bestLap, r.finishTime].every((n) => finite(n, 0, 200000))
      );
    })
  );
}
export class NetworkRace {
  readonly race: Race;
  readonly wire: NetworkPlay<RaceFrame, Command>;
  onChange?: () => void;
  private accumulator = 0;
  private pending = neutral();
  constructor(
    public readonly config: RaceConfig,
    connections: Connection[],
    public readonly localSlot: number,
    options: { keepLinks?: boolean } = {},
  ) {
    this.race = createNetworkRace(config, localSlot);
    this.wire = new NetworkPlay({
      connections,
      keepLinks: options.keepLinks,
      waitForViews: connections.length > 0,
      localSlot,
      snapshot: () => this.snapshot(),
      apply: (frame) => this.apply(frame),
      validState: (v): v is RaceFrame => validRaceFrame(v, this.race),
      validCommand,
      neutral,
      merge,
      afterConsume: (c) => ({ ...c, reset: false, shift: 0 }),
      clear: () => {
        this.pending = neutral();
        this.accumulator = 0;
      },
      changed: () => this.onChange?.(),
    });
    if (localSlot === 0) for (const { slot, link } of connections) link.send({ kind: 'start', version: 1, config, state: config, slot });
  }
  private snapshot(): RaceFrame {
    const { phase, countdown, time, finishedAt, racers } = this.race;
    return {
      phase,
      countdown,
      time,
      finishedAt,
      racers: racers.map(({ state, lap, lapStart, lastLap, bestLap, finishTime, position }) => ({
        state,
        lap,
        lapStart,
        lastLap,
        bestLap,
        finishTime,
        position,
      })),
    };
  }
  private apply(frame: RaceFrame) {
    Object.assign(this.race, { phase: frame.phase, countdown: frame.countdown, time: frame.time, finishedAt: frame.finishedAt });
    frame.racers.forEach((r, i) => {
      const racer = this.race.racers[i];
      for (const key of Object.keys(racer.state)) {
        const k = key as keyof CarState;
        Object.assign(racer.state, { [k]: r.state[k] });
      }
      for (const key of ['lap', 'lapStart', 'lastLap', 'bestLap', 'finishTime', 'position'] as const) racer[key] = r[key];
    });
  }
  action(action: 'reset' | 'shiftUp' | 'shiftDown') {
    if (action === 'reset') this.pending.reset = true;
    else this.pending.shift = action === 'shiftUp' ? 1 : -1;
  }
  advance(elapsed: number, controls: Controls, available: boolean) {
    const command = { ...this.pending, controls };
    this.pending = neutral();
    this.wire.tick(elapsed, command, available);
    if (this.localSlot !== 0 || this.wire.paused || this.race.phase === 'finished') return;
    this.accumulator += Math.min(0.1, elapsed);
    let first = true;
    while (this.accumulator >= STEP) {
      const local = first ? command : { ...command, reset: false, shift: 0 };
      first = false;
      const inputs = this.config.cars.map((_, player) => (player === 0 ? local : this.wire.consume(player)));
      const controls = new Map<number, Controls>();
      inputs.forEach((input, player) => {
        const racer = this.race.racers[humanSlot(this.config, player)];
        if (input.reset && this.race.phase === 'racing') resetRacer(this.race, racer);
        if (input.shift && this.config.settings.transmission === 'manual') shift(racer.state, input.shift > 0 ? 1 : -1);
        controls.set(racer.id, input.controls);
      });
      stepRace(this.race, local.controls, controls);
      this.accumulator -= STEP;
      const firstFinish = this.race.racers.filter((r) => r.isPlayer && r.finishTime > 0).map((r) => r.finishTime);
      if (firstFinish.length && this.race.time - Math.min(...firstFinish) > 30) {
        this.race.phase = 'finished';
        this.race.finishedAt = this.race.time;
      }
    }
  }
  restart() {
    if (this.localSlot !== 0 || !this.wire.canResume) return;
    this.config.seed = (this.config.seed + 1) % 2147483647;
    Object.assign(this.race, createNetworkRace(this.config));
    this.wire.nextRound();
  }
  dispose() {
    this.wire.close();
  }
}

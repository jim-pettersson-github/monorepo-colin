import { type Driver, driveAi } from './ai';
import { type CarSpec, carById, cars } from './cars';
import { type CarState, type Controls, forwardSpeed, placeCar, resolveContacts, stepCar, type Transmission } from './physics';
import { type Track, trackById } from './tracks';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type RaceSettings = {
  trackId: string;
  carId: string;
  laps: number;
  difficulty: Difficulty;
  transmission: Transmission;
};

export type Racer = {
  id: number;
  driverName: string;
  spec: CarSpec;
  isPlayer: boolean;
  state: CarState;
  driver: Driver;
  lap: number;
  lapStart: number;
  lastLap: number;
  bestLap: number;
  finishTime: number;
  position: number;
  slowTimer: number;
};

export type RacePhase = 'countdown' | 'racing' | 'finished';

export type Race = {
  settings: RaceSettings;
  track: Track;
  racers: Racer[];
  player: Racer;
  phase: RacePhase;
  countdown: number;
  time: number;
  wrongWay: number;
  banner: { text: string; until: number } | undefined;
  finishedAt: number;
};

export type ResultRow = {
  position: number;
  driverName: string;
  car: CarSpec;
  isPlayer: boolean;
  time: number;
  estimated: boolean;
  bestLap: number;
};

export const STEP = 1 / 120;
const COUNTDOWN = 3.4;
const OPPONENTS = 7;
const PLAYER_GRID_SLOT = 5;
const names = ['Sanna', 'Klaus', 'Lotta', 'Henrik', 'Greta', 'Jürgen', 'Maja', 'Otto', 'Elin'];
const skills: Record<Difficulty, number> = { easy: 0.84, normal: 0.93, hard: 1.0 };

export type Entrant = { driverName: string; spec: CarSpec; skill: number; isPlayer?: boolean };

// Quick races fill the grid with rivals from the player's class, repeating models when the class is small.
function quickField(settings: RaceSettings, next: () => number): Entrant[] {
  const playerSpec = carById(settings.carId);
  const sameClass = cars.filter((car) => car.id !== playerSpec.id && car.carClass === playerSpec.carClass).sort(() => next() - 0.5);
  const driverNames = [...names].sort(() => next() - 0.5);
  const field: Entrant[] = [];
  for (let slot = 0; slot <= OPPONENTS; slot++) {
    if (slot === PLAYER_GRID_SLOT) field.push({ driverName: 'Du', spec: playerSpec, skill: 1, isPlayer: true });
    else {
      const index = field.filter((entrant) => !entrant.isPlayer).length;
      field.push({
        driverName: driverNames[index % driverNames.length],
        spec: sameClass[index % sameClass.length],
        skill: skills[settings.difficulty] + (next() - 0.5) * 0.05,
      });
    }
  }
  return field;
}

export function createRace(settings: RaceSettings, seed = Date.now(), field?: Entrant[]): Race {
  const track = trackById(settings.trackId);
  let random = seed % 2147483647 || 1;
  const next = () => {
    random = (random * 16807) % 2147483647;
    return random / 2147483647;
  };

  const entrants = field ?? quickField(settings, next);
  const racers: Racer[] = entrants.map((entrant, slot) => {
    const row = Math.floor(slot / 2);
    const side = slot % 2 === 0 ? -1 : 1;
    return {
      id: slot,
      driverName: entrant.driverName,
      spec: entrant.spec,
      isPlayer: !!entrant.isPlayer,
      state: placeCar(track, -12 - row * 15 - (slot % 2) * 7, side * 3.4),
      driver: { lane: side * (0.8 + next() * 1.6), avoid: 0, skill: entrant.skill, stuck: 0 },
      lap: -1,
      lapStart: 0,
      lastLap: 0,
      bestLap: 0,
      finishTime: 0,
      position: slot + 1,
      slowTimer: 0,
    };
  });

  const player = racers.find((racer) => racer.isPlayer) ?? racers[0];
  return { settings, track, racers, player, phase: 'countdown', countdown: COUNTDOWN, time: 0, wrongWay: 0, banner: undefined, finishedAt: 0 };
}

export function raceDistance(race: Race, racer: Racer) {
  return racer.lap * race.track.path.length + racer.state.s;
}

export function resetRacer(race: Race, racer: Racer, lateral = 0) {
  const { state } = racer;
  const placed = placeCar(race.track, state.s, lateral);
  Object.assign(state, { ...placed, gear: 1, wheelSpin: state.wheelSpin });
  racer.slowTimer = 0;
  racer.driver.stuck = 0;
}

function showBanner(race: Race, text: string, seconds = 2) {
  race.banner = { text, until: race.time + seconds };
}

function completeLap(race: Race, racer: Racer) {
  const lapTime = race.time - racer.lapStart;
  racer.lap++;
  if (racer.lap >= 1) {
    racer.lastLap = lapTime;
    if (!racer.bestLap || lapTime < racer.bestLap) racer.bestLap = lapTime;
    racer.lapStart = race.time;
  }
  if (racer.lap === 0) racer.lapStart = 0;

  if (racer.lap >= race.settings.laps && !racer.finishTime) {
    racer.finishTime = race.time;
    if (racer.isPlayer && race.racers.filter((r) => r.isPlayer).every((r) => r.finishTime > 0)) {
      race.phase = 'finished';
      race.finishedAt = race.time;
      showBanner(race, racer.position === 1 ? 'SEGER!' : 'MÅLGÅNG', 4);
    }
    return;
  }

  if (!racer.isPlayer || racer.lap < 1) return;
  if (racer.lap === race.settings.laps - 1) showBanner(race, 'SISTA VARVET!', 2.5);
  else showBanner(race, `VARV ${racer.lap + 1}`);
}

function trackLaps(race: Race, racer: Racer, previousS: number) {
  const { length } = race.track.path;
  const s = racer.state.s;
  if (previousS > length * 0.75 && s < length * 0.25) completeLap(race, racer);
  else if (previousS < length * 0.25 && s > length * 0.75) racer.lap--;
}

export function stepRace(race: Race, playerControls: Controls, humanControls?: ReadonlyMap<number, Controls>) {
  const { track, settings } = race;
  const frozen = race.phase === 'countdown';

  if (frozen) {
    race.countdown -= STEP;
    if (race.countdown <= 0) {
      race.phase = 'racing';
      showBanner(race, 'KÖR!', 1);
    }
  } else race.time += STEP;

  const playerDistance = raceDistance(race, race.player);
  const states = race.racers.map((racer) => racer.state);

  for (const racer of race.racers) {
    const previousS = racer.state.s;
    const autopilot = !racer.isPlayer || racer.finishTime > 0;
    let controls = humanControls?.get(racer.id) ?? playerControls;

    if (autopilot) {
      const gap = racer.isPlayer ? 0 : raceDistance(race, racer) - playerDistance;
      const pace = racer.finishTime ? 0.8 : Math.max(0.9, Math.min(1.05, 1 - gap * 0.00035));
      controls = driveAi(racer.state, racer.spec, racer.driver, track, states, pace, STEP);
      // Cars stand still on the grid; that is not being stuck, so the AI must not start by backing out of a wall.
      if (frozen) racer.driver.stuck = 0;
    }

    stepCar(racer.state, racer.spec, controls, track, STEP, racer.isPlayer ? settings.transmission : 'auto', frozen);
    if (!frozen) trackLaps(race, racer, previousS);

    if (!racer.isPlayer && !frozen) {
      racer.slowTimer = forwardSpeed(racer.state) < 3 ? racer.slowTimer + STEP : 0;
      if (racer.slowTimer > 6) resetRacer(race, racer, racer.driver.lane);
    }
  }

  if (!frozen) resolveContacts(states);
  updatePositions(race);
  updateWrongWay(race);
}

function updatePositions(race: Race) {
  const order = [...race.racers].sort((a, b) => {
    if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
    if (a.finishTime) return -1;
    if (b.finishTime) return 1;
    return raceDistance(race, b) - raceDistance(race, a);
  });
  order.forEach((racer, index) => {
    racer.position = index + 1;
  });
}

function updateWrongWay(race: Race) {
  const { state } = race.player;
  const sample = race.track.path.samples[state.index];
  const along = state.vx * sample.tx + state.vz * sample.tz;
  const heading = Math.sin(state.yaw) * sample.tx + Math.cos(state.yaw) * sample.tz;
  const backwards = race.phase === 'racing' && (along < -4 || (heading < -0.5 && Math.hypot(state.vx, state.vz) < 4));
  race.wrongWay = backwards ? race.wrongWay + STEP : 0;
}

export function raceResults(race: Race): ResultRow[] {
  const { length } = race.track.path;
  const total = race.settings.laps * length;
  return [...race.racers]
    .map((racer) => {
      if (racer.finishTime) return { racer, time: racer.finishTime, estimated: false };
      const covered = Math.max(1, raceDistance(race, racer));
      const average = Math.max(25, covered / Math.max(race.time, 1));
      return { racer, time: race.time + (total - covered) / average, estimated: true };
    })
    .sort((a, b) => a.time - b.time)
    .map(({ racer, time, estimated }, index) => ({
      position: index + 1,
      driverName: racer.driverName,
      car: racer.spec,
      isPlayer: racer.isPlayer,
      time,
      estimated,
      bestLap: racer.bestLap,
    }));
}

export function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '-:--.--';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

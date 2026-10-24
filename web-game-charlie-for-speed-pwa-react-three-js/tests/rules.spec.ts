import { expect, test } from '@playwright/test';
import {
  abandonCup,
  buyCar,
  buyUpgrade,
  cupById,
  cupField,
  currentTrack,
  entryProblem,
  newCareer,
  recordRace,
  START_MONEY,
  startCup,
} from '../src/game/career';
import { applyUpgrades, carById, cars } from '../src/game/cars';
import { type CarState, forwardSpeed, placeCar, stepCar } from '../src/game/physics';
import { createRace, formatTime, raceDistance, raceResults, STEP, stepRace } from '../src/game/race';
import { trackById, trackDefs } from '../src/game/tracks';

const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };

for (const def of trackDefs) {
  test(`AI field completes a race on ${def.name}`, () => {
    const race = createRace({ trackId: def.id, carId: 'sting', laps: 2, difficulty: 'normal', transmission: 'auto' }, 7);
    // The player rides on autopilot so the whole field is AI-driven.
    race.player.isPlayer = false;
    let wallHits = 0;
    for (let i = 0; i < 120 * 300 && race.racers.some((racer) => !racer.finishTime); i++) {
      stepRace(race, idle);
      for (const racer of race.racers) if (racer.state.impact > 6) wallHits++;
    }
    const laps = race.racers.map((racer) => racer.bestLap);
    console.log(def.name, `${race.track.path.length.toFixed(0)} m`, laps.map(formatTime).join(' '), 'hard hits', wallHits);
    for (const racer of race.racers) expect(racer.finishTime, racer.spec.id).toBeGreaterThan(0);
    expect(Math.min(...laps)).toBeGreaterThan(35);
    expect(Math.max(...laps)).toBeLessThan(110);
  });
}

test('cars launch and reach top speed close to their specification', () => {
  const track = trackById('rheinland');
  for (const spec of cars) {
    const car: CarState = placeCar(track, 0, 0);
    let time = 0;
    let to100 = 0;
    // Drive along a virtual endless straight by snapping the car back each step.
    for (; time < 70; time += STEP) {
      stepCar(car, spec, { throttle: 1, brake: 0, steer: 0, handbrake: false }, track, STEP);
      Object.assign(car, { x: track.path.samples[0].x, z: track.path.samples[0].z, index: 0 });
      if (!to100 && forwardSpeed(car) * 3.6 >= 100) to100 = time;
    }
    const top = forwardSpeed(car) * 3.6;
    console.log(spec.id, 'to100', to100.toFixed(2), 'spec', spec.zeroTo100, 'top', top.toFixed(0), 'spec', spec.topKmh);
    expect(Math.abs(to100 - spec.zeroTo100)).toBeLessThan(0.8);
    expect(top).toBeGreaterThan(spec.topKmh * 0.95);
    expect(top).toBeLessThan(spec.topKmh * 1.04);
  }
});

test('race distance and positions start from the grid behind the line', () => {
  const race = createRace({ trackId: 'vaxjo', carId: 'skarv', laps: 3, difficulty: 'easy', transmission: 'manual' }, 3);
  expect(race.phase).toBe('countdown');
  for (const racer of race.racers) expect(raceDistance(race, racer)).toBeLessThan(0);
  expect(race.player.spec.id).toBe('skarv');
  for (const racer of race.racers) expect(racer.spec.carClass).toBe('A');
});

test('career: buy a car, upgrade it and respect cup entry rules', () => {
  let career = newCareer(11);
  expect(career.money).toBe(START_MONEY);
  expect(entryProblem(career, cupById('klubb'))).toMatch(/Köp en bil/);

  career = buyCar(career, 'skarv');
  expect(career.garage).toHaveLength(0);
  career = buyCar(career, 'arrow');
  expect(career.money).toBe(START_MONEY - carById('arrow').price);
  expect(entryProblem(career, cupById('klubb'))).toBeUndefined();
  expect(entryProblem(career, cupById('mastare'))).toMatch(/Supercupen/);

  career = buyUpgrade(career, 'arrow', 'engine');
  const tuned = applyUpgrades(carById('arrow'), career.garage[0].upgrades);
  expect(career.garage[0].upgrades.engine).toBe(1);
  expect(tuned.topKmh).toBeGreaterThan(carById('arrow').topKmh);
  expect(tuned.zeroTo100).toBeLessThan(carById('arrow').zeroTo100);
  const broke = buyUpgrade(buyUpgrade(career, 'arrow', 'engine'), 'arrow', 'engine');
  expect(broke.money).toBeGreaterThanOrEqual(0);

  career = startCup(career, 'klubb');
  expect(cupField(career)).toHaveLength(8);
  expect(cupField(career).filter((entrant) => entrant.isPlayer)).toHaveLength(1);
  expect(abandonCup(career).run).toBeUndefined();
});

test('career: a full cup pays prizes, crowns a winner and rivals spend their winnings', () => {
  let career = startCup(buyCar(newCareer(5), 'nxr'), 'klubb');
  const before = career.money;
  const cup = cupById('klubb');
  for (let round = 0; round < cup.tracks.length; round++) {
    const trackId = currentTrack(career);
    expect(trackId).toBe(cup.tracks[round]);
    const race = createRace(
      { trackId: trackId ?? '', carId: career.activeCarId, laps: 1, difficulty: 'normal', transmission: 'auto' },
      round + 1,
      cupField(career),
    );
    race.player.isPlayer = false;
    for (let i = 0; i < 120 * 200 && race.racers.some((racer) => !racer.finishTime); i++) stepRace(race, { throttle: 0, brake: 0, steer: 0, handbrake: false });
    race.player.isPlayer = true;
    career = recordRace(career, raceResults(race));
  }
  expect(career.run).toBeUndefined();
  expect(career.lastCup?.standings).toHaveLength(8);
  expect(career.money).toBeGreaterThan(before);
  const rivalMoney = career.rivals.reduce((sum, rival) => sum + rival.money, 0);
  const rivalUpgrades = career.rivals.reduce((sum, rival) => sum + rival.upgrades.C.engine + rival.upgrades.C.tyres + rival.upgrades.C.brakes, 0);
  console.log('after Klubbcupen: player', career.money, 'winner', career.lastCup?.winner, 'rival upgrades', rivalUpgrades, 'rival cash', rivalMoney);
  console.log(career.news.join(' | '));
  expect(rivalUpgrades).toBeGreaterThan(0);
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

import { createNetworkRace, NetworkRace, validRaceConfig, validRaceFrame } from '../src/game/network-race';

test('network racing advances the countdown, separates human controls and validates compact frames', () => {
  const config = {
    settings: { trackId: 'vaxjo', carId: 'sting', laps: 1, difficulty: 'easy' as const, transmission: 'auto' as const },
    cars: ['sting', 'nxr'],
    seed: 7,
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, seed: NaN })).toBe(false);
  const race = createNetworkRace(config);
  expect(race.racers.filter((r) => r.isPlayer)).toHaveLength(2);
  expect(validRaceConfig({ ...config, cars: ['sting'] })).toBe(false);
  expect(validRaceConfig({ ...config, cars: ['nxr', 'sting'] })).toBe(false);
  expect(validRaceConfig({ ...config, cars: Array(9).fill('sting') })).toBe(false);
  const six = { ...config, cars: ['sting', 'nxr', 'arrow', 'xk', 'dbs', 'sting'] };
  expect(validRaceConfig(six)).toBe(true);
  const crowd = createNetworkRace(six, 4);
  const humans = crowd.racers.filter((r) => r.isPlayer);
  expect(humans.map((r) => r.driverName).sort()).toEqual(['Spelare 1', 'Spelare 2', 'Spelare 3', 'Spelare 4', 'Spelare 5', 'Spelare 6']);
  expect(crowd.player.driverName).toBe('Spelare 5');
  expect(crowd.player.spec.id).toBe('dbs');
  expect(crowd.racers.filter((r) => !r.isPlayer)).toHaveLength(2);
  const session = new NetworkRace(config, [], 0);
  for (let i = 0; i < 100; i++) session.advance(0.05, { throttle: 0, brake: 0, steer: 0, handbrake: false }, true);
  expect(session.race.phase).toBe('racing');
  expect(session.race.player.state.vx).toBe(0);
  for (let i = 0; i < 100; i++) session.advance(0.05, { throttle: 1, brake: 0, steer: 0, handbrake: false }, true);
  expect(Math.hypot(session.race.player.state.vx, session.race.player.state.vz)).toBeGreaterThan(5);
  const frame = {
    phase: race.phase,
    countdown: race.countdown,
    time: race.time,
    finishedAt: race.finishedAt,
    racers: race.racers.map(({ state, lap, lapStart, lastLap, bestLap, finishTime, position }) => ({
      state,
      lap,
      lapStart,
      lastLap,
      bestLap,
      finishTime,
      position,
    })),
  };
  expect(validRaceFrame(frame, race)).toBe(true);
  frame.racers[0].state.index = 999999;
  expect(validRaceFrame(frame, race)).toBe(false);
  session.dispose();
});

import { axles, buildBodyShape, WHEEL_RADIUS } from '../src/render/car-body';
import { designs } from '../src/render/car-designs';

test('all redesigned bodies have outward bumper caps, finite geometry and clearance above their tyres', () => {
  for (const car of cars) {
    const design = designs[car.id];
    const shape = buildBodyShape(design, car.length, car.width);
    for (const geometry of [shape.body, shape.glass]) {
      const positions = geometry.getAttribute('position'),
        normals = geometry.getAttribute('normal');
      expect([...positions.array].every(Number.isFinite), car.id).toBe(true);
      expect([...normals.array].every(Number.isFinite), car.id).toBe(true);
      expect(
        geometry.index?.array.every((i) => i < positions.count),
        car.id,
      ).toBe(true);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox?.min.y, car.id).toBeGreaterThanOrEqual(0.2);
    }
    const positions = shape.body.getAttribute('position'),
      normals = shape.body.getAttribute('normal');
    let frontCap = 0,
      rearCap = 0;
    for (let i = 0; i < positions.count; i++) {
      if (positions.getZ(i) > car.length * 0.499 && Math.abs(positions.getX(i)) < 0.00001)
        expect(positions.getY(i), `${car.id}: cap must follow the sunken bonnet`).toBeLessThanOrEqual(shape.section(positions.getZ(i)).crown + 0.013);
      if (positions.getZ(i) > car.length * 0.499 && normals.getZ(i) > 0.98) frontCap++;
      if (positions.getZ(i) < -car.length * 0.499 && normals.getZ(i) < -0.98) rearCap++;
    }
    expect(frontCap, car.id).toBeGreaterThan(3);
    expect(rearCap, car.id).toBeGreaterThan(3);
    const radius = WHEEL_RADIUS * (design.wheelScale ?? 1),
      wheelbase = axles(design, car.length);
    for (const z of [wheelbase.front, wheelbase.rear]) expect(shape.section(z).bottom, car.id).toBeGreaterThan(radius * 2 + 0.03);
    shape.body.dispose();
    shape.glass.dispose();
  }
});

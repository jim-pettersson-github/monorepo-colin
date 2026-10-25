import { expect, test } from '@playwright/test';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
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
import { applyUpgrades, arcadeSpec, carById, cars } from '../src/game/cars';
import { brakeDecel, type CarState, cornerGrip, forwardSpeed, placeCar, stepCar } from '../src/game/physics';
import { createRace, formatTime, raceDistance, raceResults, STEP, stepRace } from '../src/game/race';
import { trackById, trackDefs } from '../src/game/tracks';
import { batchStatic } from '../src/render/batch';

const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };

test('static batches preserve transformed roots, shadow flags and dynamic parts', () => {
  const root = new Group();
  root.position.set(12, 3, -8);
  root.rotation.y = 0.7;
  const material = new MeshBasicMaterial();
  const source = new BoxGeometry(2, 3, 4);
  const first = new Mesh(source, material);
  first.position.x = 4;
  first.castShadow = true;
  first.receiveShadow = true;
  root.add(first);
  const dynamic = new Group();
  dynamic.userData.dynamic = true;
  const second = new Mesh(new BoxGeometry(1, 1, 1), material);
  dynamic.add(second);
  root.add(dynamic);
  const before = new Box3().setFromObject(root);
  const batch = batchStatic(root);
  const after = new Box3().setFromObject(root);
  expect(after.min.distanceTo(before.min)).toBeLessThan(0.00001);
  expect(after.max.distanceTo(before.max)).toBeLessThan(0.00001);
  expect(second.parent).toBe(dynamic);
  expect(root.children.find((child) => child instanceof Mesh)).toMatchObject({ castShadow: true, receiveShadow: true });
  batch.dispose();
  second.geometry.dispose();
  material.dispose();
});

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

test('both car detail levels have outward bumper caps, finite geometry and clearance above their tyres', () => {
  for (const { car, lowDetail } of cars.flatMap((car) => [
    { car, lowDetail: false },
    { car, lowDetail: true },
  ])) {
    const design = designs[car.id];
    const shape = buildBodyShape(design, car.length, car.width, lowDetail);
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

import {
  cupProblems,
  joinSession,
  memberBuy,
  memberUpgrade,
  newSession,
  recordSessionRace,
  sessionField,
  sessionTrack,
  startSessionCup,
  validSession,
} from '../src/game/multi-career';

test('online career: fresh and own-car members, fair names, cup entry and a shared grid', () => {
  let session = newSession('Fredagsracet', 'fresh', 5);
  session = joinSession(session, 'host', 'Charlie', { garage: [{ carId: 'skarv', upgrades: { engine: 3, tyres: 3, brakes: 3 } }], activeCarId: 'skarv' });
  session = joinSession(session, 'guest', 'Charlie');
  session = joinSession(session, 'ai-name', 'Klaus');
  expect(session.members.map((member) => member.name)).toEqual(['Charlie', 'Charlie 2', 'Klaus 2']);
  expect(session.members[0].garage).toEqual([]);
  expect(session.members.every((member) => member.money === START_MONEY)).toBe(true);
  expect(joinSession(session, 'host', 'Someone else')).toBe(session);

  const own = joinSession(newSession('Egna', 'own', 6), 'host', 'Alva', {
    garage: [{ carId: 'skarv', upgrades: { engine: 2, tyres: 1, brakes: 0 } }],
    activeCarId: 'skarv',
  });
  expect(own.members[0].garage[0].upgrades.engine).toBe(2);
  expect(own.members[0].activeCarId).toBe('skarv');

  const present = ['host', 'guest'];
  expect(cupProblems(session, 'klubb', present)).toHaveLength(2);
  session = memberBuy(session, 'host', 'nxr');
  session = memberBuy(session, 'guest', 'arrow');
  session = memberUpgrade(session, 'guest', 'arrow', 'engine');
  expect(session.members[1].money).toBe(START_MONEY - carById('arrow').price - 4000);
  expect(cupProblems(session, 'klubb', present)).toEqual([]);
  expect(cupProblems(session, 'mastare', present)[0]).toMatch(/Supercupen/);

  session = startSessionCup(session, 'klubb', present);
  expect(sessionTrack(session)).toBe('smaland');
  expect(memberBuy(session, 'host', 'sting')).toBe(session);
  const field = sessionField(session, present);
  expect(field).toHaveLength(8);
  expect(field[5]).toMatchObject({ driverName: 'Charlie', carId: 'nxr', player: 0 });
  expect(field[6]).toMatchObject({ driverName: 'Charlie 2', carId: 'arrow', player: 1, upgrades: { engine: 1, tyres: 0, brakes: 0 } });
  expect(field.filter((entrant) => entrant.player === undefined)).toHaveLength(6);

  const config = {
    settings: { trackId: 'smaland', carId: 'nxr', laps: 1, difficulty: 'normal' as const, transmission: 'auto' as const },
    cars: ['nxr', 'arrow'],
    seed: 3,
    entrants: field,
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, cars: ['nxr', 'sting'] })).toBe(false);
  const guestRace = createNetworkRace(config, 1);
  expect(guestRace.player.driverName).toBe('Charlie 2');
  expect(guestRace.player.spec.topKmh).toBeGreaterThan(carById('arrow').topKmh);
  expect(guestRace.racers.filter((racer) => racer.isPlayer)).toHaveLength(2);
  expect(validSession(JSON.parse(JSON.stringify(session)))).toBe(true);
});

test('online career: races pay every member and a finished cup crowns a winner and upgrades rivals', () => {
  let session = newSession('Cup', 'fresh', 9);
  for (const [id, name] of [
    ['a', 'Alva'],
    ['b', 'Bo'],
  ])
    session = joinSession(session, id, name);
  session = memberBuy(memberBuy(session, 'a', 'nxr'), 'b', 'sting');
  session = startSessionCup(session, 'klubb', ['a', 'b']);
  const rows = (first: string, second: string) =>
    [first, second, 'Sanna', 'Klaus', 'Lotta', 'Henrik', 'Greta', 'Jürgen'].map((driverName, index) => ({
      position: index + 1,
      driverName,
      car: carById('nxr'),
      isPlayer: false,
      time: 60 + index,
      estimated: false,
      bestLap: 30,
    }));
  const before = session.members.map((member) => member.money);
  session = recordSessionRace(session, rows('Alva', 'Bo'));
  expect(session.members[0].money - before[0]).toBe(cupById('klubb').prizes[0]);
  expect(session.members[1].money - before[1]).toBe(cupById('klubb').prizes[1]);
  session = recordSessionRace(session, rows('Bo', 'Alva'));
  session = recordSessionRace(session, rows('Alva', 'Bo'));
  expect(session.run).toBeUndefined();
  expect(session.lastCup?.winner).toBe('Alva');
  expect(session.members[0].cupsWon).toEqual(['klubb']);
  expect(session.rivals.some((rival) => rival.upgrades.C.engine + rival.upgrades.C.tyres + rival.upgrades.C.brakes > 0)).toBe(true);
  const late = joinSession(session, 'c', 'Cleo');
  expect(late.members[2].money).toBe(START_MONEY);
  expect(late.news[0]).toMatch(/börjar bakifrån/);
});

test('faster classes grip and brake harder, and full keyboard lock at speed turns without bogging down', () => {
  const coupe = carById('arrow');
  const supercar = carById('skarv');
  expect(cornerGrip(supercar, 70)).toBeGreaterThan(cornerGrip(coupe, 70) * 1.25);
  expect(cornerGrip(supercar, 70)).toBeGreaterThan(cornerGrip(supercar, 0));
  expect(brakeDecel(supercar)).toBeGreaterThan(brakeDecel(coupe) * 1.1);

  const track = trackById('rheinland');
  const car: CarState = placeCar(track, 0, 0);
  const speed = 200 / 3.6;
  car.vx = Math.sin(car.yaw) * speed;
  car.vz = Math.cos(car.yaw) * speed;
  const startYaw = car.yaw;
  for (let time = 0; time < 0.5; time += STEP) stepCar(car, supercar, { throttle: 1, brake: 0, steer: 1, handbrake: false }, track, STEP);
  // The car turns at the tyre limit while losing only a little speed, instead of scrubbing half a g.
  expect(Math.abs(car.yaw - startYaw)).toBeGreaterThan(0.12);
  expect(speed * 3.6 - forwardSpeed(car) * 3.6).toBeLessThan(5);
});

test('online quick races keep one class, carry lobby names and arcade-balance the cars', () => {
  const config = {
    settings: { trackId: 'vaxjo', carId: 'sting', laps: 1, difficulty: 'easy' as const, transmission: 'auto' as const },
    cars: ['sting', 'arrow', 'nxr'],
    seed: 11,
    names: ['Charlie', 'Lotta', ''],
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, cars: ['sting', 'velox'] })).toBe(false);
  expect(validRaceConfig({ ...config, names: ['x'.repeat(17), '', ''] })).toBe(false);

  const race = createNetworkRace(config);
  const humans = race.racers.filter((racer) => racer.isPlayer).map((racer) => racer.driverName);
  // An empty name falls back to the player number; a name an AI driver already has gets the number too.
  expect(humans).toContain('Charlie');
  expect(humans).toContain('Spelare 3');
  expect(humans.some((name) => name === 'Lotta' || name === 'Lotta 2')).toBe(true);
  expect(new Set(race.racers.map((racer) => racer.driverName)).size).toBe(race.racers.length);

  for (const carClass of ['C', 'B', 'A'] as const) {
    const peers = cars.filter((car) => car.carClass === carClass);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(spread(peers.map((car) => arcadeSpec(car).grip))).toBeLessThan(spread(peers.map((car) => car.grip)) * 0.3);
  }
  expect(race.racers[0].spec.grip).toBeCloseTo(arcadeSpec(cars.find((car) => car.id === race.racers[0].spec.id) ?? cars[0]).grip, 5);
});

test('AI cars drive forward from the grid instead of first backing up', () => {
  const race = createRace({ trackId: 'vaxjo', carId: 'sting', laps: 1, difficulty: 'normal', transmission: 'auto' }, 3);
  while (race.phase === 'countdown') stepRace(race, idle);
  const atGo = new Map(race.racers.map((racer) => [racer.id, raceDistance(race, racer)]));
  // Two seconds after the start every AI car is in a forward gear and has moved up the road.
  for (let step = 0; step < 240; step++) {
    stepRace(race, idle);
    for (const racer of race.racers) if (!racer.isPlayer) expect(racer.state.gear).toBeGreaterThan(0);
  }
  for (const racer of race.racers) if (!racer.isPlayer) expect(raceDistance(race, racer) - (atGo.get(racer.id) ?? 0)).toBeGreaterThan(5);
});

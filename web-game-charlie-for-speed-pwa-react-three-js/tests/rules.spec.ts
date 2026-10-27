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
import { migrateCareer, migrateSession } from '../src/game/roster-migration';
import { formatGap, LapSplits } from '../src/game/splits';
import { trackById, trackDefs } from '../src/game/tracks';
import { batchStatic } from '../src/render/batch';
import { QualityGovernor, qualityLadder } from '../src/render/quality';

const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };

test('the complete replacement roster has balanced career classes and reference performance', () => {
  expect(cars).toHaveLength(19);
  expect(new Set(cars.map((car) => car.id)).size).toBe(19);
  expect(['C', 'B', 'A'].map((level) => cars.filter((car) => car.carClass === level).length)).toEqual([7, 6, 6]);
  expect(carById('elnino').zeroTo100).toBeLessThan(carById('clkgtr').zeroTo100);
  expect(carById('elnino').topKmh).toBeLessThan(carById('clkgtr').topKmh);
  expect(carById('db7').braking).toBeLessThan(carById('storm').braking);
  expect(cars.every((car) => car.ratings.handling === 8)).toBe(true);
  expect(carById('indy98').ratings).toEqual(carById('corvette').ratings);
});

test('old solo and online career garages migrate without losing progress or starter cup access', () => {
  const old = {
    ...newCareer(9),
    money: 3500,
    garage: [{ carId: 'sting', upgrades: { engine: 2, tyres: 1, brakes: 3 } }],
    activeCarId: 'sting',
    cupsWon: ['klubb'],
    run: { cupId: 'sport', race: 2, standings: { Du: 18, Sanna: 20 } },
  };
  old.rivals[0].cars = { C: 'arrow', B: 'stallion', A: 'skarv' };
  const saved = structuredClone(old);
  const migrated = migrateCareer(old);
  expect(migrated).toMatchObject({ money: 3500, activeCarId: 'corvette', cupsWon: old.cupsWon, run: old.run });
  expect(migrated.garage).toEqual([
    { carId: 'corvette', upgrades: { engine: 2, tyres: 1, brakes: 3 } },
    { carId: 'falcon', upgrades: { engine: 0, tyres: 0, brakes: 0 } },
  ]);
  for (const rival of migrated.rivals) for (const level of ['C', 'B', 'A'] as const) expect(carById(rival.cars[level]).carClass).toBe(level);
  expect(migrateCareer(migrated)).toEqual(migrated);
  expect(old).toEqual(saved);

  const session = joinSession(newSession('Saved', 'own', 4), 'a', 'Alva');
  session.members[0] = { ...session.members[0], money: old.money, garage: old.garage, activeCarId: old.activeCarId, cupsWon: old.cupsWon };
  const result = migrateSession({ ...session, rivals: old.rivals });
  expect(result.members[0]).toMatchObject({ money: 3500, garage: migrated.garage, activeCarId: 'corvette', cupsWon: old.cupsWon });
  expect(result.rivals).toEqual(migrated.rivals);
  expect(result.updated).toBe(session.updated);
  expect(validSession(result)).toBe(true);
  expect(migrateSession(result)).toEqual(result);
});

test('all online cars stay within one percent on every track with the same solo driver', () => {
  test.setTimeout(60000);
  for (const track of trackDefs) {
    const times = cars.map((car) => {
      const race = createRace({ trackId: track.id, carId: car.id, laps: 2, difficulty: 'normal', transmission: 'auto' }, 7, [
        { driverName: 'Calibration', spec: arcadeSpec(car), skill: 1 },
      ]);
      for (let tick = 0; tick < 120 * 260 && !race.player.finishTime; tick++) stepRace(race, idle);
      expect(race.player.finishTime, `${track.id}/${car.id}`).toBeGreaterThan(0);
      return race.player.bestLap;
    });
    expect(Math.max(...times) / Math.min(...times), track.id).toBeLessThan(1.01);
  }
});

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
    const race = createRace({ trackId: def.id, carId: 'xk8', laps: 2, difficulty: 'normal', transmission: 'auto' }, 7);
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
  const race = createRace({ trackId: 'vaxjo', carId: 'elnino', laps: 3, difficulty: 'easy', transmission: 'manual' }, 3);
  expect(race.phase).toBe('countdown');
  for (const racer of race.racers) expect(raceDistance(race, racer)).toBeLessThan(0);
  expect(race.player.spec.id).toBe('elnino');
  for (const racer of race.racers) expect(racer.spec.carClass).toBe('A');
});

test('career: buy a car, upgrade it and respect cup entry rules', () => {
  let career = newCareer(11);
  expect(career.money).toBe(START_MONEY);
  expect(entryProblem(career, cupById('klubb'))).toMatch(/Köp en bil/);

  career = buyCar(career, 'elnino');
  expect(career.garage).toHaveLength(0);
  career = buyCar(career, 'falcon');
  expect(career.money).toBe(START_MONEY - carById('falcon').price);
  expect(entryProblem(career, cupById('klubb'))).toBeUndefined();
  expect(entryProblem(career, cupById('mastare'))).toMatch(/Supercupen/);

  career = buyUpgrade(career, 'falcon', 'engine');
  const tuned = applyUpgrades(carById('falcon'), career.garage[0].upgrades);
  expect(career.garage[0].upgrades.engine).toBe(1);
  expect(tuned.topKmh).toBeGreaterThan(carById('falcon').topKmh);
  expect(tuned.zeroTo100).toBeLessThan(carById('falcon').zeroTo100);
  const broke = buyUpgrade(buyUpgrade(career, 'falcon', 'engine'), 'falcon', 'engine');
  expect(broke.money).toBeGreaterThanOrEqual(0);

  career = startCup(career, 'klubb');
  expect(cupField(career)).toHaveLength(8);
  expect(cupField(career).filter((entrant) => entrant.isPlayer)).toHaveLength(1);
  expect(abandonCup(career).run).toBeUndefined();
});

test('career: a full cup pays prizes, crowns a winner and rivals spend their winnings', () => {
  let career = startCup(buyCar(newCareer(5), 'hsvgts'), 'klubb');
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
    sendFast(v: unknown) {
      return this.send(v);
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
    settings: { trackId: 'vaxjo', carId: 'xk8', laps: 1, difficulty: 'easy' as const, transmission: 'auto' as const },
    cars: ['xk8', 'hsvgts'],
    seed: 7,
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, seed: NaN })).toBe(false);
  const race = createNetworkRace(config);
  expect(race.racers.filter((r) => r.isPlayer)).toHaveLength(2);
  expect(validRaceConfig({ ...config, cars: ['xk8'] })).toBe(false);
  expect(validRaceConfig({ ...config, cars: ['hsvgts', 'xk8'] })).toBe(false);
  expect(validRaceConfig({ ...config, cars: Array(9).fill('xk8') })).toBe(false);
  const six = { ...config, cars: ['xk8', 'hsvgts', 'falcon', 'xk8', 'db7', 'xk8'] };
  expect(validRaceConfig(six)).toBe(true);
  const crowd = createNetworkRace(six, 4);
  const humans = crowd.racers.filter((r) => r.isPlayer);
  expect(humans.map((r) => r.driverName).sort()).toEqual(['Spelare 1', 'Spelare 2', 'Spelare 3', 'Spelare 4', 'Spelare 5', 'Spelare 6']);
  expect(crowd.player.driverName).toBe('Spelare 5');
  expect(crowd.player.spec.id).toBe('db7');
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
import { wheelGeometry } from '../src/render/car-wheels';

test('shared wheels have visible outward tyre surfaces and brake discs behind the spokes', () => {
  for (const style of new Set(Object.values(designs).map((design) => design.rims ?? 'five'))) {
    const wheel = wheelGeometry(style);
    expect(wheelGeometry(style)).toBe(wheel);
    for (const geometry of Object.values(wheel)) {
      expect([...geometry.getAttribute('position').array].every(Number.isFinite), style).toBe(true);
      expect([...geometry.getAttribute('normal').array].every(Number.isFinite), style).toBe(true);
      geometry.computeBoundingBox();
    }
    const positions = wheel.rubber.getAttribute('position'),
      normals = wheel.rubber.getAttribute('normal');
    let treadVertices = 0;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i),
        z = positions.getZ(i);
      if (Math.hypot(y, z) < WHEEL_RADIUS - 0.001 || Math.abs(positions.getX(i)) > 0.08) continue;
      expect(y * normals.getY(i) + z * normals.getZ(i), `${style}: tyre tread faces outward`).toBeGreaterThan(0.15);
      treadVertices++;
    }
    expect(treadVertices, style).toBeGreaterThan(32);
    expect(wheel.brake.boundingBox?.max.x, style).toBeLessThan(0.04);
    expect(wheel.metal.boundingBox?.max.x, style).toBeGreaterThan(0.1);
  }
});

test('both car detail levels have outward curved bumpers, finite geometry and clearance above their tyres', () => {
  for (const { car, lowDetail } of cars.flatMap((car) => [
    { car, lowDetail: false },
    { car, lowDetail: true },
  ])) {
    const design = designs[car.id];
    const shape = buildBodyShape(design, car.length, car.width, lowDetail);
    const triangles = (shape.body.index?.count ?? 0) / 3 + (shape.glass.index?.count ?? 0) / 3;
    expect(triangles, `${car.id}: body detail budget`).toBeLessThan(lowDetail ? (design.highDetail ? 2100 : 1800) : design.highDetail ? 11500 : 7000);
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
      expect(geometry.boundingBox?.min.y, car.id).toBeGreaterThanOrEqual(0.1);
      expect(geometry.boundingBox?.max.x, `${car.id}: body fits the collision width`).toBeLessThanOrEqual(car.width / 2 + 0.001);
      expect(geometry.boundingBox?.min.x, `${car.id}: body fits the collision width`).toBeGreaterThanOrEqual(-car.width / 2 - 0.001);
    }
    const positions = shape.body.getAttribute('position'),
      normals = shape.body.getAttribute('normal');
    for (const facing of [-1, 1]) {
      let capVertices = 0;
      let mostForwardNormal = 0;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        if (facing * z < car.length * 0.4 || Math.abs(z - shape.bumperZ(x, y, facing)) > 0.00001) continue;
        const outward = normals.getZ(i) * facing;

        mostForwardNormal = Math.max(mostForwardNormal, outward);
        capVertices++;
      }
      expect(capVertices, `${car.id}: bumper is closed across its width and height`).toBeGreaterThan(20);
      expect(mostForwardNormal, car.id).toBeGreaterThan(0.95);
      const index = shape.body.index;
      let faces = 0;
      for (let i = 0; index && i < index.count; i += 3) {
        const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        if (
          !vertices.every(
            (v) =>
              facing * positions.getZ(v) > car.length * 0.4 &&
              Math.abs(positions.getZ(v) - shape.bumperZ(positions.getX(v), positions.getY(v), facing)) < 0.00001,
          )
        )
          continue;
        const [a, b, c] = vertices;
        const normalZ =
          (positions.getX(b) - positions.getX(a)) * (positions.getY(c) - positions.getY(a)) -
          (positions.getY(b) - positions.getY(a)) * (positions.getX(c) - positions.getX(a));
        expect(normalZ * facing, `${car.id}: curved cap triangles face outward`).toBeGreaterThanOrEqual(-0.0000001);
        faces++;
      }
      expect(faces, `${car.id}: bumper has a closed surface`).toBeGreaterThan(8);
    }
    const radius = WHEEL_RADIUS * (design.wheelScale ?? 1),
      wheelbase = axles(design, car.length);
    for (const z of [wheelbase.front, wheelbase.rear]) expect(shape.section(z).bottom, car.id).toBeGreaterThan(radius * 2 + 0.03);
    for (const facing of [-1, 1])
      for (const across of [0, 0.5, 1]) {
        let previous = Number.NEGATIVE_INFINITY;
        for (let step = 0; step <= 30; step++) {
          const z = facing * car.length * (0.385 + (step * 0.115) / 30),
            x = across * shape.section(z).halfWidth,
            projected = facing * shape.bodyZ(x, shape.surface(z, across), z);
          expect(projected, `${car.id}: bumper curve cannot fold back through the bonnet`).toBeGreaterThanOrEqual(previous - 0.00001);
          previous = projected;
        }
      }
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
  session = joinSession(session, 'host', 'Charlie', { garage: [{ carId: 'elnino', upgrades: { engine: 3, tyres: 3, brakes: 3 } }], activeCarId: 'elnino' });
  session = joinSession(session, 'guest', 'Charlie');
  session = joinSession(session, 'ai-name', 'Klaus');
  expect(session.members.map((member) => member.name)).toEqual(['Charlie', 'Charlie 2', 'Klaus 2']);
  expect(session.members[0].garage).toEqual([]);
  expect(session.members.every((member) => member.money === START_MONEY)).toBe(true);
  expect(joinSession(session, 'host', 'Someone else')).toBe(session);

  const own = joinSession(newSession('Egna', 'own', 6), 'host', 'Alva', {
    garage: [{ carId: 'elnino', upgrades: { engine: 2, tyres: 1, brakes: 0 } }],
    activeCarId: 'elnino',
  });
  expect(own.members[0].garage[0].upgrades.engine).toBe(2);
  expect(own.members[0].activeCarId).toBe('elnino');

  const present = ['host', 'guest'];
  expect(cupProblems(session, 'klubb', present)).toHaveLength(2);
  session = memberBuy(session, 'host', 'hsvgts');
  session = memberBuy(session, 'guest', 'falcon');
  session = memberUpgrade(session, 'guest', 'falcon', 'engine');
  expect(session.members[1].money).toBe(START_MONEY - carById('falcon').price - 4000);
  expect(cupProblems(session, 'klubb', present)).toEqual([]);
  expect(cupProblems(session, 'mastare', present)[0]).toMatch(/Supercupen/);

  session = startSessionCup(session, 'klubb', present);
  expect(sessionTrack(session)).toBe('smaland');
  expect(memberBuy(session, 'host', 'xk8')).toBe(session);
  const field = sessionField(session, present);
  expect(field).toHaveLength(8);
  expect(field[5]).toMatchObject({ driverName: 'Charlie', carId: 'hsvgts', player: 0 });
  expect(field[6]).toMatchObject({ driverName: 'Charlie 2', carId: 'falcon', player: 1, upgrades: { engine: 1, tyres: 0, brakes: 0 } });
  expect(field.filter((entrant) => entrant.player === undefined)).toHaveLength(6);

  const config = {
    settings: { trackId: 'smaland', carId: 'hsvgts', laps: 1, difficulty: 'normal' as const, transmission: 'auto' as const },
    cars: ['hsvgts', 'falcon'],
    seed: 3,
    entrants: field,
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, cars: ['hsvgts', 'xk8'] })).toBe(false);
  const guestRace = createNetworkRace(config, 1);
  expect(guestRace.player.driverName).toBe('Charlie 2');
  expect(guestRace.player.spec.topKmh).toBeGreaterThan(carById('falcon').topKmh);
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
  session = memberBuy(memberBuy(session, 'a', 'hsvgts'), 'b', 'xk8');
  session = startSessionCup(session, 'klubb', ['a', 'b']);
  const rows = (first: string, second: string) =>
    [first, second, 'Sanna', 'Klaus', 'Lotta', 'Henrik', 'Greta', 'Jürgen'].map((driverName, index) => ({
      position: index + 1,
      driverName,
      car: carById('hsvgts'),
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
  const coupe = carById('falcon');
  const supercar = carById('elnino');
  expect(cornerGrip(supercar, 70)).toBeGreaterThan(cornerGrip(coupe, 70) * 1.15);
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

test('online quick races allow mixed classes, carry lobby names and balance all cars', () => {
  const config = {
    settings: { trackId: 'vaxjo', carId: 'corvette', laps: 1, difficulty: 'easy' as const, transmission: 'auto' as const },
    cars: ['corvette', 'falcon', 'clkgtr'],
    seed: 11,
    names: ['Charlie', 'Lotta', ''],
  };
  expect(validRaceConfig(config)).toBe(true);
  expect(validRaceConfig({ ...config, cars: ['corvette', 'elnino', 'db7'] })).toBe(true);
  expect(validRaceConfig({ ...config, names: ['x'.repeat(17), '', ''] })).toBe(false);

  const race = createNetworkRace(config);
  const humans = race.racers.filter((racer) => racer.isPlayer).map((racer) => racer.driverName);
  // An empty name falls back to the player number; a name an AI driver already has gets the number too.
  expect(humans).toContain('Charlie');
  expect(humans).toContain('Spelare 3');
  expect(humans.some((name) => name === 'Lotta' || name === 'Lotta 2')).toBe(true);
  expect(new Set(race.racers.map((racer) => racer.driverName)).size).toBe(race.racers.length);

  // Every phone builds the same grid from the seed, whatever order its browser's sort compares in.
  const grid = (built: typeof race) => built.racers.map((racer) => `${racer.driverName}:${racer.spec.id}`);
  const sort = Array.prototype.sort;
  try {
    Array.prototype.sort = function (this: unknown[], compare?: (a: unknown, b: unknown) => number) {
      return sort.call(this.reverse(), compare && ((a, b) => compare(b, a)));
    };
    expect(grid(createNetworkRace(config, 1))).toEqual(grid(race));
  } finally {
    Array.prototype.sort = sort;
  }

  const online = cars.map((car) => arcadeSpec(car));
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  expect(spread(online.map((car) => car.topKmh))).toBeLessThan(12);
  expect(spread(online.map((car) => car.zeroTo100))).toBeLessThan(0.25);
  expect(spread(online.map((car) => cornerGrip(car, 70)))).toBe(0);
  expect(spread(online.map((car) => car.braking))).toBeLessThan(spread(cars.map((car) => car.braking)) * 0.11);
  expect(race.racers.filter((racer) => racer.isPlayer).map((racer) => racer.spec.carClass)).toEqual(expect.arrayContaining(['A', 'B', 'C']));
  expect(race.racers[0].spec.grip).toBeCloseTo(arcadeSpec(cars.find((car) => car.id === race.racers[0].spec.id) ?? cars[0]).grip, 5);
});

test('AI cars drive forward from the grid instead of first backing up', () => {
  const race = createRace({ trackId: 'vaxjo', carId: 'corvette', laps: 1, difficulty: 'normal', transmission: 'auto' }, 3);
  while (race.phase === 'countdown') stepRace(race, idle);
  const atGo = new Map(race.racers.map((racer) => [racer.id, raceDistance(race, racer)]));
  // Two seconds after the start every AI car is in a forward gear and has moved up the road.
  for (let step = 0; step < 240; step++) {
    stepRace(race, idle);
    for (const racer of race.racers) if (!racer.isPlayer) expect(racer.state.gear).toBeGreaterThan(0);
  }
  for (const racer of race.racers) if (!racer.isPlayer) expect(raceDistance(race, racer) - (atGo.get(racer.id) ?? 0)).toBeGreaterThan(5);
});

test('an online guest drives its own car at once and sees the others glide, despite the delay to the host', () => {
  // Links that hold every message for a few frames, like a real network.
  class SlowLink {
    status = 'connected';
    error = '';
    other?: SlowLink;
    queue: { due: number; value: unknown }[] = [];
    messages = new Set<(v: unknown) => void>();
    frame = 0;
    send(value: unknown) {
      this.queue.push({ due: this.frame + 6, value: structuredClone(value) });
      return true;
    }
    sendFast(value: unknown) {
      return this.send(value);
    }
    deliver() {
      this.frame++;
      const due = this.queue.filter((m) => m.due <= this.frame);
      this.queue = this.queue.filter((m) => m.due > this.frame);
      for (const { value } of due) for (const listener of this.other?.messages ?? []) listener(value);
    }
    onMessage(f: (v: unknown) => void) {
      this.messages.add(f);
      return () => this.messages.delete(f);
    }
    subscribe() {
      return () => {};
    }
    close() {}
  }
  const a = new SlowLink();
  const b = new SlowLink();
  a.other = b;
  b.other = a;
  const config = {
    settings: { trackId: 'rheinland', carId: 'sting', laps: 3, difficulty: 'easy' as const, transmission: 'auto' as const },
    cars: ['sting', 'nxr'],
    seed: 5,
  };
  const host = new NetworkRace(structuredClone(config), [{ slot: 1, link: a as unknown as PeerLink }], 0);
  const guest = new NetworkRace(structuredClone(config), [{ slot: 1, link: b as unknown as PeerLink }], 1);
  const still = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const step = (controls: typeof still) => {
    host.advance(1 / 60, still, true);
    guest.advance(1 / 60, controls, true);
    a.deliver();
    b.deliver();
  };
  for (let i = 0; i < 60 * 5 && guest.race.phase !== 'racing'; i++) step(still);
  for (let i = 0; i < 30; i++) step(still);
  expect(guest.race.phase).toBe('racing');

  const mine = () => guest.race.player.state;
  const onHost = () => host.race.racers[guest.race.player.id].state;
  const hostCar = () => guest.race.racers[host.race.player.id].state;
  let jump = 0;
  let previous = { ...hostCar() };
  for (let i = 0; i < 18; i++) {
    step({ ...still, throttle: 1 });
    jump = Math.max(jump, Math.hypot(hostCar().x - previous.x, hostCar().z - previous.z));
    previous = { ...hostCar() };
  }
  // 0.3 s into the throttle the guest's own car has the full 0.3 s of it; the host, 100 ms behind, has run only 0.2 s.
  expect(forwardSpeed(mine())).toBeGreaterThan(forwardSpeed(onHost()) * 1.35);
  for (let i = 0; i < 90; i++) step(still);
  // Once the input stops arriving, the guest's view and the host's agree within a couple of metres.
  expect(Math.hypot(mine().x - onHost().x, mine().z - onHost().z)).toBeLessThan(2);
  expect(jump).toBeLessThan(1);
  host.dispose();
  guest.dispose();
});

test('graphics step down on a 10 fps phone until it nears 30 fps, and back up when there is room', () => {
  const levels = qualityLadder(1.5, false);
  expect(levels.every((level) => !level.shadows)).toBe(true);
  expect(qualityLadder(1, true)[0]).toMatchObject({ ratio: 1, shadows: true });
  const quality = new QualityGovernor(levels, 0);
  // Drawing cost follows the pixels: 10 fps at full resolution.
  const frame = () => (0.1 * quality.level.ratio ** 2) / 1.5 ** 2;
  let seconds = 0;
  while (seconds < 20) {
    seconds += frame();
    quality.frame(frame());
  }
  expect(quality.index).toBeGreaterThan(2);
  expect(1 / frame()).toBeGreaterThanOrEqual(30);
  const settled = quality.index;

  // One long stutter is not a slow phone.
  for (let i = 0; i < 120; i++) quality.frame(i === 60 ? 0.4 : 1 / 60);
  expect(quality.index).toBeLessThanOrEqual(settled);

  // A fast device climbs back to the top.
  for (let i = 0; i < 60 * 60; i++) quality.frame(1 / 60);
  expect(quality.index).toBe(0);
});

test('at the line each lap the player sees the gap to the car ahead, and to the car behind once it crosses', () => {
  const race = createRace({ trackId: 'vaxjo', carId: 'corvette', laps: 3, difficulty: 'normal', transmission: 'auto' }, 7);
  const splits = new LapSplits();
  const [ahead, , behind] = race.racers.filter((racer) => racer !== race.player);
  for (const racer of race.racers) {
    racer.lap = 0;
    racer.position = 8;
  }
  Object.assign(ahead, { position: 1 });
  Object.assign(race.player, { position: 2 });
  Object.assign(behind, { position: 3 });
  splits.observe(race);
  const cross = (racer: (typeof race.racers)[number], time: number) => {
    race.time = time;
    racer.lap++;
    racer.lapStart = time;
    splits.observe(race);
  };
  cross(ahead, 60.2);
  cross(race.player, 61.45);
  expect(splits.current?.ahead).toEqual({ name: ahead.driverName, gap: expect.closeTo(1.25, 5) });
  expect(splits.current?.behind?.gap).toBeUndefined();
  expect(splits.visible(62)).toBe(true);
  cross(behind, 62.25);
  expect(splits.current?.behind?.gap).toBeCloseTo(0.8, 5);
  expect(formatGap(splits.current?.ahead?.gap ?? 0, '+')).toBe('+1.25');
  expect(formatGap(splits.current?.behind?.gap ?? 0, '−')).toBe('−0.80');
  expect(splits.visible(66)).toBe(true);
  expect(splits.visible(68)).toBe(false);

  // Leading, there is only a car behind; one that never comes is given up on.
  Object.assign(race.player, { position: 1 });
  Object.assign(ahead, { position: 2 });
  cross(race.player, 120);
  expect(splits.current?.ahead).toBeUndefined();
  expect(splits.current?.behind?.name).toBe(ahead.driverName);
  expect(splits.visible(129)).toBe(true);
  expect(splits.visible(131)).toBe(false);
});

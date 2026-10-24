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

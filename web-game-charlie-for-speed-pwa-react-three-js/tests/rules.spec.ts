import { expect, test } from '@playwright/test';
import { cars } from '../src/game/cars';
import { type CarState, forwardSpeed, placeCar, stepCar } from '../src/game/physics';
import { createRace, formatTime, raceDistance, STEP, stepRace } from '../src/game/race';
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
  expect(new Set(race.racers.map((racer) => racer.spec.id)).size).toBe(8);
});

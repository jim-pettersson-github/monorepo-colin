import type { CarSpec } from './cars';
import { type CarState, type Controls, cornerGrip, forwardSpeed, topSpeed } from './physics';
import { sampleAt } from './track-path';
import type { Track } from './tracks';

export type Driver = {
  lane: number;
  avoid: number;
  skill: number;
  stuck: number;
};

export function targetSpeedAhead(track: Track, spec: CarSpec, s: number, speed: number, skill: number) {
  const { path } = track;
  const grip = cornerGrip(spec) * 0.9 * skill;
  const brake = 9 * spec.braking * skill;
  let target = topSpeed(spec) * (0.9 + skill * 0.1);
  const horizon = 30 + (speed * speed) / (2 * brake);

  for (let distance = 0; distance <= horizon; distance += 6) {
    const curve = Math.abs(sampleAt(path, s + distance).curve);
    if (curve < 1e-4) continue;
    const cornerSpeed = Math.sqrt(grip / curve);
    target = Math.min(target, Math.sqrt(cornerSpeed * cornerSpeed + 2 * brake * distance));
  }
  return target;
}

export function driveAi(car: CarState, spec: CarSpec, driver: Driver, track: Track, others: CarState[], pace: number, dt: number): Controls {
  const speed = forwardSpeed(car);
  const lookahead = 9 + Math.max(0, speed) * 0.5;
  const index = Math.round((car.s + lookahead) / track.path.spacing) % track.path.samples.length;

  // Steer around a slower car directly ahead.
  let wantAvoid = 0;
  for (const other of others) {
    if (other === car) continue;
    let gap = other.s - car.s;
    if (gap < -track.path.length / 2) gap += track.path.length;
    if (gap < 2 || gap > 26) continue;
    const side = other.lateral - (car.lateral + driver.avoid);
    if (Math.abs(side) > 3) continue;
    if (forwardSpeed(other) > speed + 2) continue;
    wantAvoid = other.lateral > 0 ? -3.6 : 3.6;
  }
  driver.avoid += (wantAvoid - driver.avoid) * Math.min(1, dt * 1.4);

  const halfRoom = track.halfWidth - 1.6;
  const lateral = Math.max(-halfRoom, Math.min(halfRoom, track.racingLine[index] + driver.lane + driver.avoid));
  const target = sampleAt(track.path, car.s + lookahead);
  const tx = target.x + target.rx * lateral - car.x;
  const tz = target.z + target.rz * lateral - car.z;
  const sin = Math.sin(car.yaw);
  const cos = Math.cos(car.yaw);
  const ahead = tx * sin + tz * cos;
  const right = tx * -cos + tz * sin;
  const angle = Math.atan2(right, Math.max(ahead, 0.1));

  const wanted = targetSpeedAhead(track, spec, car.s, speed, driver.skill) * pace;
  const controls: Controls = {
    steer: Math.max(-1, Math.min(1, angle * 2.6)),
    throttle: speed < wanted - 1.5 ? 1 : speed < wanted ? 0.4 : 0,
    brake: speed > wanted + 2.5 ? Math.min(1, (speed - wanted) / 6) : 0,
    handbrake: false,
  };

  if (car.surface === 'grass') controls.throttle *= 0.8;

  // Back out of a wall if the car has been stopped for a while.
  driver.stuck = speed < 2 ? driver.stuck + dt : 0;
  if (driver.stuck > 2.5) {
    controls.throttle = 0;
    controls.brake = 1;
    controls.steer = -controls.steer;
    if (driver.stuck > 4.5) driver.stuck = 0;
  }
  return controls;
}

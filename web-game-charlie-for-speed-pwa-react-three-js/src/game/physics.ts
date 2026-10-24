import type { CarSpec } from './cars';
import { locate, type TrackSample } from './track-path';
import type { Track } from './tracks';

export type Controls = {
  throttle: number;
  brake: number;
  // -1 is full left, 1 is full right.
  steer: number;
  handbrake: boolean;
};

export type Surface = 'road' | 'curb' | 'grass';

export type CarState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  steer: number;
  gear: number;
  rpm: number;
  shiftTimer: number;
  index: number;
  s: number;
  lateral: number;
  surface: Surface;
  slip: number;
  impact: number;
  pitch: number;
  wheelSpin: number;
  braking: boolean;
};

export type Transmission = 'auto' | 'manual';

const GRAVITY = 9.81;
const GEAR_RATIOS = [0.3, 0.46, 0.61, 0.75, 0.88, 1];
const IDLE_RPM = 0.14;
const MAX_STEER = 0.6;
export const CAR_RADIUS = 1.05;

export function forwardSpeed(car: CarState) {
  return car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw);
}

export function topSpeed(spec: CarSpec) {
  return spec.topKmh / 3.6;
}

export function placeCar(track: Track, s: number, lateral: number): CarState {
  const { samples, spacing } = track.path;
  const index = Math.round((((s % track.path.length) + track.path.length) % track.path.length) / spacing) % samples.length;
  const sample = samples[index];
  return {
    x: sample.x + sample.rx * lateral,
    y: sample.y,
    z: sample.z + sample.rz * lateral,
    yaw: Math.atan2(sample.tx, sample.tz),
    vx: 0,
    vz: 0,
    steer: 0,
    gear: 1,
    rpm: IDLE_RPM,
    shiftTimer: 0,
    index,
    s: sample.s,
    lateral,
    surface: 'road',
    slip: 0,
    impact: 0,
    pitch: 0,
    wheelSpin: 0,
    braking: false,
  };
}

function gearTop(spec: CarSpec, gear: number) {
  return topSpeed(spec) * 1.04 * GEAR_RATIOS[gear - 1];
}

function torque(rpm: number) {
  // Gentle peak just past mid range, falling off near the limiter.
  return 0.78 + 0.32 * Math.sin(Math.min(1, rpm) * Math.PI * 0.85);
}

export function shift(car: CarState, direction: 1 | -1) {
  const next = Math.max(1, Math.min(GEAR_RATIOS.length, car.gear + direction));
  if (next === car.gear) return;
  car.gear = next;
  car.shiftTimer = 0.18;
}

function surfaceAt(track: Track, lateral: number, sample: TrackSample): Surface {
  const distance = Math.abs(lateral);
  if (distance <= track.halfWidth) return 'road';
  const curbWidth = Math.abs(sample.curve) > 1 / 140 ? 1.4 : 0.6;
  return distance <= track.halfWidth + curbWidth ? 'curb' : 'grass';
}

export function stepCar(car: CarState, spec: CarSpec, controls: Controls, track: Track, dt: number, transmission: Transmission = 'auto', frozen = false) {
  const sinYaw = Math.sin(car.yaw);
  const cosYaw = Math.cos(car.yaw);
  let forward = car.vx * sinYaw + car.vz * cosYaw;
  let lateral = car.vx * -cosYaw + car.vz * sinYaw;
  const top = topSpeed(spec);
  const speed = Math.abs(forward);
  const surfaceGrip = car.surface === 'grass' ? 0.62 : car.surface === 'curb' ? 0.93 : 1;

  const steerRate = Math.abs(controls.steer) > Math.abs(car.steer) && Math.sign(controls.steer) === Math.sign(car.steer) ? 3.2 : 6;
  car.steer += Math.max(-steerRate * dt, Math.min(steerRate * dt, controls.steer - car.steer));

  car.shiftTimer = Math.max(0, car.shiftTimer - dt);
  const reversing = car.gear === 0;
  const gearSpeed = reversing ? 14 : gearTop(spec, car.gear);
  const revs = Math.min(1.05, IDLE_RPM + (speed / gearSpeed) * (1 - IDLE_RPM));
  const freeRevs = IDLE_RPM + controls.throttle * 0.75;
  car.rpm += ((frozen ? freeRevs : car.shiftTimer > 0 ? revs * 0.82 : revs) - car.rpm) * Math.min(1, dt * 14);
  car.braking = controls.brake > 0.05 && forward > 0.5;

  if (frozen) {
    car.vx = 0;
    car.vz = 0;
    car.slip = 0;
    car.impact = 0;
    return;
  }

  // Engine: calibrated so zeroTo100 and top speed roughly match the spec sheet.
  const launch = (27.8 / spec.zeroTo100) * 1.05;
  if (!reversing && controls.throttle > 0 && car.shiftTimer === 0) {
    const fade = 1 - Math.min(1, (Math.max(0, forward) / (top * 1.07)) ** 3);
    const limiter = car.rpm > 1.0 ? 0.2 : 1;
    forward += controls.throttle * launch * fade * torque(car.rpm) * limiter * dt;
  }

  if (reversing && controls.brake > 0) forward = Math.max(-14, forward - controls.brake * 5 * dt);
  else if (controls.brake > 0 && forward > 0.2) forward = Math.max(0, forward - controls.brake * 11 * spec.braking * surfaceGrip * dt);
  if (reversing && controls.throttle > 0 && forward < 0) forward = Math.min(0, forward + controls.throttle * 12 * dt);

  if (controls.handbrake) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 4 * dt);

  const drag = 0.25 + 0.00012 * forward * forward + (controls.throttle === 0 ? 0.6 : 0);
  const grassDrag = car.surface === 'grass' ? 1 + 0.007 * forward * forward : 0;
  forward -= Math.sign(forward) * Math.min(Math.abs(forward), (drag + grassDrag) * dt);
  forward -= GRAVITY * Math.sin(Math.atan(car.pitch)) * 0.7 * dt;

  // Automatic gearbox and reverse engagement.
  if (transmission === 'auto' && !reversing && car.shiftTimer === 0) {
    if (car.rpm > 0.97 && car.gear < GEAR_RATIOS.length) shift(car, 1);
    else if (car.gear > 1 && IDLE_RPM + (speed / gearTop(spec, car.gear - 1)) * (1 - IDLE_RPM) < 0.72) shift(car, -1);
  }
  if (controls.brake > 0.5 && controls.throttle === 0 && forward < 0.5) car.gear = 0;
  else if (reversing && (controls.throttle > 0.1 || forward > 0.5)) car.gear = 1;

  // Steering limited by tyre grip so full lock at speed only just breaks traction.
  const gripAcc = spec.grip * GRAVITY * surfaceGrip;
  const geometric = (forward * Math.tan(car.steer * MAX_STEER)) / 2.6;
  const limit = ((controls.handbrake ? 1.6 : 1.12) * gripAcc) / Math.max(speed, 6);
  const yawRate = Math.max(-limit, Math.min(limit, geometric));
  car.yaw -= yawRate * dt;

  // Keep the old heading's sideways velocity; tyres scrub it away up to their grip.
  const newSin = Math.sin(car.yaw);
  const newCos = Math.cos(car.yaw);
  const worldX = forward * sinYaw - lateral * cosYaw;
  const worldZ = forward * cosYaw + lateral * sinYaw;
  forward = worldX * newSin + worldZ * newCos;
  lateral = worldX * -newCos + worldZ * newSin;

  const scrub = gripAcc * (controls.handbrake ? 0.28 : 1) * dt;
  lateral -= Math.sign(lateral) * Math.min(Math.abs(lateral), scrub);
  car.slip = Math.abs(lateral);
  if (car.slip > 2) forward -= Math.sign(forward) * Math.min(Math.abs(forward), car.slip * 0.25 * dt);

  car.vx = forward * newSin - lateral * newCos;
  car.vz = forward * newCos + lateral * newSin;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.wheelSpin += (forward / 0.33) * dt;

  updateTrackPosition(car, track, dt);
}

export function updateTrackPosition(car: CarState, track: Track, dt: number) {
  const location = locate(track.path, car.x, car.z, car.index);
  car.index = location.index;
  car.s = location.s;
  car.lateral = location.lateral;
  car.y = location.y;
  car.pitch = location.sample.slope;
  car.surface = surfaceAt(track, location.lateral, location.sample);
  car.impact = 0;

  const limit = track.wall - 1.1;
  if (Math.abs(location.lateral) <= limit) return;

  const side = Math.sign(location.lateral);
  const { rx, rz, tx, tz } = location.sample;
  const depth = Math.abs(location.lateral) - limit;
  car.x -= rx * side * depth;
  car.z -= rz * side * depth;
  car.lateral = side * limit;

  const outward = Math.max(0, (car.vx * rx + car.vz * rz) * side);

  // Cancel the motion into the barrier; only real impacts bounce and cost speed.
  const bounce = outward > 3 ? 1.3 : 1;
  car.vx -= rx * side * outward * bounce;
  car.vz -= rz * side * outward * bounce;
  const speed = Math.hypot(car.vx, car.vz);
  if (speed > 0.1) {
    const loss = Math.min(speed, outward * 0.45 + (outward > 0.05 ? 2.5 * dt : 0));
    car.vx *= (speed - loss) / speed;
    car.vz *= (speed - loss) / speed;
  }
  car.impact = outward;

  // Swing the nose back along the barrier while scraping it.
  const along = car.vx * tx + car.vz * tz;
  const trackYaw = Math.atan2(tx * Math.sign(along || 1), tz * Math.sign(along || 1));
  const delta = Math.atan2(Math.sin(trackYaw - car.yaw), Math.cos(trackYaw - car.yaw));
  car.yaw += delta * Math.min(0.6, dt * 3 + outward * 0.04);
}

// Two circles per car approximate the body; equal-mass impulses push cars apart.
export function resolveContacts(states: CarState[]) {
  const offset = 1.15;
  for (let a = 0; a < states.length; a++) {
    for (let b = a + 1; b < states.length; b++) {
      const first = states[a];
      const second = states[b];
      if ((first.x - second.x) ** 2 + (first.z - second.z) ** 2 > 36) continue;

      for (const da of [-offset, offset]) {
        for (const db of [-offset, offset]) {
          const ax = first.x + Math.sin(first.yaw) * da;
          const az = first.z + Math.cos(first.yaw) * da;
          const bx = second.x + Math.sin(second.yaw) * db;
          const bz = second.z + Math.cos(second.yaw) * db;
          const dx = bx - ax;
          const dz = bz - az;
          const distance = Math.hypot(dx, dz);
          const overlap = CAR_RADIUS * 2 - distance;
          if (overlap <= 0 || distance < 1e-4) continue;

          const nx = dx / distance;
          const nz = dz / distance;
          first.x -= nx * overlap * 0.5;
          first.z -= nz * overlap * 0.5;
          second.x += nx * overlap * 0.5;
          second.z += nz * overlap * 0.5;

          const closing = (first.vx - second.vx) * nx + (first.vz - second.vz) * nz;
          if (closing <= 0) continue;
          const impulse = closing * 0.65;
          first.vx -= nx * impulse;
          first.vz -= nz * impulse;
          second.vx += nx * impulse;
          second.vz += nz * impulse;
          first.impact = Math.max(first.impact, closing);
          second.impact = Math.max(second.impact, closing);
        }
      }
    }
  }
}

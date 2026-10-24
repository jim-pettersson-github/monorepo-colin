import type { Commands, GameState, Runner } from './model';
import {
  angle,
  barHeight,
  clamp,
  eventInfo,
  jumpEvent,
  neutral,
  obstacleCount,
  obstaclePosition,
  raceScale,
  ranking,
  stationaryEvent,
  verticalEvent,
} from './model';
export const STEP = 1 / 60;
function launch(state: GameState, r: Runner) {
  r.launched = true;
  if (r.x > 18.25 && !stationaryEvent(state.event)) {
    r.foul = true;
    r.done = true;
    return;
  }
  const kind = eventInfo(state.event).mechanic;
  r.takeoffQuality = stationaryEvent(state.event) ? 1 : clamp(r.x / 18, 0.3, 1);
  const theta = (angle(state.time) * Math.PI) / 180;
  r.flightX = 0;
  r.flightY = jumpEvent(state.event) ? 0.1 : 1.8;
  r.peak = r.flightY;
  r.hops = 1;
  if (verticalEvent(state.event)) {
    const height = (kind === 'pole' ? 1.8 + r.speed * 0.38 : 0.8 + r.speed * 0.14) * r.takeoffQuality;
    r.flightVy = Math.sqrt(2 * 9.81 * height);
    r.flightVx = 4 / (r.flightVy / 9.81);
  } else if (jumpEvent(state.event)) {
    r.flightVx = r.speed * r.takeoffQuality * 0.84;
    r.flightVy = 5.4;
  } else {
    const power =
      (kind === 'javelin' ? 17 + r.speed * 0.95 : kind === 'discus' ? 17 + r.speed * 0.88 : kind === 'hammer' ? 20 + r.speed * 0.92 : 7.8 + r.speed * 0.72) *
      r.takeoffQuality;
    r.flightVx = Math.cos(theta) * power;
    r.flightVy = Math.sin(theta) * power;
    r.speed = 0;
  }
}
function finishField(state: GameState, r: Runner) {
  r.done = true;
  r.result = r.foul ? null : verticalEvent(state.event) ? barHeight(state.event, state.attempt) : Math.round(r.flightX * 100) / 100;
}
export function step(state: GameState, input: [Commands, Commands], dt = STEP) {
  if (state.phase === 'countdown') {
    state.countdown = Math.max(0, state.countdown - dt);
    if (state.countdown === 0) state.phase = 'playing';
    return;
  }
  if (state.phase !== 'playing') return;
  state.time += dt;
  const info = eventInfo(state.event);
  const scale = info.type === 'run' ? raceScale(state.event) : 1;
  for (const [lane, r] of state.runners.entries()) {
    if (r.done) continue;
    const ai = r.human === null;
    let command = ai ? neutral() : input[r.human as 0 | 1];
    const aiSpeed = (state.settings.difficulty === 'easy' ? 7 : state.settings.difficulty === 'normal' ? 8.7 : 10.1) + lane * 0.13;
    if (ai) {
      command = { feet: [], hold: state.time >= r.aiNext, action: false };
      const obstacle = obstacleCount(state.event);
      if (obstacle && r.hurdle < obstacle && obstaclePosition(state.event, r.hurdle) - r.x < r.speed * scale * 0.34 && r.jump === 0) command.action = true;
      if (info.type === 'field' && !r.launched) command.action = stationaryEvent(state.event) ? state.time > 2.5 + lane * 0.25 : r.x >= 16.9 + lane * 0.14;
      if (info.mechanic === 'triple' && r.landingWindow > 0) command.action = true;
    }
    r.stumble = Math.max(0, r.stumble - dt);
    for (const foot of command.feet) {
      if (foot !== r.lastFoot && state.time - r.lastStep >= 0.045) {
        r.rhythm = clamp(r.rhythm + 0.22, 0, 1);
        r.lastFoot = foot;
        r.lastStep = state.time;
      }
    }
    r.rhythm = Math.max(0, r.rhythm - dt * 0.42);
    const effort = command.hold && (state.settings.assist || ai) ? 1 : r.rhythm;
    const walk = info.mechanic === 'walk';
    const target = r.stumble > 0 ? 2.3 : (ai ? aiSpeed : 10.6) * (walk ? 0.65 : 1) * effort;
    if (!r.launched) r.speed += (target - r.speed) * Math.min(1, dt * 2.5);
    if (r.jump > 0 || r.jumpV > 0) {
      r.jumpV -= 12 * dt;
      r.jump = Math.max(0, r.jump + r.jumpV * dt);
      if (r.jump === 0) r.jumpV = 0;
    }
    if (command.action && obstacleCount(state.event) > 0 && r.jump === 0 && !r.stumble) r.jumpV = 6.1;
    if (command.action && walk) r.stumble = 0.5;
    if (command.action && info.type === 'field' && !r.launched) launch(state, r);
    if (info.type === 'run') {
      const old = r.x;
      r.x += r.speed * scale * dt;
      if (r.hurdle < obstacleCount(state.event) && r.x >= obstaclePosition(state.event, r.hurdle)) {
        if (r.jump < 0.5) {
          r.stumble = info.mechanic === 'steeple' && r.hurdle % 3 === 2 ? 1.15 : 0.8;
          r.speed *= 0.4;
        }
        r.hurdle++;
      }
      if (r.x >= info.distance) {
        r.finish = (state.time - dt + (dt * (info.distance - old)) / Math.max(0.0001, r.x - old)) * scale;
        r.result = Math.round(r.finish * 100) / 100;
        r.x = info.distance;
        r.done = true;
      }
    } else if (r.launched && !r.done) {
      if (r.landingWindow > 0) {
        if (command.action && r.hops < 3) {
          r.hops++;
          r.landingWindow = 0;
          r.flightVy = 5.4 - (r.hops - 1) * 0.35;
          r.flightVx *= 0.9;
          r.flightY = 0.01;
        } else {
          r.landingWindow = Math.max(0, r.landingWindow - dt);
          if (r.landingWindow === 0) finishField(state, r);
        }
      } else {
        const previous = r.flightX;
        r.flightX += r.flightVx * dt;
        r.flightVy -= 9.81 * dt;
        r.flightY += r.flightVy * dt;
        r.peak = Math.max(r.peak, r.flightY);
        if (verticalEvent(state.event) && previous < 4 && r.flightX >= 4 && r.flightY < barHeight(state.event, state.attempt)) r.foul = true;
        if (r.flightY <= 0) {
          r.flightY = 0;
          if (info.mechanic === 'triple' && r.hops < 3) r.landingWindow = 0.26;
          else finishField(state, r);
        }
      }
    } else if (!r.done && !stationaryEvent(state.event)) {
      r.x += r.speed * dt;
      if (r.x > 18.25) {
        r.foul = true;
        r.done = true;
      }
    }
    if (state.time >= (info.type === 'run' ? 65 : 25) && !r.done) {
      r.done = true;
      r.foul = true;
      r.result = null;
    }
  }
  if (!state.runners.every((r) => r.done)) return;
  if (info.type === 'field') {
    for (const r of state.runners) r.attempts.push(r.result);
    if (state.attempt < 2) {
      state.phase = 'attempt-result';
      return;
    }
    for (const r of state.runners) {
      const valid = r.attempts.filter((n): n is number => n !== null);
      r.result = valid.length ? Math.max(...valid) : null;
    }
  }
  state.phase = 'results';
  if (!state.awarded) {
    const order = ranking(state);
    for (const index of order) {
      if (state.runners[index].result === null) continue;
      const equal = order.findIndex((other) => state.runners[other].result === state.runners[index].result);
      state.points[index] += [5, 3, 2, 1][equal];
    }
    state.awarded = true;
  }
}

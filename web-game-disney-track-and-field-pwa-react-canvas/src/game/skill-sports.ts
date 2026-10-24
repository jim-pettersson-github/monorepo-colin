import { type Commands, clamp, type GameState, neutral, type Runner, type SkillState } from './model';

export const liftPower = (time: number) => (Math.sin(time * 2.1) + 1) / 2;
export const arrowHeight = (time: number, lane: number) => Math.cos(time * 1.7 + lane * 0.4) * 0.8;
export const entryError = (angle: number) => Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI)));
export const liftWeight = (attempt: number) => [40, 60, 80][attempt];
function finish(r: Runner, value: number | null) {
  r.done = true;
  r.result = value;
  r.foul = value === null;
  if (r.skill) r.skill.stage = 'done';
}
export function skillAI(state: GameState, r: Runner, lane: number): Commands {
  const s = r.skill;
  const command = neutral();
  if (!s || r.done) return command;
  const error = state.settings.difficulty === 'easy' ? 0.8 : state.settings.difficulty === 'normal' ? 0.4 : 0.08;
  if (state.event === 'archery') {
    const target = error * (lane % 2 ? 0.5 : -0.5);
    command.steer = Math.abs(target - s.aim) < 0.03 ? 0 : target > s.aim ? 1 : -1;
    command.action = state.time > 0.8 && Math.abs(target - s.aim) < 0.06 && Math.abs(arrowHeight(state.time, lane)) < error * 0.5 + 0.035;
  } else if (state.event === 'diving') {
    command.action = s.stage === 'ready' ? state.time > 0.5 + lane * 0.12 : s.stage === 'active' && s.aim >= Math.PI * 3 - error;
    command.steer = s.stage === 'active' && !command.action ? 1 : 0;
  } else {
    command.steer = Math.abs(s.balance) < 0.04 ? 0 : s.balance > 0 ? -1 : 1;
    command.action = s.stage === 'ready' ? state.time > 0.6 && liftPower(state.time) > 0.78 : s.elapsed >= 2.6 && Math.abs(s.balance) < 0.2;
  }
  return command;
}
export function stepSkill(state: GameState, r: Runner, lane: number, command: Commands, dt: number) {
  const s = r.skill as SkillState;
  const steer = command.steer ?? 0;
  if (state.event === 'archery') {
    if (s.stage === 'ready') {
      s.aim = clamp(s.aim + steer * dt * 0.8, -1.2, 1.2);
      if (command.action) {
        s.balance = arrowHeight(state.time, lane);
        s.score = Math.round(clamp(10 - Math.hypot(s.aim, s.balance) * 8, 0, 10));
        s.stage = 'released';
      }
    } else if (s.stage === 'released') {
      s.progress = Math.min(1, s.progress + dt * 1.5);
      if (s.progress === 1) finish(r, s.score);
    }
  } else if (state.event === 'diving') {
    if (s.stage === 'ready' && command.action) {
      s.stage = 'active';
      s.aim = 0;
    } else if (s.stage === 'active' || s.stage === 'released') {
      s.elapsed += dt;
      s.progress = Math.min(1, s.elapsed / 2.6);
      s.aim += steer * dt * (s.stage === 'active' ? 4.8 : 0.7);
      if (command.action && s.stage === 'active') s.stage = 'released';
      if (s.progress === 1) {
        const rotations = Math.min(2, Math.abs(s.aim) / (Math.PI * 2));
        const score = s.stage === 'released' ? clamp(6 + rotations * 2 - (entryError(s.aim) / Math.PI) * 7, 0, 10) : 1;
        s.score = Math.round(score * 10) / 10;
        finish(r, s.score);
      }
    }
  } else {
    s.target = liftWeight(state.attempt);
    if (s.stage === 'ready') {
      s.progress = liftPower(state.time);
      if (command.action) {
        if (s.progress < 0.65) finish(r, null);
        else {
          s.stage = 'active';
          s.progress = 0;
          s.balance = 0.15;
        }
      }
    } else if (s.stage === 'active') {
      s.elapsed += dt;
      s.progress = Math.min(1, s.elapsed / 2.5);
      s.balance += (Math.sin(s.elapsed * 3 + lane * 0.7) * 0.24 + 0.2 + steer * 0.95) * dt;
      if (Math.abs(s.balance) > 0.95 || s.elapsed > 4.2) finish(r, null);
      else if (command.action) {
        if (s.progress === 1 && Math.abs(s.balance) <= 0.22) finish(r, s.target);
        else finish(r, null);
      }
    }
  }
  if (!r.done && state.time >= 25) finish(r, state.event === 'weightlifting' ? null : 0);
}

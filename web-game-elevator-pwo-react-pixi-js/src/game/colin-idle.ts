import type { GameState } from './model';
import { atThreshold } from './spatial';

const actions = ['sit', 'scratch', 'squat', 'jump'] as const;
type IdleAction = (typeof actions)[number];
export type IdlePose = 'standing' | 'crouch' | 'squat' | 'sit' | 'scratch' | 'jump';
export interface ColinIdle {
  elapsed: number;
  next: number;
  action: IdleAction | null;
}
export const createColinIdle = (): ColinIdle => ({ elapsed: 0, next: 0, action: null });
export function resetColinIdle(idle: ColinIdle) {
  idle.elapsed = 0;
  idle.action = null;
}

const durations: Record<IdleAction, number> = { sit: 7, scratch: 2.8, squat: 4.8, jump: 2.6 };
export function stepColinIdle(idle: ColinIdle, state: GameState, busy: boolean, dt: number) {
  const player = state.player;
  if (
    busy ||
    player.targetX !== null ||
    player.targetDepth !== null ||
    player.waypoints.length ||
    player.intent ||
    player.route ||
    player.stairs ||
    (player.place !== 'outside' && atThreshold(player))
  ) {
    resetColinIdle(idle);
    return;
  }
  idle.elapsed += dt;
  if (!idle.action && idle.elapsed >= 8) {
    idle.action = actions[idle.next];
    idle.next = (idle.next + 1) % actions.length;
    idle.elapsed = 0;
  } else if (idle.action && idle.elapsed >= durations[idle.action]) resetColinIdle(idle);
}

// Feet stay anchored to the simulation point; lift is only a fraction of the
// rendered standing height. No animation changes collision or routing state.
export function colinIdleFrame(idle?: ColinIdle): { pose: IdlePose; height: number; lift: number; tilt: number } {
  const result = (pose: IdlePose, height = 1, lift = 0, tilt = 0) => ({ pose, height, lift, tilt });
  if (!idle?.action) return result('standing');
  const t = idle.elapsed;
  const remaining = durations[idle.action] - t;
  if (idle.action === 'sit' || idle.action === 'squat') {
    if (t < 0.18 || remaining < 0.18) return result('standing', 1 - Math.sin(((Math.min(t, remaining) / 0.18) * Math.PI) / 2) * 0.035);
    if (t < 0.48 || remaining < 0.48) return result('crouch', 0.89);
    if (idle.action === 'squat' || t < 0.85 || remaining < 0.85) return result('squat', 0.74);
    return result('sit', 0.66);
  }
  if (idle.action === 'scratch') {
    if (t < 0.2 || remaining < 0.2) return result('standing');
    return result('scratch', 1, 0, Math.sin((t - 0.2) * 15) * 0.006);
  }
  // Two little hops, each with a crouched anticipation and soft landing.
  const hop = t % 1.3;
  if (hop < 0.22) return result('crouch', 0.89);
  if (hop < 0.82) return result('jump', 0.89, Math.sin(((hop - 0.22) / 0.6) * Math.PI) * 0.13);
  if (hop < 1) return result('crouch', 0.89);
  return result('standing');
}

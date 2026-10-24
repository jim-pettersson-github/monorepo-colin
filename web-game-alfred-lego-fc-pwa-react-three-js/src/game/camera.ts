import type { MatchState } from './model';
import { attackDirection, clamp, FIELD } from './model';

export const CAMERA_HEIGHT = 54;
export const CAMERA_DEPTH = 52;

export function matchCameraFrame(state: MatchState, aspect: number, portrait: boolean, preview = false) {
  if (preview) return { x: 0, z: 0, halfHeight: Math.max(52, 64 / aspect) };
  const ball = state.ball;
  const penalty = state.phase === 'penalty' || state.phase === 'penalty-ready';
  const points = [{ x: ball.x, z: ball.z }];
  if (penalty && state.foul) points.push({ x: attackDirection(state.foul.team) * FIELD.halfLength, z: 0 });
  else if (!state.watching) {
    for (const team of state.mode === 'versus' ? ([0, 1] as const) : ([0] as const)) {
      const player = state.players[state.selected[team]];
      // Keep play around the ball readable; the overview locates distant players.
      points.push({ x: clamp(player.x, ball.x - 20, ball.x + 20), z: clamp(player.z, ball.z - 14, ball.z + 14) });
    }
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const baseHeight = portrait ? Math.max(25, 13 / aspect) : Math.max(10, Math.min(14, 30 / aspect), 20 / aspect);
  const horizontalSpan = portrait ? maxZ - minZ : maxX - minX;
  const verticalSpan = portrait ? maxX - minX : maxZ - minZ;
  const halfHeight = clamp(Math.max((horizontalSpan / 2 + 7) / aspect, (verticalSpan / 2 + 8) * 0.82), baseHeight, baseHeight * 1.5);
  const groundProjection = CAMERA_HEIGHT / Math.hypot(CAMERA_HEIGHT, portrait ? 50 : CAMERA_DEPTH);
  const halfGroundX = portrait ? halfHeight / groundProjection : halfHeight * aspect;
  const halfGroundZ = portrait ? halfHeight * aspect : halfHeight / groundProjection;
  const limitX = Math.max(0, FIELD.halfLength - halfGroundX + 5);
  const limitZ = Math.max(0, FIELD.halfWidth - halfGroundZ + 4);
  return {
    x: clamp((minX + maxX) / 2 + (penalty ? 0 : clamp(ball.vx * 0.18, -3, 3)), -limitX, limitX),
    z: clamp((minZ + maxZ) / 2 + (penalty ? 0 : clamp(ball.vz * 0.18, -2, 2)), -limitZ, limitZ),
    halfHeight,
  };
}

import { type FloorPoint, type GameState, layout, stairProgress } from './model';

export const cafeSpace = { width: 1536, height: 1024 };
export const cafeLift = { left: 258, right: 417, sill: 827, top: 548, rise: 475, slope: -0.18 };
export const cafeCall = (floor: number) => ({ x: 435, y: 647 - floor * cafeLift.rise });
export const cafeButton = (floor: number, level: number) => ({ x: 378, y: 656 - level * cafeLift.rise - floor * 40 });
export const cafeDoorButton = (target: 0 | 1, level: number) => ({ x: 303 + target * 52, y: 710 - level * cafeLift.rise });
export const cafeStairFeet = [
  { x: 1308, y: 781 },
  { x: 1172, y: 330 },
];

// Keep the shared simulation's doorway coordinates. Only their projection differs here.
export function cafeProject(point: FloorPoint, floor: number) {
  const upper = floor >= 0.5;
  const span = upper ? 822 : 958;
  const corridorX = 350 + ((layout.threshold - point.x) / (layout.threshold - layout.stairs)) * span;
  const x = point.x > layout.threshold ? 350 - (point.x - layout.threshold) * 0.22 : corridorX;
  const corridorY = upper
    ? point.x >= 200
      ? 330 - ((layout.threshold - Math.min(point.x, layout.threshold)) * 45) / 625
      : 285 + ((200 - point.x) * 45) / 95
    : point.x >= 450
      ? 805 - ((layout.threshold - Math.min(point.x, layout.threshold)) * 71) / 375
      : 734 + ((450 - point.x) * 43) / 345;
  return { x, y: corridorY + point.depth * (upper ? 68 : 180) };
}

export function cafePlayerFeet(state: GameState) {
  const { player } = state;
  if (player.stairs) {
    const from = cafeStairFeet[player.stairs.from];
    const to = cafeStairFeet[player.stairs.to];
    const progress = stairProgress(player.stairs);
    return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  }
  if (player.riding) {
    const lift = state.buildings.find((building) => building.id === 'cafe')?.lift;
    const point = cafeProject(player, 0);
    return { x: point.x, y: point.y - (lift?.position ?? 0) * cafeLift.rise };
  }
  return cafeProject(player, player.floor);
}

export function cafeFloorPoint(point: { x: number; y: number }, floor: number): FloorPoint {
  const span = floor === 1 ? 822 : 958;
  const x = Math.max(25, Math.min(layout.threshold, layout.threshold - ((point.x - 350) / span) * 720));
  const baseline = cafeProject({ x, depth: 0 }, floor).y;
  const front = floor === 1 ? (x < 450 ? 0.42 : 0.65) : 0.85;
  return { x, depth: Math.max(0.09, Math.min(front, (point.y - baseline) / (floor === 1 ? 68 : 180))) };
}

export const cafeDoorClearance = (point: FloorPoint) =>
  Math.min(1, ((Math.abs(cafeProject(point, 0).x - (cafeLift.left + cafeLift.right) / 2) + 30) * 2) / (cafeLift.right - cafeLift.left));

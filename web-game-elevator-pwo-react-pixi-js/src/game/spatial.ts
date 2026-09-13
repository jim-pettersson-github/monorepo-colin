import { type FloorPoint, type GameState, isOpen, layout, type Player } from './model';

export const roomSpace = { width: 1448, height: 1086, sill: 640, front: 1040 };
export const portal = { left: 720, right: 1063, top: 158, bottom: 636 };
export const cabinPanel = { x: 921, top: 284, spacing: 53, radius: 20 };
export const gateLever = { x: 1104, y: 433, width: 58, height: 108 };
export const cabinDoorButton = (target: 0 | 1) => ({ x: cabinPanel.x + 2 * cabinPanel.spacing, y: cabinPanel.top + (1 - target) * cabinPanel.spacing });
export const cabinButton = (floor: number) => ({
  x: cabinPanel.x + (floor % 2) * cabinPanel.spacing,
  y: cabinPanel.top + Math.floor(floor / 2) * cabinPanel.spacing,
});
export const depthScale = (depth: number) => 0.7 + depth * 0.6;
export const projectPoint = (point: FloorPoint) => ({ x: 724 + (point.x - 629) * 1.21 * depthScale(point.depth), y: roomSpace.sill + point.depth * 400 });
export function floorPoint(x: number, y: number): FloorPoint {
  const depth = Math.max(0.07, Math.min(0.97, (y - roomSpace.sill) / 400));
  return { x: Math.max(25, Math.min(layout.width - 30, 629 + (Math.max(130, Math.min(1280, x)) - 724) / (1.21 * depthScale(depth)))), depth };
}
export const atThreshold = (point: FloorPoint, distance = 0.065) => Math.abs(point.depth) < distance && Math.abs(point.x - layout.threshold) < 65;
export function doorClearance(point: FloorPoint, gate = false) {
  const x = projectPoint(point).x;
  const width = portal.right - portal.left;
  return Math.min(1, gate ? 1 - (x - portal.left - 56) / width : ((Math.abs(x - (portal.left + portal.right) / 2) + 56) * 2) / width);
}
export const defaultDepth = (x: number) => (x > layout.threshold + 20 ? -0.18 : Math.abs(x - layout.threshold) < 25 ? 0 : 0.3);

export function setWalkTarget(player: Player, target: FloorPoint) {
  player.targetX = target.x;
  player.targetDepth = target.depth;
  player.waypoints = [];
  if (player.place === 'outside') return;
  if (player.depth < 0 && target.depth >= 0) player.waypoints.push({ x: layout.threshold, depth: player.depth }, { x: layout.threshold, depth: 0.14 });
  if (player.depth >= 0 && target.depth < 0) player.waypoints.push({ x: layout.threshold, depth: 0.14 }, { x: layout.threshold, depth: 0 });
}

export function movePoint(point: FloorPoint, target: FloorPoint, amount: number) {
  const distance = Math.hypot(target.x - point.x, (target.depth - point.depth) * 500);
  const part = Math.min(1, amount / Math.max(distance, 0.001));
  return { x: point.x + (target.x - point.x) * part, depth: point.depth + (target.depth - point.depth) * part };
}

export function movePlayer(state: GameState, amount: number) {
  const player = state.player;
  if (player.targetX === null || player.targetDepth === null) return false;
  const target = player.waypoints[0] ?? { x: player.targetX, depth: player.targetDepth };
  const next = movePoint(player, target, amount);
  const lift = state.buildings.find((b) => b.id === player.place)?.lift;
  if (lift) {
    const crossing = (player.depth >= 0 && next.depth < 0.08) || (player.depth < 0 && next.depth > -0.08);
    if (crossing && Math.abs(next.x - layout.threshold) < 85 && !(isOpen(lift) && (player.riding || lift.position === player.floor))) {
      const partlyOpen = lift.destination === null && lift.position === player.floor && Math.min(lift.landing.open, lift.gate.open) > 0.15;
      next.depth = player.depth >= 0 ? Math.max(next.depth, partlyOpen ? 0.025 : 0.085) : Math.min(next.depth, -0.085);
    }
    player.riding = next.depth < -0.035;
  }
  player.x = next.x;
  player.depth = next.depth;
  if (Math.abs(next.x - target.x) > 0.01 || Math.abs(next.depth - target.depth) > 0.001) return false;
  if (player.waypoints.length) {
    player.waypoints.shift();
    return false;
  }
  return true;
}

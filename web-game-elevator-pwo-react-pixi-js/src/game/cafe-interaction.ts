import { cafeButton, cafeCall, cafeDoorButton, cafeFloorPoint, cafeLift, cafeProject, cafeSpace } from './cafe-spatial';
import { type Command, currentBuilding, type GameState, layout } from './model';

export function cafeAction(state: GameState, point: { x: number; y: number }): Command | null {
  const { x, y } = point;
  if (x < 0 || x > cafeSpace.width || y < 0 || y > cafeSpace.height) return null;
  const building = currentBuilding(state);
  if (!building) return null;
  const { player } = state;
  const { lift } = building;
  const floor = y < 430 ? 1 : 0;
  const route = (target: { x: number; depth: number }): Command => ({ type: 'walk', floor, ...target });
  const local = !player.stairs && floor === (player.riding ? Math.round(lift.position) : player.floor);
  const atCabin = x > cafeLift.left && x < cafeLift.right && y > cafeLift.top - floor * cafeLift.rise && y < cafeLift.sill - floor * cafeLift.rise;
  const inMovingCabin =
    x > cafeLift.left && x < cafeLift.right && y > cafeLift.top - lift.position * cafeLift.rise && y < cafeLift.sill - lift.position * cafeLift.rise - 30;
  if (inMovingCabin && player.riding) {
    if (lift.destination !== null) return { type: 'panel' };
    for (const target of [0, 1] as const) {
      const button = cafeDoorButton(target, lift.position);
      if (Math.hypot(x - button.x, y - button.y) < 24) return { type: 'landing', target };
    }
    for (const target of [0, 1]) {
      const button = cafeButton(target, lift.position);
      if (Math.hypot(x - button.x, y - button.y) < 24) return { type: 'floor', floor: target };
    }
    return { type: 'panel' };
  }
  const call = cafeCall(floor);
  if (Math.abs(x - call.x) < 28 && Math.abs(y - call.y) < 35) return local ? { type: 'call' } : route({ x: 710, depth: 0.025 });
  if (x > 477 && x < 518 && Math.abs(y - (call.y + 8)) < 32) return local ? { type: 'light' } : route({ x: 675, depth: 0.025 });
  if (x > 475 && x < 520 && y > call.y - 112 && y < call.y - 44) return local ? { type: 'alarm' } : route({ x: 675, depth: 0.025 });
  if (Math.abs(x - call.x) < 28 && y > call.y - 109 && y < call.y - 58) return local ? { type: 'sign' } : route({ x: 710, depth: 0.025 });
  const sill = cafeLift.sill + (x - cafeLift.left) * cafeLift.slope - floor * cafeLift.rise;
  if (x > cafeLift.left && x < cafeLift.right && Math.abs(y - sill) < 23) return local ? { type: 'threshold' } : route({ x: 750, depth: 0.2 });
  if (atCabin) return local ? { type: 'board' } : route({ x: 750, depth: 0.2 });
  if (x > 1385 && y > 440 && y < 850) return local ? { type: 'exit' } : route({ x: 30, depth: 0.3 });
  // The visible stair flight connects both floor planes; tapping it traverses one flight.
  if (x > 1070 && x < 1385 && y > 280 && y < 800) {
    if (player.stairs) return { type: 'walk', floor: player.stairs.to, x: layout.stairs, depth: 0.025 };
    return { type: 'stairs', direction: player.floor === 0 ? 1 : -1 };
  }
  for (const person of building.people) {
    if (person.phase !== 'idle' || person.floor !== floor) continue;
    const feet = cafeProject(person, floor);
    if (Math.abs(x - feet.x) < 40 && y < feet.y && y > feet.y - 220) return local ? { type: 'invite', id: person.id } : route(person);
  }
  if (
    floor === 0 &&
    [
      [990, 854, 133, 97],
      [600, 966, 205, 99],
      [290, 1010, 212, 88],
    ].some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1)
  )
    return null;
  // Exclude back walls/counter. Upper-floor clicks never turn into lower-floor movement.
  if ((floor === 1 && x > 255 && x < 1070 && y > 220 && y < 395) || (floor === 0 && y > 710)) return route(cafeFloorPoint(point, floor));
  return null;
}

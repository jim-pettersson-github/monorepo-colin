import { buildings, type Command, currentBuilding, type GameState, isOpen, layout } from './model';
import { actorBounds } from './room-art';
import { cabinPanel, floorPoint, portal, roomSpace } from './spatial';

export function roomAction(state: GameState, point: { x: number; y: number }, floor: number): Command | null {
  const { x, y } = point;
  if (x < 0 || x > roomSpace.width || y < 0 || y > roomSpace.height) return null;
  const player = state.player;
  if (player.place === 'outside') {
    const index = Math.floor((x - 120) / 430);
    if (y > 245 && y < 655 && index >= 0 && index < 3) return { type: 'enter', building: buildings[index].id };
    if (y < 655) return null;
    const target = floorPoint(x, y);
    return { type: 'walk', x: Math.max(20, Math.min(layout.outsideWidth - 20, (target.x - 180) / 1.36)), depth: target.depth };
  }
  const building = currentBuilding(state);
  if (!building) return null;
  const cabin = x > portal.left && x < portal.right && y > portal.top && y < 610;
  if (player.riding && floor === Math.round(building.lift.position) && cabin) {
    for (let button = 0; button < 3; button++)
      if (isOpen(building.lift) && Math.hypot(x - cabinPanel.x, y - cabinPanel.top - button * cabinPanel.spacing) < cabinPanel.radius + 6)
        return { type: 'floor', floor: button };
    return { type: 'panel' };
  }
  const target = floorPoint(x, y);
  if (floor !== (player.riding ? Math.round(building.lift.position) : player.floor) || player.stairs) return { type: 'walk', floor, ...target };
  for (const person of building.people.filter((p) => p.floor === floor && p.phase === 'idle').sort((a, b) => b.depth - a.depth)) {
    const bounds = actorBounds(person);
    if (Math.abs(x - bounds.x) < 45 && y > bounds.y - bounds.height - 38 && y < bounds.y) return { type: 'invite', id: person.id };
  }
  if (cabin) return { type: player.riding ? 'panel' : 'board' };
  if (x > portal.left && x < portal.right && Math.abs(y - roomSpace.sill) < 28) return { type: 'threshold' };
  if (x > 625 && x < 684 && y > 378 && y < 477) return { type: 'call' };
  if (x > 543 && x < 615 && y > 370 && y < 470) return { type: 'light' };
  if (x > 445 && x < 530 && y > 257 && y < 372) return { type: 'alarm' };
  if (x > 620 && x < 691 && y > 270 && y < 350) return { type: 'sign' };
  if (x > 1150 && x < 1300 && y > 220 && y < 690) return { type: floor === 0 ? 'exit' : 'roomDoor' };
  if (x > 145 && x < 423 && y > 70 && y < 635) return { type: 'stairs', direction: floor === 2 ? -1 : 1 };
  if (y >= 655) return { type: 'walk', floor, ...target };
  return null;
}

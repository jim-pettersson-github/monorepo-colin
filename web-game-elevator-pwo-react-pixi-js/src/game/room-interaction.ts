import { buildings, type Command, currentBuilding, floorCount, floors, type GameState, isOpen, layout, validFloor } from './model';
import { actorBounds } from './room-art';
import { cabinButton, cabinDoorButton, cabinPanel, floorPoint, gateLever, portal, roomSpace } from './spatial';

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
  if (!building || !validFloor(building.id, floor)) return null;
  const cabin = x > portal.left && x < portal.right && y > portal.top && y < 610;
  if (player.riding && floor === Math.round(building.lift.position) && cabin) {
    const panelVisible = building.lift.destination === null && (isOpen(building.lift) || building.id === 'house');
    for (const target of [1, 0] as const) {
      const center = cabinDoorButton(target);
      if (panelVisible && Math.hypot(x - center.x, y - center.y) < cabinPanel.radius + 6) return { type: 'landing', target };
    }
    for (const button of floors(building.id)) {
      const center = cabinButton(button);
      if (panelVisible && Math.hypot(x - center.x, y - center.y) < cabinPanel.radius + 6) return { type: 'floor', floor: button };
    }
    return { type: 'panel' };
  }
  const target = floorPoint(x, y);
  if (floor !== (player.riding ? Math.round(building.lift.position) : player.floor) || player.stairs) return { type: 'walk', floor, ...target };
  if (building.id === 'house' && Math.abs(x - gateLever.x) < gateLever.width / 2 && Math.abs(y - gateLever.y) < gateLever.height / 2) return { type: 'gate' };
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
  if (floor === 0 && x > 1150 && x < 1300 && y > 220 && y < 690) return { type: 'exit' };
  if (x > 145 && x < 423 && y > 70 && y < 635) return { type: 'stairs', direction: floor === floorCount(building.id) - 1 ? -1 : 1 };
  if (y >= 655) return { type: 'walk', floor, ...target };
  return null;
}

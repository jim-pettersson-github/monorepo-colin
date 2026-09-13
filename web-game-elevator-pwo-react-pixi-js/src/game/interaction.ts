import { buildings, type Command, currentBuilding, floorY, type GameState, layout, roomDoorX } from './model';

export function worldAction(state: GameState, point: { x: number; y: number }): Command | null {
  if (state.player.place === 'outside') {
    if (point.y < floorY(0) + 5 && point.y > floorY(0) - 330) {
      const index = Math.max(0, Math.min(2, Math.floor(point.x / 250)));
      return { type: 'enter', building: buildings[index].id };
    }
    return { type: 'walk', x: point.x };
  }
  const floor = Math.floor((layout.ground + 40 - point.y) / layout.floorHeight);
  if (floor < 0 || floor > 2 || point.x < 0 || point.x > layout.width) return null;
  const lift = currentBuilding(state)?.lift;
  // During a ride, keep the current cabin's own panel interactive.
  if (state.player.riding && lift && point.x > layout.threshold + 20 && point.y > floorY(lift.position) - 225 && point.y < floorY(lift.position) + 5)
    return { type: 'panel' };
  if (floor !== state.player.floor || state.player.stairs || (state.player.riding && lift?.destination !== null)) return { type: 'walk', floor, x: point.x };
  const y = point.y - floorY(floor);
  const person = currentBuilding(state)?.people.find(
    (person) => person.phase === 'idle' && person.floor === floor && Math.abs(person.x - point.x) < 30 && y < 5 && y > -205,
  );
  if (point.x < 175 && y < -25) return { type: 'stairs', direction: floor === 2 ? -1 : 1 };
  if (person) return { type: 'invite', id: person.id };
  if (floor === 0 && point.x >= 183 && point.x <= 248 && y < -25 && y > -198) return { type: 'exit' };
  if (point.x >= layout.threshold - 25 && point.x <= layout.threshold + 20 && y > -70) return { type: 'threshold' };
  if (point.x > layout.threshold + 20 && y < 5 && y > -225) return { type: state.player.riding ? 'panel' : 'board' };
  if (Math.abs(point.x - 625) < 35 && y < -70 && y > -150) return { type: 'light' };
  if (Math.abs(point.x - 765) < 32 && y < -140 && y > -215) return { type: 'sign' };
  if (Math.abs(point.x - 773) < 28 && y < -65 && y > -140) return { type: 'call' };
  if (Math.abs(point.x - 703) < 31 && y < -60 && y > -205) return { type: 'alarm' };
  if (point.x > roomDoorX(floor) && point.x < roomDoorX(floor) + (floor === 0 ? 65 : 81) && y < -30 && y > -165) return { type: 'roomDoor' };
  return { type: 'walk', x: point.x, floor };
}

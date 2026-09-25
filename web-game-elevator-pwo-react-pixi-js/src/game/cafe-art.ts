import { type Graphics, Rectangle, Texture } from 'pixi.js';
import { worldPalette as p } from '../palette';
import { cafeButton, cafeCall, cafeDoorButton, cafeLift, cafePlayerFeet, cafeProject, cafeSpace } from './cafe-spatial';
import { type ColinIdle, colinIdleFrame } from './colin-idle';
import { currentBuilding, type FloorPoint, floorLabel, type GameState } from './model';
import type { PaintedAssets } from './painted-assets';
import { drawDigit } from './room-details';
import type { SimulationUI } from './simulation';

const fixedFrames = new WeakMap<Texture, Array<{ texture: Texture; x: number; y: number; width: number; height: number }>>();
const exitSigns = new WeakMap<Texture, Texture>();
function shaftFrames(texture: Texture) {
  let frames = fixedFrames.get(texture);
  if (!frames) {
    frames = [
      [214, 0, 39, 850],
      [448, 0, 23, 803],
      [118, 0, 22, 786],
    ].map(([x, y, width, height]) => ({
      texture: new Texture({ source: texture.source, frame: new Rectangle(x, y, width, height) }),
      x,
      y,
      width,
      height,
    }));
    fixedFrames.set(texture, frames);
  }
  return frames;
}

function glass(g: Graphics, left: number, right: number, top: number, bottom: number, alpha = 0.1) {
  const skew = (x: number) => (x - cafeLift.left) * cafeLift.slope;
  g.poly([left, top + skew(left), right, top + skew(right), right, bottom + skew(right), left, bottom + skew(left)])
    .fill({ color: p.cafeGlass, alpha })
    .stroke({ color: p.cafeBronze, width: 2 });
  g.moveTo(left + 5, top + skew(left) + 12)
    .lineTo(left + 5, bottom + skew(left) - 9)
    .stroke({ color: p.surface, alpha: 0.5, width: 1 });
  if (right - left > 25)
    g.moveTo(left + 12, top + 65)
      .lineTo(Math.min(right - 8, left + 35), top + 35)
      .stroke({ color: p.surface, alpha: 0.22, width: 3 });
}

function doors(g: Graphics, level: number, opening: number) {
  const { left, right, top, sill, rise } = cafeLift;
  const width = ((right - left) / 2) * (1 - opening);
  if (width < 0.2) return;
  glass(g, left, left + width, top - level * rise, sill - level * rise);
  glass(g, right - width, right, top - level * rise, sill - level * rise);
}

function drawActor(
  g: Graphics,
  assets: PaintedAssets,
  feet: { x: number; y: number },
  height: number,
  time: number,
  walking: boolean,
  colin: boolean,
  facing: number,
  reaching = false,
  idle?: ColinIdle,
) {
  const rest = colinIdleFrame(colin && !walking && !reaching ? idle : undefined);
  const frame = walking ? [1, 2, 3, 2][Math.floor(time * 7) % 4] : 0;
  const key: keyof PaintedAssets = colin
    ? reaching
      ? 'reach'
      : rest.pose !== 'standing'
        ? `colin-${rest.pose}`
        : `colin-${frame as 0 | 1 | 2 | 3}`
    : 'passenger-0';
  const texture = assets[key];
  const poseHeight = height * rest.height;
  const width = (poseHeight * texture.width) / texture.height;
  g.ellipse(feet.x, feet.y + 2, height * 0.09, height * 0.023).fill({ color: p.ink, alpha: 0.2 });
  g.save()
    .setFillStyle({ color: 'white', alpha: 1 })
    .setTransform(facing, 0, rest.tilt, 1, feet.x, feet.y - height * rest.lift)
    .texture(texture, 'white', -width * (reaching ? 0.35 : 0.5), -poseHeight, width, poseHeight)
    .restore();
}

export function drawCafe(g: Graphics, state: GameState, ui: SimulationUI, assets: PaintedAssets) {
  g.clear().setFillStyle({ color: 'white', alpha: 1 });
  g.texture(assets['room-cafe'], 'white', 0, 0, cafeSpace.width, cafeSpace.height);
  const building = currentBuilding(state);
  if (!building) return;
  const { lift } = building;
  const { player } = state;
  const offset = lift.position * cafeLift.rise;

  // One moving glass cabin, visible throughout its journey inside the two-storey shaft.
  g.poly([149, 485 - offset, 258, 548 - offset, 258, 824 - offset, 149, 761 - offset])
    .fill({ color: p.cafeGlass, alpha: 0.1 })
    .stroke({ color: p.cafeBronze, width: 3 });
  glass(g, 258, 417, 548 - offset, 824 - offset, 0.06);
  g.poly([151, 761 - offset, 258, 824 - offset, 417, 795 - offset, 310, 733 - offset])
    .fill({ texture: assets.marble, textureSpace: 'local' })
    .stroke({ color: p.cafeBronze, width: 3 });
  g.poly([151, 485 - offset, 258, 548 - offset, 417, 519 - offset, 310, Math.max(0, 457 - offset)])
    .fill({ color: p.cafeGlass, alpha: 0.13 })
    .stroke({ color: p.cafeBronze, width: 3 });
  g.moveTo(270, 724 - offset)
    .lineTo(400, 701 - offset)
    .stroke({ color: p.cafeBronze, width: 4 });
  g.moveTo(270, 722 - offset)
    .lineTo(400, 699 - offset)
    .stroke({ color: p.surface, alpha: 0.5, width: 1 });
  g.roundRect(354, 588 - offset, 47, 93, 4)
    .fill({ color: p.cafeBronze, alpha: 0.9 })
    .stroke({ color: p.trim, width: 2 });
  for (const floor of [0, 1]) {
    const point = cafeButton(floor, lift.position);
    const selected = lift.destination === floor || lift.queue.includes(floor);
    g.circle(point.x, point.y, 17)
      .fill(selected ? p.light : p.indicatorDark)
      .stroke({ color: p.cafeBronze, width: 2 });
    drawDigit(g, floorLabel(floor), point.x - 4, point.y - 9, 18, selected ? p.ink : p.surface, 2);
  }
  for (const target of [0, 1] as const) {
    const point = cafeDoorButton(target, lift.position);
    g.roundRect(point.x - 22, point.y - 17, 44, 34, 5)
      .fill(p.indicatorDark)
      .stroke({ color: p.cafeBronze, width: 2 });
    for (const side of [-1, 1]) {
      const direction = side * (target ? 1 : -1);
      const x = point.x + side * 9;
      g.moveTo(x - direction * 5, point.y - 6)
        .lineTo(x + direction * 3, point.y)
        .lineTo(x - direction * 5, point.y + 6)
        .stroke({ color: p.surface, width: 2 });
    }
  }

  const reaching = ui.reach?.building === 'cafe' && ui.reach.type === 'call';
  const next = player.waypoints[0] ?? { x: player.targetX ?? player.x, depth: player.targetDepth ?? player.depth };
  const colin = () =>
    drawActor(
      g,
      assets,
      cafePlayerFeet(state),
      190 + Math.max(0, player.depth) * 26,
      state.time,
      player.targetX !== null || !!player.stairs,
      true,
      reaching || next.x > player.x ? -1 : 1,
      reaching,
      ui.idle,
    );
  const personFeet = (point: FloorPoint, floor: number, riding: boolean) => {
    const feet = cafeProject(point, riding ? 0 : floor);
    if (riding) feet.y -= offset;
    return feet;
  };
  const personDraw = (person: (typeof building.people)[number]) => {
    const feet = personFeet(person, person.floor, person.phase === 'riding' || person.depth < -0.035);
    drawActor(g, assets, feet, 214 + Math.max(0, person.depth) * 20, state.time, !['idle', 'riding', 'away'].includes(person.phase), false, 1);
    if (['idle', 'waiting', 'riding'].includes(person.phase)) {
      g.roundRect(feet.x - 17, feet.y - 251, 34, 31, 9).fill(p.surface);
      drawDigit(g, floorLabel(person.wanted), feet.x - 5, feet.y - 245, 20, p.ink, 2);
    }
  };
  for (const person of building.people.filter((person) => person.phase !== 'away' && person.depth < -0.035)) personDraw(person);
  if (player.riding) colin();
  if (lift.destination !== null) doors(g, lift.position, 0);
  for (const floor of [0, 1]) doors(g, floor, lift.destination === null && lift.position === floor ? lift.landing.open : 0);
  // Fixed shaft columns remain in front of the moving cabin and its occupants.
  for (const frame of shaftFrames(assets['room-cafe'])) {
    g.setFillStyle({ color: 'white', alpha: 1 }).texture(frame.texture, 'white', frame.x, frame.y, frame.width, frame.height);
  }

  for (const floor of [0, 1]) {
    const call = cafeCall(floor);
    g.roundRect(call.x - 15, call.y - 46, 30, 66, 3)
      .fill(p.cafeBronze)
      .stroke({ color: p.trim, width: 1 });
    drawDigit(g, floorLabel(floor), call.x - 5, call.y - 37, 20, p.ink, 2.5);
    const lit = lift.queue.includes(floor) || lift.destination === floor || (reaching && player.floor === floor);
    g.circle(call.x, call.y, 10)
      .fill(lit ? p.light : p.surface)
      .stroke({ color: p.ink, width: 2 });
    g.roundRect(483, call.y - 13, 30, 44, 4).fill(p.cafeBronze);
    g.roundRect(490, call.y - 6, 16, 30, 3).fill(building.lights[floor] ? p.surface : p.wall);
    g.poly([call.x, call.y - 104, call.x - 19, call.y - 70, call.x + 19, call.y - 70])
      .fill(p.light)
      .stroke({ color: p.ink, width: 2 });
    g.moveTo(call.x, call.y - 94)
      .lineTo(call.x, call.y - 83)
      .stroke({ color: p.ink, width: 3 });
    g.circle(call.x, call.y - 77, 1.8).fill(p.ink);
    g.roundRect(481, call.y - 109, 34, 60, 3)
      .fill(p.accent)
      .stroke({ color: p.trim, width: 1 });
    g.poly([493, call.y - 82, 488, call.y - 90, 496, call.y - 106, 497, call.y - 95, 503, call.y - 100, 508, call.y - 89, 503, call.y - 82]).fill(p.surface);
    g.rect(486, call.y - 77, 24, 20)
      .fill(p.surface)
      .stroke({ color: p.ink, width: 1 });
    g.moveTo(489, call.y - 66)
      .lineTo(507, call.y - 66)
      .stroke({ color: p.ink, width: 2 });
    g.circle(498, call.y - 66, 3).fill(ui.alarmRemaining > 0 && player.floor === floor ? p.light : p.accent);
  }
  const actors: Array<{ y: number; draw: () => void }> = building.people
    .filter((person) => person.phase !== 'away' && person.depth >= -0.035)
    .map((person) => ({ y: cafeProject(person, person.floor).y, draw: () => personDraw(person) }));
  if (!player.riding) actors.push({ y: cafePlayerFeet(state).y, draw: colin });
  for (const actor of actors.sort((a, b) => a.y - b.y)) actor.draw();

  for (const floor of [0, 1]) {
    if (!building.lights[floor])
      g.rect(0, floor === 1 ? 0 : 430, cafeSpace.width, floor === 1 ? 430 : cafeSpace.height - 430).fill({ color: p.ink, alpha: 0.48 });
  }
  if (!building.lights[0]) {
    let sign = exitSigns.get(assets['room-cafe']);
    if (!sign) {
      sign = new Texture({ source: assets['room-cafe'].source, frame: new Rectangle(1040, 414, 37, 41) });
      exitSigns.set(assets['room-cafe'], sign);
    }
    g.setFillStyle({ color: 'white', alpha: 1 }).texture(sign, 'white', 1040, 414, 37, 41);
  }
  const target =
    player.route ?? (player.targetX !== null && player.targetDepth !== null ? { x: player.targetX, depth: player.targetDepth, floor: player.floor } : null);
  if (target) {
    const point = cafeProject(target, target.floor);
    g.ellipse(point.x, point.y, 10, 4).stroke({ color: p.surface, width: 2 });
  }
}

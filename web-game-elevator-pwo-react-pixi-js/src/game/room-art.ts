import { type Graphics, Rectangle, Texture } from 'pixi.js';
import { worldPalette as p } from '../palette';
import { currentBuilding, type FloorPoint, type GameState, layout, type Passenger, playerLevel } from './model';
import type { PaintedAssets } from './painted-assets';
import type { SimulationUI } from './simulation';
import { atThreshold, cabinPanel, depthScale, portal, projectPoint, roomSpace } from './spatial';

const signs = new WeakMap<Texture, Texture>();
function glowingSign(texture: Texture) {
  let sign = signs.get(texture);
  if (!sign) {
    sign = new Texture({ source: texture.source, frame: new Rectangle(232, 56, 122, 70) });
    signs.set(texture, sign);
  }
  return sign;
}

export function actorBounds(point: FloorPoint, colin = false) {
  const feet = projectPoint(point);
  return { ...feet, height: (colin ? 400 : 470) * depthScale(point.depth) };
}

function actor(
  g: Graphics,
  assets: PaintedAssets,
  point: FloorPoint,
  time: number,
  walking: boolean,
  colin: boolean,
  id: number,
  facing: number,
  reach: boolean,
  away: boolean,
) {
  const { x, y, height } = actorBounds(point, colin);
  const frame = walking ? [1, 2, 3, 2][Math.floor(time * 7) % 4] : 0;
  const key: keyof PaintedAssets = colin ? (reach ? 'reach' : away ? 'colin-back' : `colin-${frame as 0 | 1 | 2 | 3}`) : `passenger-${(id % 3) as 0 | 1 | 2}`;
  const texture = assets[key];
  const width = (height * texture.width) / texture.height;
  const bob = walking ? Math.sin(time * 12) * 1.4 : 0;
  g.ellipse(x, y + 3, height * 0.08, height * 0.023).fill({ color: p.ink, alpha: 0.25 });
  g.save()
    .setFillStyle({ color: 'white', alpha: 1 })
    .setTransform(facing, 0, 0, 1, x, y + bob)
    .texture(texture, 'white', -width * (reach ? 0.35 : 0.5), -height, width, height)
    .restore();
}

export function drawRoom(g: Graphics, state: GameState, ui: SimulationUI, assets: PaintedAssets, floor: number) {
  g.clear();
  const building = currentBuilding(state);
  if (!building) return;
  const texture = assets[`room-${building.id}`];
  g.texture(texture, 'white', 0, 0, roomSpace.width, roomSpace.height);
  const lift = building.lift;
  const player = state.player;
  const playerHere = Math.round(playerLevel(state)) === floor;
  const carHere = lift.destination === null && lift.position === floor;
  const reach = ui.reach?.building === building.id && ui.reach.floor === floor ? ui.reach : null;

  if (building.roomDoors[floor]) {
    g.rect(1166, 244, 108, 399).fill(p.ink);
    g.rect(1180, 278, 74, 330).fill({ texture: assets['outside-sky'], textureSpace: 'local' });
    g.rect(1165, 244, 18, 402).fill({ texture: assets.wood, textureSpace: 'local' });
  }
  // The independent light switch is a painted brass plate and an ivory rocker.
  g.roundRect(560, 393, 34, 57, 4).fill({ texture: assets.brass, textureSpace: 'local' }).stroke({ color: p.frame, width: 2 });
  g.roundRect(568, 405, 18, 32, 3)
    .fill(building.lights[floor] ? p.surface : p.wall)
    .stroke({ color: p.trim, width: 2 });
  g.moveTo(570, building.lights[floor] ? 430 : 410)
    .lineTo(584, building.lights[floor] ? 430 : 410)
    .stroke({ color: p.ink, width: 2 });
  // A warning plaque remains separate from the fire call point.
  g.poly([653, 285, 680, 334, 626, 334]).fill({ texture: assets.brass, textureSpace: 'local' }).stroke({ color: p.ink, width: 3 });
  g.moveTo(653, 300).lineTo(653, 317).stroke({ color: p.ink, width: 4 });
  g.circle(653, 325, 2.5).fill(p.ink);

  // Back-wall controls belong behind the occupants and sliding door leaves.
  g.roundRect(cabinPanel.x - 44, 248, 88, 185, 8).fill({ color: p.ink, alpha: 0.45 });
  g.roundRect(cabinPanel.x - 40, 244, 80, 185, 7)
    .fill({ texture: assets.brass, textureSpace: 'local' })
    .stroke({ color: p.frame, width: 3 });
  for (const screwY of [253, 420])
    for (const screwX of [-30, 30]) {
      g.circle(cabinPanel.x + screwX, screwY, 2.5).fill(p.frame);
      g.moveTo(cabinPanel.x + screwX - 1.5, screwY)
        .lineTo(cabinPanel.x + screwX + 1.5, screwY)
        .stroke({ color: p.light, width: 1 });
    }
  for (let button = 0; button < 3; button++) {
    const x = cabinPanel.x,
      y = cabinPanel.top + button * cabinPanel.spacing;
    const lit = lift.queue.includes(button) || lift.destination === button;
    g.circle(x, y, cabinPanel.radius + 3)
      .fill(p.frame)
      .stroke({ color: p.light, width: 1 });
    g.circle(x, y, cabinPanel.radius)
      .fill(lit ? p.light : p.ink)
      .stroke({ color: lit ? p.surface : p.trim, width: 2 });
    const style = { color: lit ? p.ink : p.surface, width: 3 };
    if (button === 0) g.roundRect(x - 5, y - 8, 10, 16, 5).stroke(style);
    if (button === 1)
      g.moveTo(x - 4, y - 5)
        .lineTo(x + 1, y - 8)
        .lineTo(x + 1, y + 8)
        .moveTo(x - 5, y + 8)
        .lineTo(x + 6, y + 8)
        .stroke(style);
    if (button === 2)
      g.moveTo(x - 6, y - 5)
        .bezierCurveTo(x - 4, y - 12, x + 9, y - 9, x + 5, y - 2)
        .lineTo(x - 6, y + 8)
        .lineTo(x + 7, y + 8)
        .stroke(style);
  }

  const visible = building.people.filter(
    (person) => person.phase !== 'away' && (person.phase === 'riding' ? Math.round(lift.position) : person.floor) === floor,
  );
  const drawPerson = (person: Passenger) =>
    actor(
      g,
      assets,
      person,
      state.time,
      ['waiting', 'boarding', 'leaving', 'returning'].includes(person.phase),
      false,
      person.id,
      ['leaving', 'returning'].includes(person.phase) ? -1 : 1,
      false,
      person.phase === 'boarding',
    );
  const drawColin = () => {
    const next = player.waypoints[0] ?? { x: player.targetX ?? player.x, depth: player.targetDepth ?? player.depth };
    const point = player.stairs ? { x: layout.stairs, depth: 0.025 - Math.sin((player.stairs.elapsed / 3) * Math.PI) * 0.09 } : player;
    actor(
      g,
      assets,
      point,
      state.time,
      player.targetX !== null || !!player.stairs,
      true,
      0,
      reach ? 1 : next.x < player.x ? -1 : 1,
      reach?.type === 'call',
      next.depth < player.depth,
    );
  };
  for (const person of visible.filter((p) => p.depth < -0.035).sort((a, b) => a.depth - b.depth)) drawPerson(person);
  if (playerHere && player.depth < -0.035) drawColin();

  const opening = carHere ? lift.landing.open : 0;
  const half = (portal.right - portal.left) / 2;
  const doorTexture = building.id === 'mall' ? assets.glass : assets.brass;
  for (const side of [-1, 1]) {
    const width = half * (1 - opening);
    const x = side < 0 ? portal.left : portal.right - width;
    if (width > 0) {
      g.rect(x, portal.top, width, portal.bottom - portal.top).fill({ texture: doorTexture, textureSpace: 'local' });
      g.rect(x + (side < 0 ? Math.max(0, width - 5) : 0), portal.top, Math.min(width, 5), portal.bottom - portal.top).fill(p.frame);
    }
  }
  if (building.id === 'house' && carHere) {
    const width = (portal.right - portal.left) * (1 - lift.gate.open);
    for (let i = 0; i < 8 && width > 1; i++) {
      const x = portal.left + (width / 8) * i;
      g.poly([x, 175, x + width / 8, 397, x, 625], false).stroke({ color: p.ink, width: 5 });
      g.poly([x + width / 8, 175, x, 397, x + width / 8, 625], false).stroke({ color: p.light, width: 2 });
    }
  }
  if (!building.lights[floor]) g.rect(0, 0, roomSpace.width, roomSpace.height).fill({ color: p.ink, alpha: 0.57 });
  g.texture(glowingSign(texture), 'white', 232, 56, 122, 70);
  const outsideActors: Array<{ depth: number; draw: () => void }> = visible
    .filter((p) => p.depth >= -0.035)
    .map((person) => ({ depth: person.depth, draw: () => drawPerson(person) }));
  if (playerHere && player.depth >= -0.035) outsideActors.push({ depth: player.depth, draw: drawColin });
  for (const item of outsideActors.sort((a, b) => a.depth - b.depth)) item.draw();
  if (reach?.type === 'call' || lift.queue.includes(floor) || lift.destination === floor) {
    g.circle(654, 416, 13).fill({ color: p.light, alpha: 0.16 });
    g.circle(654, 416, 6).fill(p.light);
  }
  if (ui.alarmRemaining > 0 && floor === player.floor) g.circle(488, 329, 7).fill(p.light);
  if (playerHere && atThreshold(player)) g.ellipse(projectPoint(player).x, roomSpace.sill + 3, 42, 7).stroke({ color: p.light, width: 3 });
  for (const person of visible.filter((p) => ['idle', 'waiting', 'riding'].includes(p.phase))) {
    if (person.depth < 0 && opening < 0.95) continue;
    const bounds = actorBounds(person);
    g.roundRect(bounds.x - 20, bounds.y - bounds.height - 38, 40, 32, 12).fill(p.surface);
  }
  const target =
    player.route ?? (player.targetX !== null && player.targetDepth !== null ? { x: player.targetX, depth: player.targetDepth, floor: player.floor } : null);
  if (target && target.floor === floor) {
    const point = projectPoint(target);
    g.ellipse(point.x, point.y, 12, 5).stroke({ color: p.surface, width: 2 });
  }
}

export function drawStreet(g: Graphics, state: GameState, assets: PaintedAssets) {
  g.clear();
  g.texture(assets['outside-sky'], 'white', 0, 0, 1448, 700);
  g.rect(0, 650, 1448, 436).fill({ texture: assets.marble, textureSpace: 'local' });
  for (let i = 0; i < 3; i++) {
    const x = 120 + i * 430;
    g.rect(x, 245, 340, 410).fill({ texture: assets[`${(['hotel', 'mall', 'house'] as const)[i]}-wall`], textureSpace: 'local' });
    g.poly([x - 15, 245, x + 170, 155, x + 355, 245]).fill(p.frame);
    for (let j = 0; j < 3; j++)
      g.roundRect(x + 28 + j * 104, 305, 76, 100, 4)
        .fill({ texture: assets.glass, textureSpace: 'local' })
        .stroke({ color: p.light, width: 5 });
    g.roundRect(x + 119, 472, 102, 182, 5)
      .fill({ texture: assets.wood, textureSpace: 'local' })
      .stroke({ color: p.ink, width: 5 });
    g.circle(x + 203, 560, 5).fill(p.light);
  }
  const point = { x: 180 + state.player.x * 1.36, depth: state.player.depth };
  actor(g, assets, point, state.time, state.player.targetX !== null, true, 0, (state.player.targetX ?? state.player.x) < state.player.x ? -1 : 1, false, false);
}

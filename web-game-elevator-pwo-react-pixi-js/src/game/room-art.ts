import { type Graphics, Rectangle, Texture } from 'pixi.js';
import { worldPalette as p } from '../palette';
import { currentBuilding, type FloorPoint, floorLabel, floors, type GameState, layout, type Passenger, playerLevel, stairProgress } from './model';
import type { PaintedAssets } from './painted-assets';
import { drawDigit, drawFloorPlaque, drawIndicator } from './room-details';
import { drawFloorProps } from './room-props';
import type { SimulationUI } from './simulation';
import { atThreshold, cabinButton, cabinDoorButton, cabinPanel, depthScale, gateLever, portal, projectPoint, roomSpace } from './spatial';

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
  g.setFillStyle({ color: 'white', alpha: 1 });
  const building = currentBuilding(state);
  if (!building) return;
  const texture = assets[`room-${building.id}-${floor === 0 ? 'entry' : 'upper'}`];
  g.texture(texture, 'white', 0, 0, roomSpace.width, roomSpace.height);
  const lift = building.lift;
  const player = state.player;
  const playerHere = Math.round(playerLevel(state)) === floor;
  const carHere = lift.destination === null && lift.position === floor;
  const reach = ui.reach?.building === building.id && ui.reach.floor === floor ? ui.reach : null;

  drawFloorPlaque(g, floor);
  drawFloorProps(g, assets, building.id, floor);
  if (!carHere) g.rect(portal.left, portal.top, portal.right - portal.left, portal.bottom - portal.top).fill(p.indicatorDark);
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

  // The panel sits behind occupants and both independent door layers.
  if (carHere) {
    const rows = Math.ceil(floors(building.id).length / 2);
    const panelHeight = rows * cabinPanel.spacing + 18;
    g.roundRect(cabinPanel.x - 33, cabinPanel.top - 35, 172, panelHeight, 7)
      .fill({ texture: assets.brass, textureSpace: 'local' })
      .stroke({ color: p.frame, width: 3 });
    for (const button of floors(building.id)) {
      const { x, y } = cabinButton(button);
      const lit = lift.queue.includes(button) || lift.destination === button;
      g.circle(x, y, cabinPanel.radius + 3)
        .fill(p.frame)
        .stroke({ color: p.light, width: 1 });
      g.circle(x, y, cabinPanel.radius)
        .fill(lit ? p.light : p.ink)
        .stroke({ color: lit ? p.surface : p.trim, width: 2 });
      drawDigit(g, floorLabel(button), x - 5, y - 10, 20, lit ? p.ink : p.surface, 2.5);
    }
    for (const target of [1, 0] as const) {
      const { x, y } = cabinDoorButton(target);
      g.roundRect(x - 23, y - 23, 46, 46, 6)
        .fill(p.ink)
        .stroke({ color: p.trim, width: 2 });
      for (const side of [-1, 1]) {
        const direction = side * (target ? 1 : -1);
        const tip = x + side * 10 + direction * 5;
        g.moveTo(x + side * 10 - direction * 5, y)
          .lineTo(tip, y)
          .moveTo(tip - direction * 5, y - 6)
          .lineTo(tip, y)
          .lineTo(tip - direction * 5, y + 6)
          .stroke({ color: p.surface, width: 3 });
      }
      g.moveTo(x, y - 12)
        .lineTo(x, y + 12)
        .stroke({ color: p.trim, width: 2 });
    }
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
      ['waiting', 'boarding', 'leaving', 'returning', 'departing'].includes(person.phase),
      false,
      person.id,
      ['leaving', 'returning', 'departing'].includes(person.phase) ? -1 : 1,
      false,
      person.phase === 'boarding' || person.phase === 'departing',
    );
  const drawColin = () => {
    const next = player.waypoints[0] ?? { x: player.targetX ?? player.x, depth: player.targetDepth ?? player.depth };
    const point = player.stairs ? { x: layout.stairs, depth: 0.025 - Math.sin(stairProgress(player.stairs) * Math.PI) * 0.09 } : player;
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
  for (const person of visible.filter((p) => carHere && p.depth < -0.035).sort((a, b) => a.depth - b.depth)) drawPerson(person);
  if (carHere && playerHere && player.depth < -0.035) drawColin();

  const opening = carHere ? lift.landing.open : 0;
  const half = (portal.right - portal.left) / 2;
  const doorTexture = building.id === 'mall' ? assets.glass : assets.brass;
  for (const side of [-1, 1]) {
    const width = half * (1 - opening);
    const x = side < 0 ? portal.left : portal.right - width;
    if (width > 0) {
      if (building.id === 'house') {
        // A rigid barred landing grille slides clear; its latch stays in front of occupants.
        g.rect(x, portal.top, width, portal.bottom - portal.top).fill({ color: p.steel, alpha: 0.12 });
        for (let bar = 0; bar <= width; bar += 23) {
          g.rect(x + bar, portal.top, Math.min(6, width - bar), portal.bottom - portal.top).fill(p.steel);
          g.rect(x + bar, portal.top, Math.min(2, width - bar), portal.bottom - portal.top).fill(p.steelLight);
        }
        for (const y of [portal.top, 318, 474, portal.bottom - 8]) g.rect(x, y, width, 8).fill(p.steel);
        if (width > 30) g.roundRect(side < 0 ? x + width - 22 : x + 8, 393, 14, 43, 3).fill(p.steelLight);
      } else g.rect(x, portal.top, width, portal.bottom - portal.top).fill({ texture: doorTexture, textureSpace: 'local' });
      g.rect(x + (side < 0 ? Math.max(0, width - 5) : 0), portal.top, Math.min(width, 5), portal.bottom - portal.top).fill(p.frame);
    }
  }
  if (building.id === 'house' && carHere) {
    const width = (portal.right - portal.left) * (1 - lift.gate.open);
    for (let i = 0; i < 8 && width > 1; i++) {
      const x = portal.left + (width / 8) * i;
      g.poly([x, 175, x + width / 8, 397, x, 625], false).stroke({ color: p.steel, width: 5 });
      g.poly([x + width / 8, 175, x, 397, x + width / 8, 625], false).stroke({ color: p.steelLight, width: 2 });
    }
  }
  if (building.id === 'house') {
    // The gate lever stays reachable on the jamb even with both grilles closed.
    const { x, y, width, height } = gateLever;
    g.roundRect(x - width / 2, y - height / 2, width, height, 6)
      .fill(p.steel)
      .stroke({ color: p.steelLight, width: 3 });
    for (const side of [-1, 1]) g.rect(x + side * 15 - 2, y - 39, 4, 20).fill(p.steelLight);
    g.moveTo(x - 15, y - 29)
      .lineTo(x + 15, y - 29)
      .stroke({ color: p.steelLight, width: 2 });
    g.circle(x, y + 18, 9).fill(p.ink);
    const handleY = y + 18 - (carHere ? lift.gate.open : 0) * 35;
    g.moveTo(x, y + 18)
      .lineTo(x + 10, handleY)
      .stroke({ color: p.steelLight, width: 7 });
    g.circle(x + 10, handleY, 10)
      .fill(carHere ? p.light : p.trim)
      .stroke({ color: p.ink, width: 2 });
  }
  if (!building.lights[floor]) g.rect(0, 0, roomSpace.width, roomSpace.height).fill({ color: p.ink, alpha: 0.57 });
  g.texture(glowingSign(texture), 'white', 232, 56, 122, 70);
  drawIndicator(g, building);
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
  g.setFillStyle({ color: 'white', alpha: 1 });
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

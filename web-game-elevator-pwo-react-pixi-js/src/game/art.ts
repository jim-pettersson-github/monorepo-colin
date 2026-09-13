import type { Graphics } from 'pixi.js';
import { palette as p } from '../palette';
import { currentBuilding, floorY, type GameState, layout, type Place, playerLevel, roomDoorX } from './model';

function brush(g: Graphics) {
  return {
    box: (x: number, y: number, w: number, h: number, color: string, radius = 0) => g.roundRect(x, y, w, h, radius).fill(color),
    oval: (x: number, y: number, rx: number, ry: number, color: string) => g.ellipse(x, y, rx, ry).fill(color),
    line: (points: number[], color: string, width = 2) => g.poly(points, false).stroke({ color, width, cap: 'round', join: 'round' }),
  };
}

function exitSign(g: Graphics, x: number, y: number) {
  const { box, oval, line } = brush(g);
  box(x, y, 74, 32, p.exit, 4);
  box(x + 7, y + 6, 13, 21, p.surface, 1);
  box(x + 11, y + 9, 10, 18, p.exit);
  oval(x + 32, y + 7, 3, 3, p.surface);
  line([x + 28, y + 13, x + 35, y + 14, x + 39, y + 20], p.surface, 3);
  line([x + 31, y + 14, x + 27, y + 22, x + 23, y + 26], p.surface, 3);
  line([x + 29, y + 19, x + 35, y + 22, x + 35, y + 27], p.surface, 3);
  line([x + 45, y + 16, x + 66, y + 16, x + 60, y + 10], p.surface, 3);
  line([x + 66, y + 16, x + 60, y + 22], p.surface, 3);
}

function person(g: Graphics, x: number, y: number, colin: boolean, index: number, stride: number) {
  const { box, oval, line } = brush(g);
  const skin = colin || index === 0 ? p.skin : index === 1 ? p.hair : p.floor;
  const shirt = colin ? p.shirt : [p.accent, p.plant, p.frame][index % 3];
  const sway = Math.sin(stride) * 5;
  oval(x, y + 3, 22, 5, p.trim);
  line([x - 9, y - 28, x - 10 - sway, y - 6], skin, 9);
  line([x + 9, y - 28, x + 10 + sway, y - 6], skin, 9);
  oval(x - 12 - sway, y - 3, 9, 4, colin ? skin : p.ink);
  oval(x + 12 + sway, y - 3, 9, 4, colin ? skin : p.ink);
  box(x - 17, y - 42, 34, 22, p.pants, 4);
  line([x - 19, y - 57, x - 22 + sway, y - 34], skin, 8);
  line([x + 19, y - 57, x + 22 - sway, y - 34], skin, 8);
  box(x - 20, y - 63, 40, 29, shirt, 7);
  oval(x, y - 82, 21, 24, skin);
  oval(x - 21, y - 80, 4, 6, skin);
  oval(x + 21, y - 80, 4, 6, skin);
  oval(x - 1, y - 100, 22, 12, colin ? p.hair : p.eyes);
  g.poly([x - 21, y - 99, x + 17, y - 103, x + 21, y - 87, x + 11, y - 94, x + 3, y - 88, x - 4, y - 95, x - 16, y - 87]).fill(colin ? p.hair : p.eyes);
  oval(x - 8, y - 81, 2.1, 2.8, p.eyes);
  oval(x + 8, y - 81, 2.1, 2.8, p.eyes);
  line([x - 5, y - 70, x, y - 67, x + 6, y - 70], p.eyes, 1.8);
}

export function drawBackground(g: Graphics, place: Place) {
  g.clear();
  const { box, oval, line } = brush(g);
  if (place === 'outside') {
    box(0, 350, 780, 650, p.glass);
    oval(680, 430, 35, 35, p.light);
    box(0, 795, 780, 190, p.plant);
    box(0, 842, 780, 100, p.floor);
    for (let b = 0; b < 3; b++) {
      const x = 35 + b * 250;
      box(x, 535, 200, 310, b === 1 ? p.frame : b === 2 ? p.floor : p.wall, 10);
      g.poly([x - 10, 538, x + 100, 485, x + 210, 538]).fill(b === 2 ? p.eyes : p.ink);
      for (let f = 0; f < 2; f++)
        for (let w = 0; w < 3; w++) {
          box(x + 22 + w * 57, 561 + f * 80, 40, 52, p.surface, 5);
          box(x + 27 + w * 57, 566 + f * 80, 30, 42, p.glass, 3);
        }
      box(x + 69, 736, 65, 107, p.ink, 6);
      box(x + 78, 745, 47, 98, p.frame, 2);
      oval(x + 117, 791, 3, 3, p.light);
      exitSign(g, x + 66, 696);
    }
    return;
  }
  box(0, -100, layout.width, 1100, p.paper);
  box(827, -100, 215, 1030, p.ink);
  for (let f = 0; f < 3; f++) {
    const y = floorY(f);
    box(0, y - 270, layout.corridor, 270, place === 'house' ? p.floor : p.wall);
    box(0, y, layout.corridor + 2, 40, p.floor);
    box(0, y - 9, layout.corridor, 9, p.trim);
    line([0, y + 24, layout.corridor, y + 24], p.trim);
    for (let x = 60; x < layout.corridor; x += 120) line([x, y + 1, x - 15, y + 39], p.trim);
    // The signed stairwell remains a consistent landmark on every floor.
    box(28, y - 198, 144, 195, p.trim, 6);
    box(38, y - 188, 124, 185, p.frame, 4);
    box(49, y - 175, 102, 131, p.glass, 3);
    for (let stair = 0; stair < 7; stair++) {
      box(51 + stair * 12, y - 55 - stair * 16, 18, 8, p.surface, 1);
    }
    line([58, y - 86, 136, y - 180], p.surface, 3);
    box(49, y - 35, 102, 7, p.surface, 2);
    exitSign(g, 62, y - 242);
    if (f === 0) {
      box(183, y - 198, 65, 195, p.trim, 5);
      box(190, y - 191, 51, 188, p.eyes, 3);
      box(197, y - 155, 37, 104, p.glass, 2);
      line([203, y - 142, 218, y - 148], p.surface, 2);
      line([198, y - 40, 231, y - 40], p.surface, 4);
    }
    // Ordinary room door, light switch, lamp, and an optional alarm demo.
    const doorX = roomDoorX(f);
    const doorWidth = f === 0 ? 65 : 81;
    box(doorX, y - 164, doorWidth, 160, p.trim, 5);
    box(doorX + 9, y - 154, doorWidth - 18, 150, place === 'mall' ? p.glass : p.frame, 3);
    oval(doorX + doorWidth - 21, y - 76, 4, 4, p.light);
    box(611, y - 122, 34, 44, p.surface, 5);
    box(619, y - 113, 18, 26, p.frame, 3);
    line([626, y - 265, 626, y - 224], p.ink, 3);
    g.poly([596, y - 208, 611, y - 233, 641, y - 233, 656, y - 208]).fill(p.light);
    box(592, y - 207, 68, 5, p.ink, 2);
    // Fire pictogram above a manual call point: flame, glass, and press target.
    box(674, y - 205, 58, 68, p.surface, 4);
    box(678, y - 201, 50, 60, p.accent, 2);
    g.moveTo(703, y - 194)
      .bezierCurveTo(709, y - 181, 723, y - 178, 719, y - 164)
      .bezierCurveTo(715, y - 149, 693, y - 150, 688, y - 163)
      .bezierCurveTo(684, y - 174, 696, y - 176, 693, y - 186)
      .lineTo(702, y - 176)
      .bezierCurveTo(707, y - 182, 700, y - 187, 703, y - 194)
      .fill(p.surface);
    g.moveTo(704, y - 176)
      .bezierCurveTo(716, y - 162, 708, y - 155, 700, y - 161)
      .bezierCurveTo(696, y - 165, 703, y - 169, 704, y - 176)
      .fill(p.accent);
    box(674, y - 125, 58, 62, p.trim, 5);
    box(676, y - 127, 54, 60, p.accent, 4);
    box(683, y - 109, 40, 29, p.surface, 2);
    line([686, y - 105, 694, y - 107], p.glass, 2);
    g.circle(703, y - 95, 6).stroke({ color: p.accent, width: 2 });
    line([687, y - 95, 693, y - 95, 690, y - 98], p.accent, 2);
    line([719, y - 95, 713, y - 95, 716, y - 98], p.accent, 2);
    for (const x of [682, 724]) oval(x, y - 73, 1.5, 1.5, p.surface);
    // Warning triangle and hall call buttons.
    g.poly([763, y - 193, 787, y - 151, 739, y - 151])
      .fill(p.light)
      .stroke({ color: p.ink, width: 3 });
    line([763, y - 180, 763, y - 166], p.ink, 4);
    oval(763, y - 158, 2, 2, p.ink);
    box(758, y - 123, 31, 50, p.surface, 5);
    oval(773, y - 109, 6, 6, p.accent);
    oval(773, y - 90, 6, 6, p.frame);
    box(826, y - 240, 217, 241, place === 'house' ? p.eyes : p.trim, 5);
    box(836, y - 228, 197, 225, p.ink, 2);
    box(894, y - 276, 85, 29, p.ink, 5);
    box(823, y, 224, 8, p.frame, 1);
    // Room details differentiate the floors and buildings.
    if (place === 'mall') {
      for (let i = 0; i < 4; i++) box(590 + i * 22, y - 44 - (i % 2) * 12, 17, 32 + (i % 2) * 12, [p.accent, p.shirt, p.plant, p.light][i], 2);
      box(582, y - 10, 110, 10, p.frame, 2);
    } else if (f === 2 && place === 'hotel') {
      box(599, y - 52, 84, 8, p.frame, 3);
      line([610, y - 44, 604, y], p.ink, 5);
      line([671, y - 44, 677, y], p.ink, 5);
      box(628, y - 69, 15, 17, p.surface, 3);
    } else {
      line([651, y - 30, 651, y - 75], p.plant, 4);
      oval(640, y - 70, 14, 7, p.plant);
      oval(660, y - 52, 15, 8, p.frame);
      box(634, y - 30, 35, 30, p.accent, 3);
    }
  }
}

export function drawDynamic(g: Graphics, state: GameState) {
  g.clear();
  const { box, oval, line } = brush(g);
  const building = currentBuilding(state);
  if (building) {
    const lift = building.lift;
    const cabinY = floorY(lift.position);
    box(846, cabinY - 217, 176, 213, building.id === 'mall' ? p.glass : building.id === 'house' ? p.floor : p.surface, 4);
    box(854, cabinY - 203, 160, 181, p.glass, 2);
    box(846, cabinY - 16, 176, 18, p.floor);
    line([860, cabinY - 72, 1005, cabinY - 72], p.frame, 4);
    box(1006, cabinY - 134, 11, 39, p.surface, 3);
    for (let i = 0; i < 3; i++) oval(1011, cabinY - 126 + i * 11, 2, 2, p.ink);
    for (let f = 0; f < 3; f++) {
      const y = floorY(f);
      const atStop = lift.destination === null && lift.position === f;
      const opening = atStop ? lift.landing.open : 0;
      if (building.id === 'house') {
        box(838, y - 224, 190 * (1 - opening), 220, p.frame, 2);
        if (opening < 0.95) {
          box(854, y - 198, 42 * (1 - opening), 84, p.glass, 3);
          line([848, y - 97, 872, y - 97], p.light, 3);
        }
      } else {
        const half = 93 * (1 - opening);
        g.roundRect(838, y - 222, half, 218, 1).fill({ color: building.id === 'mall' ? p.glass : p.frame, alpha: building.id === 'mall' ? 0.4 : 0.9 });
        g.roundRect(1028 - half, y - 222, half, 218, 1).fill({ color: building.id === 'mall' ? p.glass : p.frame, alpha: building.id === 'mall' ? 0.4 : 0.9 });
        if (half > 8) {
          line([838 + half - 7, y - 138, 838 + half - 7, y - 99], p.surface, 3);
          line([1028 - half + 7, y - 138, 1028 - half + 7, y - 99], p.surface, 3);
        }
      }
      if (building.roomDoors[f]) {
        const doorX = roomDoorX(f);
        box(doorX + 9, y - 153, f === 0 ? 47 : 63, 150, p.ink, 2);
        box(doorX + 24, y - 121, f === 0 ? 22 : 34, 67, p.light, 3);
        box(doorX + 9, y - 153, 13, 150, p.frame, 2);
      }
      if (!building.lights[f]) g.rect(0, y - 265, layout.corridor, 258).fill({ color: p.ink, alpha: 0.48 });
      else g.ellipse(626, y - 182, 50, 22).fill({ color: p.light, alpha: 0.24 });
      exitSign(g, 62, y - 242);
      box(619, y - 113, 18, 26, building.lights[f] ? p.light : p.frame, 3);
      // A clear threshold marker stays visible even with the lights off.
      g.ellipse(layout.threshold, y + 15, 24, 9).fill({ color: atStop && lift.blocked ? p.light : p.glass, alpha: 0.8 });
    }
    if (building.id === 'house') {
      const width = 171 * (1 - lift.gate.open) + 10;
      for (let i = 0; i < 7; i++) {
        const x = 843 + (width / 7) * i;
        line([x, cabinY - 215, x + width / 7, cabinY - 110, x, cabinY - 8], p.eyes, 3);
        line([x + width / 7, cabinY - 215, x, cabinY - 110, x + width / 7, cabinY - 8], p.eyes, 3);
      }
    }
    for (const passenger of building.people) {
      if (passenger.phase === 'away') continue;
      const y = floorY(passenger.phase === 'riding' ? lift.position : passenger.floor);
      const walking = ['waiting', 'boarding', 'leaving', 'returning'].includes(passenger.phase);
      person(g, passenger.x, y - 4, false, passenger.id, walking ? state.time * 8 : 0);
      if (['idle', 'waiting', 'riding'].includes(passenger.phase)) {
        box(passenger.x - 18, y - 158, 36, 32, p.surface, 12);
        g.poly([passenger.x - 6, y - 128, passenger.x, y - 119, passenger.x + 6, y - 128]).fill(p.surface);
      }
    }
  }
  const player = state.player;
  const y = floorY(playerLevel(state));
  person(g, player.x, y + 16, true, 0, player.targetX !== null || player.stairs ? state.time * 10 : 0);
  const targetX = player.route?.x ?? player.targetX;
  const targetY = player.route ? floorY(player.route.floor) : y;
  if (targetX !== null) {
    oval(targetX, targetY + 21, 8, 3, p.accent);
    line([targetX - 4, targetY + 10, targetX, targetY + 16, targetX + 4, targetY + 10], p.accent, 2);
  }
}

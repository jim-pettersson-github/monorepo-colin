import type { Graphics } from 'pixi.js';
import { worldPalette as p } from '../palette';
import { type Building, floorCount, floorLabel, floors } from './model';

const digits: Record<string, string> = {
  E: 'adefg',
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};
const segments = {
  a: [0, 0, 1, 0],
  b: [1, 0, 1, 1],
  c: [1, 1, 1, 2],
  d: [0, 2, 1, 2],
  e: [0, 1, 0, 2],
  f: [0, 0, 0, 1],
  g: [0, 1, 1, 1],
};

export function drawDigit(g: Graphics, label: string, x: number, y: number, height: number, color: string, width = 2) {
  for (const segment of digits[label] ?? '') {
    const [x1, y1, x2, y2] = segments[segment as keyof typeof segments];
    g.moveTo(x + x1 * height * 0.48, y + (y1 * height) / 2)
      .lineTo(x + x2 * height * 0.48, y + (y2 * height) / 2)
      .stroke({ color, width, cap: 'round' });
  }
}

export function drawIndicator(g: Graphics, building: Building) {
  const { lift, id } = building;
  const level = Math.round(lift.position);
  if (id === 'hotel') {
    g.roundRect(809, 47, 169, 82, 8).fill(p.frame).stroke({ color: p.trim, width: 4 });
    g.roundRect(819, 55, 149, 65, 5).fill(p.indicatorDark);
    drawDigit(g, floorLabel(level), 871, 67, 42, p.light, 5);
  } else if (id === 'mall') {
    g.roundRect(741, 51, 305, 76, 12).fill(p.indicatorDark).stroke({ color: p.steelLight, width: 4 });
    for (const floor of floors(id)) {
      const x = 775 + floor * 57;
      const lit = floor === level;
      g.roundRect(x - 22, 62, 44, 45, 7).fill(lit ? p.mallIndicator : p.glass);
      drawDigit(g, floorLabel(floor), x - 7, 72, 24, lit ? p.indicatorDark : p.surface, 3);
    }
    const markerX = 775 + lift.position * 57;
    g.circle(markerX, 117, 3).fill(p.mallIndicator);
  } else {
    const cx = 891,
      cy = 121,
      radius = 75;
    g.moveTo(cx - radius - 7, cy)
      .arc(cx, cy, radius + 7, Math.PI, Math.PI * 2)
      .closePath()
      .fill(p.ink)
      .stroke({ color: p.frame, width: 4 });
    for (const floor of floors(id)) {
      const angle = Math.PI + (floor / (floorCount(id) - 1)) * Math.PI;
      const x = cx + Math.cos(angle) * 65,
        y = cy + Math.sin(angle) * 65;
      drawDigit(g, floorLabel(floor), x - 3, y - 9, 12, p.surface, 1.5);
      g.moveTo(cx + Math.cos(angle) * 49, cy + Math.sin(angle) * 49)
        .lineTo(cx + Math.cos(angle) * 54, cy + Math.sin(angle) * 54)
        .stroke({ color: p.light, width: 2 });
    }
    const angle = Math.PI + (lift.position / (floorCount(id) - 1)) * Math.PI;
    g.moveTo(cx, cy)
      .lineTo(cx + Math.cos(angle) * 48, cy + Math.sin(angle) * 48)
      .stroke({ color: p.light, width: 4, cap: 'round' });
    g.circle(cx, cy, 5).fill(p.light);
  }
  if (lift.destination !== null) {
    const direction = lift.destination > lift.position ? -1 : 1;
    const x = building.id === 'mall' ? 1065 : 1003,
      y = 89;
    g.moveTo(x, y - direction * 12)
      .lineTo(x, y + direction * 12)
      .moveTo(x - 7, y + direction * 5)
      .lineTo(x, y + direction * 12)
      .lineTo(x + 7, y + direction * 5)
      .stroke({ color: p.light, width: 3 });
  }
}

export const floorAccents = [
  p.floorTeal,
  p.floorOchre,
  p.floorBlue,
  p.floorRose,
  p.floorSage,
  p.floorClay,
  p.floorSlate,
  p.floorOlive,
  p.floorLilac,
  p.floorAmber,
];

export function drawFloorPlaque(g: Graphics, floor: number) {
  g.roundRect(485, 504, 118, 94, 7).fill(floorAccents[floor]).stroke({ color: p.trim, width: 4 });
  drawDigit(g, floorLabel(floor), 532, 521, 54, p.surface, 5);
}

import type { Graphics } from 'pixi.js';
import { worldPalette as p } from '../palette';
import type { BuildingId } from './model';
import type { PaintedAssets } from './painted-assets';

interface PropPlacement {
  index: number;
  x: number;
  bottom: number;
  height: number;
  surface: 'floor' | 'wall' | 'table';
}

// Coordinates follow the painted wall/floor junction, which sits below the lift sill.
// Each object has its own scale: a clock, chair and vase cannot share a bounding box.
const hotel: PropPlacement[][] = [
  [{ index: 0, x: 73, bottom: 700, height: 112, surface: 'floor' }],
  [{ index: 1, x: 1219, bottom: 422, height: 114, surface: 'wall' }],
  [{ index: 2, x: 1237, bottom: 718, height: 210, surface: 'floor' }],
  [{ index: 3, x: 1225, bottom: 551, height: 126, surface: 'table' }],
  [{ index: 4, x: 1234, bottom: 714, height: 220, surface: 'floor' }],
  [{ index: 5, x: 1218, bottom: 413, height: 104, surface: 'wall' }],
  [{ index: 6, x: 1218, bottom: 453, height: 159, surface: 'wall' }],
  [{ index: 7, x: 1219, bottom: 709, height: 190, surface: 'floor' }],
  [{ index: 8, x: 1240, bottom: 723, height: 173, surface: 'floor' }],
  [{ index: 9, x: 1240, bottom: 720, height: 208, surface: 'floor' }],
];

const mall: PropPlacement[][] = [
  [
    { index: 10, x: 74, bottom: 706, height: 226, surface: 'floor' },
    { index: 8, x: 1380, bottom: 753, height: 142, surface: 'floor' },
  ],
  [
    { index: 11, x: 1239, bottom: 719, height: 231, surface: 'floor' },
    { index: 8, x: 74, bottom: 708, height: 126, surface: 'floor' },
  ],
  [
    { index: 12, x: 1234, bottom: 715, height: 201, surface: 'floor' },
    { index: 13, x: 73, bottom: 706, height: 116, surface: 'floor' },
  ],
  [
    { index: 13, x: 1233, bottom: 719, height: 203, surface: 'floor' },
    { index: 8, x: 74, bottom: 709, height: 128, surface: 'floor' },
  ],
  [
    { index: 14, x: 1272, bottom: 746, height: 246, surface: 'floor' },
    { index: 8, x: 74, bottom: 709, height: 128, surface: 'floor' },
  ],
];

function floorShadow(g: Graphics, x: number, bottom: number, width: number) {
  g.ellipse(x, bottom - 2, width * 0.48, width * 0.07).fill({ color: p.ink, alpha: 0.07 });
  g.ellipse(x, bottom - 3, width * 0.36, width * 0.035).fill({ color: p.ink, alpha: 0.12 });
}

function flowerTable(g: Graphics, assets: PaintedAssets) {
  floorShadow(g, 1225, 708, 174);
  for (const x of [1154, 1285]) {
    g.rect(x, 560, 12, 145).fill({ texture: assets.wood, textureSpace: 'local' }).stroke({ color: p.frame, width: 2 });
    g.rect(x, 687, 12, 18).fill(p.trim);
  }
  g.rect(1146, 558, 158, 28).fill({ texture: assets.wood, textureSpace: 'local' }).stroke({ color: p.frame, width: 2 });
  g.poly([1141, 551, 1298, 551, 1310, 565, 1141, 565]).fill({ texture: assets.wood, textureSpace: 'local' }).stroke({ color: p.trim, width: 2 });
}

export function drawFloorProps(g: Graphics, assets: PaintedAssets, building: BuildingId, floor: number) {
  if (building === 'house') {
    const index = floor + 15;
    const prop = assets[`prop-${index}` as keyof PaintedAssets];
    const width = floor === 0 ? 125 : 215;
    const height = Math.min(240, (width * prop.height) / prop.width);
    const drawWidth = (height * prop.width) / prop.height;
    g.texture(prop, 'white', (floor === 0 ? 73 : 1236) - drawWidth / 2, (floor <= 4 ? 460 : 646) - height, drawWidth, height);
    return;
  }
  if (building === 'hotel' && floor === 3) flowerTable(g, assets);
  for (const placement of (building === 'hotel' ? hotel : mall)[floor] ?? []) {
    const { index, x, bottom, height, surface } = placement;
    const prop = assets[`prop-${index}` as keyof PaintedAssets];
    const width = (height * prop.width) / prop.height;
    if (surface === 'floor') floorShadow(g, x, bottom, width);
    if (surface === 'wall') {
      if (index === 5 || index === 6) g.ellipse(x + 3, bottom - height / 2 + 4, width / 2, height / 2).fill({ color: p.ink, alpha: 0.14 });
      else g.roundRect(x - width / 2 + 3, bottom - height + 4, width, height, 3).fill({ color: p.ink, alpha: 0.14 });
    }
    // Contact shadows must not tint the artwork drawn after them.
    g.setFillStyle({ color: 'white', alpha: 1 });
    g.texture(prop, 'white', x - width / 2, bottom - height, width, height);
  }
}

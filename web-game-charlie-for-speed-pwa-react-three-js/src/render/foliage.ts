import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Region, TrackTheme } from '../game/tracks';
import { canvas, texture } from './textures';
import type { Ground } from './track-world';

type Disposable = { dispose: () => void };
type Vec3 = [number, number, number];

// Trees closer to the track than this are modelled; further out they are painted cards.
const NEAR = 120;

// A position hash in [-1, 1]: vertices that share a position move together, so shapes stay closed.
function jitter(x: number, y: number, z: number, seed: number) {
  const n = Math.sin(Math.round(x * 997) * 0.129898 + Math.round(y * 997) * 0.78233 + Math.round(z * 997) * 0.37719 + seed * 4.1) * 43758.5453;
  return (n - Math.floor(n)) * 2 - 1;
}

// Colours a part from a darker base to a lighter top; faces pointing down darken further, a cheap ambient occlusion.
function paint(source: THREE.BufferGeometry, bottom: string, top: string, low: number, high: number) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (geometry.attributes.uv) geometry.deleteAttribute('uv');
  const from = new THREE.Color(bottom);
  const to = new THREE.Color(top);
  const color = new THREE.Color();
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = THREE.MathUtils.clamp((position.getY(i) - low) / (high - low), 0, 1);
    color
      .copy(from)
      .lerp(to, t)
      .multiplyScalar(0.8 + 0.2 * normal.getY(i));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Welds a primitive so it can be deformed without opening seams, then re-smooths it.
function deform(source: THREE.BufferGeometry, move: (x: number, y: number, z: number) => Vec3) {
  source.deleteAttribute('normal');
  source.deleteAttribute('uv');
  const geometry = mergeVertices(source);
  source.dispose();
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setXYZ(i, ...move(position.getX(i), position.getY(i), position.getZ(i)));
  geometry.computeVertexNormals();
  return geometry;
}

// A lumpy clump of foliage; detail 1 for the main mass, 0 for the smaller ones.
function clump(radius: number, scale: Vec3, at: Vec3, seed: number, detail = 0, lump = 0.2) {
  return deform(new THREE.IcosahedronGeometry(radius, detail), (x, y, z) => {
    const k = 1 + jitter(x, y, z, seed) * lump;
    return [x * k * scale[0] + at[0], y * k * scale[1] + at[1], z * k * scale[2] + at[2]];
  });
}

// One whorl of conifer branches: a cone with a ragged, drooping rim.
function whorl(radius: number, height: number, y: number, seed: number) {
  return deform(new THREE.ConeGeometry(radius, height, 9, 1), (x, py, z) => {
    if (Math.hypot(x, z) < 0.01) return [x, py + y, z];
    const j = jitter(x, 0, z, seed);
    return [x * (1 + 0.24 * j), py + y - height * (0.1 + 0.08 * j), z * (1 + 0.24 * j)];
  });
}

function stem(bottom: number, top: number, height: number, sides = 6, segments = 1) {
  return new THREE.CylinderGeometry(top, bottom, height, sides, segments, true).translate(0, height / 2, 0);
}

function merged(parts: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Foliage parts do not merge');
  return geometry;
}

function spruce(blue: boolean, seed: number) {
  const parts = [paint(stem(0.34, 0.2, 3.2), '#3a2a1e', '#5a4030', 0, 3)];
  const whorls = blue ? 7 : 6;
  for (let i = 0; i < whorls; i++) {
    const t = i / (whorls - 1);
    const height = 2.9 - t * 1.2;
    parts.push(whorl((blue ? 3.3 : 2.9) * (1 - t) * 0.85 + 0.45, height, 2.6 + i * 1.3 + height / 2, seed + i));
  }
  parts.push(new THREE.ConeGeometry(0.4, 1.6, 6).translate(0, 2.6 + whorls * 1.3 + 0.9, 0));
  const top = 2.6 + whorls * 1.3 + 1.6;
  const [dark, light] = blue ? ['#183528', '#3b6a4c'] : ['#1a3a21', '#3f7239'];
  return merged(parts.map((part, index) => (index ? paint(part, dark, light, 2, top) : part)));
}

function scotsPine(seed: number) {
  // A bare, reddish upper trunk under an irregular, layered crown.
  const crown = [
    clump(2.5, [1.15, 0.8, 1.15], [0, 10.2, 0], seed, 1, 0.2),
    clump(1.9, [1.1, 0.75, 1.1], [1.7, 8.8, 0.9], seed + 1),
    clump(1.8, [1.1, 0.75, 1.1], [-1.6, 8.5, -1], seed + 2),
    clump(1.6, [1.1, 0.8, 1.1], [0.5, 12, -0.9], seed + 3),
    clump(1.5, [1.1, 0.75, 1.1], [-0.6, 7.4, 1.4], seed + 4),
  ];
  return merged([paint(stem(0.36, 0.2, 10), '#4a3222', '#a8643a', 0, 9), ...crown.map((part) => paint(part, '#1e3c23', '#4c7c40', 6.5, 13))]);
}

function broadleaf(wide: boolean, seed: number) {
  const spread = wide ? 1.35 : 1;
  const crown = [
    clump(2.9, [1.1 * spread, 0.9, 1.1 * spread], [0, 6.4, 0], seed, 1, 0.16),
    clump(2, [1, 0.9, 1], [1.9 * spread, 5.6, 0.9], seed + 1),
    clump(2.1, [1, 0.9, 1], [-1.7 * spread, 5.9, -1.1], seed + 2),
    clump(1.8, [1, 0.9, 1], [0.6, 7.9, -1.4 * spread], seed + 3),
    clump(1.7, [1, 0.9, 1], [-0.8, 7.6, 1.5 * spread], seed + 4),
  ];
  const [dark, light] = wide ? ['#2c4a1c', '#6b8f34'] : ['#2e5622', '#74a03c'];
  return merged([paint(stem(0.45, 0.3, 4.6), '#3e2c20', '#5e4634', 0, 4), ...crown.map((part) => paint(part, dark, light, 3.5, 9.5))]);
}

function birch(seed: number) {
  // A white trunk with dark bark bands, coloured per ring.
  const trunk = paint(stem(0.22, 0.13, 8, 6, 8), '#e6e2d8', '#efece4', 0, 8);
  const position = trunk.attributes.position;
  const colors = trunk.attributes.color;
  for (let i = 0; i < position.count; i++) {
    if (jitter(0, Math.round(position.getY(i)), 0, seed) > 0.35) colors.setXYZ(i, 0.16, 0.16, 0.15);
  }
  const crown = [
    clump(1.7, [1, 1.45, 1], [0, 7.4, 0], seed, 1, 0.2),
    clump(1.3, [1, 1.4, 1], [1, 6.1, 0.5], seed + 1),
    clump(1.2, [1, 1.4, 1], [-0.8, 8.7, -0.5], seed + 2),
  ];
  return merged([trunk, ...crown.map((part) => paint(part, '#3f6a26', '#9cc25a', 4.5, 10.5))]);
}

// Far trees: two crossed cards painted with the same species, lit as if facing the sky.
type Painter = (context: CanvasRenderingContext2D, random: () => number) => void;

const cardPainters: Record<'spruce' | 'fir' | 'pine' | 'broadleaf' | 'oak' | 'birch', Painter> = {
  spruce: (context, random) => conifer(context, random, ['#1a3a21', '#3f7239'], 0.4),
  fir: (context, random) => conifer(context, random, ['#183528', '#3b6a4c'], 0.46),
  pine: (context, random) => {
    trunkLine(context, 6, 70, '#a0603a');
    blobs(context, random, 64, 52, 56, 30, ['#203f25', '#2f5a30', '#4a7a3e'], 26);
  },
  broadleaf: (context, random) => {
    trunkLine(context, 9, 150, '#4a3626');
    blobs(context, random, 64, 100, 54, 70, ['#2e5622', '#4a7a2e', '#74a03c'], 40);
  },
  oak: (context, random) => {
    trunkLine(context, 11, 150, '#3e2c20');
    blobs(context, random, 64, 104, 62, 62, ['#2c4a1c', '#4a6c28', '#6b8f34'], 42);
  },
  birch: (context, random) => {
    trunkLine(context, 5, 40, '#ebe7de');
    context.fillStyle = '#2a2a2a';
    for (let y = 60; y < 250; y += 9 + random() * 14) context.fillRect(61, y, 6, 2);
    blobs(context, random, 64, 82, 40, 70, ['#3f6a26', '#6e9a3a', '#9cc25a'], 30);
  },
};

function trunkLine(context: CanvasRenderingContext2D, width: number, top: number, color: string) {
  context.fillStyle = color;
  context.fillRect(64 - width / 2, top, width, 256 - top);
}

function conifer(context: CanvasRenderingContext2D, random: () => number, [dark, light]: [string, string], spread: number) {
  trunkLine(context, 7, 180, '#4a3424');
  const tiers = 9;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const bottom = 236 - i * 24;
    const half = 128 * spread * (1 - t) + 6;
    const gradient = context.createLinearGradient(0, bottom - 40, 0, bottom);
    gradient.addColorStop(0, light);
    gradient.addColorStop(1, dark);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(64, bottom - 46);
    for (let x = -half; x <= half; x += 6) context.lineTo(64 + x, bottom - (Math.abs(x) / half) * 10 + random() * 8);
    context.closePath();
    context.fill();
  }
}

function blobs(context: CanvasRenderingContext2D, random: () => number, cx: number, cy: number, rx: number, ry: number, colors: string[], count: number) {
  // Back to front: shadowed clumps first, sunlit ones on top and up toward the light.
  colors.forEach((color, layer) => {
    for (let i = 0; i < count / colors.length; i++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * (1 - layer * 0.18);
      const x = cx + Math.cos(angle) * rx * distance - layer * 4;
      const y = cy + Math.sin(angle) * ry * distance - layer * 6;
      const radius = 10 + random() * 14 - layer * 2;
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function cardTexture(painter: Painter, seed: number) {
  let value = seed;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
  return texture(
    canvas(128, 256, (context) => painter(context, random)),
    false,
    false,
  );
}

function cardGeometry(width: number, height: number) {
  const planes = [0, Math.PI / 2].map((angle) => new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0).rotateY(angle));
  const geometry = mergeGeometries(planes);
  for (const plane of planes) plane.dispose();
  if (!geometry) throw new Error('Cards do not merge');
  const normal = geometry.attributes.normal;
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
  return geometry;
}

type Species = { model: () => THREE.BufferGeometry; card: keyof typeof cardPainters; size: [number, number]; conifer: boolean; share: number };

function speciesFor(region: Region): Species[] {
  return region === 'sweden'
    ? [
        { model: () => spruce(false, 3), card: 'spruce', size: [7, 13.5], conifer: true, share: 0.65 },
        { model: () => scotsPine(5), card: 'pine', size: [6.5, 14], conifer: true, share: 0.35 },
        { model: () => birch(7), card: 'birch', size: [5, 10.5], conifer: false, share: 0.55 },
        { model: () => broadleaf(false, 9), card: 'broadleaf', size: [8, 10], conifer: false, share: 0.45 },
      ]
    : [
        { model: () => spruce(false, 11), card: 'spruce', size: [7, 13.5], conifer: true, share: 0.6 },
        { model: () => spruce(true, 13), card: 'fir', size: [8, 14], conifer: true, share: 0.4 },
        { model: () => broadleaf(false, 15), card: 'broadleaf', size: [8, 10], conifer: false, share: 0.5 },
        { model: () => broadleaf(true, 17), card: 'oak', size: [10, 10], conifer: false, share: 0.5 },
      ];
}

export type FoliageOptions = {
  scene: THREE.Scene;
  region: Region;
  theme: TrackTheme;
  ground: Ground;
  wall: number;
  forest: { count: number; pines: number; clearance: number };
  center: { x: number; z: number };
  random: () => number;
  blocked: (x: number, z: number) => boolean;
};

// Forests with modelled trees near the road and painted cards beyond, plus bushes and boulders along the verges.
export function plantFoliage({ scene, region, theme, ground, wall, forest, center, random, blocked }: FoliageOptions): Disposable[] {
  const disposables: Disposable[] = [];
  const species = speciesFor(region);
  const near = species.map(() => [] as THREE.Matrix4[]);
  const far = species.map(() => [] as THREE.Matrix4[]);
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pick = (conifer: boolean) => {
    const options = species.filter((entry) => entry.conifer === conifer);
    let roll = random();
    for (const entry of options) {
      roll -= entry.share;
      if (roll <= 0) return species.indexOf(entry);
    }
    return species.indexOf(options[options.length - 1]);
  };
  const transform = (x: number, z: number, size: number, sink: number) =>
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, ground.height(x, z) - sink, z),
      quaternion.setFromAxisAngle(up, random() * Math.PI * 2),
      new THREE.Vector3(size, size * (0.85 + random() * 0.35), size),
    );

  // Cards cost almost nothing, so the far forest is planted denser than before.
  const target = Math.round(forest.count * 1.5);
  let planted = 0;
  for (let attempt = 0; attempt < 90000 && planted < target; attempt++) {
    const x = center.x + (random() - 0.5) * 2500;
    const z = center.z + (random() - 0.5) * 2500;
    const distance = ground.trackDistance(x, z);
    if (distance < wall + forest.clearance || ground.inLake(x, z)) continue;
    if (random() > (distance < 90 ? 0.95 : distance < 300 ? 0.5 : 0.25)) continue;
    if (blocked(x, z)) continue;
    const kind = pick(random() < forest.pines);
    const size = 0.75 + random() * 0.6;
    (distance < wall + NEAR ? near : far)[kind].push(transform(x, z, size, 0.3));
    planted++;
  }

  const tint = new THREE.Color();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], variation: number) => {
    if (!matrices.length) {
      geometry.dispose();
      return;
    }
    // A forest-wide bound defeats frustum culling. Small cells leave off-screen trees on the CPU.
    const cells = new Map<string, { matrix: THREE.Matrix4; color: THREE.Color }[]>();
    for (const matrix of matrices) {
      const light = 1 - variation / 2 + random() * variation;
      // Four-triangle distant cards stay in a species-wide batch; only modelled foliage needs cells.
      const key = geometry.attributes.color ? `${Math.floor(matrix.elements[12] / 420)},${Math.floor(matrix.elements[14] / 420)}` : 'cards';
      const cell = cells.get(key) ?? [];
      cell.push({ matrix, color: tint.setRGB(light * (0.95 + random() * 0.1), light, light * (0.9 + random() * 0.1)).clone() });
      cells.set(key, cell);
    }
    for (const cell of cells.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, cell.length);
      cell.forEach(({ matrix, color }, index) => {
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, color);
      });
      mesh.computeBoundingSphere();
      mesh.userData.foliage = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      disposables.push({ dispose: () => mesh.dispose() });
    }
    disposables.push(geometry);
  };

  const bark = new THREE.MeshLambertMaterial({ vertexColors: true });
  disposables.push(bark);
  species.forEach((entry, index) => {
    add(entry.model(), bark, near[index], 0.3);
    const map = cardTexture(cardPainters[entry.card], 17 + index * 13);
    const material = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, color: '#c8c8c8' });
    disposables.push(map, material);
    add(cardGeometry(...entry.size), material, far[index], 0.35);
  });

  // Bushes along the verges and forest edges, boulders where the land is rough.
  const scatter = (count: number, from: number, to: number, size: [number, number], sink: number) => {
    const found: THREE.Matrix4[] = [];
    for (let attempt = 0; attempt < count * 30 && found.length < count; attempt++) {
      const x = center.x + (random() - 0.5) * 2200;
      const z = center.z + (random() - 0.5) * 2200;
      const distance = ground.trackDistance(x, z);
      if (distance < wall + from || distance > wall + to || ground.inLake(x, z) || blocked(x, z)) continue;
      found.push(transform(x, z, size[0] + random() * (size[1] - size[0]), sink));
    }
    return found;
  };
  const bushes = { vaxjo: 500, germany: 450, stockholm: 0, hamburg: 0, smaland: 650, schwarzwald: 800 }[theme];
  if (bushes) {
    const bush = merged([
      paint(clump(1.2, [1.3, 0.8, 1.2], [0, 0.7, 0], 21, 1, 0.22), '#21401c', '#4f7d32', 0, 1.8),
      paint(clump(0.9, [1.2, 0.8, 1.2], [0.9, 0.6, 0.5], 22), '#21401c', '#4f7d32', 0, 1.6),
    ]);
    add(bush, bark, scatter(bushes, 4, 60, [0.6, 1.5], 0.2), 0.35);
  }
  const boulders = { vaxjo: 90, germany: 30, stockholm: 0, hamburg: 0, smaland: 140, schwarzwald: 160 }[theme];
  if (boulders) {
    const rock = paint(clump(1, [1.2, 0.65, 1], [0, 0.25, 0], 31, 1, 0.3), '#5e5c57', '#8f8c84', -0.4, 0.9);
    add(rock, bark, scatter(boulders, 5, 160, [0.4, 1.8], 0.15), 0.3);
  }
  return disposables;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackPath, TrackSample } from '../game/track-path';
import type { Track, TrackTheme } from '../game/tracks';
import { batchStatic } from './batch';
import { buildLensFlare } from './effects';
import { buildScenery } from './scenery';
import { asphaltTexture, barrierTexture, checkerTexture, cloudTexture, curbTexture, glowTexture, grassTexture, ridgeTexture, seeded } from './textures';

export type ThemeLook = {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sunColor: string;
  sun: THREE.Vector3;
  hemiSky: string;
  hemiGround: string;
  grass: string;
  grassShades: string[];
  terrainTint: [string, string];
  farRidge: string;
  nearRidge: string;
  barrier: 'armco' | 'concrete';
  lineColor: string;
  hills: number;
  headlights: boolean;
};

export const looks: Record<TrackTheme, ThemeLook> = {
  vaxjo: {
    skyTop: '#3d5fa8',
    skyHorizon: '#f7b878',
    fog: '#d9b496',
    fogNear: 260,
    fogFar: 1500,
    sunColor: '#ffd2a0',
    sun: new THREE.Vector3(-0.75, 0.22, -0.62).normalize(),
    hemiSky: '#c6cfe6',
    hemiGround: '#3f5a2a',
    grass: '#4e7a2c',
    grassShades: ['#446d26', '#5a8834', '#3d6322', '#62903a'],
    terrainTint: ['#5b8a36', '#3e6526'],
    farRidge: '#6f7fa4',
    nearRidge: '#24402a',
    barrier: 'armco',
    lineColor: '#f2f2ee',
    hills: 1,
    headlights: true,
  },
  germany: {
    skyTop: '#2a6ad0',
    skyHorizon: '#cfe6ff',
    fog: '#c4d8ec',
    fogNear: 320,
    fogFar: 1700,
    sunColor: '#fff4dc',
    sun: new THREE.Vector3(0.5, 0.32, -0.8).normalize(),
    hemiSky: '#d8e8ff',
    hemiGround: '#506a30',
    grass: '#5d8f34',
    grassShades: ['#52822c', '#68993c', '#4a7628', '#74a446'],
    terrainTint: ['#6c9a3e', '#4b7a2c'],
    farRidge: '#7d93b8',
    nearRidge: '#3f5e3a',
    barrier: 'concrete',
    lineColor: '#f4f4f0',
    hills: 1.6,
    headlights: false,
  },
};

export type TrackWorld = {
  scene: THREE.Scene;
  look: ThemeLook;
  setStartLights: (lit: number, green: boolean) => void;
  // 0 in daylight, 1 deep inside a tunnel.
  setShade: (amount: number) => void;
  update: (camera: THREE.Camera, time: number) => void;
  dispose: () => void;
};

export type Ground = {
  height: (x: number, z: number) => number;
  trackDistance: (x: number, z: number) => number;
  inLake: (x: number, z: number) => boolean;
};

const TERRAIN_SIZE = 2800;
const TERRAIN_CELLS = 175;

// Builds a strip alongside the centre line, optionally only where `keep` allows.
export function ribbon(
  path: TrackPath,
  inner: number,
  outer: number,
  options: { lift?: number; outerDrop?: number; vLength?: number; uMeters?: number; keep?: (sample: TrackSample) => boolean } = {},
) {
  const { lift = 0, outerDrop = 0, vLength = 8, uMeters, keep } = options;
  const positions: number[] = [];
  const uvs: number[] = [];
  const { samples, length } = path;
  const count = samples.length;

  for (let i = 0; i < count; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % count];
    if (keep && !keep(a) && !keep(b)) continue;
    const vA = a.s / vLength;
    const vB = (i + 1 === count ? length : b.s) / vLength;
    const corners = [
      [a, inner, vA, 0],
      [a, outer, vA, 1],
      [b, inner, vB, 0],
      [b, outer, vB, 1],
    ] as const;
    const vertices = corners.map(([sample, lateral, v, u]) => {
      const drop = u === 1 ? outerDrop : 0;
      return [sample.x + sample.rx * lateral, sample.y + lift - drop, sample.z + sample.rz * lateral, uMeters ? (lateral - inner) / uMeters : u, v];
    });
    const flip = outer > inner;
    for (const index of flip ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]) {
      const [x, y, z, u, v] = vertices[index];
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function wallGeometry(path: TrackPath, lateral: number, height: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const { samples, length } = path;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    const vA = a.s / 4;
    const vB = (i + 1 === samples.length ? length : b.s) / 4;
    const ax = a.x + a.rx * lateral;
    const az = a.z + a.rz * lateral;
    const bx = b.x + b.rx * lateral;
    const bz = b.z + b.rz * lateral;
    positions.push(ax, a.y - 0.6, az, bx, b.y - 0.6, bz, ax, a.y + height, az, ax, a.y + height, az, bx, b.y - 0.6, bz, bx, b.y + height, bz);
    uvs.push(vA, 0, vB, 0, vA, 1, vA, 1, vB, 0, vB, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function lakeFor(theme: TrackTheme) {
  return theme === 'vaxjo' ? { x: 380, z: 175, rx: 120, rz: 78 } : undefined;
}

function hillsFor(theme: TrackTheme) {
  return theme === 'germany' ? [{ x: 180, z: 860, radius: 190, height: 70 }] : [{ x: -520, z: 760, radius: 220, height: 40 }];
}

function buildGround(track: Track, look: ThemeLook): Ground & { geometry: THREE.BufferGeometry } {
  const { path } = track;
  const lake = lakeFor(track.theme);
  const hills = hillsFor(track.theme);
  const coarse = path.samples.filter((_, index) => index % 3 === 0);
  const grid = TERRAIN_CELLS + 1;
  const cell = TERRAIN_SIZE / TERRAIN_CELLS;
  const half = TERRAIN_SIZE / 2;
  const center = coarse.reduce((sum, sample) => ({ x: sum.x + sample.x / coarse.length, z: sum.z + sample.z / coarse.length }), { x: 0, z: 0 });
  const distances = new Float32Array(grid * grid);
  const heights = new Float32Array(grid * grid);
  const random = seeded(track.id.length * 97);
  const phase = [random() * 10, random() * 10, random() * 10];

  const lakeFactor = (x: number, z: number) => (lake ? ((x - lake.x) / lake.rx) ** 2 + ((z - lake.z) / lake.rz) ** 2 : 9);

  for (let row = 0; row < grid; row++) {
    for (let column = 0; column < grid; column++) {
      const x = center.x - half + column * cell;
      const z = center.z - half + row * cell;
      let best = Number.POSITIVE_INFINITY;
      let nearest = coarse[0];
      for (const sample of coarse) {
        const distance = (x - sample.x) ** 2 + (z - sample.z) ** 2;
        if (distance < best) {
          best = distance;
          nearest = sample;
        }
      }
      const distance = Math.sqrt(best);
      const blend = THREE.MathUtils.smoothstep(distance, track.wall + 24, track.wall + 220);
      let rolling = (Math.sin(x * 0.006 + phase[0]) * Math.cos(z * 0.005 + phase[1]) * 14 + Math.sin(x * 0.017 + z * 0.011 + phase[2]) * 5 + 6) * look.hills;
      for (const hill of hills) rolling += hill.height * Math.exp(-((x - hill.x) ** 2 + (z - hill.z) ** 2) / (hill.radius * hill.radius));
      const fromCenter = Math.hypot(x - center.x, z - center.z);
      rolling += THREE.MathUtils.smoothstep(fromCenter, 700, 1300) * 40;
      let height = nearest.y - 0.7 + blend * rolling;
      const inLake = lakeFactor(x, z);
      if (inLake < 1.6) height = THREE.MathUtils.lerp(-3.5, height, THREE.MathUtils.smoothstep(inLake, 0.8, 1.6));
      distances[row * grid + column] = distance;
      heights[row * grid + column] = height;
    }
  }

  const sampleGrid = (values: Float32Array, x: number, z: number) => {
    const gx = THREE.MathUtils.clamp((x - center.x + half) / cell, 0, grid - 1.001);
    const gz = THREE.MathUtils.clamp((z - center.z + half) / cell, 0, grid - 1.001);
    const column = Math.floor(gx);
    const row = Math.floor(gz);
    const fx = gx - column;
    const fz = gz - row;
    const at = (r: number, c: number) => values[r * grid + c];
    return (
      at(row, column) * (1 - fx) * (1 - fz) + at(row, column + 1) * fx * (1 - fz) + at(row + 1, column) * (1 - fx) * fz + at(row + 1, column + 1) * fx * fz
    );
  };

  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_CELLS, TERRAIN_CELLS);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(center.x, 0, center.z);
  const position = geometry.attributes.position;
  const colors: number[] = [];
  const light = new THREE.Color(look.terrainTint[0]);
  const dark = new THREE.Color(look.terrainTint[1]);
  const sand = new THREE.Color('#c8b48a');
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const column = Math.round((x - center.x + half) / cell);
    const row = Math.round((z - center.z + half) / cell);
    const height = heights[row * grid + column];
    position.setY(i, height);
    color.copy(light).lerp(dark, 0.5 + 0.5 * Math.sin(x * 0.02 + z * 0.013) * Math.cos(z * 0.021));
    if (lakeFactor(x, z) < 1.25) color.lerp(sand, 0.7);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (TERRAIN_SIZE / 12), uv.getY(i) * (TERRAIN_SIZE / 12));

  return {
    geometry,
    height: (x, z) => sampleGrid(heights, x, z),
    trackDistance: (x, z) => sampleGrid(distances, x, z),
    inLake: (x, z) => lakeFactor(x, z) < 1.15,
  };
}

function buildSky(look: ThemeLook, disposables: { dispose: () => void }[]) {
  const sky = new THREE.Group();
  sky.userData.dynamic = true;
  const dome = new THREE.SphereGeometry(1900, 24, 14);
  const top = new THREE.Color(look.skyTop);
  const horizon = new THREE.Color(look.skyHorizon);
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < dome.attributes.position.count; i++) {
    const y = dome.attributes.position.getY(i) / 1900;
    color.copy(horizon).lerp(top, THREE.MathUtils.clamp(y * 2.2, 0, 1) ** 0.8);
    colors.push(color.r, color.g, color.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const domeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  sky.add(new THREE.Mesh(dome, domeMaterial));

  const sunTexture = glowTexture(look.sunColor);
  const sunMaterial = new THREE.SpriteMaterial({ map: sunTexture, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  const sun = new THREE.Sprite(sunMaterial);
  sun.position.copy(look.sun).multiplyScalar(1700);
  sun.scale.setScalar(420);
  sky.add(sun);

  const random = seeded(31);
  const clouds = [cloudTexture(3), cloudTexture(8)];
  const cloudMaterials = clouds.map((map) => new THREE.MeshBasicMaterial({ map, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
  // The sky follows the camera, so cards facing its centre always face the viewer; one mesh per texture.
  const cloudCards: THREE.BufferGeometry[][] = [[], []];
  for (let i = 0; i < 14; i++) {
    const angle = random() * Math.PI * 2;
    const distance = 1300 + random() * 350;
    const card = new THREE.PlaneGeometry(500 + random() * 300, 160 + random() * 80);
    card.rotateY(-angle - Math.PI / 2);
    card.translate(Math.cos(angle) * distance, 180 + random() * 380, Math.sin(angle) * distance);
    cloudCards[i % 2].push(card);
  }
  cloudCards.forEach((cards, index) => {
    const geometry = mergeGeometries(cards);
    for (const card of cards) card.dispose();
    sky.add(new THREE.Mesh(geometry, cloudMaterials[index]));
    disposables.push(geometry);
  });

  const ridges = [
    { radius: 1700, height: 260, color: look.farRidge, jagged: false, repeat: 3, y: 60 },
    { radius: 1450, height: 150, color: look.nearRidge, jagged: true, repeat: 7, y: 40 },
  ].map(({ radius, height, color: ridgeColor, jagged, repeat, y }, index) => {
    const map = ridgeTexture(ridgeColor, 40 + index, jagged);
    map.repeat.set(repeat, 1);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, side: THREE.BackSide, fog: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), material);
    mesh.position.y = y;
    mesh.renderOrder = -1;
    disposables.push(map, material, mesh.geometry);
    return mesh;
  });
  sky.add(...ridges);
  disposables.push(dome, domeMaterial, sunTexture, sunMaterial, ...clouds, ...cloudMaterials);
  return sky;
}

export function buildTrackWorld(track: Track): TrackWorld {
  const look = looks[track.theme];
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };
  const { path, halfWidth, wall } = track;

  scene.background = new THREE.Color(look.fog);
  scene.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar);
  const skyLight = new THREE.HemisphereLight(look.hemiSky, look.hemiGround, 1.6);
  scene.add(skyLight);
  const sunLight = new THREE.DirectionalLight(look.sunColor, 2.2);
  sunLight.position.copy(look.sun).multiplyScalar(100);
  scene.add(sunLight);

  const sky = buildSky(look, disposables);
  const lensFlare = buildLensFlare(look.sunColor);
  lensFlare.flare.position.copy(look.sun).multiplyScalar(1650);
  sky.add(lensFlare.flare);
  disposables.push(lensFlare);
  scene.add(sky);

  const ground = buildGround(track, look);
  const grass = keep(grassTexture(look.grass, look.grassShades, 9));
  const terrainMaterial = keep(new THREE.MeshLambertMaterial({ map: grass, vertexColors: true, flatShading: true }));
  scene.add(new THREE.Mesh(keep(ground.geometry), terrainMaterial));

  const shoulderMaterial = keep(new THREE.MeshLambertMaterial({ map: grass, color: '#d8e8c8' }));
  const shoulderOptions = { lift: -0.04, outerDrop: 0.5, uMeters: 12, vLength: 12 };
  scene.add(new THREE.Mesh(keep(ribbon(path, halfWidth - 0.2, wall + 3, shoulderOptions)), shoulderMaterial));
  scene.add(new THREE.Mesh(keep(ribbon(path, -halfWidth + 0.2, -wall - 3, shoulderOptions)), shoulderMaterial));

  const asphalt = keep(asphaltTexture(look.lineColor));
  const roadMaterial = keep(new THREE.MeshLambertMaterial({ map: asphalt }));
  scene.add(new THREE.Mesh(keep(ribbon(path, -halfWidth, halfWidth, { lift: 0.02, vLength: halfWidth * 2 })), roadMaterial));

  const curbMaterial = keep(new THREE.MeshLambertMaterial({ map: keep(curbTexture()) }));
  const cornering = (sample: TrackSample) => Math.abs(sample.curve) > 1 / 140;
  const curbOptions = { lift: 0.05, vLength: 2, keep: cornering };
  scene.add(new THREE.Mesh(keep(ribbon(path, halfWidth, halfWidth + 1.4, curbOptions)), curbMaterial));
  scene.add(new THREE.Mesh(keep(ribbon(path, -halfWidth, -halfWidth - 1.4, curbOptions)), curbMaterial));

  const barrierMap = keep(barrierTexture(look.barrier));
  const barrierMaterial = keep(new THREE.MeshLambertMaterial({ map: barrierMap, side: THREE.DoubleSide }));
  const barrierHeight = look.barrier === 'armco' ? 0.9 : 1.1;
  scene.add(new THREE.Mesh(keep(wallGeometry(path, wall, barrierHeight)), barrierMaterial));
  scene.add(new THREE.Mesh(keep(wallGeometry(path, -wall, barrierHeight)), barrierMaterial));

  const lake = lakeFor(track.theme);
  if (lake) {
    const waterMaterial = keep(new THREE.MeshPhongMaterial({ color: '#3f6f9a', shininess: 90, specular: '#ffd7a8', flatShading: true }));
    const water = new THREE.Mesh(keep(new THREE.CircleGeometry(1, 40)), waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.scale.set(lake.rx * 1.3, lake.rz * 1.3, 1);
    water.position.set(lake.x, -1.4, lake.z);
    scene.add(water);
  }

  const start = path.samples[0];
  const checker = keep(checkerTexture());
  const lineGeometry = keep(new THREE.PlaneGeometry(halfWidth * 2, 1.6));
  lineGeometry.rotateX(-Math.PI / 2);
  const line = new THREE.Mesh(lineGeometry, keep(new THREE.MeshLambertMaterial({ map: checker })));
  line.rotation.y = Math.atan2(-start.rz, start.rx);
  line.position.set(start.x, start.y + 0.06, start.z);
  scene.add(line);

  const scenery = buildScenery(scene, track, ground, look);
  disposables.push(scenery);
  // Hundreds of static props collapse into a few batched draw calls.
  disposables.push(batchStatic(scene));

  return {
    scene,
    look,
    setStartLights: scenery.setStartLights,
    setShade(amount) {
      skyLight.intensity = 1.6 - amount * 1.0;
      sunLight.intensity = 2.2 * (1 - amount * 0.9);
    },
    update(camera, time) {
      sky.position.set(camera.position.x, 0, camera.position.z);
      scenery.update(time);
    },
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

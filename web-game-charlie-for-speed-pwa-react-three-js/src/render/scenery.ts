import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sampleAt } from '../game/track-path';
import type { Region, Track, TrackTheme } from '../game/tracks';
import { plantFoliage } from './foliage';
import {
  chevronTexture,
  concreteTexture,
  crowdTexture,
  facadeDetailTexture,
  isRetro,
  seeded,
  shopTexture,
  signTexture,
  texture,
  windowsTexture,
} from './textures';
import type { Ground, ThemeLook } from './track-world';

type Disposable = { dispose: () => void };
type Ad = readonly [lines: readonly string[], background: string, ink: string, accent?: string];

const ads: Record<Region, readonly Ad[]> = {
  sweden: [
    [['SMÅLANDS BENSIN'], '#ffcc1a', '#11284f', '#11284f'],
    [['KRONOBERG DÄCK'], '#111111', '#f4f4f4', '#e8322b'],
    [['GLASBRUKET'], '#1c6fb8', '#ffffff'],
    [['CHARLIE', 'FOR SPEED'], '#f4f4f4', '#0a5ea8', '#ffcc1a'],
    [['TURBO-OLJA'], '#e8322b', '#ffffff', '#111111'],
    [['RADIO SPRINT 104,5'], '#2c2c34', '#ffcc1a'],
    [['SJÖKIOSKEN', 'GLASS & KAFFE'], '#f7f0e0', '#8e2a1e'],
  ],
  germany: [
    [['RHEIN ÖL'], '#0f3f8f', '#ffcc1a', '#ffcc1a'],
    [['BREZEL BRÄU'], '#f4ead2', '#7a2a18'],
    [['REIFEN WOLF'], '#111111', '#ffcc1a', '#e8322b'],
    [['CHARLIE', 'FOR SPEED'], '#e8322b', '#ffffff'],
    [['SCHNELL-KAFFEE'], '#5a3a28', '#f4ead2'],
    [['ZÜNDKERZEN KRAFT'], '#f4f4f4', '#1a1a1a', '#1f8a3c'],
    [['MOTOR-FUNK 98,1'], '#2a6fd6', '#ffffff'],
  ],
};

// Tree count, share of conifers and the closest a tree may stand to the barriers.
const forests: Record<TrackTheme, { count: number; pines: number; clearance: number }> = {
  vaxjo: { count: 2600, pines: 0.68, clearance: 8 },
  germany: { count: 1900, pines: 0.35, clearance: 8 },
  stockholm: { count: 380, pines: 0.2, clearance: 110 },
  hamburg: { count: 220, pines: 0.1, clearance: 140 },
  smaland: { count: 1900, pines: 0.45, clearance: 6 },
  schwarzwald: { count: 3800, pines: 0.9, clearance: 5 },
};

const facades: Record<'stockholm' | 'hamburg', { walls: string[]; roofs: string[]; heights: [number, number] }> = {
  stockholm: { walls: ['#d9a441', '#b5533c', '#e8d9b0', '#9aa67a', '#c98a5a'], roofs: ['#4f8a73', '#3a3634'], heights: [13, 24] },
  hamburg: { walls: ['#8e3b2a', '#7a3324', '#9c4a34', '#6d6a66', '#a9b4bd'], roofs: ['#3e5a52', '#2f2e2c'], heights: [15, 30] },
};

function colored(source: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const geometry = source.index ? source.toNonIndexed() : source;
  geometry.translate(x, y, z);
  const tint = new THREE.Color(color);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([tint.r, tint.g, tint.b], i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}

function treeGeometries(region: Region) {
  const sides = isRetro() ? 6 : 10;
  const round = isRetro() ? 0 : 1;
  const pine = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5), '#5a3b26', 0, 1.2, 0),
    colored(new THREE.ConeGeometry(2.6, 5, sides), '#24502a', 0, 4.2, 0),
    colored(new THREE.ConeGeometry(1.9, 4, sides), '#2b5e30', 0, 6.6, 0),
    colored(new THREE.ConeGeometry(1.1, 3, sides), '#336b36', 0, 8.6, 0),
  ]);
  const leafy =
    region === 'sweden'
      ? mergeGeometries([
          colored(new THREE.CylinderGeometry(0.16, 0.24, 6, 5), '#ebe7de', 0, 3, 0),
          colored(new THREE.IcosahedronGeometry(2.2, round).scale(1, 1.5, 1), '#7aa646', 0, 7.2, 0),
        ])
      : mergeGeometries([
          colored(new THREE.CylinderGeometry(0.3, 0.42, 3.2, 5), '#5a3b26', 0, 1.6, 0),
          colored(new THREE.IcosahedronGeometry(3.4, round), '#4f8a2e', 0, 5.6, 0),
          colored(new THREE.IcosahedronGeometry(2.4, round), '#5f9a36', 1.2, 7.2, 0.6),
        ]);
  return { pine, leafy };
}

function prism(width: number, height: number, depth: number) {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, height)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function flagTexture(region: Region) {
  const element = document.createElement('canvas');
  element.width = 32;
  element.height = 20;
  const context = element.getContext('2d');
  if (context && region === 'sweden') {
    context.fillStyle = '#006aa7';
    context.fillRect(0, 0, 32, 20);
    context.fillStyle = '#fecc02';
    context.fillRect(10, 0, 4, 20);
    context.fillRect(0, 8, 32, 4);
  } else if (context) {
    for (const [index, color] of ['#111111', '#dd0000', '#ffce00'].entries()) {
      context.fillStyle = color;
      context.fillRect(0, index * 7, 32, 7);
    }
  }
  return texture(element, false);
}

// City facade: a 2×2 block of windows, some lit, repeated across each wall by scaling the box UVs.
function facadeTexture(wall: string, lit: number, seed: number) {
  const random = seeded(seed);
  const element = document.createElement('canvas');
  element.width = element.height = 32;
  const context = element.getContext('2d');
  if (context) {
    context.fillStyle = wall;
    context.fillRect(0, 0, 32, 32);
    for (const x of [4, 20]) {
      for (const y of [5, 21]) {
        context.fillStyle = '#e8e4da';
        context.fillRect(x - 1, y - 1, 10, 9);
        context.fillStyle = random() < lit ? '#ffd27a' : '#2a3442';
        context.fillRect(x, y, 8, 7);
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(x, y, 8, 2);
      }
    }
  }
  return texture(element);
}

function scaleBoxUv(geometry: THREE.BoxGeometry, width: number, height: number, depth: number, tileWidth = 8, tileHeight = 7) {
  const uv = geometry.attributes.uv;
  const faces = [
    [depth, height],
    [depth, height],
    [0, 0],
    [0, 0],
    [width, height],
    [width, height],
  ];
  faces.forEach(([across, up], face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, (uv.getX(i) * across) / tileWidth, (uv.getY(i) * up) / tileHeight);
  });
  return geometry;
}

export function buildScenery(scene: THREE.Scene, track: Track, ground: Ground, look: ThemeLook) {
  const disposables: Disposable[] = [];
  const keep = <T extends Disposable>(item: T) => {
    disposables.push(item);
    return item;
  };
  const reserved: { x: number; z: number; radius: number }[] = [];
  const animated: ((time: number) => void)[] = [];
  const random = seeded([...track.id].reduce((sum, letter) => sum * 31 + letter.charCodeAt(0), 7) % 100000);
  const { path, halfWidth, wall, theme, setting, region, tunnel } = track;
  const material = (color: string, options: THREE.MeshLambertMaterialParameters = {}) =>
    keep(new THREE.MeshLambertMaterial({ color, flatShading: isRetro(), ...options }));
  const adList = ads[region];
  const nearTunnel = (s: number) => s > tunnel.start - 40 && s < tunnel.end + 40;
  const shadows = (root: THREE.Object3D) => {
    root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry instanceof THREE.BoxGeometry) object.castShadow = true;
    });
  };

  // Local frame at distance s: +x runs along the track, -z faces the road and +z points away from it.
  const frame = (object: THREE.Object3D, s: number, lateral: number, onGround = true) => {
    shadows(object);
    const sample = sampleAt(path, s);
    const x = sample.x + sample.rx * lateral;
    const z = sample.z + sample.rz * lateral;
    object.position.set(x, onGround ? Math.min(ground.height(x, z), sample.y) : sample.y, z);
    object.rotation.y = Math.atan2(-sample.tz, sample.tx) + (lateral < 0 ? Math.PI : 0);
    scene.add(object);
    return object;
  };

  const sign = (lines: readonly string[], background: string, ink: string, accent?: string) => {
    const map = keep(signTexture([...lines], background, ink, accent));
    return keep(new THREE.MeshLambertMaterial({ map }));
  };

  const place = (object: THREE.Object3D, x: number, z: number, radius: number) => {
    shadows(object);
    object.position.set(x, ground.height(x, z), z);
    scene.add(object);
    reserved.push({ x, z, radius });
    return object;
  };

  const isFree = (x: number, z: number, radius: number) =>
    ground.trackDistance(x, z) > wall + radius + 6 &&
    !ground.inLake(x, z) &&
    !reserved.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius + radius);

  const findSpot = (minimum: number, maximum: number, radius: number) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const sample = sampleAt(path, random() * path.length);
      const lateral = (random() < 0.5 ? -1 : 1) * (minimum + random() * (maximum - minimum));
      const x = sample.x + sample.rx * lateral;
      const z = sample.z + sample.rz * lateral;
      if (!isFree(x, z, radius)) continue;
      return { x, z, facing: Math.atan2(-sample.rx * Math.sign(lateral), -sample.rz * Math.sign(lateral)) };
    }
    return undefined;
  };

  // Start/finish gantry with five countdown lamps.
  const gantry = new THREE.Group();
  const steel = material('#3a3f48');
  const span = halfWidth * 2 + 4;
  const banner = sign(['START  •  MÅL'], '#111111', '#ffffff', '#e8322b');
  for (const side of [-1, 1]) gantry.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.8, 7.5, 0.8)), steel).translateZ((side * span) / 2).translateY(3.75));
  const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 1.8, span)), [banner, banner, steel, steel, steel, steel]);
  beam.position.y = 7.2;
  gantry.add(beam);
  const lamps = [0, 1, 2, 3, 4].map((index) => {
    const lamp = keep(new THREE.MeshBasicMaterial({ color: '#2a0a0a' }));
    const housing = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 20)), steel);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(0, 5.9, (index - 2) * 1.2);
    const lens = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.32, 0.32, 0.36, 20)), lamp);
    lens.rotation.copy(housing.rotation);
    lens.position.copy(housing.position);
    gantry.add(housing, lens);
    return lamp;
  });
  const start = path.samples[0];
  gantry.position.set(start.x, start.y, start.z);
  gantry.rotation.y = Math.atan2(start.rx, start.rz);
  scene.add(gantry);
  shadows(gantry);

  // Grandstands beside the start straight: a full circuit gets five, a street race two.
  if (setting !== 'country') {
    const crowd = keep(crowdTexture(5));
    crowd.repeat.set(isRetro() ? 4 : 3, 1);
    const crowdMaterial = keep(new THREE.MeshLambertMaterial({ map: crowd }));
    const standConcrete = material('#b9b4a8');
    const roofMaterial = material(region === 'sweden' ? '#2c5d9a' : '#d8d8d8');
    const stands = setting === 'circuit' ? 5 : 2;
    for (let index = 0; index < stands; index++) {
      const s = 30 + index * 58;
      const stand = new THREE.Group();
      for (let row = 0; row < 7; row++) {
        const step = new THREE.Mesh(keep(new THREE.BoxGeometry(50, 1.1, 2.2)), [
          standConcrete,
          standConcrete,
          crowdMaterial,
          standConcrete,
          standConcrete,
          crowdMaterial,
        ]);
        step.position.set(0, 0.55 + row * 1.1, row * 2.2);
        stand.add(step);
      }
      const back = new THREE.Mesh(keep(new THREE.BoxGeometry(50, 9, 0.6)), standConcrete);
      back.position.set(0, 4.5, 15.6);
      const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(52, 0.4, 18)), roofMaterial);
      roof.position.set(0, 11.5, 7.5);
      roof.rotation.x = -0.08;
      stand.add(back, roof);
      for (const x of [-24, 0, 24])
        stand.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 11.5, 0.5)), steel).translateX(x).translateY(5.75).translateZ(15.2));
      frame(stand, s, -(wall + 5));
      reserved.push({ x: stand.position.x, z: stand.position.z, radius: 40 });
    }
  }

  if (setting === 'circuit') {
    const pitWindows = keep(windowsTexture('#e9e9e4', '#30343c', '#5b7690'));
    pitWindows.repeat.set(30, 1);
    const pits = new THREE.Group();
    const pitWall = keep(new THREE.MeshLambertMaterial({ map: pitWindows }));
    const pitRoof = material('#7a7f88');
    pits.add(new THREE.Mesh(keep(new THREE.BoxGeometry(200, 7, 14)), [pitRoof, pitRoof, pitRoof, pitRoof, pitWall, pitWall]).translateY(3.5).translateZ(7));
    const pitSign = new THREE.Mesh(keep(new THREE.BoxGeometry(60, 4, 0.5)), sign([track.name.toUpperCase()], '#111111', '#ffcc1a'));
    pitSign.position.set(0, 9, 1);
    pitSign.rotation.y = Math.PI;
    pits.add(pitSign);
    frame(pits, 150, wall + 6);
    for (let s = 40; s <= 260; s += 40) {
      const sample = sampleAt(path, s);
      reserved.push({ x: sample.x + sample.rx * (wall + 14), z: sample.z + sample.rz * (wall + 14), radius: 28 });
    }
  }

  // Billboards around the lap, alternating sides; sparse in the countryside.
  const post = material('#8a8f96');
  let adIndex = 0;
  const adGap = setting === 'country' ? 420 : setting === 'city' ? 200 : 150;
  for (let s = 360; s < path.length - 120; s += adGap + random() * 90) {
    const sample = sampleAt(path, s);
    if (Math.abs(sample.curve) > 1 / 70 || nearTunnel(s)) continue;
    const [lines, background, ink, accent] = adList[adIndex++ % adList.length];
    const board = new THREE.Group();
    const face = sign(lines, background, ink, accent);
    const panel = new THREE.Mesh(keep(new THREE.BoxGeometry(12, 3, 0.3)), [post, post, post, post, post, face]);
    panel.position.y = 3.6;
    board.add(panel);
    for (const x of [-4.5, 4.5]) board.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.3, 2.2, 0.3)), post).translateX(x).translateY(1.1));
    const side = adIndex % 2 ? 1 : -1;
    frame(board, s, side * (wall + 1.6));
    reserved.push({ x: board.position.x, z: board.position.z, radius: 8 });
  }

  // Chevrons on the outside of the tight corners, angled toward oncoming cars.
  const chevron = keep(chevronTexture());
  const chevronMaterial = keep(new THREE.MeshLambertMaterial({ map: chevron, side: THREE.DoubleSide }));
  const chevronGeometry = keep(new THREE.PlaneGeometry(2.6, 1.3));
  let lastChevron = Number.NEGATIVE_INFINITY;
  for (const sample of path.samples) {
    if (Math.abs(sample.curve) < 1 / 75 || sample.s - lastChevron < 14) continue;
    lastChevron = sample.s;
    const side = -Math.sign(sample.curve);
    const inward = { x: -sample.rx * side, z: -sample.rz * side };
    const mesh = new THREE.Mesh(chevronGeometry, chevronMaterial);
    const lateral = side * (wall + 0.4);
    mesh.position.set(sample.x + sample.rx * lateral, sample.y + 1.6, sample.z + sample.rz * lateral);
    mesh.rotation.y = Math.atan2(-sample.tx + inward.x * 0.7, -sample.tz + inward.z * 0.7);
    if (sample.curve < 0) mesh.scale.x = -1;
    scene.add(mesh);
  }

  // Footbridge and overhead banner gantries on circuits and in town.
  if (setting !== 'country') {
    const bridge = new THREE.Group();
    const bridgeSpan = wall * 2 + 4;
    const [bridgeLines, bridgeBackground, bridgeInk] = adList[1];
    const bridgeFace = sign(bridgeLines, bridgeBackground, bridgeInk, '#e8322b');
    const deckMaterial = material(region === 'sweden' ? '#7a5634' : '#8d96a0');
    const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(bridgeSpan, 2.2, 3)), [
      deckMaterial,
      deckMaterial,
      deckMaterial,
      deckMaterial,
      bridgeFace,
      bridgeFace,
    ]);
    deck.position.y = 7.4;
    bridge.add(deck);
    for (const x of [-bridgeSpan / 2 + 1, bridgeSpan / 2 - 1])
      bridge.add(new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 7, 2.4)), deckMaterial).translateX(x).translateY(3.2));
    let bridgeS = 330;
    while (Math.abs(sampleAt(path, bridgeS).curve) > 1 / 200 && bridgeS < 700) bridgeS += 10;
    const bridgeSample = sampleAt(path, bridgeS);
    bridge.position.set(bridgeSample.x, bridgeSample.y, bridgeSample.z);
    bridge.rotation.y = Math.atan2(-bridgeSample.rz, bridgeSample.rx);
    scene.add(bridge);

    [adList[3], adList[0]].forEach(([lines, background, ink, accent], index) => {
      let s = path.length * (0.42 + index * 0.2);
      for (let tries = 0; tries < 80 && (nearTunnel(s) || Math.abs(sampleAt(path, s).curve) > 1 / 150); tries++) s += 20;
      const overhead = new THREE.Group();
      const face = sign(lines, background, ink, accent);
      const truss = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 2, wall * 2 + 1)), [face, face, steel, steel, steel, steel]);
      truss.position.y = 7.6;
      overhead.add(truss);
      for (const side of [-1, 1])
        overhead.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 8.6, 0.5)), steel).translateZ(side * (wall + 0.6)).translateY(4.3));
      frame(overhead, s, 0, false);
    });
  }

  // Tunnel: concrete walls and ceiling with lamp rows.
  const tunnelHeight = 7;
  const tunnelPositions: number[] = [];
  const tunnelUvs: number[] = [];
  const corner = (s: number, lateral: number, height: number) => {
    const sample = sampleAt(path, s);
    return [sample.x + sample.rx * lateral, sample.y + height, sample.z + sample.rz * lateral];
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], uv: number[][]) => {
    tunnelPositions.push(...a, ...b, ...c, ...c, ...b, ...d);
    for (const index of [0, 1, 2, 2, 1, 3]) tunnelUvs.push(...uv[index]);
  };
  for (let s = tunnel.start; s < tunnel.end; s += path.spacing) {
    const next = s + path.spacing;
    for (const side of [-wall, wall]) {
      quad(corner(s, side, -0.6), corner(next, side, -0.6), corner(s, side, tunnelHeight), corner(next, side, tunnelHeight), [
        [s / 6, 0],
        [next / 6, 0],
        [s / 6, 1],
        [next / 6, 1],
      ]);
    }
    quad(corner(s, -wall, tunnelHeight), corner(s, wall, tunnelHeight), corner(next, -wall, tunnelHeight), corner(next, wall, tunnelHeight), [
      [s / 6, 0],
      [s / 6, 3],
      [next / 6, 0],
      [next / 6, 3],
    ]);
  }
  const tunnelGeometry = keep(new THREE.BufferGeometry());
  tunnelGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tunnelPositions, 3));
  tunnelGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(tunnelUvs, 2));
  tunnelGeometry.computeVertexNormals();
  const concrete = keep(concreteTexture());
  scene.add(new THREE.Mesh(tunnelGeometry, keep(new THREE.MeshLambertMaterial({ map: concrete, color: '#8a8780', side: THREE.DoubleSide }))));

  const lampMaterial = keep(new THREE.MeshBasicMaterial({ color: '#ffe7a0' }));
  const lampGeometry = keep(new THREE.BoxGeometry(0.5, 0.12, 2.4));
  for (let s = tunnel.start + 4; s < tunnel.end; s += 9) {
    for (const lateral of [-wall * 0.45, wall * 0.45]) {
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.fromArray(corner(s, lateral, tunnelHeight - 0.08));
      lamp.rotation.y = Math.atan2(sampleAt(path, s).tx, sampleAt(path, s).tz);
      scene.add(lamp);
    }
  }

  const portalMaterial = keep(new THREE.MeshLambertMaterial({ map: concrete, color: '#b8b4aa' }));
  const portalSign = sign([track.tunnelName], '#1b2a4a', '#f4f4f4', '#ffcc1a');
  for (const s of [tunnel.start, tunnel.end]) {
    const portal = new THREE.Group();
    const portalBeam = new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, 3.4, wall * 2 + 10)), [
      portalSign,
      portalSign,
      portalMaterial,
      portalMaterial,
      portalMaterial,
      portalMaterial,
    ]);
    portalBeam.position.y = tunnelHeight + 1.7;
    portal.add(portalBeam);
    for (const side of [-1, 1])
      portal.add(
        new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, tunnelHeight + 4, 5)), portalMaterial)
          .translateZ(side * (wall + 2.5))
          .translateY((tunnelHeight + 4) / 2 - 1),
      );
    frame(portal, s, 0, false);
  }

  const mid = sampleAt(path, (tunnel.start + tunnel.end) / 2);
  if (setting !== 'city') {
    const hillMaterial = material(look.terrainTint[1]);
    for (const side of [-1, 1]) {
      const hill = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1, 2)), hillMaterial);
      hill.scale.set((tunnel.end - tunnel.start) / 2 + 12, 16, 22);
      hill.position.set(mid.x + mid.rx * side * (wall + 22), mid.y - 1, mid.z + mid.rz * side * (wall + 22));
      hill.rotation.y = Math.atan2(-mid.tz, mid.tx);
      scene.add(hill);
      reserved.push({ x: hill.position.x, z: hill.position.z, radius: 30 });
    }
  }

  // City streets: lamp posts and blocks of facades, with a taller second row behind.
  if (setting === 'city' && (theme === 'stockholm' || theme === 'hamburg')) {
    const lit = look.litWindows > 0.3;
    const lampHead = keep(new THREE.MeshBasicMaterial({ color: lit ? '#fff1c0' : '#c9ccd0' }));
    const lampPost = material('#2c3036');
    for (let s = 10; s < path.length; s += 32) {
      if (s > tunnel.start - 10 && s < tunnel.end + 10) continue;
      for (const side of [-1, 1]) {
        const lamp = new THREE.Group();
        lamp.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.14, 7, 6)), lampPost).translateY(3.5));
        lamp.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.15, 0.15, 1.8)), lampPost).translateY(7).translateZ(-0.9));
        lamp.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.18, 0.8)), lampHead).translateY(6.88).translateZ(-1.7));
        frame(lamp, s, side * (wall + 0.8));
      }
    }

    const palette = facades[theme];
    const modern = !isRetro();
    const walls = palette.walls.flatMap((color, index) =>
      [0, 1].map((variant) => {
        const seed = index * 10 + variant + 3;
        const map = modern ? facadeDetailTexture(color, look.litWindows, seed) : facadeTexture(color, look.litWindows, seed);
        return keep(new THREE.MeshLambertMaterial({ map: keep(map) }));
      }),
    );
    const roofs = palette.roofs.map((color) => material(color));
    const shops = [0, 1, 2, 3, 4, 5].map((seed) => keep(new THREE.MeshLambertMaterial({ map: keep(shopTexture(seed + (theme === 'hamburg' ? 6 : 0))) })));
    const stoneTrim = material(theme === 'hamburg' ? '#cfc8bc' : '#efe6d2');
    const plinth = material('#4a4744');
    const rooftop = [material('#8d9196'), material('#6e3a2c'), material('#a6a8aa')];
    const box = (width: number, height: number, depth: number, materials: THREE.Material | THREE.Material[], y: number) => {
      const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), materials);
      mesh.position.y = y + height / 2;
      return mesh;
    };
    // A street-front building: plinth and shop floor, upper storeys, cornices and roof clutter.
    const detailed = (width: number, depth: number, height: number, front: boolean) => {
      const holder = new THREE.Group();
      const wallMaterial = walls[Math.floor(random() * walls.length)];
      const roofMaterial = roofs[Math.floor(random() * roofs.length)];
      const base = front ? 4.5 : -1;
      if (front) {
        const shop = shops[Math.floor(random() * shops.length)];
        const shopFloor = keep(scaleBoxUv(new THREE.BoxGeometry(width, 4.5, depth), width, 4.5, depth, 8, 4.5));
        holder.add(new THREE.Mesh(shopFloor, [shop, shop, roofMaterial, roofMaterial, shop, shop]).translateY(2.25));
        holder.add(box(width + 0.2, 1.3, depth + 0.2, plinth, -1));
        holder.add(box(width + 0.5, 0.35, depth + 0.5, stoneTrim, 4.4));
      }
      const upper = height - base;
      const storeys = keep(scaleBoxUv(new THREE.BoxGeometry(width, upper, depth), width, upper, depth));
      holder.add(new THREE.Mesh(storeys, [wallMaterial, wallMaterial, roofMaterial, roofMaterial, wallMaterial, wallMaterial]).translateY(base + upper / 2));
      holder.add(box(width + 0.7, 0.6, depth + 0.7, stoneTrim, height - 0.3));
      holder.add(box(width - 0.4, 0.9, depth - 0.4, wallMaterial, height));
      for (let i = 0, count = 1 + Math.floor(random() * 3); i < count; i++) {
        const kind = Math.floor(random() * 3);
        const [w, h, d] = kind === 0 ? [1.6, 1.1, 1.2] : kind === 1 ? [0.9, 2.4, 0.9] : [4, 2.6, 3];
        const unit = box(w, h, d, rooftop[kind], height + 0.3);
        unit.position.x = (random() - 0.5) * (width - w - 2);
        unit.position.z = (random() - 0.5) * (depth - d - 2);
        holder.add(unit);
      }
      return holder;
    };
    const block = (s: number, lateral: number, width: number, depth: number, height: number) => {
      const sample = sampleAt(path, s);
      const side = Math.sign(lateral);
      for (const along of [-width / 2, width / 2]) {
        for (const across of [-depth / 2, depth / 2]) {
          const x = sample.x + sample.tx * along + sample.rx * (lateral + side * across);
          const z = sample.z + sample.tz * along + sample.rz * (lateral + side * across);
          if (ground.trackDistance(x, z) < wall + 2.5 || ground.inLake(x, z)) return false;
        }
      }
      const x = sample.x + sample.rx * lateral;
      const z = sample.z + sample.rz * lateral;
      if (reserved.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius)) return false;
      if (modern) {
        frame(detailed(width, depth, height, Math.abs(lateral) < wall + 4 + depth), s, lateral);
        return true;
      }
      const wallMaterial = walls[Math.floor(random() * walls.length)];
      const roofMaterial = roofs[Math.floor(random() * roofs.length)];
      const geometry = keep(scaleBoxUv(new THREE.BoxGeometry(width, height, depth), width, height, depth));
      const building = new THREE.Mesh(geometry, [wallMaterial, wallMaterial, roofMaterial, roofMaterial, wallMaterial, wallMaterial]);
      building.position.y = height / 2 - 1;
      const holder = new THREE.Group();
      holder.add(building);
      frame(holder, s, lateral);
      return true;
    };
    for (const side of [-1, 1]) {
      for (let s = 0; s < path.length; ) {
        const width = 14 + random() * 12;
        const depth = 12 + random() * 10;
        const [low, high] = palette.heights;
        block(s + width / 2, side * (wall + 3 + depth / 2), width, depth, low + random() * (high - low));
        if (random() < 0.7) block(s + width / 2, side * (wall + 8 + depth * 1.5), width, depth, high + random() * 10);
        s += width + 1 + random() * 3;
      }
    }
  }

  // Houses and farms; Swedish ones are falu red with white corners, German ones half-timbered.
  const houseWalls = keep(region === 'sweden' ? windowsTexture('#8e2a1e', '#f2f2ee', '#2b3a4a') : windowsTexture('#efe8d8', '#4a3020', '#2b3a4a', true));
  houseWalls.repeat.set(2, 1);
  const houseMaterial = keep(new THREE.MeshLambertMaterial({ map: houseWalls }));
  const houseRoof = material(region === 'sweden' ? '#3a3836' : '#9a4428');
  const trimMaterial = material('#f2f2ee');
  const house = (width: number, depth: number, height: number) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), houseMaterial).translateY(height / 2));
    const roof = new THREE.Mesh(keep(prism(depth + 1, height * 0.7, width + 0.8)), houseRoof);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = height;
    group.add(roof);
    if (region === 'sweden') {
      for (const x of [-width / 2, width / 2])
        for (const z of [-depth / 2, depth / 2])
          group.add(
            new THREE.Mesh(keep(new THREE.BoxGeometry(0.3, height, 0.3)), trimMaterial)
              .translateX(x)
              .translateY(height / 2)
              .translateZ(z),
          );
    }
    return group;
  };

  if (setting !== 'city') {
    const count = setting === 'country' ? 18 : theme === 'vaxjo' ? 16 : 22;
    for (let i = 0; i < count; i++) {
      const spot = findSpot(32, 160, 9);
      if (!spot) continue;
      const building = house(7 + random() * 5, 6 + random() * 3, 3.5 + random() * (region === 'sweden' ? 1.5 : 4));
      building.rotation.y = spot.facing + (random() - 0.5) * 0.4;
      place(building, spot.x, spot.z, 10);
    }
  }

  if (setting === 'country') {
    // Barns and round hay bales out in the fields.
    for (let i = 0; i < 7; i++) {
      const spot = findSpot(50, 260, 14);
      if (!spot) continue;
      const barn = house(16 + random() * 6, 10 + random() * 3, 6 + random() * 2);
      barn.rotation.y = spot.facing + (random() - 0.5) * 0.6;
      place(barn, spot.x, spot.z, 16);
    }
    const bale = material('#e8e2c8');
    const baleGeometry = keep(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 10));
    baleGeometry.rotateZ(Math.PI / 2);
    for (let i = 0; i < 45; i++) {
      const spot = findSpot(40, 300, 2);
      if (!spot) continue;
      const mesh = new THREE.Mesh(baleGeometry, bale);
      mesh.rotation.y = random() * Math.PI;
      place(mesh, spot.x, spot.z, 2).position.y += 0.6;
    }
  }

  const flagMaterial = keep(new THREE.MeshLambertMaterial({ map: keep(flagTexture(region)), side: THREE.DoubleSide }));
  const poleMaterial = material('#f2f2ee');
  const flags = (spots: readonly (readonly [number, number])[]) => {
    for (const [s, lateral] of spots) {
      const pole = new THREE.Group();
      pole.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.12, 10, 6)), poleMaterial).translateY(5));
      const cloth = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.2, 2)), flagMaterial);
      cloth.position.set(1.65, 8.9, 0);
      const holder = new THREE.Group();
      holder.userData.dynamic = true;
      holder.add(cloth);
      pole.add(holder);
      frame(pole, s, lateral);
      animated.push((time) => {
        holder.rotation.y = Math.sin(time * 2.1 + s) * 0.35;
      });
    }
  };

  const stone = material('#b8ae9c');
  const redRoof = material('#9a3b28');
  const castle = (x: number, z: number) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(16, 26, 16)), stone).translateY(13));
    group.add(new THREE.Mesh(keep(new THREE.ConeGeometry(12.5, 10, 4)), redRoof).translateY(31).rotateY(Math.PI / 4));
    for (const [cx, cz] of [
      [-22, -22],
      [22, -22],
      [-22, 22],
      [22, 22],
    ]) {
      group.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(4, 4.5, 20, 8)), stone).translateX(cx).translateZ(cz).translateY(10));
      group.add(new THREE.Mesh(keep(new THREE.ConeGeometry(5, 9, 8)), redRoof).translateX(cx).translateZ(cz).translateY(24.5));
    }
    for (const [cx, cz, rotate] of [
      [0, -22, 0],
      [0, 22, 0],
      [-22, 0, 1],
      [22, 0, 1],
    ]) {
      const wallMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(40, 12, 3)), stone);
      wallMesh.position.set(cx, 6, cz);
      wallMesh.rotation.y = rotate * (Math.PI / 2);
      group.add(wallMesh);
    }
    place(group, x, z, 50);
  };

  const church = (tower: number, spireColor: string) => {
    const group = new THREE.Group();
    const plaster = material(region === 'sweden' ? '#e9dcc0' : '#ece4d2');
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(10, 9, 22)), plaster).translateY(4.5));
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(6, tower, 6)), plaster).translateY(tower / 2).translateZ(-12));
    group.add(
      new THREE.Mesh(keep(new THREE.ConeGeometry(4.4, tower * 0.6, 4)), material(spireColor))
        .translateY(tower + tower * 0.3)
        .translateZ(-12)
        .rotateY(Math.PI / 4),
    );
    const roof = new THREE.Mesh(keep(prism(11, 6, 22)), redRoof);
    roof.position.y = 9;
    group.add(roof);
    const spot = findSpot(setting === 'city' ? 60 : 70, setting === 'city' ? 120 : 150, 18);
    if (!spot) return;
    group.rotation.y = spot.facing;
    place(group, spot.x, spot.z, 18);
  };

  const jetty = () => {
    if (!track.lake) return;
    const group = new THREE.Group();
    const wood = material('#7a5634');
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(3, 0.4, 26)), wood).translateY(-0.9).translateZ(13));
    const boathouse = house(6, 5, 3);
    boathouse.position.set(0, -1, -2);
    group.add(boathouse);
    group.position.set(track.lake.x, 0, track.lake.z - track.lake.rz * 1.25);
    scene.add(group);
  };

  // Landmarks that give each track its own skyline.
  if (theme === 'vaxjo') {
    flags([
      [-40, wall + 3],
      [-25, wall + 3],
      [-10, wall + 3],
      [20, -(wall + 3)],
    ]);
    const tower = new THREE.Group();
    const white = material('#ecebe6');
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(2.4, 3, 24, 10)), white).translateY(12));
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 3, 8, 12)), white).translateY(27));
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 9, 3, 12)), white).translateY(32.5));
    const hill = track.hills?.[0];
    if (hill) place(tower, hill.x, hill.z, 20);
    jetty();
  } else if (theme === 'germany' || theme === 'schwarzwald') {
    const hill = track.hills?.[0];
    if (hill) castle(hill.x, hill.z);
    church(24, '#4a6a5a');
    if (theme === 'germany') {
      const turbineWhite = material('#f0f2f4');
      for (const [x, z] of [
        [-950, 250],
        [-1050, 560],
        [1150, 80],
        [1180, 420],
      ]) {
        const turbine = new THREE.Group();
        turbine.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1.8, 70, 8)), turbineWhite).translateY(35));
        const rotor = new THREE.Group();
        rotor.userData.dynamic = true;
        rotor.position.set(0, 70, 3);
        for (let blade = 0; blade < 3; blade++) {
          const arm = new THREE.Mesh(keep(new THREE.BoxGeometry(1.4, 26, 0.4)), turbineWhite);
          arm.position.y = 13;
          const holder = new THREE.Group();
          holder.rotation.z = (blade * Math.PI * 2) / 3;
          holder.add(arm);
          rotor.add(holder);
        }
        turbine.add(rotor, new THREE.Mesh(keep(new THREE.BoxGeometry(3, 3, 7)), turbineWhite).translateY(70));
        turbine.rotation.y = Math.atan2(look.sun.x, look.sun.z);
        place(turbine, x, z, 10);
        const speed = 0.6 + random() * 0.4;
        animated.push((time) => {
          rotor.rotation.z = time * speed;
        });
      }
    }
  } else if (theme === 'stockholm') {
    flags([
      [-30, wall + 2],
      [-15, wall + 2],
      [0, wall + 2],
    ]);
    church(34, '#3f7a64');
    const lake = track.lake;
    if (lake) {
      const hull = material('#f2f2ee');
      const cabin = material('#2a6fd6');
      for (let i = 0; i < 6; i++) {
        const boat = new THREE.Group();
        boat.add(new THREE.Mesh(keep(new THREE.BoxGeometry(14, 2, 4)), hull).translateY(0.2));
        boat.add(new THREE.Mesh(keep(new THREE.BoxGeometry(6, 2, 3)), cabin).translateY(2));
        boat.position.set(lake.x - lake.rx * 0.8 + i * lake.rx * 0.3, -1.4, lake.z + (random() - 0.2) * lake.rz * 0.6);
        boat.rotation.y = random() * 0.4;
        scene.add(boat);
      }
    }
  } else if (theme === 'hamburg') {
    church(46, '#3f6a5e');
    const lake = track.lake;
    if (lake) {
      const craneMaterial = material('#c9a020');
      const containerColors = ['#b8352a', '#2a6fd6', '#2f8a4a', '#d9a020', '#6d6a66'].map((color) => material(color));
      for (let i = 0; i < 6; i++) {
        const x = lake.x - lake.rx * 0.8 + i * lake.rx * 0.32;
        const z = lake.z - lake.rz * 1.05;
        if (ground.trackDistance(x, z) < wall + 20) continue;
        const crane = new THREE.Group();
        for (const [lx, lz] of [
          [-4, -4],
          [4, -4],
          [-4, 4],
          [4, 4],
        ])
          crane.add(new THREE.Mesh(keep(new THREE.BoxGeometry(1, 30, 1)), craneMaterial).translateX(lx).translateZ(lz).translateY(15));
        crane.add(new THREE.Mesh(keep(new THREE.BoxGeometry(10, 4, 10)), craneMaterial).translateY(32));
        crane.add(new THREE.Mesh(keep(new THREE.BoxGeometry(2, 2, 60)), craneMaterial).translateY(34).translateZ(18));
        place(crane, x, z, 12);
        for (let stack = 0; stack < 5; stack++) {
          const box = new THREE.Mesh(keep(new THREE.BoxGeometry(12, 2.6, 2.5)), containerColors[Math.floor(random() * containerColors.length)]);
          const cx = x + (random() - 0.5) * 30;
          const cz = z - 18 - random() * 20;
          if (ground.trackDistance(cx, cz) < wall + 8) continue;
          box.position.set(cx, ground.height(cx, cz) + 1.3 + Math.floor(random() * 3) * 2.6, cz);
          scene.add(box);
        }
      }
    }
  } else if (theme === 'smaland') {
    flags([
      [-30, wall + 3],
      [-12, wall + 3],
    ]);
    jetty();
  }

  // Forests: dense close to the barriers, thinning out toward the horizon.
  const forest = forests[theme];
  const center = path.samples.reduce((sum, sample) => ({ x: sum.x + sample.x / path.samples.length, z: sum.z + sample.z / path.samples.length }), {
    x: 0,
    z: 0,
  });
  const blocked = (x: number, z: number) => reserved.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius);
  if (!isRetro()) disposables.push(...plantFoliage({ scene, region, theme, ground, wall, forest, center, random, blocked }));
  else plantRetroForest();

  function plantRetroForest() {
    const { pine, leafy } = treeGeometries(region);
    keep(pine);
    keep(leafy);
    const treeMaterial = material('#ffffff', { vertexColors: true });
    const transforms: { pine: THREE.Matrix4[]; leafy: THREE.Matrix4[] } = { pine: [], leafy: [] };
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let attempt = 0; attempt < 60000 && transforms.pine.length + transforms.leafy.length < forest.count; attempt++) {
      const x = center.x + (random() - 0.5) * 2500;
      const z = center.z + (random() - 0.5) * 2500;
      const distance = ground.trackDistance(x, z);
      if (distance < wall + forest.clearance || ground.inLake(x, z)) continue;
      if (random() > (distance < 90 ? 0.95 : distance < 300 ? 0.45 : 0.18)) continue;
      if (blocked(x, z)) continue;
      const kind = random() < forest.pines ? 'pine' : 'leafy';
      const size = 0.8 + random() * 0.7;
      quaternion.setFromAxisAngle(up, random() * Math.PI * 2);
      transforms[kind].push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, ground.height(x, z) - 0.3, z),
          quaternion,
          new THREE.Vector3(size, size * (0.85 + random() * 0.4), size),
        ),
      );
    }
    const tint = new THREE.Color();
    for (const kind of ['pine', 'leafy'] as const) {
      if (!transforms[kind].length) continue;
      const mesh = new THREE.InstancedMesh(kind === 'pine' ? pine : leafy, treeMaterial, transforms[kind].length);
      transforms[kind].forEach((matrix, index) => {
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, tint.setHSL(0, 0, 0.78 + random() * 0.3));
      });
      mesh.computeBoundingSphere();
      scene.add(mesh);
      disposables.push({ dispose: () => mesh.dispose() });
    }
  }

  return {
    setStartLights(lit: number, green: boolean) {
      lamps.forEach((lamp, index) => {
        lamp.color.set(green ? '#36ff5a' : index < lit ? '#ff2a1a' : '#2a0a0a');
      });
    },
    update(time: number) {
      for (const animate of animated) animate(time);
    },
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

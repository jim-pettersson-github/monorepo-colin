import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sampleAt } from '../game/track-path';
import type { Track } from '../game/tracks';
import { chevronTexture, concreteTexture, crowdTexture, seeded, signTexture, texture, windowsTexture } from './textures';
import type { Ground, ThemeLook } from './track-world';

type Disposable = { dispose: () => void };

const ads = {
  vaxjo: [
    [['SMÅLANDS BENSIN'], '#ffcc1a', '#11284f', '#11284f'],
    [['KRONOBERG DÄCK'], '#111111', '#f4f4f4', '#e8322b'],
    [['GLASBRUKET'], '#1c6fb8', '#ffffff', undefined],
    [['VÄXJÖ', 'MOTORRING'], '#f4f4f4', '#0a5ea8', '#ffcc1a'],
    [['TURBO-OLJA'], '#e8322b', '#ffffff', '#111111'],
    [['RADIO SPRINT 104,5'], '#2c2c34', '#ffcc1a', undefined],
    [['SJÖKIOSKEN', 'GLASS & KAFFE'], '#f7f0e0', '#8e2a1e', undefined],
  ],
  germany: [
    [['RHEIN ÖL'], '#0f3f8f', '#ffcc1a', '#ffcc1a'],
    [['BREZEL BRÄU'], '#f4ead2', '#7a2a18', undefined],
    [['REIFEN WOLF'], '#111111', '#ffcc1a', '#e8322b'],
    [['RHEINLAND', 'RING'], '#e8322b', '#ffffff', undefined],
    [['SCHNELL-KAFFEE'], '#5a3a28', '#f4ead2', undefined],
    [['ZÜNDKERZEN KRAFT'], '#f4f4f4', '#1a1a1a', '#1f8a3c'],
    [['MOTOR-FUNK 98,1'], '#2a6fd6', '#ffffff', undefined],
  ],
} as const;

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

function treeGeometries(theme: Track['theme']) {
  const pine = mergeGeometries([
    colored(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 5), '#5a3b26', 0, 1.2, 0),
    colored(new THREE.ConeGeometry(2.6, 5, 6), '#24502a', 0, 4.2, 0),
    colored(new THREE.ConeGeometry(1.9, 4, 6), '#2b5e30', 0, 6.6, 0),
    colored(new THREE.ConeGeometry(1.1, 3, 6), '#336b36', 0, 8.6, 0),
  ]);
  const leafy =
    theme === 'vaxjo'
      ? mergeGeometries([
          colored(new THREE.CylinderGeometry(0.16, 0.24, 6, 5), '#ebe7de', 0, 3, 0),
          colored(new THREE.IcosahedronGeometry(2.2, 0).scale(1, 1.5, 1), '#7aa646', 0, 7.2, 0),
        ])
      : mergeGeometries([
          colored(new THREE.CylinderGeometry(0.3, 0.42, 3.2, 5), '#5a3b26', 0, 1.6, 0),
          colored(new THREE.IcosahedronGeometry(3.4, 0), '#4f8a2e', 0, 5.6, 0),
          colored(new THREE.IcosahedronGeometry(2.4, 0), '#5f9a36', 1.2, 7.2, 0.6),
        ]);
  return { pine, leafy };
}

function prism(width: number, height: number, depth: number) {
  const shape = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, height)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
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
  const random = seeded(track.id === 'vaxjo' ? 1729 : 4242);
  const { path, halfWidth, wall, theme } = track;
  const material = (color: string, options: THREE.MeshLambertMaterialParameters = {}) =>
    keep(new THREE.MeshLambertMaterial({ color, flatShading: true, ...options }));

  // Local frame at distance s: +x runs along the track, -z faces the road and +z points away from it.
  const frame = (object: THREE.Object3D, s: number, lateral: number, onGround = true) => {
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
    gantry.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.7, 0.7, 0.7)), lamp).translateY(5.9).translateZ((index - 2) * 1.2));
    return lamp;
  });
  const start = path.samples[0];
  gantry.position.set(start.x, start.y, start.z);
  gantry.rotation.y = Math.atan2(start.rx, start.rz);
  scene.add(gantry);

  // Grandstands on the left of the main straight and pit garages on the right.
  const crowd = keep(crowdTexture(5));
  crowd.repeat.set(4, 1);
  const crowdMaterial = keep(new THREE.MeshLambertMaterial({ map: crowd }));
  const standConcrete = material('#b9b4a8');
  const roofMaterial = material(theme === 'vaxjo' ? '#2c5d9a' : '#d8d8d8');
  for (let s = 30; s < 280; s += 58) {
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
    for (const x of [-24, 0, 24]) stand.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 11.5, 0.5)), steel).translateX(x).translateY(5.75).translateZ(15.2));
    frame(stand, s, -(wall + 5));
    reserved.push({ x: stand.position.x, z: stand.position.z, radius: 40 });
  }

  const pitWindows = keep(windowsTexture('#e9e9e4', '#30343c', '#5b7690'));
  pitWindows.repeat.set(30, 1);
  const pits = new THREE.Group();
  const pitWall = keep(new THREE.MeshLambertMaterial({ map: pitWindows }));
  const pitRoof = material('#7a7f88');
  pits.add(new THREE.Mesh(keep(new THREE.BoxGeometry(200, 7, 14)), [pitRoof, pitRoof, pitRoof, pitRoof, pitWall, pitWall]).translateY(3.5).translateZ(7));
  const pitSign = new THREE.Mesh(
    keep(new THREE.BoxGeometry(60, 4, 0.5)),
    sign(theme === 'vaxjo' ? ['VÄXJÖ MOTORRING'] : ['RHEINLAND-RING'], '#111111', '#ffcc1a'),
  );
  pitSign.position.set(0, 9, 1);
  pitSign.rotation.y = Math.PI;
  pits.add(pitSign);
  frame(pits, 150, wall + 6);
  for (let s = 40; s <= 260; s += 40) {
    const sample = sampleAt(path, s);
    reserved.push({ x: sample.x + sample.rx * (wall + 14), z: sample.z + sample.rz * (wall + 14), radius: 28 });
  }

  const { tunnel } = track;
  const nearTunnel = (s: number) => s > tunnel.start - 40 && s < tunnel.end + 40;

  // Billboards around the lap, alternating sides.
  const adList = ads[theme];
  const post = material('#8a8f96');
  let adIndex = 0;
  for (let s = 360; s < path.length - 120; s += 150 + random() * 90) {
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

  // Footbridge over the main straight.
  const bridge = new THREE.Group();
  const bridgeSpan = halfWidth * 2 + 10;
  const bridgeFace = sign(
    theme === 'vaxjo' ? ['KRONOBERG DÄCK'] : ['RHEIN ÖL'],
    theme === 'vaxjo' ? '#111111' : '#0f3f8f',
    theme === 'vaxjo' ? '#f4f4f4' : '#ffcc1a',
    '#e8322b',
  );
  const deckMaterial = material(theme === 'vaxjo' ? '#7a5634' : '#8d96a0');
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
  const bridgeSample = sampleAt(path, theme === 'vaxjo' ? 330 : 520);
  bridge.position.set(bridgeSample.x, bridgeSample.y, bridgeSample.z);
  bridge.rotation.y = Math.atan2(-bridgeSample.rz, bridgeSample.rx);
  scene.add(bridge);

  // Tunnel: concrete walls and ceiling with lamp rows, flanked by grassy hills.
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
  const portalSign = sign(theme === 'vaxjo' ? ['SKOGSTUNNELN'] : ['BURGTUNNEL'], '#1b2a4a', '#f4f4f4', '#ffcc1a');
  for (const s of [tunnel.start, tunnel.end]) {
    const portal = new THREE.Group();
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, 3.4, wall * 2 + 10)), [
      portalSign,
      portalSign,
      portalMaterial,
      portalMaterial,
      portalMaterial,
      portalMaterial,
    ]);
    beam.position.y = tunnelHeight + 1.7;
    portal.add(beam);
    for (const side of [-1, 1])
      portal.add(
        new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, tunnelHeight + 4, 5)), portalMaterial)
          .translateZ(side * (wall + 2.5))
          .translateY((tunnelHeight + 4) / 2 - 1),
      );
    frame(portal, s, 0, false);
  }

  const hillMaterial = material(look.terrainTint[1]);
  const mid = sampleAt(path, (tunnel.start + tunnel.end) / 2);
  for (const side of [-1, 1]) {
    const hill = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1, 2)), hillMaterial);
    hill.scale.set((tunnel.end - tunnel.start) / 2 + 12, 16, 22);
    hill.position.set(mid.x + mid.rx * side * (wall + 22), mid.y - 1, mid.z + mid.rz * side * (wall + 22));
    hill.rotation.y = Math.atan2(-mid.tz, mid.tx);
    scene.add(hill);
    reserved.push({ x: hill.position.x, z: hill.position.z, radius: 30 });
  }

  // Overhead banner gantries spanning the road.
  const gantryAds = theme === 'vaxjo' ? [adList[3], adList[0]] : [adList[3], adList[2]];
  gantryAds.forEach(([lines, background, ink, accent], index) => {
    let s = path.length * (0.42 + index * 0.2);
    while (nearTunnel(s) || Math.abs(sampleAt(path, s).curve) > 1 / 150) s += 20;
    const banner = new THREE.Group();
    const face = sign(lines, background, ink, accent);
    const truss = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 2, wall * 2 + 1)), [face, face, steel, steel, steel, steel]);
    truss.position.y = 7.6;
    banner.add(truss);
    for (const side of [-1, 1]) banner.add(new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 8.6, 0.5)), steel).translateZ(side * (wall + 0.6)).translateY(4.3));
    frame(banner, s, 0, false);
  });

  const place = (object: THREE.Object3D, x: number, z: number, radius: number) => {
    object.position.set(x, ground.height(x, z), z);
    scene.add(object);
    reserved.push({ x, z, radius });
    return object;
  };

  const findSpot = (minimum: number, maximum: number, radius: number) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const sample = sampleAt(path, random() * path.length);
      const lateral = (random() < 0.5 ? -1 : 1) * (minimum + random() * (maximum - minimum));
      const x = sample.x + sample.rx * lateral;
      const z = sample.z + sample.rz * lateral;
      if (ground.trackDistance(x, z) < wall + radius + 6 || ground.inLake(x, z)) continue;
      if (reserved.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius + radius)) continue;
      return { x, z, facing: Math.atan2(-sample.rx * Math.sign(lateral), -sample.rz * Math.sign(lateral)) };
    }
    return undefined;
  };

  const houseWalls = keep(theme === 'vaxjo' ? windowsTexture('#8e2a1e', '#f2f2ee', '#2b3a4a') : windowsTexture('#efe8d8', '#4a3020', '#2b3a4a', true));
  houseWalls.repeat.set(2, 1);
  const houseMaterial = keep(new THREE.MeshLambertMaterial({ map: houseWalls }));
  const houseRoof = material(theme === 'vaxjo' ? '#3a3836' : '#9a4428');
  const trimMaterial = material('#f2f2ee');

  const house = (width: number, depth: number, height: number) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(keep(new THREE.BoxGeometry(width, height, depth)), houseMaterial).translateY(height / 2));
    const roof = new THREE.Mesh(keep(prism(depth + 1, height * 0.7, width + 0.8)), houseRoof);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = height;
    group.add(roof);
    if (theme === 'vaxjo') {
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

  const houseCount = theme === 'vaxjo' ? 16 : 22;
  for (let i = 0; i < houseCount; i++) {
    const spot = findSpot(32, 160, 9);
    if (!spot) continue;
    const building = house(7 + random() * 5, 6 + random() * 3, 3.5 + random() * (theme === 'vaxjo' ? 1.5 : 4));
    building.rotation.y = spot.facing + (random() - 0.5) * 0.4;
    place(building, spot.x, spot.z, 10);
  }

  if (theme === 'vaxjo') {
    const flag = keep(
      texture(
        (() => {
          const element = document.createElement('canvas');
          element.width = 32;
          element.height = 20;
          const context = element.getContext('2d');
          if (context) {
            context.fillStyle = '#006aa7';
            context.fillRect(0, 0, 32, 20);
            context.fillStyle = '#fecc02';
            context.fillRect(10, 0, 4, 20);
            context.fillRect(0, 8, 32, 4);
          }
          return element;
        })(),
        false,
      ),
    );
    const flagMaterial = keep(new THREE.MeshLambertMaterial({ map: flag, side: THREE.DoubleSide }));
    const poleMaterial = material('#f2f2ee');
    for (const [s, lateral] of [
      [-40, wall + 3],
      [-25, wall + 3],
      [-10, wall + 3],
      [20, -(wall + 3)],
    ] as const) {
      const pole = new THREE.Group();
      pole.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.12, 10, 6)), poleMaterial).translateY(5));
      const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.2, 2)), flagMaterial);
      banner.position.set(1.65, 8.9, 0);
      const holder = new THREE.Group();
      holder.userData.dynamic = true;
      holder.add(banner);
      pole.add(holder);
      frame(pole, s, lateral);
      animated.push((time) => {
        holder.rotation.y = Math.sin(time * 2.1 + s) * 0.35;
      });
    }

    const tower = new THREE.Group();
    const white = material('#ecebe6');
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(2.4, 3, 24, 10)), white).translateY(12));
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 3, 8, 12)), white).translateY(27));
    tower.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 9, 3, 12)), white).translateY(32.5));
    place(tower, -520, 760, 20);

    const jetty = new THREE.Group();
    const wood = material('#7a5634');
    jetty.add(new THREE.Mesh(keep(new THREE.BoxGeometry(3, 0.4, 26)), wood).translateY(-0.9).translateZ(13));
    const boathouse = house(6, 5, 3);
    boathouse.position.set(0, -1, -2);
    jetty.add(boathouse);
    jetty.position.set(380, 0, 175 - 78 * 1.25);
    jetty.rotation.y = 0;
    scene.add(jetty);
  } else {
    const stone = material('#b8ae9c');
    const redRoof = material('#9a3b28');
    const castle = new THREE.Group();
    castle.add(new THREE.Mesh(keep(new THREE.BoxGeometry(16, 26, 16)), stone).translateY(13));
    castle.add(new THREE.Mesh(keep(new THREE.ConeGeometry(12.5, 10, 4)), redRoof).translateY(31).rotateY(Math.PI / 4));
    for (const [x, z] of [
      [-22, -22],
      [22, -22],
      [-22, 22],
      [22, 22],
    ]) {
      castle.add(new THREE.Mesh(keep(new THREE.CylinderGeometry(4, 4.5, 20, 8)), stone).translateX(x).translateZ(z).translateY(10));
      castle.add(new THREE.Mesh(keep(new THREE.ConeGeometry(5, 9, 8)), redRoof).translateX(x).translateZ(z).translateY(24.5));
    }
    for (const [x, z, rotate] of [
      [0, -22, 0],
      [0, 22, 0],
      [-22, 0, 1],
      [22, 0, 1],
    ]) {
      const wallMesh = new THREE.Mesh(keep(new THREE.BoxGeometry(40, 12, 3)), stone);
      wallMesh.position.set(x, 6, z);
      wallMesh.rotation.y = rotate * (Math.PI / 2);
      castle.add(wallMesh);
    }
    place(castle, 180, 860, 50);

    const church = new THREE.Group();
    const plaster = material('#ece4d2');
    church.add(new THREE.Mesh(keep(new THREE.BoxGeometry(10, 9, 22)), plaster).translateY(4.5));
    church.add(new THREE.Mesh(keep(new THREE.BoxGeometry(6, 24, 6)), plaster).translateY(12).translateZ(-12));
    church.add(
      new THREE.Mesh(keep(new THREE.ConeGeometry(4.4, 14, 4)), material('#4a6a5a'))
        .translateY(31)
        .translateZ(-12)
        .rotateY(Math.PI / 4),
    );
    const roof = new THREE.Mesh(keep(prism(11, 6, 22)), redRoof);
    roof.position.y = 9;
    church.add(roof);
    const spot = findSpot(70, 150, 18);
    if (spot) {
      church.rotation.y = spot.facing;
      place(church, spot.x, spot.z, 18);
    }

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

  // Forests: dense close to the barriers, thinning out toward the horizon.
  const { pine, leafy } = treeGeometries(theme);
  keep(pine);
  keep(leafy);
  const treeMaterial = material('#ffffff', { vertexColors: true });
  const transforms: { pine: THREE.Matrix4[]; leafy: THREE.Matrix4[] } = { pine: [], leafy: [] };
  const center = path.samples.reduce((sum, sample) => ({ x: sum.x + sample.x / path.samples.length, z: sum.z + sample.z / path.samples.length }), {
    x: 0,
    z: 0,
  });
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const target = theme === 'vaxjo' ? 2600 : 1900;
  for (let attempt = 0; attempt < 40000 && transforms.pine.length + transforms.leafy.length < target; attempt++) {
    const x = center.x + (random() - 0.5) * 2500;
    const z = center.z + (random() - 0.5) * 2500;
    const distance = ground.trackDistance(x, z);
    if (distance < wall + 8 || ground.inLake(x, z)) continue;
    if (random() > (distance < 90 ? 0.95 : distance < 300 ? 0.45 : 0.18)) continue;
    if (reserved.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius)) continue;
    const kind = random() < (theme === 'vaxjo' ? 0.68 : 0.35) ? 'pine' : 'leafy';
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
    const mesh = new THREE.InstancedMesh(kind === 'pine' ? pine : leafy, treeMaterial, transforms[kind].length);
    transforms[kind].forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, tint.setHSL(0, 0, 0.78 + random() * 0.3));
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    disposables.push({ dispose: () => mesh.dispose() });
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

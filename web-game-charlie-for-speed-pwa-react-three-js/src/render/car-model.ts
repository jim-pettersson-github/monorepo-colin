import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { batchStatic } from './batch';
import { ARCH_RADIUS, axles, buildBodyShape, WHEEL_RADIUS } from './car-body';
import { designs, type RimStyle } from './car-designs';
import { paceLiveryTexture, plateTexture } from './car-textures';
import { glowTexture, shadowTexture } from './textures';

let sharedShadow: THREE.Texture | undefined;
let sharedGlows: { red: THREE.Texture; white: THREE.Texture } | undefined;
const wheelCache = new Map<RimStyle, { rubber: THREE.BufferGeometry; metal: THREE.BufferGeometry }>();

// Tyre with rounded shoulders, a spoked rim face, barrel, hub cap and brake disc, built once per rim style.
function wheelGeometry(style: RimStyle) {
  const cached = wheelCache.get(style);
  if (cached) return cached;
  const rimRadius = 0.245;
  const profile = [
    [rimRadius, -0.125],
    [0.3, -0.135],
    [0.33, -0.12],
    [WHEEL_RADIUS, -0.07],
    [WHEEL_RADIUS, 0.07],
    [0.33, 0.12],
    [0.3, 0.135],
    [rimRadius, 0.125],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const rubber = new THREE.LatheGeometry(profile, 28);
  rubber.rotateZ(Math.PI / 2);

  const face = new THREE.Shape();
  face.absarc(0, 0, rimRadius, 0, Math.PI * 2, false);
  const spokes = style === 'five' ? 5 : style === 'multi' ? 10 : style === 'turbine' ? 8 : 0;
  if (style === 'dial') {
    for (let i = 0; i < 5; i++) {
      const hole = new THREE.Path();
      const angle = (i / 5) * Math.PI * 2;
      hole.absarc(Math.cos(angle) * 0.145, Math.sin(angle) * 0.145, 0.055, 0, Math.PI * 2, true);
      face.holes.push(hole);
    }
  } else {
    const gap = (Math.PI * 2) / spokes - (style === 'five' ? 0.36 : 0.16);
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + (style === 'turbine' ? 0.15 : 0);
      const hole = new THREE.Path();
      hole.absarc(0, 0, 0.215, angle + gap / 2, angle - gap / 2, true);
      hole.absarc(0, 0, 0.075, angle - gap / 2 + (style === 'turbine' ? 0.3 : 0), angle + gap / 2 + (style === 'turbine' ? 0.3 : 0), false);
      hole.closePath();
      face.holes.push(hole);
    }
  }
  const spokeFace = new THREE.ExtrudeGeometry(face, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 6,
  });
  spokeFace.rotateY(Math.PI / 2);
  spokeFace.translate(0.07, 0, 0);
  const barrel = new THREE.CylinderGeometry(rimRadius, rimRadius, 0.2, 28, 1, true);
  barrel.rotateZ(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(0.045, 0.05, 0.03, 16);
  cap.rotateZ(Math.PI / 2);
  cap.translate(0.115, 0, 0);
  const disc = new THREE.CylinderGeometry(0.19, 0.19, 0.022, 28);
  disc.rotateZ(Math.PI / 2);
  disc.translate(-0.02, 0, 0);
  const lip = new THREE.TorusGeometry(rimRadius - 0.009, 0.011, 6, 28);
  lip.rotateY(Math.PI / 2);
  lip.translate(0.105, 0, 0);
  const sourceParts = [spokeFace, barrel, cap, disc, lip];
  const parts = sourceParts.map((geometry) => {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    plain.deleteAttribute('uv');
    return plain;
  });
  const metal = mergeGeometries(parts);
  for (const geometry of new Set([...sourceParts, ...parts])) geometry.dispose();
  rubber.deleteAttribute('uv');
  const result = { rubber, metal };
  wheelCache.set(style, result);
  return result;
}

export type CarModel = {
  group: THREE.Group;
  setDistance: (distance: number) => void;
  update: (state: CarState, headingDot: number) => void;
  dispose: () => void;
};

export function buildCarModel(spec: CarSpec, headlightsOn = false): CarModel {
  const design = designs[spec.id] ?? designs.corvette;
  const { length, width } = spec;
  const nose = length / 2;
  const features = new Set(design.features);
  const shape = buildBodyShape(design, length, width);
  const { front, rear } = axles(design, length);
  const wheelScale = design.wheelScale ?? 1;
  const wheelRadius = WHEEL_RADIUS * wheelScale;
  const roofTop = Math.max(...design.cabin.map(([, v]) => v));
  const [rearBase, roofRear, roofFront, screenBase] = design.cabin;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.45, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x121e29,
    metalness: 0.15,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.7,
    side: design.openTop ? THREE.DoubleSide : THREE.FrontSide,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.55, metalness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: spec.trim, roughness: 0.35, metalness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e6e8, roughness: 0.12, metalness: 1 });
  const head = new THREE.MeshStandardMaterial({
    color: 0x9daeb9,
    emissive: 0xfff3d6,
    emissiveIntensity: headlightsOn ? 1.8 : 0,
    roughness: 0.2,
    metalness: 0.25,
  });
  const tail = new THREE.MeshStandardMaterial({ color: 0x650810, emissive: 0xff1a12, emissiveIntensity: headlightsOn ? 0.4 : 0.12, roughness: 0.24 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x6a3000, emissive: 0xff8a10, emissiveIntensity: 0.5, roughness: 0.18 });
  const caliperColor = ['f355', 'f550', 'diablo'].includes(spec.id) ? 0x8e2525 : 0x454951;
  const caliper = new THREE.MeshStandardMaterial({ color: caliperColor, roughness: 0.35, metalness: 0.3 });
  const plateMap = plateTexture();
  const plate = new THREE.MeshStandardMaterial({ map: plateMap, roughness: 0.4 });
  const materials: THREE.Material[] = [paint, glass, black, trim, chrome, head, tail, amber, caliper, plate];

  const add = (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, rotateX = 0, rotateY = 0, rotateZ = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotateX, rotateY, rotateZ);
    body.add(mesh);
    return mesh;
  };
  const rounded = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, rotateX = 0, rotateZ = 0, radius = 0.02) =>
    add(new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 2, h / 2, d / 2)), material, x, y, z, rotateX, 0, rotateZ);
  const disc = (radius: number, depth: number, material: THREE.Material, x: number, y: number, z: number, tilt = 0, facing = 1) =>
    add(new THREE.CylinderGeometry(radius, radius, depth, 20), material, x, y, z, (Math.PI / 2) * facing + tilt);
  // Height of the upper surface at z, from the crown (0) out to the shoulder (1).
  const surface = shape.surface;
  const ellipse = (x: number, z: number, w: number, d: number, taper = 0): [number, number][] =>
    Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      return [x + ((Math.cos(angle) * w) / 2) * (1 - (taper * (1 - Math.sin(angle))) / 2), z + (Math.sin(angle) * d) / 2];
    });
  // A small conforming patch is a flush lens or panel inset, rather than a box stuck on the bonnet.
  const hoodPatch = (outline: [number, number][], material: THREE.Material, lift = 0.009) => {
    const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length,
      cz = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
    const points = [[cx, cz], ...outline];
    const positions = points.flatMap(([x, z]) => [x, surface(z, Math.abs(x) / shape.section(z).halfWidth) + lift, z]);
    const indices = outline.flatMap((_, i) => [0, ((i + 1) % outline.length) + 1, i + 1]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(geometry, material);
  };
  const sidePatch = (side: number, outline: [number, number][], material: THREE.Material = black, lift = 0.008) => {
    const positions: number[] = [];
    const midpoint = (a: THREE.Vector2, b: THREE.Vector2) => new THREE.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2);
    const triangle = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth: number) => {
      if (depth) {
        const ab = midpoint(a, b),
          bc = midpoint(b, c),
          ca = midpoint(c, a);
        triangle(a, ab, ca, depth - 1);
        triangle(ab, b, bc, depth - 1);
        triangle(ca, bc, c, depth - 1);
        triangle(ab, bc, ca, depth - 1);
        return;
      }
      for (const point of side > 0 ? [a, c, b] : [a, b, c]) positions.push(side * (shape.flank(point.x, point.y) + lift), point.y, point.x);
    };
    const contour = outline.map(([z, y]) => new THREE.Vector2(z, y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) triangle(contour[a], contour[b], contour[c], 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return add(geometry, material);
  };
  const slopeAt = (z: number) => Math.atan2(surface(z + 0.1, 0.5) - surface(z - 0.1, 0.5), 0.2);

  // Body and glasshouse with painted roof and pillars.
  add(shape.body, paint);
  const roofPaint = features.has('blackRoof') ? new THREE.MeshPhysicalMaterial({ color: '#111923', metalness: 0.25, roughness: 0.2, clearcoat: 1 }) : paint;
  if (roofPaint !== paint) materials.push(roofPaint);
  add(shape.glass, [glass, roofPaint]);
  if (design.openTop) {
    const seatZ = ((roofRear[0] + roofFront[0]) * length) / 2 - 0.13;
    rounded(width * 0.68, 0.1, (roofFront[0] - roofRear[0]) * length, black, 0, 0.51, seatZ);
    for (const side of [-1, 1]) {
      rounded(0.43, 0.12, 0.48, black, side * width * 0.18, 0.6, seatZ);
      rounded(0.43, 0.42, 0.14, black, side * width * 0.18, 0.8, seatZ - 0.19, -0.15);
      rounded(0.24, 0.18, 0.13, black, side * width * 0.18, 1.07, seatZ - 0.21);
    }
    rounded(width * 0.64, 0.14, 0.22, black, 0, 0.92, roofFront[0] * length + 0.12);
    const steering = add(new THREE.TorusGeometry(0.16, 0.024, 6, 16), black, -width * 0.18, 1.04, roofFront[0] * length - 0.03, -0.5);
    steering.rotation.y = Math.PI;
  }
  let liveryMap: THREE.Texture | undefined;
  if (spec.id === 'indy98') {
    liveryMap = paceLiveryTexture();
    const livery = new THREE.MeshStandardMaterial({ map: liveryMap, roughness: 0.4 });
    materials.push(livery);
    for (const side of [-1, 1])
      add(new THREE.PlaneGeometry(length * 0.38, 0.21), livery, side * (shape.section(0).halfWidth + 0.012), 0.63, 0, 0, (side * Math.PI) / 2);
  }

  // Black rocker trim between the wheel arches.
  const sillZ = (front + rear) / 2;
  const sillLength = front - rear - ARCH_RADIUS * wheelScale * 2.1;
  const sill = shape.section(sillZ);
  for (const side of [-1, 1])
    rounded(0.025, 0.035, sillLength, features.has('skirts') ? paint : black, side * (sill.halfWidth + 0.003), sill.bottom + 0.022, sillZ);

  // Sculpted intake surrounds sit in front of the closed nose, with dark recessed throats.
  const noseZ = nose + 0.012;
  const nosePart = shape.section(nose);
  const intake = (x: number, y: number, w: number, h: number, oval: boolean, metal = false) => {
    const outline = (w: number, h: number) => {
      const p = new THREE.Shape();
      if (oval) p.absellipse(0, 0, w / 2, h / 2, 0, Math.PI * 2, false);
      else {
        const r = Math.min(h * 0.25, w * 0.12);
        p.moveTo(-w / 2 + r, -h / 2);
        p.lineTo(w / 2 - r, -h / 2);
        p.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        p.lineTo(w / 2, h / 2 - r);
        p.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        p.lineTo(-w / 2 + r, h / 2);
        p.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        p.lineTo(-w / 2, -h / 2 + r);
        p.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      }
      return p;
    };
    const outer = outline(w, h),
      inner = outline(w - 0.045, h - 0.035);
    outer.holes.push(new THREE.Path(inner.getPoints(6)));
    add(new THREE.ShapeGeometry(inner), black, x, y, noseZ + 0.005);
    add(
      new THREE.ExtrudeGeometry(outer, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 }),
      metal ? chrome : paint,
      x,
      y,
      noseZ,
    );
    for (let i = -1; i <= 1; i++) rounded(w * 0.77, 0.008, 0.008, trim, x, y + i * h * 0.2, noseZ + 0.012);
  };
  const fw = nosePart.halfWidth;
  const fy = nosePart.bottom + 0.12;
  if (spec.id === 'sl600') {
    intake(0, nosePart.shoulder - 0.12, fw * 0.92, 0.2, false, true);
    intake(0, fy, fw * 1.7, 0.115, false);
    rounded(0.022, 0.19, 0.06, chrome, 0, nosePart.shoulder - 0.12, noseZ + 0.04);
  } else if (spec.id === 'falcon' || spec.id === 'hsvgts') {
    intake(0, nosePart.shoulder - 0.16, fw * 1.1, 0.13, false);
    intake(0, fy, fw * 1.5, 0.14, false);
    if (spec.id === 'hsvgts') rounded(0.035, 0.14, 0.07, paint, 0, nosePart.shoulder - 0.16, noseZ + 0.04);
    for (const side of [-1, 1]) disc(0.047, 0.03, head, side * fw * 0.84, fy, noseZ + 0.035);
  } else if (design.face === 'oval') {
    intake(0, fy + 0.025, fw * (spec.id === 'db7' ? 1.2 : 1.42), 0.18, true, spec.id === 'db7' || spec.id === 'xk8');
    for (const side of [-1, 1]) intake(side * fw * 0.85, fy, fw * 0.19, 0.09, false);
  } else if (design.face === 'wide') {
    intake(0, fy + 0.015, fw * 1.35, 0.16, false);
    for (const side of [-1, 1]) intake(side * fw * 0.85, fy, fw * 0.18, 0.11, false);
  } else if (design.face === 'twin') {
    for (const side of [-1, 1]) intake(side * fw * 0.43, fy, fw * 0.77, 0.14, true);
  } else if (design.face === 'split') {
    intake(0, fy, fw * 0.67, 0.12, false);
    for (const side of [-1, 1]) intake(side * fw * 0.72, fy, fw * 0.48, 0.12, false);
  } else if (design.face === 'endurance') {
    intake(0, fy, fw * 1.1, 0.13, false);
    for (const side of [-1, 1]) intake(side * fw * 0.83, fy, fw * 0.25, 0.14, false);
  } else intake(0, fy, fw * 1.65, 0.09, false);
  if (design.face !== 'endurance') add(new THREE.PlaneGeometry(0.43, 0.095), plate, 0, fy - 0.005, noseZ + 0.038);
  if (features.has('splitter')) rounded(width * 0.96, 0.035, 0.32, black, 0, nosePart.bottom - 0.035, nose - 0.04);

  // Lens outlines sit flush with the body and contain individual reflectors.
  const lampZ = nose - (design.lamps?.inset ?? (design.headlights === 'popup' ? 0.42 : 0.35));
  const lampX = shape.section(lampZ).halfWidth * (design.lamps?.spread ?? 0.65);
  const lampY = surface(lampZ, 0.65);
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (design.headlights === 'popup') {
      const outline: [number, number][] = [
        [x - 0.21, lampZ - 0.16],
        [x + 0.21, lampZ - 0.16],
        [x + 0.2, lampZ + 0.15],
        [x - 0.2, lampZ + 0.15],
      ];
      hoodPatch(outline, black, 0.006);
      hoodPatch(
        outline.map(([px, pz]) => [x + (px - x) * 0.94, lampZ + (pz - lampZ) * 0.94]),
        paint,
        0.008,
      );
      if (headlightsOn) {
        rounded(0.41, 0.14, 0.28, paint, x, lampY + 0.085, lampZ, -0.2);
        rounded(0.34, 0.075, 0.025, head, x, lampY + 0.1, lampZ + 0.15);
      }
      for (const [offset, material] of [
        [0.8, amber],
        [0.53, head],
      ] as const)
        rounded(0.2, 0.045, 0.024, material, side * nosePart.halfWidth * offset, Math.min(nosePart.shoulder - 0.025, fy + 0.12), nose + 0.025);
    } else if (design.headlights === 'rect') {
      const y = nosePart.shoulder - 0.09,
        w = design.lamps?.width ?? 0.46,
        h = design.lamps?.depth ?? 0.15;
      rounded(w + 0.02, h + 0.02, 0.025, black, x, y, nose + 0.012, 0, 0, 0.025);
      rounded(w, h, 0.027, chrome, x, y, nose + 0.026, 0, 0, 0.025);
      for (const offset of [-0.23, 0.22]) disc(h * 0.3, 0.018, head, x + w * offset, y, nose + 0.045);
      rounded(0.06, h * 0.84, 0.022, amber, x + side * w * 0.39, y, nose + 0.042);
    } else {
      const w = design.lamps?.width ?? 0.43,
        d = design.lamps?.depth ?? 0.32;
      const taper = design.headlights === 'covered' ? 0.35 : design.headlights === 'slim' ? 0.12 : 0;
      const lensOutline = (width: number, depth: number) => {
        if (spec.id !== 'clkgtr') return ellipse(x, lampZ, width, depth, taper);
        return Array.from({ length: 20 }, (_, i): [number, number] => {
          const angle = (i / 20) * Math.PI * 2,
            c = Math.cos(angle),
            s = Math.sin(angle);
          return [x + (Math.sign(c) * Math.sqrt(Math.abs(c)) * width) / 2, lampZ + (Math.sign(s) * Math.sqrt(Math.abs(s)) * depth) / 2];
        });
      };
      hoodPatch(lensOutline(w + 0.022, d + 0.025), black, 0.008);
      hoodPatch(lensOutline(w, d), glass, 0.012);
      const count = design.lamps?.projectors ?? 2;
      for (let i = 0; i < count; i++) {
        const px = x + (i - (count - 1) / 2) * Math.min(0.115, w * 0.26),
          pz = lampZ + 0.025;
        const radius = Math.min(0.075, w / (count * 2.7));
        hoodPatch(ellipse(px, pz, radius * 2.1, radius * 2.25), chrome, 0.017);
        hoodPatch(ellipse(px, pz, radius * 1.55, radius * 1.7), head, 0.021);
      }
      hoodPatch(ellipse(x + side * w * 0.34, lampZ + 0.03, 0.045, 0.08), amber, 0.018);
    }
  }
  if (spec.id === 'f550')
    hoodPatch(
      [
        [-0.24, length * 0.26],
        [0.24, length * 0.26],
        [0.21, length * 0.29],
        [-0.21, length * 0.29],
      ],
      black,
    );

  // Recessed rear clusters, a painted bumper and the appropriate exhaust layout.
  const tailZ = -nose + 0.025,
    tailPart = shape.section(tailZ),
    tailY = tailPart.shoulder - 0.105,
    tailX = tailPart.halfWidth * 0.67;
  const lampCentres: THREE.Vector3[] = [];
  if (design.taillights === 'grille' || spec.id === 'f355') rounded(tailPart.halfWidth * 1.75, 0.16, 0.026, black, 0, tailY, tailZ - 0.028);
  for (const side of [-1, 1]) {
    const x = side * tailX;
    if (design.taillights === 'round' || design.taillights === 'quad') {
      for (const offset of [-0.105, 0.105]) {
        const px = x + side * offset;
        disc(0.079, 0.018, black, px, tailY, tailZ - 0.022, 0, -1);
        disc(0.069, 0.022, tail, px, tailY, tailZ - 0.033, 0, -1);
        lampCentres.push(new THREE.Vector3(px, tailY, tailZ - 0.06));
      }
    } else {
      const w = design.taillights === 'slim' ? tailPart.halfWidth * 0.66 : 0.39,
        h = spec.id === 'sl600' ? 0.17 : 0.125;
      rounded(w + 0.018, h + 0.016, 0.025, black, x, tailY, tailZ - 0.025, 0, 0, 0.035);
      rounded(w, h, 0.028, tail, x, tailY, tailZ - 0.04, 0, 0, 0.035);
      rounded(w * 0.32, h * 0.2, 0.015, head, x - side * w * 0.25, tailY - h * 0.18, tailZ - 0.058);
      if (design.taillights !== 'slim') rounded(w * 0.2, h * 0.34, 0.017, amber, x + side * w * 0.31, tailY + h * 0.17, tailZ - 0.057);
      if (spec.id === 'sl600') for (const offset of [-0.035, 0.025]) rounded(w * 0.94, 0.01, 0.012, black, x, tailY + offset, tailZ - 0.06);
      lampCentres.push(new THREE.Vector3(x, tailY, tailZ - 0.065));
    }
  }
  rounded(0.55, 0.143, 0.023, black, 0, tailY - 0.205, tailZ - 0.023, 0, 0, 0.025);
  add(new THREE.PlaneGeometry(0.5, 0.105), plate, 0, tailY - 0.205, tailZ - 0.037, 0, Math.PI);
  rounded(tailPart.halfWidth * 1.85, 0.007, 0.009, black, 0, tailY - 0.31, tailZ - 0.017);
  rounded(tailPart.halfWidth * 1.65, 0.055, 0.15, black, 0, (design.rideHeight ?? 0.15) + 0.06, tailZ + 0.02);
  if (features.has('splitter')) for (let i = -2; i <= 2; i++) rounded(0.012, 0.075, 0.2, black, i * 0.17, (design.rideHeight ?? 0.15) + 0.02, tailZ + 0.015);
  const outlets =
    design.exhaust === 'centre'
      ? [-0.27, -0.13, 0.13, 0.27]
      : design.exhaust === 'left'
        ? [-0.65, -0.54]
        : design.exhaust === 'quad'
          ? [-0.72, -0.59, 0.59, 0.72]
          : [-0.62, 0.62];
  for (const x of outlets) {
    const pipe = new THREE.CylinderGeometry(0.036, 0.041, 0.14, 16, 1, true);
    add(pipe, chrome, x, (design.rideHeight ?? 0.15) + 0.08, tailZ - 0.025, Math.PI / 2);
    disc(0.03, 0.006, black, x, (design.rideHeight ?? 0.15) + 0.08, tailZ - 0.097, 0, -1);
  }

  // Door mirrors and handles.
  const mirrorZ = screenBase[0] * length - 0.22;
  const mirrorBase = shape.section(mirrorZ);
  for (const side of [-1, 1]) {
    rounded(0.05, 0.03, 0.06, black, side * (mirrorBase.halfWidth * 0.85), mirrorBase.crown + 0.02, mirrorZ);
    rounded(0.1, 0.075, 0.16, paint, side * (mirrorBase.halfWidth * 0.85 + 0.08), mirrorBase.crown + 0.06, mirrorZ - 0.02, 0, 0, 0.03);
    for (const handleZ of design.fourDoors ? [-length * 0.17, length * 0.035] : [rearBase[0] * length + 0.35]) {
      const handle = shape.section(handleZ);
      rounded(0.02, 0.025, 0.14, chrome, side * (shape.flank(handleZ, handle.shoulder - 0.12) + 0.003), handle.shoulder - 0.12, handleZ);
    }
    if (design.fourDoors) {
      const middle = shape.section(0);
      rounded(0.012, middle.shoulder - middle.bottom - 0.08, 0.009, black, side * (middle.halfWidth + 0.01), (middle.shoulder + middle.bottom) / 2, 0);
    }
  }

  // Fine door shuts give the broad painted flanks a readable scale without extra materials.
  for (const side of [-1, 1]) {
    const frontZ = front - wheelRadius * 1.15;
    const rearZ = rear + wheelRadius * 1.3;
    const points = [
      [frontZ, shape.section(frontZ).shoulder - 0.06],
      [frontZ - 0.08, shape.section(frontZ).bottom + 0.16],
      [rearZ + 0.12, shape.section(rearZ).bottom + 0.16],
      [rearZ, shape.section(rearZ).shoulder - 0.09],
    ].map(([z, y]) => new THREE.Vector3(side * (shape.flank(z, y) + 0.004), y, z));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 16, 0.003, 4, false), black);
  }

  // Rubber glazing seals, fine bonnet/deck seams and wipers make the scale readable up close.
  const seam = (points: THREE.Vector3[], radius = 0.003, material: THREE.Material = black, closed = false) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), Math.max(12, points.length * 2), radius, 3, closed), material);
  for (const side of [-1, 1]) {
    const from = (design.openTop ? roofFront[0] : rearBase[0]) * length,
      to = screenBase[0] * length;
    const bottom: THREE.Vector3[] = [],
      top: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const z = THREE.MathUtils.lerp(from, to, i / 20),
        cabin = shape.cabin(z);
      bottom.push(new THREE.Vector3(side * cabin.baseWidth, cabin.base + 0.005, z));
      top.push(new THREE.Vector3(side * cabin.roofWidth, cabin.roof - 0.025, z));
    }
    seam(bottom, 0.006);
    seam(top, 0.006);
    if (design.openTop) seam(top, 0.013, paint);
  }
  const bonnetRear = screenBase[0] * length + 0.04,
    bonnetFront = length * 0.455,
    bonnetMiddle = (bonnetRear + bonnetFront) / 2;
  const bonnet: [number, number][] = [
    [(-0.52 * width) / 2, bonnetRear],
    [(-0.57 * width) / 2, bonnetMiddle],
    [(-0.43 * width) / 2, bonnetFront],
    [(0.43 * width) / 2, bonnetFront],
    [(0.57 * width) / 2, bonnetMiddle],
    [(0.52 * width) / 2, bonnetRear],
  ];
  seam(
    bonnet.map(([x, z]) => new THREE.Vector3(x, surface(z, Math.abs(x) / shape.section(z).halfWidth) + 0.004, z)),
    0.0028,
    black,
    true,
  );
  if (!design.openTop) {
    const z0 = -length * 0.47,
      z1 = rearBase[0] * length - 0.03;
    const deck: [number, number][] = [
      [-width * 0.32, z0],
      [width * 0.32, z0],
      [width * 0.34, z1],
      [-width * 0.34, z1],
    ];
    seam(
      deck.map(([x, z]) => new THREE.Vector3(x, surface(z, Math.abs(x) / shape.section(z).halfWidth) + 0.004, z)),
      0.0028,
      black,
      true,
    );
  }
  for (const side of [-1, 1]) {
    const z0 = (screenBase[0] - 0.018) * length,
      z1 = (screenBase[0] - 0.045) * length;
    seam(
      [
        new THREE.Vector3(side * 0.06, shape.cabin(z0).roof + 0.01, z0),
        new THREE.Vector3(side * 0.34, shape.cabin(z1).roof + 0.008, z1),
        new THREE.Vector3(side * 0.61, shape.cabin(z1).roof + 0.006, z1),
      ],
      0.005,
    );
  }

  // Brake calipers stay put while the wheels spin around them.
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) rounded(0.05, 0.14, 0.12, caliper, side * (shape.section(z).halfWidth - 0.2), wheelRadius + 0.1, z - 0.08, 0, 0, 0.02);
  }

  // Model-specific details.
  if (features.has('airboxes')) {
    const z = -length * 0.25;
    for (const side of [-1, 1]) {
      const { halfWidth } = shape.section(z);
      const y = surface(z, 0.8);
      rounded(0.36, 0.17, 0.7, paint, side * (halfWidth - 0.22), y + 0.07, z, 0, 0, 0.05);
      rounded(0.28, 0.1, 0.03, black, side * (halfWidth - 0.22), y + 0.08, z + 0.35);
    }
  }
  if (features.has('naca')) {
    for (const side of [-1, 1]) {
      const { halfWidth, shoulder } = shape.section(0);
      rounded(0.02, 0.1, 0.8, black, side * (halfWidth * 0.97), shoulder - 0.12, length * 0.02, 0.18);
    }
  }
  if (features.has('sideIntakes')) {
    const z = -length * 0.15,
      { shoulder, bottom } = shape.section(z);
    const top = shoulder - 0.12,
      lower = THREE.MathUtils.lerp(bottom, shoulder, 0.36);
    for (const side of [-1, 1]) {
      sidePatch(side, [
        [z + 0.28, top - 0.04],
        [z - 0.24, top],
        [z - 0.25, lower],
        [z + 0.12, lower + 0.035],
      ]);
      if (spec.id === 'f355')
        for (const fraction of [0.35, 0.68]) {
          const y = THREE.MathUtils.lerp(lower, top, fraction);
          sidePatch(
            side,
            [
              [z + 0.19, y],
              [z - 0.22, y],
              [z - 0.22, y + 0.012],
              [z + 0.2, y + 0.012],
            ],
            paint,
            0.009,
          );
        }
    }
  }
  if (spec.id === 'f550')
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const z = front - 0.38 - i * 0.075,
          y = shape.section(z).shoulder - 0.13;
        sidePatch(side, [
          [z + 0.016, y + 0.07],
          [z - 0.016, y + 0.06],
          [z - 0.04, y - 0.06],
          [z - 0.008, y - 0.05],
        ]);
      }
    }
  if (features.has('louvres')) {
    for (let i = 0; i < 6; i++) {
      const z = -length * (0.44 - i * 0.028);
      rounded(width * 0.5, 0.015, 0.04, black, 0, surface(z, 0.3) + 0.012, z);
    }
  }
  if (features.has('hoodVents')) {
    const z = length * 0.26;
    for (const side of [-1, 1]) rounded(0.22, 0.02, 0.4, black, side * 0.42, surface(z, 0.5) + 0.012, z, -slopeAt(z));
  }
  const roofZ = ((roofRear[0] + roofFront[0]) / 2) * length;
  if (features.has('roofScoop')) {
    rounded(0.32, 0.12, 0.62, paint, 0, roofTop + 0.06, roofZ - 0.2, 0, 0, 0.05);
    rounded(0.24, 0.07, 0.03, black, 0, roofTop + 0.07, roofZ + 0.11);
  }
  // Stripes follow the hood, roof and deck but skip the glass.
  if (spec.stripe) {
    const stripe = new THREE.MeshPhysicalMaterial({ color: spec.stripe, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    materials.push(stripe);
    const lanes = [-0.2, 0.2];
    const pieces: [number, number, (z: number) => number][] = [
      [screenBase[0] * length + 0.05, nose - 0.05, (z) => surface(z, 0.25)],
      [roofRear[0] * length, roofFront[0] * length, () => roofTop + 0.016],
      [-nose + 0.06, rearBase[0] * length - 0.04, (z) => surface(z, 0.25)],
    ];
    for (const [from, to, height] of pieces) {
      const positions: number[] = [];
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const z0 = THREE.MathUtils.lerp(from, to, i / steps);
        const z1 = THREE.MathUtils.lerp(from, to, (i + 1) / steps);
        for (const lane of lanes) {
          const [x0, x1] = [lane - 0.085, lane + 0.085];
          const y0 = height(z0) + 0.006;
          const y1 = height(z1) + 0.006;
          positions.push(x0, y0, z0, x1, y0, z0, x0, y1, z1, x1, y0, z0, x1, y1, z1, x0, y1, z1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      add(geometry, stripe);
    }
  }

  // Rear wings.
  const tailTop = shape.section(-length * 0.47).crown;
  const wingZ = -nose + 0.28;
  const wingHeight = design.wingHeight ?? (design.wing === 'gt' ? 0.34 : 0.15);
  const airfoil = (span: number, chord: number, material: THREE.Material, y: number, z: number, roll = 0, x = 0) => {
    const section = new THREE.Shape();
    section.moveTo(-chord / 2, 0);
    section.quadraticCurveTo(-chord * 0.1, chord * 0.16, chord / 2, 0.012);
    section.lineTo(chord / 2, -0.004);
    section.quadraticCurveTo(0, chord * 0.04, -chord / 2, 0);
    const geometry = new THREE.ExtrudeGeometry(section, { depth: span, bevelEnabled: false, curveSegments: 6 });
    geometry.translate(0, 0, -span / 2);
    geometry.rotateY(Math.PI / 2);
    add(geometry, material, x, y, z, -0.06, Math.PI, roll);
  };
  if (design.wing === 'v') {
    rounded(0.1, 0.16, 0.2, paint, 0, tailTop + 0.08, wingZ - 0.05);
    for (const side of [-1, 1]) airfoil(width * 0.5, 0.42, paint, tailTop + 0.19, wingZ - 0.05, side * 0.12, side * width * 0.24);
  } else if (design.wing === 'gt') {
    airfoil(width - 0.06, 0.46, black, tailTop + wingHeight, wingZ - 0.06);
    for (const side of [-1, 1]) {
      rounded(0.025, 0.28, 0.5, black, side * (width / 2 - 0.02), tailTop + wingHeight - 0.02, wingZ - 0.06);
      rounded(0.045, wingHeight, 0.12, black, side * 0.48, tailTop + wingHeight / 2, wingZ);
    }
  } else if (design.wing === 'whale') {
    rounded(width * 0.72, 0.07, 0.5, paint, 0, shape.section(-length * 0.42).crown + 0.11, -length * 0.42, -0.28, 0, 0.03);
    rounded(width * 0.74, 0.025, 0.05, black, 0, shape.section(-length * 0.42).crown + 0.08, -length * 0.42 - 0.26);
  } else if (design.wing === 'lip') {
    rounded(tailPart.halfWidth * 1.6, 0.04, 0.12, paint, 0, tailTop + 0.02, -nose + 0.1, -0.3);
  } else if (design.wing === 'low') {
    airfoil(width - 0.22, 0.34, paint, tailTop + wingHeight, wingZ);
    for (const side of [-1, 1]) rounded(0.04, wingHeight, 0.16, paint, side * (width / 2 - 0.45), tailTop + wingHeight / 2, wingZ);
  }

  // Additive glows for brake lights, and headlights on evening tracks.
  sharedGlows ??= { red: glowTexture('#ff2a1a'), white: glowTexture('#fff2c8') };
  const brakeMaterial = new THREE.SpriteMaterial({ map: sharedGlows.red, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const headMaterial = new THREE.SpriteMaterial({
    map: sharedGlows.white,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  });
  materials.push(brakeMaterial, headMaterial);
  const brakeGlows = lampCentres.map((centre) => {
    const sprite = new THREE.Sprite(brakeMaterial);
    sprite.position.copy(centre);
    sprite.scale.setScalar(0.42);
    sprite.visible = false;
    body.add(sprite);
    return sprite;
  });
  if (headlightsOn) {
    for (const side of [-1, 1]) {
      const sprite = new THREE.Sprite(headMaterial);
      sprite.position.set(side * lampX, lampY - 0.02, lampZ + 0.32);
      sprite.scale.setScalar(0.55);
      body.add(sprite);
    }
  }

  // Wheels: rubber and metal meshes spin; front pivots steer.
  const wheels = wheelGeometry(design.rims ?? 'five');
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: spec.id === 'indy98' ? 0xe8c72b : 0xc9cdd2, roughness: 0.22, metalness: 1 });
  materials.push(rubber, rim);
  const spinners: THREE.Group[] = [];
  const wheelPivots: THREE.Group[] = [];
  const steerers: THREE.Group[] = [];
  const tyres = new THREE.InstancedMesh(wheels.rubber, rubber, 4);
  const rims = new THREE.InstancedMesh(wheels.metal, rim, 4);
  group.add(tyres, rims);
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const tyreWidth = z < 0 ? (design.rearTyreWidth ?? 1) : 1;
      pivot.position.set(side * (shape.section(z).halfWidth - 0.13 * tyreWidth), wheelRadius, z);
      const spinner = new THREE.Group();
      spinner.scale.set(tyreWidth, wheelScale, wheelScale);
      pivot.add(spinner);
      group.add(pivot);
      wheelPivots.push(pivot);
      spinners.push(spinner);
      if (z > 0) steerers.push(pivot);
    }
  }
  const wheelMatrix = new THREE.Matrix4();
  const mirroredWheel = new THREE.Matrix4().makeRotationY(Math.PI);
  const updateWheels = () => {
    wheelPivots.forEach((pivot, index) => {
      pivot.updateMatrix();
      spinners[index].updateMatrix();
      wheelMatrix.multiplyMatrices(pivot.matrix, spinners[index].matrix);
      if (index % 2 === 0) wheelMatrix.multiply(mirroredWheel);
      tyres.setMatrixAt(index, wheelMatrix);
      rims.setMatrixAt(index, wheelMatrix);
    });
    tyres.instanceMatrix.needsUpdate = rims.instanceMatrix.needsUpdate = true;
  };
  updateWheels();
  for (const mesh of [tyres, rims]) {
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.2;
  }

  sharedShadow ??= shadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: sharedShadow, transparent: true, depthWrite: false, opacity: 0.55 });
  materials.push(shadowMaterial);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.7, length + 0.9), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  shadow.renderOrder = 1;
  group.add(shadow);
  group.rotation.order = 'YXZ';

  // Static body parts collapse into one mesh per material.
  batchStatic(body, Number.POSITIVE_INFINITY);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child !== shadow) child.castShadow = true;
  });

  // Distant rivals retain their individual silhouette, windows, wing and lights in a handful of draws.
  const distant = new THREE.Group();
  const simple = buildBodyShape(design, length, width, true);
  distant.add(new THREE.Mesh(simple.body, paint), new THREE.Mesh(simple.glass, [glass, roofPaint]));
  const lowBox = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    distant.add(mesh);
  };
  if (design.wing && design.wing !== 'lip') lowBox(width * 0.9, 0.06, 0.4, paint, 0, tailTop + wingHeight, wingZ);
  for (const side of [-1, 1]) {
    lowBox(0.42, 0.09, 0.03, tail, side * tailX, tailY, tailZ - 0.07);
    lowBox(0.42, 0.06, 0.03, head, side * lampX, lampY - 0.04, nose + 0.025);
    for (const z of [front, rear]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.26, 10), rubber);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (shape.section(z).halfWidth - 0.1), wheelRadius, z);
      distant.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, 0.025, 8), rim);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      hub.position.x += side * 0.14;
      distant.add(hub);
    }
  }
  batchStatic(distant, Number.POSITIVE_INFINITY);
  distant.visible = false;
  group.add(distant);
  let detailed = true;

  return {
    group,
    setDistance(distance) {
      // Hysteresis avoids flicker when another car hovers near the transition distance.
      detailed = detailed ? distance < 65 : distance < 55;
      body.visible = detailed;
      distant.visible = !detailed;
      tyres.visible = rims.visible = detailed;
      shadow.visible = distance < 160;
    },
    update(state, headingDot) {
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.yaw;
      group.rotation.x = -Math.atan(state.pitch) * headingDot;
      const speed = Math.hypot(state.vx, state.vz);
      body.rotation.z = -state.steer * Math.min(1, speed / 45) * 0.03 - Math.min(0.04, state.slip * 0.003) * Math.sign(state.steer);
      body.position.y = state.surface === 'grass' ? Math.sin(state.wheelSpin * 2.3) * 0.02 : 0;
      distant.position.y = body.position.y;
      distant.rotation.z = body.rotation.z;
      for (const spinner of spinners) spinner.rotation.x = state.wheelSpin / wheelScale;
      for (const pivot of steerers) pivot.rotation.y = -state.steer * 0.45;
      if (detailed) updateWheels();
      for (const glow of brakeGlows) glow.visible = state.braking;
      tail.emissiveIntensity = state.braking ? 1.65 : headlightsOn ? 0.4 : 0.12;
    },
    dispose() {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry !== wheels.rubber && child.geometry !== wheels.metal) child.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      tyres.dispose();
      rims.dispose();
      plateMap.dispose();
      liveryMap?.dispose();
    },
  };
}

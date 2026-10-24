import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { batchStatic } from './batch';
import { ARCH_RADIUS, axles, buildBodyShape, WHEEL_RADIUS } from './car-body';
import { designs, type RimStyle } from './car-designs';
import { plateTexture } from './car-textures';
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
  const rubber = new THREE.LatheGeometry(profile, 20);
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
    curveSegments: 8,
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
  const sourceParts = [spokeFace, barrel, cap, disc];
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
  const design = designs[spec.id] ?? designs.sting;
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

  const paint = new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.38, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x172b38,
    metalness: 0.15,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.15,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.55, metalness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: spec.trim, roughness: 0.35, metalness: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e6e8, roughness: 0.12, metalness: 1 });
  const head = new THREE.MeshStandardMaterial({ color: 0xf2f0e8, emissive: 0xfff3d6, emissiveIntensity: headlightsOn ? 2.4 : 0.4, roughness: 0.12 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x4a0406, emissive: 0xff1a12, emissiveIntensity: 0.55, roughness: 0.18 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x6a3000, emissive: 0xff8a10, emissiveIntensity: 0.5, roughness: 0.18 });
  const caliperColor = spec.carClass === 'A' ? 0xf2c400 : spec.carClass === 'B' ? 0xc8141c : 0x5c6066;
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
  const surface = (z: number, across: number) => {
    const { crown, shoulder } = shape.section(z);
    return THREE.MathUtils.lerp(crown, shoulder, THREE.MathUtils.smoothstep(across, 0.35, 0.9));
  };
  const slopeAt = (z: number) => Math.atan2(surface(z + 0.1, 0.5) - surface(z - 0.1, 0.5), 0.2);

  // Body and glasshouse with painted roof and pillars.
  add(shape.body, paint);
  const roofPaint = features.has('blackRoof') ? new THREE.MeshPhysicalMaterial({ color: '#111923', metalness: 0.25, roughness: 0.2, clearcoat: 1 }) : paint;
  if (roofPaint !== paint) materials.push(roofPaint);
  add(shape.glass, [glass, roofPaint]);

  // Black rocker trim between the wheel arches.
  const sillZ = (front + rear) / 2;
  const sillLength = front - rear - ARCH_RADIUS * wheelScale * 2.1;
  const sill = shape.section(sillZ);
  for (const side of [-1, 1])
    rounded(0.05, 0.09, sillLength, features.has('skirts') ? trim : black, side * (sill.halfWidth + 0.005), sill.bottom + 0.05, sillZ);

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
    outer.holes.push(new THREE.Path(inner.getPoints(24)));
    add(new THREE.ShapeGeometry(inner), black, x, y, noseZ + 0.005);
    add(
      new THREE.ExtrudeGeometry(outer, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 }),
      metal ? chrome : paint,
      x,
      y,
      noseZ,
    );
    for (let i = -1; i <= 1; i++) rounded(w * 0.77, 0.008, 0.008, trim, x, y + i * h * 0.2, noseZ + 0.012);
  };
  const fw = nosePart.halfWidth;
  const fy = nosePart.bottom + 0.12;
  if (design.face === 'oval') {
    intake(0, fy, fw * 1.42, 0.23, true, spec.id === 'xk');
    for (const side of [-1, 1]) intake(side * fw * 0.85, fy, fw * 0.2, 0.13, false);
  } else if (design.face === 'wide') {
    intake(0, fy + 0.025, fw * 1.72, 0.23, false, spec.id === 'dbs');
  } else if (design.face === 'twin') {
    for (const side of [-1, 1]) intake(side * fw * 0.43, fy, fw * 0.78, 0.22, true);
  } else if (design.face === 'split') {
    intake(0, fy, fw * 0.62, 0.16, false);
    for (const side of [-1, 1]) intake(side * fw * 0.7, fy, fw * 0.49, 0.16, false);
  } else if (design.face === 'endurance') {
    intake(0, fy - 0.035, fw * 1.12, 0.15, false);
    for (const side of [-1, 1]) {
      intake(side * fw * 0.83, fy + 0.02, fw * 0.26, 0.21, false);
      rounded(0.035, 0.17, 0.35, black, side * fw * 0.56, nosePart.bottom - 0.025, nose - 0.04);
    }
  } else intake(0, fy - 0.015, fw * 1.76, 0.1, false);
  if (design.face !== 'endurance') add(new THREE.PlaneGeometry(0.29, 0.075), plate, 0, fy - 0.005, noseZ + 0.078);
  if (features.has('splitter')) rounded(width * 0.96, 0.035, 0.32, black, 0, nosePart.bottom - 0.035, nose - 0.04);

  // Headlights by type, sitting on the front of the hood.
  const lampZ = nose - (design.headlights === 'round' ? 0.55 : design.headlights === 'popup' ? 0.48 : 0.24);
  const lampX = shape.section(lampZ).halfWidth * (design.headlights === 'round' ? 0.76 : 0.6);
  const lampY = surface(lampZ, 0.65);
  const hoodTilt = -slopeAt(lampZ);
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (design.headlights === 'popup') {
      rounded(0.46, 0.045, 0.34, paint, x, lampY + 0.012, lampZ, hoodTilt);
      rounded(0.44, 0.004, 0.006, black, x, lampY + 0.04, lampZ + 0.14, hoodTilt);
      rounded(0.26, 0.05, 0.03, amber, side * nosePart.halfWidth * 0.82, Math.min(nosePart.shoulder - 0.04, fy + 0.13), nose + 0.035);
      rounded(0.22, 0.05, 0.03, head, side * nosePart.halfWidth * 0.5, Math.min(nosePart.shoulder - 0.04, fy + 0.13), nose + 0.032);
    } else if (design.headlights === 'round') {
      const y = shape.section(lampZ).shoulder;
      const pod = add(new THREE.SphereGeometry(1, 20, 12), paint, x, y - 0.1, lampZ - 0.12);
      pod.scale.set(0.19, 0.18, 0.34);
      disc(0.13, 0.04, chrome, x, y - 0.065, lampZ + 0.15, -0.55);
      disc(0.11, 0.05, head, x, y - 0.065, lampZ + 0.165, -0.55);
    } else if (design.headlights === 'quad') {
      rounded(0.42, 0.13, 0.2, black, x, lampY - 0.05, lampZ, hoodTilt);
      for (const offset of [-0.1, 0.1]) disc(0.055, 0.05, head, x + offset, lampY - 0.04, lampZ + 0.08, hoodTilt);
    } else if (design.headlights === 'slim') {
      rounded(0.54, 0.06, 0.16, black, x, lampY + 0.005, lampZ, hoodTilt, side * 0.08);
      rounded(0.48, 0.025, 0.025, head, x, lampY + 0.015, lampZ + 0.085, hoodTilt);
    } else {
      rounded(0.5, 0.11, 0.26, black, x, lampY - 0.035, lampZ, hoodTilt, 0, 0.04);
      rounded(0.42, 0.025, 0.02, head, x, lampY - 0.01, lampZ + 0.12, hoodTilt);
      disc(0.05, 0.04, head, x - side * 0.09, lampY - 0.05, lampZ + 0.11, hoodTilt);
      disc(0.05, 0.04, head, x + side * 0.06, lampY - 0.05, lampZ + 0.11, hoodTilt);
    }
  }

  // Tail: light clusters by type, plate, diffuser fins and exhaust tips.
  const tailZ = -nose + 0.06;
  const tailPart = shape.section(tailZ);
  const tailY = tailPart.shoulder - 0.12;
  const tailX = tailPart.halfWidth * 0.66;
  const lampCentres: THREE.Vector3[] = [];
  if (design.taillights === 'grille') rounded(tailPart.halfWidth * 1.8, 0.22, 0.06, black, 0, tailY, tailZ - 0.05);
  for (const side of [-1, 1]) {
    const x = side * tailX;
    if (design.taillights === 'round' || design.taillights === 'quad') {
      const radius = design.taillights === 'round' ? 0.085 : 0.1;
      for (const offset of [0.1, -0.15]) {
        disc(radius + 0.015, 0.03, chrome, x + side * offset, tailY, tailZ - 0.04, 0, -1);
        disc(radius, 0.05, tail, x + side * offset, tailY, tailZ - 0.05, 0, -1);
        lampCentres.push(new THREE.Vector3(x + side * offset, tailY, tailZ - 0.1));
      }
    } else if (design.taillights === 'slim') {
      rounded(tailPart.halfWidth * 0.9, 0.045, 0.04, tail, side * tailPart.halfWidth * 0.46, tailY + 0.04, tailZ - 0.05);
      lampCentres.push(new THREE.Vector3(side * tailPart.halfWidth * 0.62, tailY + 0.04, tailZ - 0.1));
    } else {
      rounded(0.46, design.taillights === 'grille' ? 0.15 : 0.11, 0.05, tail, x, tailY, tailZ - 0.07);
      rounded(0.12, design.taillights === 'grille' ? 0.15 : 0.11, 0.05, amber, x + side * 0.29, tailY, tailZ - 0.07);
      lampCentres.push(new THREE.Vector3(x, tailY, tailZ - 0.12));
    }
  }
  add(new THREE.PlaneGeometry(0.42, 0.1), plate, 0, tailPart.bottom + 0.2, tailZ - 0.08, 0, Math.PI);
  rounded(tailPart.halfWidth * 1.7, 0.1, 0.24, black, 0, tailPart.bottom + 0.03, tailZ + 0.02);
  for (let i = -2; i <= 2; i++) rounded(0.015, 0.09, 0.22, black, i * 0.16, tailPart.bottom - 0.02, tailZ - 0.04);
  for (const side of [-1, 1]) {
    if (spec.id === 'stallion') {
      const pipe = new THREE.CylinderGeometry(0.045, 0.045, (front - rear) * 0.6, 16, 1, true);
      add(pipe, chrome, side * shape.section(0).halfWidth, 0.29, (front + rear) / 2, Math.PI / 2);
    } else {
      const pipe = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 16, 1, true);
      add(pipe, chrome, side * tailPart.halfWidth * 0.45, tailPart.bottom + 0.06, tailZ - 0.1, Math.PI / 2);
    }
  }

  // Door mirrors and handles.
  const mirrorZ = screenBase[0] * length - 0.22;
  const mirrorBase = shape.section(mirrorZ);
  for (const side of [-1, 1]) {
    rounded(0.05, 0.03, 0.06, black, side * (mirrorBase.halfWidth * 0.85), mirrorBase.crown + 0.02, mirrorZ);
    rounded(0.1, 0.075, 0.16, paint, side * (mirrorBase.halfWidth * 0.85 + 0.08), mirrorBase.crown + 0.06, mirrorZ - 0.02, 0, 0, 0.03);
    const handleZ = rearBase[0] * length + 0.35;
    const handle = shape.section(handleZ);
    rounded(0.02, 0.025, 0.14, chrome, side * (handle.halfWidth + 0.003), handle.shoulder - 0.12, handleZ);
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
    ].map(([z, y]) => new THREE.Vector3(side * (shape.section(z).halfWidth + 0.008), y, z));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), 16, 0.007, 4, false), black);
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
    const z = -length * 0.15;
    for (const side of [-1, 1]) {
      const { halfWidth, shoulder, bottom } = shape.section(z);
      rounded(0.04, (shoulder - bottom) * 0.42, 0.6, black, side * halfWidth, THREE.MathUtils.lerp(bottom, shoulder, 0.5), z, 0, 0, 0.03);
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
  const wingZ = -nose + 0.32;
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
    airfoil(width - 0.06, 0.46, black, tailTop + 0.4, wingZ - 0.06);
    for (const side of [-1, 1]) {
      rounded(0.025, 0.28, 0.5, black, side * (width / 2 - 0.02), tailTop + 0.38, wingZ - 0.06);
      rounded(0.05, 0.38, 0.12, black, side * 0.42, tailTop + 0.19, wingZ);
    }
  } else if (design.wing === 'whale') {
    rounded(width * 0.72, 0.07, 0.5, paint, 0, shape.section(-length * 0.42).crown + 0.11, -length * 0.42, -0.28, 0, 0.03);
    rounded(width * 0.74, 0.025, 0.05, black, 0, shape.section(-length * 0.42).crown + 0.08, -length * 0.42 - 0.26);
  } else if (design.wing === 'lip') {
    rounded(tailPart.halfWidth * 1.6, 0.04, 0.12, paint, 0, tailTop + 0.02, -nose + 0.1, -0.3);
  } else if (design.wing === 'low') {
    airfoil(width - 0.22, 0.34, paint, tailTop + 0.16, wingZ);
    for (const side of [-1, 1]) rounded(0.04, 0.16, 0.16, paint, side * (width / 2 - 0.45), tailTop + 0.08, wingZ);
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
  const rim = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.22, metalness: 1 });
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
  if (design.wing && design.wing !== 'lip') lowBox(width * 0.9, 0.06, 0.4, paint, 0, tailTop + (design.wing === 'gt' ? 0.4 : 0.17), wingZ);
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
      tail.emissiveIntensity = state.braking ? 2.6 : 0.55;
    },
    dispose() {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry !== wheels.rubber && child.geometry !== wheels.metal) child.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      tyres.dispose();
      rims.dispose();
      plateMap.dispose();
    },
  };
}

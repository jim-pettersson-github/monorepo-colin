import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { batchStatic } from './batch';
import { ARCH_RADIUS, axles, buildBodyShape, heightAt, WHEEL_RADIUS } from './car-body';
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
  const parts = [spokeFace, barrel, cap, disc].map((geometry) => {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    plain.deleteAttribute('uv');
    return plain;
  });
  const metal = mergeGeometries(parts);
  rubber.deleteAttribute('uv');
  const result = { rubber, metal };
  wheelCache.set(style, result);
  return result;
}

export type CarModel = {
  group: THREE.Group;
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
  const roofTop = Math.max(...design.cabin.map(([, v]) => v));
  const [rearBase, roofRear, roofFront, screenBase] = design.cabin;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: 0.4, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x05080c,
    metalness: 0,
    roughness: 0.08,
    clearcoat: 0.5,
    clearcoatRoughness: 0.05,
    envMapIntensity: 0.35,
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
  add(shape.glass, [glass, paint]);

  // Black rocker trim between the wheel arches.
  const sillZ = (front + rear) / 2;
  const sillLength = front - rear - ARCH_RADIUS * 2.1;
  const sill = shape.section(sillZ);
  for (const side of [-1, 1])
    rounded(0.05, 0.09, sillLength, features.has('skirts') ? trim : black, side * (sill.halfWidth + 0.005), sill.bottom + 0.05, sillZ);

  // Nose: intake with mesh, plate, indicators and optional splitter.
  const noseZ = nose - 0.08;
  const nosePart = shape.section(noseZ);
  rounded(nosePart.halfWidth * 1.35, 0.13, 0.12, black, 0, nosePart.bottom + 0.11, noseZ, 0, 0, 0.03);
  for (let i = -3; i <= 3; i++) rounded(0.012, 0.11, 0.02, trim, i * nosePart.halfWidth * 0.18, nosePart.bottom + 0.11, noseZ + 0.065);
  add(new THREE.PlaneGeometry(0.42, 0.1), plate, 0, nosePart.bottom + 0.11, noseZ + 0.08);
  if (features.has('splitter')) rounded(width * 0.9, 0.035, 0.28, black, 0, nosePart.bottom - 0.01, nose - 0.05);

  // Headlights by type, sitting on the front of the hood.
  const lampZ = nose - (design.headlights === 'popup' ? 0.48 : 0.24);
  const lampX = shape.section(lampZ).halfWidth * 0.6;
  const lampY = surface(lampZ, 0.65);
  const hoodTilt = -slopeAt(lampZ);
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (design.headlights === 'popup') {
      rounded(0.46, 0.045, 0.34, paint, x, lampY + 0.012, lampZ, hoodTilt);
      rounded(0.44, 0.004, 0.006, black, x, lampY + 0.04, lampZ + 0.14, hoodTilt);
      rounded(0.26, 0.05, 0.03, amber, side * nosePart.halfWidth * 0.82, nosePart.bottom + 0.24, nose - 0.04);
      rounded(0.22, 0.05, 0.03, head, side * nosePart.halfWidth * 0.5, nosePart.bottom + 0.24, nose - 0.03);
    } else if (design.headlights === 'round') {
      disc(0.13, 0.05, chrome, x, lampY - 0.02, lampZ, hoodTilt - 0.55);
      disc(0.11, 0.06, head, x, lampY - 0.01, lampZ + 0.01, hoodTilt - 0.55);
    } else if (design.headlights === 'quad') {
      rounded(0.42, 0.13, 0.2, black, x, lampY - 0.05, lampZ, hoodTilt);
      for (const offset of [-0.1, 0.1]) disc(0.055, 0.05, head, x + offset, lampY - 0.04, lampZ + 0.08, hoodTilt);
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
    const pipe = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 16, 1, true);
    add(pipe, chrome, side * (tailPart.halfWidth * 0.45), tailPart.bottom + 0.06, tailZ - 0.1, Math.PI / 2);
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

  // Brake calipers stay put while the wheels spin around them.
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) rounded(0.05, 0.14, 0.12, caliper, side * (shape.section(z).halfWidth - 0.2), WHEEL_RADIUS + 0.1, z - 0.08, 0, 0, 0.02);
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
  if (features.has('hoodBulge')) {
    const z = length * 0.22;
    rounded(width * 0.36, 0.08, length * 0.3, paint, 0, surface(z, 0) + 0.015, z, -slopeAt(z), 0, 0.05);
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
  if (features.has('doubleBubble')) {
    for (const side of [-1, 1])
      rounded(width * 0.22, 0.04, (roofFront[0] - roofRear[0]) * length, paint, side * width * 0.15, roofTop + 0.02, roofZ, 0, 0, 0.02);
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
  const tailTop = heightAt(design.top, -0.47);
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
    rounded(width * 0.72, 0.07, 0.5, paint, 0, heightAt(design.top, -0.42) + 0.11, -length * 0.42, -0.28, 0, 0.03);
    rounded(width * 0.74, 0.025, 0.05, black, 0, heightAt(design.top, -0.42) + 0.08, -length * 0.42 - 0.26);
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
  const steerers: THREE.Group[] = [];
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (shape.section(z).halfWidth - 0.13), WHEEL_RADIUS, z);
      const spinner = new THREE.Group();
      const tyre = new THREE.Mesh(wheels.rubber, rubber);
      const metal = new THREE.Mesh(wheels.metal, rim);
      if (side < 0) {
        tyre.rotation.y = Math.PI;
        metal.rotation.y = Math.PI;
      }
      spinner.add(tyre, metal);
      pivot.add(spinner);
      group.add(pivot);
      spinners.push(spinner);
      if (z > 0) steerers.push(pivot);
    }
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
  const batched = batchStatic(body, Number.POSITIVE_INFINITY);
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child !== shadow) child.castShadow = true;
  });

  return {
    group,
    update(state, headingDot) {
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.yaw;
      group.rotation.x = -Math.atan(state.pitch) * headingDot;
      const speed = Math.hypot(state.vx, state.vz);
      body.rotation.z = -state.steer * Math.min(1, speed / 45) * 0.03 - Math.min(0.04, state.slip * 0.003) * Math.sign(state.steer);
      body.position.y = state.surface === 'grass' ? Math.sin(state.wheelSpin * 2.3) * 0.02 : 0;
      for (const spinner of spinners) spinner.rotation.x = state.wheelSpin;
      for (const pivot of steerers) pivot.rotation.y = -state.steer * 0.45;
      for (const glow of brakeGlows) glow.visible = state.braking;
      tail.emissiveIntensity = state.braking ? 2.6 : 0.55;
    },
    dispose() {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry !== wheels.rubber && child.geometry !== wheels.metal) child.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      plateMap.dispose();
      batched.dispose();
    },
  };
}

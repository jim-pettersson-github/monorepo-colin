import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { batchStatic } from './batch';
import { ARCH_RADIUS, axles, buildBodyShape, WHEEL_RADIUS } from './car-body';
import { designs } from './car-designs';
import { addFavoriteDetails } from './car-favorites';
import { paceLiveryTexture, plateTexture } from './car-textures';
import { wheelGeometry } from './car-wheels';
import { glowTexture, shadowTexture } from './textures';

let sharedShadow: THREE.Texture | undefined;
let sharedGlows: { red: THREE.Texture; white: THREE.Texture } | undefined;
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

  const paint = new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: design.paintMetalness ?? 0.45,
    roughness: 0.3,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: design.cockpit ? 0x112334 : 0x070e16,
    metalness: 0,
    roughness: 0.2,
    clearcoat: 0.1,
    clearcoatRoughness: 0.18,
    specularIntensity: 0.15,
    envMapIntensity: 0.32,
    side: design.openTop || design.cockpit ? THREE.DoubleSide : THREE.FrontSide,
    transparent: !!design.cockpit,
    opacity: design.cockpit ? 0.78 : 1,
    depthWrite: !design.cockpit,
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
  const reflector = new THREE.MeshPhysicalMaterial({ color: 0x8f9da9, metalness: 0.65, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x650810, emissive: 0xff1a12, emissiveIntensity: headlightsOn ? 0.4 : 0.12, roughness: 0.24 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x6a3000, emissive: 0xff8a10, emissiveIntensity: 0.5, roughness: 0.18 });
  const caliperColor = ['f355', 'f550', 'diablo'].includes(spec.id) ? 0x8e2525 : 0x454951;
  const caliper = new THREE.MeshStandardMaterial({ color: caliperColor, roughness: 0.35, metalness: 0.3 });
  const plateMap = plateTexture();
  const plate = new THREE.MeshStandardMaterial({ map: plateMap, roughness: 0.4 });
  const materials: THREE.Material[] = [paint, glass, black, trim, chrome, head, reflector, tail, amber, caliper, plate];

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
  const hoodPatch = (outline: [number, number][], material: THREE.Material, lift = 0.009, bulge = 0) => {
    if (design.highDetail && !bulge) {
      const contour = outline.map(([x, z]) => new THREE.Vector2(x, z)),
        positions: number[] = [];
      const triangle = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth: number) => {
        if (depth) {
          const ab = a.clone().lerp(b, 0.5),
            bc = b.clone().lerp(c, 0.5),
            ca = c.clone().lerp(a, 0.5);
          triangle(a, ab, ca, depth - 1);
          triangle(ab, b, bc, depth - 1);
          triangle(ca, bc, c, depth - 1);
          triangle(ab, bc, ca, depth - 1);
          return;
        }
        const positive = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
        for (const p of positive ? [a, c, b] : [a, b, c]) {
          const y = surface(p.y, Math.abs(p.x) / shape.section(p.y).halfWidth);
          positions.push(p.x, y + lift, shape.bodyZ(p.x, y, p.y));
        }
      };
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) triangle(contour[a], contour[b], contour[c], 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      return add(geometry, material);
    }
    const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length,
      cz = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
    const points = [[cx, cz], ...(bulge ? outline.map(([x, z]) => [THREE.MathUtils.lerp(cx, x, 0.55), THREE.MathUtils.lerp(cz, z, 0.55)]) : []), ...outline];
    const positions = points.flatMap(([x, z], i) => {
      const y = surface(z, Math.abs(x) / shape.section(z).halfWidth);
      return [x, y + lift + bulge * (i === 0 ? 1 : i <= outline.length && bulge ? 0.7 : 0), shape.bodyZ(x, y, z)];
    });
    const indices = outline.flatMap((_, i) => [0, ((i + 1) % outline.length) + 1, i + 1]);
    if (bulge)
      for (let i = 0; i < outline.length; i++) {
        const a = i + 1,
          b = ((i + 1) % outline.length) + 1,
          c = a + outline.length,
          d = b + outline.length;
        indices.push(a, d, c, a, b, d);
      }
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
      if (design.highDetail) {
        const z = (a.x + b.x + c.x) / 3,
          y = (a.y + b.y + c.y) / 3,
          section = shape.section(z);
        if (y < section.bottom || y > section.shoulder + 0.01) return;
      }
      for (const point of side > 0 ? [a, c, b] : [a, b, c]) positions.push(side * (shape.flank(point.x, point.y) + lift), point.y, point.x);
    };
    const contour = outline.map(([z, y]) => new THREE.Vector2(z, y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) triangle(contour[a], contour[b], contour[c], design.highDetail ? 3 : 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (material instanceof THREE.MeshStandardMaterial && material.map) {
      const zs = outline.map(([z]) => z),
        ys = outline.map(([, y]) => y),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs),
        y0 = Math.min(...ys),
        y1 = Math.max(...ys);
      const uv: number[] = [];
      for (let i = 0; i < positions.length; i += 3)
        uv.push(side > 0 ? (z1 - positions[i + 2]) / (z1 - z0) : (positions[i + 2] - z0) / (z1 - z0), (positions[i + 1] - y0) / (y1 - y0));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    geometry.computeVertexNormals();
    return add(geometry, material);
  };
  const slopeAt = (z: number) => Math.atan2(surface(z + 0.1, 0.5) - surface(z - 0.1, 0.5), 0.2);
  // Rear lenses and seals follow the rounded bumper rather than hovering beyond its corners.
  const rearPanel = (x: number, y: number, w: number, h: number, material: THREE.Material, lift = 0.012) => {
    const contour = new THREE.Shape(),
      r = Math.min(h * 0.2, w * 0.08);
    contour.moveTo(-w / 2 + r, -h / 2);
    contour.lineTo(w / 2 - r, -h / 2);
    contour.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    contour.lineTo(w / 2, h / 2 - r);
    contour.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    contour.lineTo(-w / 2 + r, h / 2);
    contour.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    contour.lineTo(-w / 2, -h / 2 + r);
    contour.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const points = contour.getPoints(3).map((point) => point.add(new THREE.Vector2(x, y))),
      positions: number[] = [];
    const triangle = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2, depth: number) => {
      if (depth) {
        const ab = a.clone().lerp(b, 0.5),
          bc = b.clone().lerp(c, 0.5),
          ca = c.clone().lerp(a, 0.5);
        triangle(a, ab, ca, depth - 1);
        triangle(ab, b, bc, depth - 1);
        triangle(ca, bc, c, depth - 1);
        triangle(ab, bc, ca, depth - 1);
        return;
      }
      const positive = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
      for (const p of positive ? [a, c, b] : [a, b, c]) positions.push(p.x, p.y, shape.bumperZ(p.x, p.y, -1) - lift);
    };
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(points, [])) triangle(points[a], points[b], points[c], 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    add(geometry, material);
  };

  // Body and glasshouse with painted roof and pillars.
  add(shape.body, paint);
  const roofPaint = design.softTop
    ? new THREE.MeshStandardMaterial({ color: design.softTop, roughness: 0.94 })
    : features.has('blackRoof')
      ? new THREE.MeshPhysicalMaterial({ color: '#111923', metalness: 0.25, roughness: 0.2, clearcoat: 1 })
      : paint;
  if (roofPaint !== paint) materials.push(roofPaint);
  add(shape.glass, [glass, roofPaint, paint]);
  if (design.openTop || design.cockpit) {
    const seatZ = ((roofRear[0] + roofFront[0]) * length) / 2 - 0.13;
    rounded(width * 0.68, 0.1, (roofFront[0] - roofRear[0]) * length, black, 0, 0.51 * (design.cockpit ? 0.78 : 1), seatZ);
    const seatScale = design.cockpit ? 0.78 : 1;
    for (const side of spec.id === 'clkgtr' ? [-1] : [-1, 1]) {
      rounded(0.43, 0.12, 0.48, black, side * width * 0.18, 0.6 * seatScale, seatZ);
      rounded(0.43, 0.42, 0.14, black, side * width * 0.18, 0.8 * seatScale, seatZ - 0.19, -0.15);
      rounded(0.24, 0.18, 0.13, black, side * width * 0.18, 1.07 * seatScale, seatZ - 0.21);
    }
    rounded(width * 0.64, 0.14, 0.22, black, 0, design.cockpit ? 0.72 : 0.92, roofFront[0] * length + 0.12);
    const steering = add(new THREE.TorusGeometry(0.16, 0.024, 6, 16), black, -width * 0.18, design.cockpit ? 0.8 : 1.04, roofFront[0] * length - 0.03, -0.5);
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
    const z = shape.bumperZ(x, y) + 0.01;
    add(new THREE.ShapeGeometry(inner), black, x, y, z + 0.005);
    add(
      new THREE.ExtrudeGeometry(outer, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 }),
      metal ? chrome : paint,
      x,
      y,
      z,
    );
    for (let i = -1; i <= 1; i++) rounded(w * 0.77, 0.008, 0.008, trim, x, y + i * h * 0.2, z + 0.012);
  };
  const fw = nosePart.halfWidth;
  const fy = nosePart.bottom + 0.12;
  if (spec.id === 'countach') {
    for (const side of [-1, 1]) {
      intake(side * fw * 0.61, nosePart.bottom + 0.065, fw * 0.49, 0.1, false);
      const px = side * fw * 0.22,
        py = nosePart.bottom + 0.1;
      rounded(0.13, 0.09, 0.02, black, px, py, shape.bumperZ(px, py) + 0.013);
      rounded(0.095, 0.073, 0.023, head, px, py, shape.bumperZ(px, py) + 0.023);
    }
  } else if (spec.id === 'diablo') {
    for (const side of [-1, 1]) intake(side * fw * 0.48, nosePart.bottom + 0.08, fw * 0.79, 0.105, true);
  } else if (spec.id === 'clkgtr') {
    intake(0, nosePart.crown - 0.1, fw * 0.96, 0.2, false, true);
    intake(0, fy - 0.025, fw * 1.55, 0.14, true);
    for (const side of [-1, 1]) intake(side * fw * 0.85, fy + 0.035, fw * 0.25, 0.14, false);
    rounded(0.018, 0.18, 0.024, chrome, 0, nosePart.crown - 0.115, noseZ + 0.024);
  } else if (spec.id === 'sl600') {
    intake(0, nosePart.shoulder - 0.12, fw * 0.92, 0.2, false, true);
    intake(0, fy, fw * 1.7, 0.115, false);
    rounded(0.022, 0.19, 0.06, chrome, 0, nosePart.shoulder - 0.12, noseZ + 0.04);
  } else if (spec.id === 'falcon' || spec.id === 'hsvgts') {
    intake(0, nosePart.shoulder - 0.16, fw * 1.1, 0.13, false);
    intake(0, fy, fw * 1.5, 0.14, false);
    if (spec.id === 'hsvgts') rounded(0.035, 0.14, 0.07, paint, 0, nosePart.shoulder - 0.16, noseZ + 0.04);
    for (const side of [-1, 1]) disc(0.047, 0.03, head, side * fw * 0.84, fy, shape.bumperZ(side * fw * 0.84, fy) + 0.018);
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
  if (design.face !== 'endurance' && !design.highDetail) add(new THREE.PlaneGeometry(0.43, 0.095), plate, 0, fy - 0.005, noseZ + 0.038);
  if (features.has('splitter') && !design.highDetail) rounded(width * 0.96, 0.035, 0.32, black, 0, nosePart.bottom - 0.035, nose - 0.04);

  // Lens outlines sit flush with the body and contain individual reflectors.
  const lampZ = nose - (design.lamps?.inset ?? (design.headlights === 'popup' ? 0.42 : 0.35));
  const lampX = shape.section(lampZ).halfWidth * (design.lamps?.spread ?? 0.65);
  const lampY = surface(lampZ, 0.65);
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (design.headlights === 'popup') {
      const w = design.lamps?.width ?? 0.42,
        d = design.lamps?.depth ?? 0.31;
      const outline: [number, number][] = [
        [x - w / 2, lampZ - d / 2],
        [x + w / 2, lampZ - d / 2],
        [x + w * 0.45, lampZ + d / 2],
        [x - w * 0.45, lampZ + d / 2],
      ];
      hoodPatch(outline, black, 0.006);
      hoodPatch(
        outline.map(([px, pz]) => [x + (px - x) * 0.94, lampZ + (pz - lampZ) * 0.94]),
        paint,
        0.008,
      );
      if (headlightsOn) {
        rounded(w, 0.14, d * 0.9, paint, x, lampY + 0.085, lampZ, -0.2);
        rounded(w * 0.82, 0.075, 0.025, head, x, lampY + 0.1, lampZ + d / 2);
      }
      for (const [offset, material] of [
        [0.8, amber],
        [0.53, head],
      ] as const) {
        const px = side * nosePart.halfWidth * offset,
          py = Math.min(nosePart.shoulder - 0.025, fy + 0.12);
        rounded(design.highDetail ? 0.15 : 0.2, 0.045, 0.024, material, px, py, shape.bumperZ(px, py) + 0.012);
      }
    } else if (design.headlights === 'quad') {
      // The NFS III CLK-GTR has four separate, upright oval lenses, not two bonnet pods.
      for (const inner of [false, true]) {
        const px = side * nosePart.halfWidth * (inner ? 0.58 : 0.86),
          py = nosePart.shoulder - (inner ? 0.135 : 0.155),
          w = inner ? 0.145 : 0.225,
          h = inner ? 0.21 : 0.29,
          z = shape.bumperZ(px, py);
        const surround = new THREE.SphereGeometry(1, 16, 8);
        surround.scale((w + 0.018) / 2, (h + 0.018) / 2, 0.018);
        add(surround, black, px, py, z + 0.013);
        const lens = new THREE.SphereGeometry(1, 16, 8);
        lens.scale(w / 2, h / 2, 0.026);
        add(lens, reflector, px, py, z + 0.014);
        disc(w * 0.27, 0.006, chrome, px, py + 0.015, z + 0.041);
        disc(w * 0.11, 0.007, head, px, py + 0.015, z + 0.046);
      }
    } else if (design.headlights === 'rect') {
      const y = nosePart.shoulder - 0.09,
        w = design.lamps?.width ?? 0.46,
        h = design.lamps?.depth ?? 0.15;
      const z = shape.bumperZ(x, y);
      const face = (scale: number, material: THREE.Material, lift: number) => {
        const outline = new THREE.Shape();
        outline.moveTo(-w * 0.5, -h * 0.38);
        outline.quadraticCurveTo(-w * 0.53, h * 0.47, -w * 0.43, h * 0.5);
        outline.lineTo(w * 0.44, h * 0.43);
        outline.quadraticCurveTo(w * 0.56, h * 0.23, w * 0.46, -h * 0.48);
        outline.closePath();
        const geometry = new THREE.ShapeGeometry(outline, 6);
        geometry.scale(scale, scale, 1);
        add(geometry, material, x, y, z + lift);
      };
      face(1.045, black, 0.025);
      face(1, reflector, 0.027);
      for (let i = -3; i <= 3; i++) rounded(0.006, h * 0.75, 0.006, head, x + i * w * 0.1, y, z + 0.031);
      rounded(0.065, h * 0.75, 0.012, amber, x + side * w * 0.37, y, z + 0.033);
    } else {
      const w = design.lamps?.width ?? 0.43,
        d = design.lamps?.depth ?? 0.32;
      const taper = design.headlights === 'covered' ? 0.35 : design.headlights === 'slim' ? 0.12 : 0;
      const lensOutline = (width: number, depth: number) => {
        return ellipse(x, lampZ, width, depth, taper).map(([px, pz]): [number, number] => [px, pz - side * (px - x) * (design.lamps?.sweep ?? 0)]);
      };
      hoodPatch(lensOutline(w + 0.015, d + 0.018), black, 0.005);
      hoodPatch(lensOutline(w, d), reflector, 0.007, 0.002);
      const count = design.lamps?.projectors ?? 2;
      for (let i = 0; i < count; i++) {
        const vertical = d > w * 1.15,
          offset = (i - (count - 1) / 2) * Math.min(0.105, (vertical ? d : w) * 0.27),
          px = x + (vertical ? 0 : offset),
          pz = lampZ + (vertical ? offset : -side * offset * (design.lamps?.sweep ?? 0));
        const radius = Math.min(0.064, (vertical ? w : d) * 0.3);
        hoodPatch(ellipse(px, pz, radius * 2, radius * 2), chrome, 0.012, -0.003);
        hoodPatch(ellipse(px, pz, radius * 0.8, radius), head, 0.013, 0.001);
      }
      hoodPatch(ellipse(x + side * w * 0.34, lampZ + 0.03, 0.026, 0.055), amber, 0.014);
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
  if (design.taillights === 'grille' || spec.id === 'f355') rearPanel(0, tailY, tailPart.halfWidth * 1.75, 0.16, black, 0.008);
  if (spec.id !== 'clkgtr')
    for (const side of [-1, 1]) {
      const x = side * tailX;
      if (design.taillights === 'round' || design.taillights === 'quad') {
        for (const offset of [-0.105, 0.105]) {
          const px = x + side * offset;
          const z = shape.bumperZ(px, tailY, -1);
          disc(0.079, 0.012, black, px, tailY, z - 0.01, 0, -1);
          disc(0.069, 0.015, tail, px, tailY, z - 0.018, 0, -1);
          lampCentres.push(new THREE.Vector3(px, tailY, z - 0.04));
        }
      } else {
        const w = design.taillights === 'slim' ? tailPart.halfWidth * 0.66 : 0.39,
          h = spec.id === 'sl600' ? 0.17 : 0.125;
        rearPanel(x, tailY, w + 0.018, h + 0.016, black, 0.008);
        rearPanel(x, tailY, w, h, tail);
        rearPanel(x - side * w * 0.25, tailY - h * 0.18, w * 0.32, h * 0.2, head, 0.014);
        if (design.taillights !== 'slim') rearPanel(x + side * w * 0.31, tailY + h * 0.17, w * 0.2, h * 0.34, amber, 0.014);
        if (spec.id === 'sl600') for (const offset of [-0.035, 0.025]) rearPanel(x, tailY + offset, w * 0.94, 0.01, black, 0.015);
        lampCentres.push(new THREE.Vector3(x, tailY, shape.bumperZ(x, tailY, -1) - 0.04));
      }
    }
  rounded(0.55, 0.143, 0.023, black, 0, tailY - 0.205, tailZ - 0.023, 0, 0, 0.025);
  add(new THREE.PlaneGeometry(0.5, 0.105), plate, 0, tailY - 0.205, tailZ - 0.037, 0, Math.PI);
  rearPanel(0, tailY - 0.31, tailPart.halfWidth * 1.85, 0.007, black, 0.009);
  rounded(tailPart.halfWidth * 1.65, 0.055, 0.15, black, 0, (design.rideHeight ?? 0.15) + 0.06, tailZ + 0.02);
  if (features.has('splitter')) for (let i = -2; i <= 2; i++) rounded(0.012, 0.075, 0.2, black, i * 0.17, (design.rideHeight ?? 0.15) + 0.02, tailZ + 0.015);
  const outlets =
    design.exhaust === 'centre'
      ? [-0.27, -0.13, 0.13, 0.27]
      : design.exhaust === 'left'
        ? [-0.65, -0.54]
        : spec.id === 'clkgtr'
          ? [-0.5, 0.5]
          : design.exhaust === 'quad'
            ? [-0.72, -0.59, 0.59, 0.72]
            : [-0.62, 0.62];
  for (const x of outlets) {
    const pipe = new THREE.CylinderGeometry(spec.id === 'clkgtr' ? 0.059 : 0.036, spec.id === 'clkgtr' ? 0.065 : 0.041, 0.14, 16, 1, true);
    add(pipe, chrome, x, (design.rideHeight ?? 0.15) + 0.08, tailZ - 0.025, Math.PI / 2);
    disc(spec.id === 'clkgtr' ? 0.053 : 0.03, 0.006, black, x, (design.rideHeight ?? 0.15) + 0.08, tailZ - 0.097, 0, -1);
  }

  // Door mirrors and handles.
  const mirrorZ = screenBase[0] * length - 0.22;
  const mirrorBase = shape.section(mirrorZ);
  const mirrorPaint = spec.id === 'clkgtr' ? new THREE.MeshPhysicalMaterial({ color: '#a51f2b', roughness: 0.35, clearcoat: 0.8 }) : paint;
  if (mirrorPaint !== paint) materials.push(mirrorPaint);
  for (const side of [-1, 1]) {
    if (design.highDetail) {
      const x = side * (mirrorBase.halfWidth + 0.035),
        y = mirrorBase.shoulder + 0.06;
      rounded(0.13, 0.025, 0.055, black, side * (mirrorBase.halfWidth - 0.015), y - 0.035, mirrorZ);
      rounded(0.15, 0.085, 0.21, mirrorPaint, x, y, mirrorZ - 0.02, 0, 0, 0.025);
      add(new THREE.PlaneGeometry(0.105, 0.052), chrome, x, y, mirrorZ - 0.128, 0, Math.PI);
    } else {
      rounded(0.05, 0.03, 0.06, black, side * (mirrorBase.halfWidth * 0.85), mirrorBase.crown + 0.02, mirrorZ);
      rounded(0.1, 0.075, 0.16, mirrorPaint, side * (mirrorBase.halfWidth * 0.85 + 0.08), mirrorBase.crown + 0.06, mirrorZ - 0.02, 0, 0, 0.03);
    }
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
    const projected = new THREE.CatmullRomCurve3(points, false, 'centripetal')
      .getPoints(32)
      .map((point) => new THREE.Vector3(side * (shape.flank(point.z, point.y) + 0.006), point.y, point.z));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(projected, false, 'centripetal'), 32, 0.0025, 3, false), black);
  }

  // Rubber glazing seals, fine bonnet/deck seams and wipers make the scale readable up close.
  const seam = (points: THREE.Vector3[], radius = 0.003, material: THREE.Material = black, closed = false) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), Math.max(12, points.length * 2), radius, 3, closed), material);
  const bodySeam = (outline: [number, number][]) => {
    const curve = new THREE.CatmullRomCurve3(
      outline.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    const projected = curve.getPoints(48).map((point) => {
      const y = surface(point.z, Math.abs(point.x) / shape.section(point.z).halfWidth);
      return new THREE.Vector3(point.x, y + 0.007, shape.bodyZ(point.x, y, point.z));
    });
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(projected, false, 'centripetal'), 64, 0.0025, 3, false), black);
  };
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
  bodySeam(bonnet);
  if (!design.openTop) {
    const z0 = -length * 0.47,
      z1 = rearBase[0] * length - 0.03;
    const deck: [number, number][] = [
      [-width * 0.32, z0],
      [width * 0.32, z0],
      [width * 0.34, z1],
      [-width * 0.34, z1],
    ];
    bodySeam(deck);
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
  if (design.highDetail)
    liveryMap = addFavoriteDetails({
      spec,
      design,
      shape,
      add,
      rounded,
      sidePatch,
      hoodPatch,
      rearPanel,
      materials: { paint, black, chrome, head, trim, tail, amber },
      lampCentres,
      registerMaterial: (material) => materials.push(material),
    });
  if (features.has('airboxes') && !design.highDetail) {
    const z = -length * 0.25;
    for (const side of [-1, 1]) {
      const { halfWidth } = shape.section(z);
      const y = surface(z, 0.8);
      rounded(0.36, 0.17, 0.7, paint, side * (halfWidth - 0.22), y + 0.07, z, 0, 0, 0.05);
      rounded(0.28, 0.1, 0.03, black, side * (halfWidth - 0.22), y + 0.08, z + 0.35);
    }
  }
  if (features.has('naca') && !design.highDetail) {
    for (const side of [-1, 1]) {
      const { halfWidth, shoulder } = shape.section(0);
      rounded(0.02, 0.1, 0.8, black, side * (halfWidth * 0.97), shoulder - 0.12, length * 0.02, 0.18);
    }
  }
  if (features.has('sideIntakes') && !design.highDetail) {
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
  if (features.has('louvres') && !design.highDetail) {
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
      [-nose + 0.06, rearBase[0] * length - 0.04, (z) => surface(z, 0.25)],
    ];
    if (!design.openTop) pieces.push([roofRear[0] * length, roofFront[0] * length, (z) => shape.cabin(z).roof + 0.008]);
    for (const [from, to, height] of pieces) {
      const positions: number[] = [];
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const z0 = THREE.MathUtils.lerp(from, to, i / steps);
        const z1 = THREE.MathUtils.lerp(from, to, (i + 1) / steps);
        for (const lane of lanes) {
          const half = (t: number) => 0.075 * (0.2 + Math.sin(Math.PI * t) ** 0.7);
          const x0 = lane - half(i / steps),
            x1 = lane + half(i / steps);
          const x2 = lane - half((i + 1) / steps),
            x3 = lane + half((i + 1) / steps);
          const y0 = height(z0) + 0.006;
          const y1 = height(z1) + 0.006;
          const a = [x0, y0, shape.bodyZ(x0, y0 - 0.006, z0)],
            b = [x1, y0, shape.bodyZ(x1, y0 - 0.006, z0)],
            c = [x2, y1, shape.bodyZ(x2, y1 - 0.006, z1)],
            d = [x3, y1, shape.bodyZ(x3, y1 - 0.006, z1)];
          positions.push(...a, ...c, ...b, ...b, ...c, ...d);
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
    for (const side of [-1, 1]) {
      rounded(0.055, 0.23, 0.19, paint, side * width * 0.29, tailTop + 0.115, wingZ - 0.04, 0.18);
      airfoil(width * 0.5, 0.34, paint, tailTop + 0.235, wingZ - 0.05, side * 0.045, side * width * 0.25);
    }
  } else if (design.wing === 'gt') {
    airfoil(width - 0.06, 0.46, black, tailTop + wingHeight, wingZ - 0.06);
    for (const side of [-1, 1]) {
      rounded(0.025, design.highDetail ? 0.12 : 0.28, 0.5, black, side * (width / 2 - 0.02), tailTop + wingHeight - 0.02, wingZ - 0.06);
      rounded(0.045, wingHeight, 0.12, black, side * 0.48, tailTop + wingHeight / 2, wingZ);
    }
  } else if (design.wing === 'whale') {
    rounded(width * 0.72, 0.07, 0.5, paint, 0, shape.section(-length * 0.42).crown + 0.11, -length * 0.42, -0.28, 0, 0.03);
    rounded(width * 0.74, 0.025, 0.05, black, 0, shape.section(-length * 0.42).crown + 0.08, -length * 0.42 - 0.26);
  } else if (design.wing === 'lip') {
    rounded(tailPart.halfWidth * 1.6, 0.04, 0.12, paint, 0, tailTop + 0.02, -nose + 0.1, -0.3);
  } else if (design.wing === 'low') {
    const wingPaint = spec.id === 'diablo' ? black : paint;
    airfoil(width - 0.22, 0.34, wingPaint, tailTop + wingHeight, wingZ);
    for (const side of [-1, 1]) rounded(0.04, wingHeight, 0.16, wingPaint, side * (width / 2 - 0.45), tailTop + wingHeight / 2, wingZ);
  }

  // Additive glows for brake lights, and headlights on evening tracks.
  sharedGlows ??= { red: glowTexture('#ff2a1a'), white: glowTexture('#fff2c8') };
  const brakeMaterial = new THREE.SpriteMaterial({ map: sharedGlows.red, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const headMaterial = new THREE.SpriteMaterial({
    map: sharedGlows.white,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.35,
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
      let x = side * lampX,
        y = surface(lampZ, design.lamps?.spread ?? 0.65) + 0.025,
        z = shape.bodyZ(x, y - 0.025, lampZ) + 0.01;
      if (design.headlights === 'popup') {
        y = lampY + 0.1;
        z = lampZ + (design.lamps?.depth ?? 0.31) / 2 + 0.025;
      } else if (design.headlights === 'rect' || design.headlights === 'quad') {
        if (design.headlights === 'quad') x = side * nosePart.halfWidth * 0.81;
        y = nosePart.shoulder - (design.headlights === 'quad' ? 0.155 : 0.09);
        z = shape.bumperZ(x, y) + 0.055;
      }
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(0.23);
      body.add(sprite);
    }
  }

  // Wheels: rubber and metal meshes spin; front pivots steer.
  const wheels = wheelGeometry(design.rims ?? 'five');
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({
    color: design.highDetail ? 0xffffff : spec.id === 'indy98' || spec.id === 'spectre' ? 0xc4a851 : 0xc9cdd2,
    vertexColors: !!wheels.metal.getAttribute('color'),
    roughness: design.highDetail ? 0.22 : 0.27,
    metalness: 0.85,
  });
  const brake = new THREE.MeshStandardMaterial({ color: 0x454b53, roughness: 0.65, metalness: 0.55 });
  materials.push(rubber, rim, brake);
  const spinners: THREE.Group[] = [];
  const wheelPivots: THREE.Group[] = [];
  const steerers: THREE.Group[] = [];
  const tyres = new THREE.InstancedMesh(wheels.rubber, rubber, 4);
  const rims = new THREE.InstancedMesh(wheels.metal, rim, 4);
  const discs = new THREE.InstancedMesh(wheels.brake, brake, 4);
  group.add(tyres, rims, discs);
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const tyreWidth = z < 0 ? (design.rearTyreWidth ?? 1) : (design.frontTyreWidth ?? 1);
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
      discs.setMatrixAt(index, wheelMatrix);
    });
    tyres.instanceMatrix.needsUpdate = rims.instanceMatrix.needsUpdate = discs.instanceMatrix.needsUpdate = true;
  };
  updateWheels();
  for (const mesh of [tyres, rims, discs]) {
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
    if (child instanceof THREE.Mesh && child !== shadow)
      child.castShadow = !(Array.isArray(child.material) ? child.material : [child.material]).some((material) => material.transparent);
  });

  // Distant rivals retain their individual silhouette, windows, wing and lights in a handful of draws.
  const distant = new THREE.Group();
  const simple = buildBodyShape(design, length, width, true);
  const distantGlass = design.cockpit ? glass.clone() : glass;
  if (distantGlass !== glass) {
    distantGlass.transparent = false;
    distantGlass.opacity = 1;
    distantGlass.depthWrite = true;
    materials.push(distantGlass);
  }
  distant.add(new THREE.Mesh(simple.body, paint), new THREE.Mesh(simple.glass, [distantGlass, roofPaint, paint]));
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
      tyres.visible = rims.visible = discs.visible = detailed;
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
        if (child instanceof THREE.Mesh && child.geometry !== wheels.rubber && child.geometry !== wheels.metal && child.geometry !== wheels.brake)
          child.geometry.dispose();
      });
      for (const material of materials) material.dispose();
      tyres.dispose();
      rims.dispose();
      discs.dispose();
      plateMap.dispose();
      liveryMap?.dispose();
    },
  };
}

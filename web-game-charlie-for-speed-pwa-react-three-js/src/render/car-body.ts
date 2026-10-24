import * as THREE from 'three';
import type { CarDesign, Point } from './car-designs';

export const WHEEL_RADIUS = 0.34;
export const ARCH_RADIUS = 0.42;
const FLOOR = 0.26;
const BODY_STATIONS = 72;
const GLASS_STATIONS = 28;

// Height of the upper outline at u, ignoring the bottom corners of the rear and front faces.
export function heightAt(top: Point[], u: number) {
  const chain = top.slice(1, -1);
  if (u <= chain[0][0]) return chain[0][1];
  for (let i = 1; i < chain.length; i++) {
    const [u0, v0] = chain[i - 1];
    const [u1, v1] = chain[i];
    if (u <= u1) return u1 === u0 ? Math.max(v0, v1) : v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
  }
  return chain[chain.length - 1][1];
}

function lineAt(points: Point[], u: number) {
  if (u <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [u0, v0] = points[i - 1];
    const [u1, v1] = points[i];
    if (u <= u1) return v0 + ((v1 - v0) * (u - u0)) / Math.max(u1 - u0, 1e-6);
  }
  return points[points.length - 1][1];
}

export function axles(design: CarDesign, length: number) {
  const shift = (design.axleShift ?? 0) * length;
  return { front: design.axle * length + shift, rear: -design.axle * length + shift };
}

export type BodyShape = {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  // Cross-section measurements at a distance z along the car, for placing details on the surface.
  section: (z: number) => { halfWidth: number; bottom: number; shoulder: number; crown: number };
};

// Builds a closed loft from rings of points; flips the winding if the first side normal points inward.
function loft(rings: THREE.Vector3[][], groups?: (station: number, segment: number) => number) {
  const ringSize = rings[0].length;
  const positions: number[] = [];
  for (const ring of rings) for (const point of ring) positions.push(point.x, point.y, point.z);
  const indices: number[][] = [[], []];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < ringSize; j++) {
      const a = i * ringSize + j;
      const b = (i + 1) * ringSize + j;
      const c = (i + 1) * ringSize + ((j + 1) % ringSize);
      const d = i * ringSize + ((j + 1) % ringSize);
      indices[groups ? groups(i, j) : 0].push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([...indices[0], ...indices[1]]);
  geometry.addGroup(0, indices[0].length, 0);
  geometry.addGroup(indices[0].length, indices[1].length, 1);
  geometry.computeVertexNormals();

  // Probe the widest point of the middle ring: its normal must point away from the centre line.
  const middle = Math.floor(rings.length / 2) * ringSize + 3;
  if (geometry.attributes.normal.getX(middle) * positions[middle * 3] < 0) {
    const index = geometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const swap = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, swap);
      }
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

export function buildBodyShape(design: CarDesign, length: number, width: number): BodyShape {
  const { front, rear } = axles(design, length);

  const section = (z: number) => {
    const u = THREE.MathUtils.clamp(z / length, -0.5, 0.5);
    const plan = (1 - (Math.abs(u) / 0.5) ** 6) ** (1 / 6);
    let halfWidth =
      (width / 2) *
      plan *
      (1 - design.pinch * THREE.MathUtils.smoothstep(u, 0.12, 0.5)) *
      (1 + (design.hips ?? 0) * THREE.MathUtils.smoothstep(-u, 0.02, 0.28));
    const crown = heightAt(design.top, u);
    let shoulder = crown - 0.05;
    let bottom = FLOOR + 0.05 * THREE.MathUtils.smoothstep(Math.abs(u), 0.4, 0.5);

    // Flared fenders rise over each wheel; the arch is cut out of the lower edge.
    for (const axle of [front, rear]) {
      const distance = Math.abs(z - axle);
      const fender = WHEEL_RADIUS + ARCH_RADIUS + 0.07;
      shoulder = Math.max(shoulder, THREE.MathUtils.lerp(fender, shoulder, THREE.MathUtils.smoothstep(distance, ARCH_RADIUS * 0.75, ARCH_RADIUS * 1.5)));
      halfWidth *= 1 + 0.03 * (1 - THREE.MathUtils.smoothstep(distance, ARCH_RADIUS * 0.6, ARCH_RADIUS * 1.6));
      if (distance < ARCH_RADIUS) bottom = Math.max(bottom, Math.min(WHEEL_RADIUS + Math.sqrt(ARCH_RADIUS ** 2 - distance ** 2), shoulder - 0.1));
    }
    return { halfWidth, bottom, shoulder, crown: Math.max(crown, shoulder - 0.02) };
  };

  // Body rings: floor, rocker, door, tumblehome, shoulder, then over the crowned hood or deck.
  const lean = 1 - design.tumble * 0.35;
  const bodyRings: THREE.Vector3[][] = [];
  for (let i = 0; i < BODY_STATIONS; i++) {
    const t = i / (BODY_STATIONS - 1);
    const z = (-0.5 + (1 - Math.cos(t * Math.PI)) / 2) * length;
    const { halfWidth: w, bottom, shoulder, crown } = section(z);
    const side: [number, number][] = [
      [0.9, bottom],
      [1, bottom + 0.09],
      [1, THREE.MathUtils.lerp(bottom, shoulder, 0.55)],
      [0.985 * lean + 0.015, shoulder - 0.06],
      [0.93 * lean, shoulder],
      [0.74 * lean, THREE.MathUtils.lerp(shoulder, crown, 0.55)],
      [0.42 * lean, crown + 0.012],
    ];
    const ring = [new THREE.Vector3(0, bottom + 0.02, z)];
    for (const [x, y] of side) ring.push(new THREE.Vector3(x * w, y, z));
    ring.push(new THREE.Vector3(0, crown + 0.02, z));
    for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x * w, y, z));
    bodyRings.push(ring);
  }
  const body = loft(bodyRings);

  // Glasshouse: windscreen, side windows and rear glass, with painted roof and pillars (group 1).
  const [rearBase, roofRear, roofFront, screenBase] = design.cabin;
  const cabinLine: Point[] = [rearBase, roofRear, roofFront, screenBase];
  const pillarU = THREE.MathUtils.lerp(roofRear[0], roofFront[0], 0.3);
  const glassRings: THREE.Vector3[][] = [];
  const stationU: number[] = [];
  for (let i = 0; i < GLASS_STATIONS; i++) {
    const u = THREE.MathUtils.lerp(rearBase[0], screenBase[0], i / (GLASS_STATIONS - 1));
    const z = u * length;
    const { halfWidth: w, crown } = section(z);
    const base = crown - 0.03;
    const roof = Math.max(base + 0.01, lineAt(cabinLine, u));
    const gl = 1 - design.tumble * 0.4;
    const side: [number, number][] = [
      [0.84 * gl, base],
      [0.8 * gl, THREE.MathUtils.lerp(base, roof, 0.45)],
      [0.7 * gl, roof - 0.045],
      [0.48 * gl, roof - 0.006],
    ];
    const ring = [new THREE.Vector3(0, base - 0.06, z)];
    for (const [x, y] of side) ring.push(new THREE.Vector3(x * w, y, z));
    ring.push(new THREE.Vector3(0, roof + 0.012, z));
    for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x * w, y, z));
    glassRings.push(ring);
    stationU.push(u);
  }
  const ringSize = glassRings[0].length;
  const glass = loft(glassRings, (station, segment) => {
    const u = stationU[station];
    const outer = segment === 1 || segment === ringSize - 2;
    if (segment === 0 || segment === ringSize - 1) return 1;
    if (u > roofFront[0]) return outer ? 1 : 0;
    if (u < roofRear[0]) return outer ? 1 : 0;
    if (segment === 4 || segment === 5) return 1;
    return Math.abs(u - pillarU) < 0.02 ? 1 : 0;
  });

  return { body, glass, section: (z) => section(z) };
}

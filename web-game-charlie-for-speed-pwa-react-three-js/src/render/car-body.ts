import * as THREE from 'three';
import type { CarDesign, Point } from './car-designs';

export const WHEEL_RADIUS = 0.34;
export const ARCH_RADIUS = 0.42;
const FLOOR = 0.26;

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
function loft(rings: THREE.Vector3[][], groups?: (station: number, segment: number) => number, capMaterial = 0) {
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
  // Separate cap vertices keep each bumper face flat instead of rounding it into a pointed tip.
  for (const end of [0, rings.length - 1]) {
    const ring = rings[end];
    const first = positions.length / 3;
    for (const point of ring) positions.push(point.x, point.y, point.z);
    // A prototype's sunken bonnet is concave: a centre fan would fill above its outline.
    const contour = ring.map((point) => new THREE.Vector2(point.x, point.y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const normal = (ring[b].x - ring[a].x) * (ring[c].y - ring[a].y) - (ring[b].y - ring[a].y) * (ring[c].x - ring[a].x);
      const forward = normal > 0 === (end === 0);
      indices[capMaterial].push(first + a, first + (forward ? b : c), first + (forward ? c : b));
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

export function buildBodyShape(design: CarDesign, length: number, width: number, lowDetail = false): BodyShape {
  const bodyStations = lowDetail ? 24 : 72;
  const glassStations = lowDetail ? 10 : 28;
  const { front, rear } = axles(design, length);
  const wheelRadius = WHEEL_RADIUS * (design.wheelScale ?? 1);
  const archRadius = ARCH_RADIUS * (design.wheelScale ?? 1);

  const section = (z: number) => {
    const u = THREE.MathUtils.clamp(z / length, -0.5, 0.5);
    const stations = design.body;
    let a = stations[0],
      b = stations[stations.length - 1];
    for (let i = 1; i < stations.length; i++)
      if (u <= stations[i][0]) {
        a = stations[i - 1];
        b = stations[i];
        break;
      }
    const linear = THREE.MathUtils.clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
    const blend = design.section === 'crease' ? linear : THREE.MathUtils.lerp(linear, THREE.MathUtils.smoothstep(linear, 0, 1), 0.6);
    const halfWidth = (width / 2) * THREE.MathUtils.lerp(a[1], b[1], blend);
    let shoulder = THREE.MathUtils.lerp(a[2], b[2], blend);
    const bulge = design.features?.includes('hoodBulge') ? 0.055 * Math.exp(-(((u - 0.23) / 0.14) ** 4)) : 0;
    const crown = THREE.MathUtils.lerp(a[3], b[3], blend) + bulge;
    let bottom = FLOOR;
    for (const axle of [front, rear]) {
      const distance = Math.abs(z - axle);
      const fender = wheelRadius + archRadius + 0.14;
      shoulder = Math.max(shoulder, THREE.MathUtils.lerp(fender, shoulder, THREE.MathUtils.smoothstep(distance, archRadius * 0.75, archRadius * 1.5)));
      if (distance < archRadius) bottom = Math.max(bottom, Math.min(wheelRadius + Math.sqrt(archRadius ** 2 - distance ** 2), shoulder - 0.13));
    }
    return { halfWidth, bottom, shoulder, crown };
  };

  const bodyRings: THREE.Vector3[][] = [];
  for (let i = 0; i < bodyStations; i++) {
    const t = i / (bodyStations - 1);
    const z = (-0.5 + (1 - Math.cos(t * Math.PI)) / 2) * length;
    const { halfWidth: w, bottom, shoulder, crown } = section(z);
    const up = (f: number) => THREE.MathUtils.lerp(bottom, shoulder, f);
    const hood = (f: number) => THREE.MathUtils.lerp(shoulder, crown, f);
    // Different section shapes produce planar wedges, curved GTs, pinched muscle bodies and race-car light pods.
    const side: [number, number][] =
      design.section === 'crease'
        ? [
            [0.7, FLOOR],
            [0.91, bottom],
            [1, bottom + 0.035],
            [1, up(0.58)],
            [0.995, shoulder - 0.018],
            [0.8, hood(0.12)],
            [0.5, hood(0.85)],
          ]
        : design.section === 'round'
          ? [
              [0.68, FLOOR],
              [0.86, bottom],
              [0.97, up(0.28)],
              [1, up(0.65)],
              [0.98, shoulder - 0.02],
              [0.9, shoulder],
              [0.73, hood(0.3)],
              [0.45, hood(0.86)],
            ]
          : design.section === 'muscle'
            ? [
                [0.68, FLOOR],
                [0.84, bottom],
                [0.93, up(0.2)],
                [1, up(0.8)],
                [1.015, shoulder],
                [0.88, hood(0.25)],
                [0.67, hood(0.8)],
                [0.38, crown],
              ]
            : [
                [0.78, FLOOR],
                [1, bottom],
                [1.015, bottom + 0.04],
                [0.96, up(0.7)],
                [1.01, shoulder],
                [0.91, shoulder + 0.015],
                [0.75, hood(0.15)],
                [0.58, hood(0.88)],
                [0.28, crown],
              ];
    const ring = [new THREE.Vector3(0, FLOOR, z)];
    for (const [x, y] of side) ring.push(new THREE.Vector3(x * w, y, z));
    ring.push(new THREE.Vector3(0, crown + 0.012, z));
    for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x * w, y, z));
    bodyRings.push(ring);
  }
  const body = loft(bodyRings);

  // Glasshouse: windscreen, side windows and rear glass, with painted roof and pillars (group 1).
  const [rearBase, roofRear, roofFront, screenBase] = design.cabin;
  const cabinLine: Point[] = [rearBase, roofRear, roofFront, screenBase];
  const pillarU = design.pillar ?? Number.NaN;
  const glassRings: THREE.Vector3[][] = [];
  const stationU: number[] = [];
  for (let i = 0; i < glassStations; i++) {
    const u = THREE.MathUtils.lerp(rearBase[0], screenBase[0], i / (glassStations - 1));
    const z = u * length;
    const { halfWidth: w, crown } = section(z);
    const base = crown + 0.012;
    const dome = (design.roofDome ?? 0) * Math.sin(((u - rearBase[0]) / (screenBase[0] - rearBase[0])) * Math.PI);
    const roof = Math.max(base + 0.025, lineAt(cabinLine, u) + dome);
    const roofWidth = design.roofWidth;
    const side: [number, number][] = [
      [0.84, base],
      [THREE.MathUtils.lerp(0.84, roofWidth, 0.36), THREE.MathUtils.lerp(base, roof, 0.45)],
      [roofWidth, roof - 0.045],
      [roofWidth * 0.65, roof + (design.features?.includes('doubleBubble') ? 0.032 : -0.006)],
    ];
    const ring = [new THREE.Vector3(0, base - 0.06, z)];
    for (const [x, y] of side) ring.push(new THREE.Vector3(x * w, y, z));
    ring.push(new THREE.Vector3(0, roof + 0.012, z));
    for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x * w, y, z));
    glassRings.push(ring);
    stationU.push(u);
  }
  const ringSize = glassRings[0].length;
  const glass = loft(
    glassRings,
    (station, segment) => {
      const u = stationU[station];
      const outer = segment === 1 || segment === ringSize - 2;
      if (segment === 0 || segment === ringSize - 1) return 1;
      if (u > roofFront[0]) return outer ? 1 : 0;
      if (u < roofRear[0]) return outer ? 1 : 0;
      if (segment === 4 || segment === 5) return 1;
      return Math.abs(u - pillarU) < 0.008 ? 1 : 0;
    },
    1,
  );

  return { body, glass, section: (z) => section(z) };
}

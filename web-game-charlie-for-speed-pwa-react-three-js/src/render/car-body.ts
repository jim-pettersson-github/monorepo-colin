import * as THREE from 'three';
import type { CarDesign } from './car-designs';

export const WHEEL_RADIUS = 0.34;
export const ARCH_RADIUS = 0.38;

export function axles(design: CarDesign, length: number) {
  const shift = (design.axleShift ?? 0) * length;
  return { front: design.axle * length + shift, rear: -design.axle * length + shift };
}

export type BodyShape = {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  section: (z: number) => { halfWidth: number; bottom: number; shoulder: number; crown: number };
  surface: (z: number, across: number) => number;
  flank: (z: number, height: number) => number;
  cabin: (z: number) => { base: number; roof: number; baseWidth: number; roofWidth: number };
  bumperZ: (x: number, y: number, facing?: number) => number;
  bodyZ: (x: number, y: number, z: number) => number;
};

// Monotone cubic sections make continuous highlights without overshooting a drawn bonnet or wing.
function bodyProfile(stations: readonly (readonly number[])[]) {
  const gradients = stations.map((station, i) =>
    Array.from({ length: station.length - 1 }, (_, index) => index + 1).map((column) => {
      const before = stations[Math.max(0, i - 1)],
        after = stations[Math.min(stations.length - 1, i + 1)];
      const left = i ? (station[column] - before[column]) / (station[0] - before[0]) : (after[column] - station[column]) / (after[0] - station[0]);
      const right = i < stations.length - 1 ? (after[column] - station[column]) / (after[0] - station[0]) : left;
      return left * right > 0 ? (2 * left * right) / (left + right) : 0;
    }),
  );
  return (u: number, column: number) => {
    let index = stations.findIndex((station) => station[0] >= u);
    index = Math.max(1, index < 0 ? stations.length - 1 : index);
    const a = stations[index - 1],
      b = stations[index],
      interval = b[0] - a[0];
    const t = THREE.MathUtils.clamp((u - a[0]) / interval, 0, 1),
      t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * a[column] +
      (t3 - 2 * t2 + t) * interval * gradients[index - 1][column - 1] +
      (-2 * t3 + 3 * t2) * b[column] +
      (t3 - t2) * interval * gradients[index][column - 1]
    );
  };
}

// Rings run from the underbody around the right side, over the roof and back down the left.
function loft(
  rings: THREE.Vector3[][],
  groups?: (station: number, segment: number) => number,
  capMaterial = 0,
  caps = true,
  capSurface?: (x: number, y: number, facing: number) => number,
  lowDetail = false,
) {
  const ringSize = rings[0].length,
    positions: number[] = [],
    indices: number[][] = [[], [], []];
  for (const ring of rings) for (const point of ring) positions.push(point.x, point.y, point.z);
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < ringSize; j++) {
      const a = i * ringSize + j,
        b = (i + 1) * ringSize + j,
        c = (i + 1) * ringSize + ((j + 1) % ringSize),
        d = i * ringSize + ((j + 1) % ringSize);
      const material = groups?.(i, j) ?? 0;
      if (material >= 0) indices[material].push(a, d, b, b, d, c);
    }
  if (caps)
    for (const end of [0, rings.length - 1]) {
      const ring = rings[end],
        direction = end === 0 ? -1 : 1;
      if (capSurface) {
        // Triangulate the actual concave outline: prototype bonnets sit below their front wings.
        const contour = ring.map((point) => new THREE.Vector2(point.x, point.y));
        const vertices = new Map<string, number>();
        const key = (x: number, y: number) => `${x.toFixed(6)},${y.toFixed(6)}`;
        ring.forEach((point, i) => {
          vertices.set(key(point.x, point.y), end * ringSize + i);
        });
        const vertex = (point: THREE.Vector2) => {
          const id = key(point.x, point.y);
          let index = vertices.get(id);
          if (index === undefined) {
            index = positions.length / 3;
            positions.push(point.x, point.y, capSurface(point.x, point.y, direction));
            vertices.set(id, index);
          }
          return index;
        };
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
          const forward = direction > 0,
            sameWinding = positive === forward;
          indices[capMaterial].push(vertex(a), vertex(sameWinding ? b : c), vertex(sameWinding ? c : b));
        };
        for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) triangle(contour[a], contour[b], contour[c], lowDetail ? 1 : 2);
        continue;
      }
      const first = positions.length / 3;
      for (const point of ring) positions.push(point.x, point.y, point.z);
      const contour = ring.map((point) => new THREE.Vector2(point.x, point.y));
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
        const normal = (ring[b].x - ring[a].x) * (ring[c].y - ring[a].y) - (ring[b].y - ring[a].y) * (ring[c].x - ring[a].x);
        const forward = normal > 0 === (end === rings.length - 1);
        indices[capMaterial].push(first + a, first + (forward ? b : c), first + (forward ? c : b));
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices.flat());
  let start = 0;
  indices.forEach((group, material) => {
    if (group.length) geometry.addGroup(start, group.length, material);
    start += group.length;
  });
  geometry.computeVertexNormals();
  return geometry;
}

export function buildBodyShape(design: CarDesign, length: number, width: number, lowDetail = false): BodyShape {
  const floor = design.rideHeight ?? 0.15,
    { front, rear } = axles(design, length);
  const wheelRadius = WHEEL_RADIUS * (design.wheelScale ?? 1),
    archRadius = ARCH_RADIUS * (design.wheelScale ?? 1);
  const profile = bodyProfile(design.body);
  const section = (z: number) => {
    const u = THREE.MathUtils.clamp(z / length, -0.5, 0.5),
      halfWidth = (width / 2) * profile(u, 1);
    let shoulder = profile(u, 2),
      bottom = floor;
    const crown = profile(u, 3) + (design.features?.includes('hoodBulge') ? 0.018 * Math.exp(-(((u - 0.23) / 0.15) ** 4)) : 0);
    for (const axle of [front, rear]) {
      const distance = Math.abs(z - axle),
        fender = wheelRadius + archRadius + 0.028;
      shoulder = Math.max(shoulder, THREE.MathUtils.lerp(fender, shoulder, THREE.MathUtils.smoothstep(distance, archRadius * 0.7, archRadius * 1.5)));
      if (distance < archRadius) bottom = Math.max(bottom, Math.min(wheelRadius + Math.sqrt(archRadius ** 2 - distance ** 2), shoulder - 0.026));
    }
    return { halfWidth, bottom, shoulder, crown };
  };
  const surface = (z: number, across: number) => {
    const { shoulder, crown } = section(z);
    const x = THREE.MathUtils.clamp(Math.abs(across), 0, 1);
    const blend = design.section === 'crease' ? Math.max(0, (x - 0.12) / 0.88) : 1 - Math.sqrt(1 - x * x);
    return THREE.MathUtils.lerp(crown, shoulder, blend);
  };
  // Rounded plan corners and rolled upper/lower bumper edges share a surface with the front fittings.
  const bumperZ = (x: number, y: number, facing = 1) => {
    const end = section((facing * length) / 2),
      centreY = (Math.max(end.crown, end.shoulder) + floor) / 2,
      halfHeight = centreY - floor,
      radius = design.bumperRound ?? (design.section === 'crease' ? 0.075 : 0.19);
    const across = THREE.MathUtils.clamp(Math.abs(x) / end.halfWidth, 0, 1),
      vertical = THREE.MathUtils.clamp(Math.abs((y - centreY) / halfHeight), 0, 1);
    return facing * (length / 2 - radius * (facing < 0 ? 0.75 : 1) * (across ** 4 + 0.45 * vertical ** 4));
  };
  const bodyZ = (x: number, y: number, z: number) =>
    z + (bumperZ(x, y, Math.sign(z)) - (Math.sign(z) * length) / 2) * THREE.MathUtils.smoothstep(Math.abs(z / length), 0.385, 0.5);

  const stations = new Set<number>(design.body.map((station) => station[0] * length));
  const count = lowDetail ? 14 : 46;
  for (let i = 0; i < count; i++) stations.add((-0.5 + i / (count - 1)) * length);
  // Extra samples follow the actual circular wheel openings rather than a coarse jagged cut.
  const archSteps = lowDetail ? 4 : 16;
  for (const axle of [front, rear]) for (let i = 0; i <= archSteps; i++) stations.add(axle + archRadius * Math.cos((i / archSteps) * Math.PI));
  const sectionPoints = (z: number): [number, number][] => {
    const { bottom, shoulder } = section(z);
    const up = (t: number) => THREE.MathUtils.lerp(bottom, shoulder, t);
    const side: [number, number][] =
      design.section === 'crease'
        ? [
            [0.74, floor],
            [0.94, bottom],
            [0.995, bottom + 0.02],
            [1, up(0.54)],
            [1, shoulder - 0.025],
          ]
        : [
            [0.72, floor],
            [0.86, bottom],
            [0.95, up(0.18)],
            [0.99, up(0.38)],
            [1, up(0.62)],
            [0.992, up(0.84)],
            [0.97, shoulder],
          ];
    if (lowDetail) {
      side.splice(0, side.length, [0.74, floor], [0.92, bottom], [1, up(0.65)], [0.98, shoulder]);
    }
    for (const across of lowDetail ? [0.66, 0.3] : [0.93, 0.82, 0.66, 0.46, 0.23]) side.push([across, surface(z, across)]);
    return side;
  };
  const flank = (z: number, height: number) => {
    const points = sectionPoints(z),
      w = section(z).halfWidth;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1],
        [x1, y1] = points[i];
      if (height >= y0 && height <= y1 && y1 > y0) return w * THREE.MathUtils.lerp(x0, x1, (height - y0) / (y1 - y0));
    }
    return w * 0.98;
  };
  const bodyRings = [...stations]
    .filter((z) => Math.abs(z) <= length / 2)
    .sort((a, b) => a - b)
    .map((z) => {
      const { halfWidth: w, crown } = section(z),
        side = sectionPoints(z);
      const ring = [new THREE.Vector3(0, floor, z)];
      for (const [x, y] of side) ring.push(new THREE.Vector3(x * w, y, z));
      ring.push(new THREE.Vector3(0, crown, z));
      for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x * w, y, z));
      for (const point of ring) point.z = bodyZ(point.x, point.y, point.z);
      return ring;
    });
  const body = loft(
    bodyRings,
    design.openTop
      ? (station, segment) => {
          const a = bodyRings[station][segment],
            b = bodyRings[station][(segment + 1) % bodyRings[station].length],
            u = a.z / length;
          const inside = u > design.cabin[1][0] && u < design.cabin[2][0];
          return inside && a.y > 0.55 && b.y > 0.55 && Math.max(Math.abs(a.x), Math.abs(b.x)) < section(a.z).halfWidth * 0.8 ? -1 : 0;
        }
      : undefined,
    0,
    true,
    bumperZ,
    lowDetail,
  );

  const [rearBase, roofRear, roofFront, screenBase] = design.cabin;
  const cabinProfile = bodyProfile(design.cabin);
  const cabin = (z: number) => {
    const u = z / length,
      { halfWidth: w, crown, shoulder } = section(z),
      base = Math.max(crown, shoulder - 0.045) + 0.008;
    const dome = (design.roofDome ?? 0) * Math.sin(THREE.MathUtils.clamp((u - rearBase[0]) / (screenBase[0] - rearBase[0]), 0, 1) * Math.PI);
    const roof = Math.max(base + 0.008, cabinProfile(u, 1) + dome);
    const spread =
      u < roofRear[0]
        ? THREE.MathUtils.smoothstep(roofRear[0] - u, 0, roofRear[0] - rearBase[0])
        : THREE.MathUtils.smoothstep(u - roofFront[0], 0, screenBase[0] - roofFront[0]);
    return { base, roof, baseWidth: w * 0.87, roofWidth: w * THREE.MathUtils.lerp(design.roofWidth, 0.87, spread) };
  };
  const glassU = new Set<number>();
  for (let i = 0; i < (lowDetail ? 8 : 30); i++)
    glassU.add(THREE.MathUtils.lerp(design.openTop ? roofFront[0] : rearBase[0], screenBase[0], i / ((lowDetail ? 8 : 30) - 1)));
  for (const u of [roofRear[0], roofFront[0], design.pillar ?? -1])
    for (const offset of lowDetail ? [0] : [-0.004, 0, 0.004]) {
      const station = u + offset;
      if (station >= (design.openTop ? roofFront[0] : rearBase[0]) && station <= screenBase[0]) glassU.add(station);
    }
  const stationU = [...glassU].sort((a, b) => a - b);
  const glassRings = stationU.map((u) => {
    const z = u * length,
      { base, roof, baseWidth, roofWidth } = cabin(z);
    const side: [number, number][] = [
      [baseWidth, base],
      [THREE.MathUtils.lerp(baseWidth, roofWidth, 0.32), THREE.MathUtils.lerp(base, roof, 0.45)],
      [roofWidth + 0.012, Math.max(base, roof - 0.085)],
      [roofWidth, Math.max(base, roof - 0.045)],
      [roofWidth * 0.72, roof - 0.012],
      [roofWidth * 0.38, roof - 0.002],
    ];
    const ring = [new THREE.Vector3(0, base - 0.03, z)];
    for (const [x, y] of side) ring.push(new THREE.Vector3(x, y, z));
    ring.push(new THREE.Vector3(0, roof, z));
    for (const [x, y] of [...side].reverse()) ring.push(new THREE.Vector3(-x, y, z));
    return ring;
  });
  const ringSize = glassRings[0].length;
  const glass = loft(
    glassRings,
    (station, segment) => {
      const u = (stationU[station] + stationU[station + 1]) / 2;
      if (segment === 0 || segment === ringSize - 1) return 2;
      const frontFrame = Math.abs(u - roofFront[0]) < 0.0045;
      if (frontFrame && segment >= 4 && segment <= ringSize - 5) return 2;
      if (!design.openTop && Math.abs(u - roofRear[0]) < 0.0045) return 2;
      // A narrow strip follows the sloping A-pillar; side glass continues underneath it.
      if (u >= roofFront[0]) return segment === 3 || segment === ringSize - 4 ? 2 : 0;
      if (u <= roofRear[0]) return segment <= 3 || segment >= ringSize - 4 ? (design.softTop ? 1 : 2) : 0;
      if (segment >= 4 && segment <= ringSize - 5) return 1;
      return Math.abs(u - (design.pillar ?? -1)) < 0.0045 ? 2 : 0;
    },
    2,
    !design.openTop,
  );
  return { body, glass, section, surface, cabin, flank, bumperZ, bodyZ };
}

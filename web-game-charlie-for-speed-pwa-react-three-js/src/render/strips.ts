import * as THREE from 'three';
import type { TrackPath, TrackSample } from '../game/track-path';

function geometryOf(positions: number[], uvs: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

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
  return geometryOf(positions, uvs);
}

// An upright strip at a fixed lateral offset: barriers, fences and walls. The texture repeats every uLength metres.
export function upright(
  path: TrackPath,
  lateral: number,
  bottom: number,
  top: number,
  options: { uLength?: number; keep?: (sample: TrackSample) => boolean } = {},
) {
  const { uLength = 4, keep } = options;
  const positions: number[] = [];
  const uvs: number[] = [];
  const { samples, length } = path;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i];
    const b = samples[(i + 1) % samples.length];
    if (keep && !keep(a) && !keep(b)) continue;
    const uA = a.s / uLength;
    const uB = (i + 1 === samples.length ? length : b.s) / uLength;
    const ax = a.x + a.rx * lateral;
    const az = a.z + a.rz * lateral;
    const bx = b.x + b.rx * lateral;
    const bz = b.z + b.rz * lateral;
    positions.push(ax, a.y + bottom, az, bx, b.y + bottom, bz, ax, a.y + top, az, ax, a.y + top, az, bx, b.y + bottom, bz, bx, b.y + top, bz);
    uvs.push(uA, 0, uB, 0, uA, 1, uA, 1, uB, 0, uB, 1);
  }
  return geometryOf(positions, uvs);
}

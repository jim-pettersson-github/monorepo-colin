import * as THREE from 'three';
import type { TrackSample } from '../game/track-path';
import type { Track } from '../game/tracks';
import { ribbon, upright } from './strips';
import { fenceTexture, gravelTexture, isRetro } from './textures';
import type { ThemeLook } from './track-world';

type Disposable = { dispose: () => void };

// Safety furniture along the lap: gravel traps, guardrail posts, tyre walls and catch fences.
export function buildTrackside(scene: THREE.Scene, track: Track, look: ThemeLook): Disposable[] {
  const disposables: Disposable[] = [];
  const keep = <T extends Disposable>(item: T) => {
    disposables.push(item);
    return item;
  };
  const { path, halfWidth, wall, setting, tunnel } = track;
  const modern = !isRetro();
  const open = (sample: TrackSample) => sample.s < tunnel.start - 2 || sample.s > tunnel.end + 2;
  // Curvature is positive in right-hand bends, so the outside of a bend is the side opposite its sign.
  const outside = (side: number, limit: number) => (sample: TrackSample) => -side * sample.curve > limit && open(sample);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const unit = new THREE.Vector3(1, 1, 1);

  // One instanced mesh per prop; `spots` yields position and heading along the track.
  const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, spots: { sample: TrackSample; lateral: number; y: number }[]) => {
    if (!spots.length) return;
    const mesh = new THREE.InstancedMesh(keep(geometry), material, spots.length);
    spots.forEach(({ sample, lateral, y }, index) => {
      quaternion.setFromAxisAngle(up, Math.atan2(sample.tx, sample.tz));
      matrix.compose(new THREE.Vector3(sample.x + sample.rx * lateral, sample.y + y, sample.z + sample.rz * lateral), quaternion, unit);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
    disposables.push({ dispose: () => mesh.dispose() });
  };
  // Path samples are 2 m apart; props spaced closer than that need positions between them.
  const between = (s: number): TrackSample => {
    const count = path.samples.length;
    const index = Math.floor((((s % path.length) + path.length) % path.length) / path.spacing) % count;
    const a = path.samples[index];
    const b = path.samples[(index + 1) % count];
    const t = THREE.MathUtils.clamp((s - a.s) / path.spacing, 0, 1);
    const mix = (from: number, to: number) => from + (to - from) * t;
    return {
      ...a,
      s,
      x: mix(a.x, b.x),
      y: mix(a.y, b.y),
      z: mix(a.z, b.z),
      tx: mix(a.tx, b.tx),
      tz: mix(a.tz, b.tz),
      rx: mix(a.rx, b.rx),
      rz: mix(a.rz, b.rz),
    };
  };
  const every = (step: number, offset: number, where: (sample: TrackSample) => boolean) => {
    const found: TrackSample[] = [];
    for (let s = offset; s < path.length; s += step) {
      const sample = between(s);
      if (where(sample)) found.push(sample);
    }
    return found;
  };

  if (setting === 'circuit') {
    const gravel = keep(new THREE.MeshLambertMaterial({ map: keep(gravelTexture()) }));
    for (const side of [-1, 1]) {
      const strip = ribbon(path, side * (halfWidth + 1.4), side * (wall - 0.3), { lift: 0.01, uMeters: 6, vLength: 6, keep: outside(side, 1 / 160) });
      scene.add(new THREE.Mesh(keep(strip), gravel));
    }
  }

  if (look.barrier === 'armco' && modern) {
    // Guardrail posts behind the see-through rails, lined up with the rail joints.
    const steel = keep(new THREE.MeshLambertMaterial({ color: '#7c858c' }));
    const posts = every(4, 2.1, open).flatMap((sample) => [-1, 1].map((side) => ({ sample, lateral: side * (wall + 0.12), y: 0.27 })));
    instanced(new THREE.BoxGeometry(0.1, 1.15, 0.16), steel, posts);

    // Tyre stacks behind the rails on the outside of the tight bends.
    // Five tyres high, so the top rows show above the guardrail.
    const tyre = new THREE.CylinderGeometry(0.42, 0.42, 1.4, 12, 10);
    const shade = new THREE.Color();
    const position = tyre.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const band = Math.round((position.getY(i) + 0.7) / 0.14);
      const rim = Math.hypot(position.getX(i), position.getZ(i)) < 0.2;
      shade.set(rim ? '#050505' : band % 2 ? '#2b2b2d' : '#121213');
      colors.set([shade.r, shade.g, shade.b], i * 3);
    }
    tyre.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const rubber = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const stacks = [-1, 1].flatMap((side) => every(0.9, 0, outside(side, 1 / 85)).map((sample) => ({ sample, lateral: side * (wall + 0.62), y: 0.62 })));
    instanced(tyre, rubber, stacks);
  }

  // Catch fences: behind the barrier on circuits, on top of the concrete walls in town.
  if (setting !== 'country') {
    const city = setting === 'city';
    const lateral = city ? wall + 0.06 : wall + 1.1;
    const bottom = city ? 1.1 : -0.2;
    const top = 3.8;
    const mesh = keep(fenceTexture());
    const fence = keep(new THREE.MeshLambertMaterial({ map: mesh, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    for (const side of [-1, 1]) scene.add(new THREE.Mesh(keep(upright(path, side * lateral, bottom, top, { uLength: top - bottom, keep: open })), fence));
    const post = keep(new THREE.MeshLambertMaterial({ color: '#4c535b' }));
    const height = top - bottom;
    const poles = every(6, 0, open).flatMap((sample) => [-1, 1].map((side) => ({ sample, lateral: side * (lateral + 0.05), y: bottom + height / 2 })));
    instanced(new THREE.CylinderGeometry(0.05, 0.06, height, 6), post, poles);
  }

  return disposables;
}

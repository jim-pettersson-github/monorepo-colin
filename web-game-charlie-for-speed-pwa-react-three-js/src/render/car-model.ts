import * as THREE from 'three';
import type { BodyStyle, CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { shadowTexture } from './textures';

type Point = readonly [u: number, v: number];

// Side silhouettes: u runs from the rear (-0.5) to the nose (0.5) of the car, v is height in metres.
const profiles: Record<BodyStyle, { body: Point[]; cabin: Point[]; axle: number; nose: number; tail: number }> = {
  rear: {
    body: [
      [-0.5, 0.26],
      [-0.5, 0.6],
      [-0.44, 0.76],
      [-0.25, 0.84],
      [0.18, 0.8],
      [0.42, 0.7],
      [0.5, 0.52],
      [0.5, 0.26],
    ],
    cabin: [
      [-0.4, 0.74],
      [-0.14, 1.28],
      [0.04, 1.3],
      [0.24, 0.8],
    ],
    axle: 0.33,
    nose: 0.62,
    tail: 0.66,
  },
  mid: {
    body: [
      [-0.5, 0.28],
      [-0.5, 0.74],
      [-0.3, 0.84],
      [0.08, 0.82],
      [0.44, 0.62],
      [0.5, 0.46],
      [0.5, 0.28],
    ],
    cabin: [
      [-0.32, 0.8],
      [-0.14, 1.16],
      [0.04, 1.17],
      [0.28, 0.78],
    ],
    axle: 0.34,
    nose: 0.56,
    tail: 0.68,
  },
  wedge: {
    body: [
      [-0.5, 0.28],
      [-0.5, 0.86],
      [-0.28, 0.9],
      [0.06, 0.84],
      [0.46, 0.5],
      [0.5, 0.4],
      [0.5, 0.28],
    ],
    cabin: [
      [-0.26, 0.86],
      [-0.1, 1.12],
      [0.03, 1.12],
      [0.34, 0.66],
    ],
    axle: 0.34,
    nose: 0.46,
    tail: 0.78,
  },
  front: {
    body: [
      [-0.5, 0.3],
      [-0.5, 0.76],
      [-0.36, 0.84],
      [-0.04, 0.82],
      [0.44, 0.72],
      [0.5, 0.56],
      [0.5, 0.3],
    ],
    cabin: [
      [-0.38, 0.8],
      [-0.24, 1.2],
      [-0.04, 1.22],
      [0.14, 0.8],
    ],
    axle: 0.33,
    nose: 0.62,
    tail: 0.7,
  },
  gt1: {
    body: [
      [-0.5, 0.24],
      [-0.5, 0.8],
      [-0.22, 0.86],
      [0.14, 0.8],
      [0.44, 0.52],
      [0.5, 0.36],
      [0.5, 0.24],
    ],
    cabin: [
      [-0.2, 0.82],
      [-0.06, 1.1],
      [0.08, 1.1],
      [0.3, 0.76],
    ],
    axle: 0.35,
    nose: 0.44,
    tail: 0.72,
  },
};

const WHEEL_RADIUS = 0.34;
let sharedShadow: THREE.Texture | undefined;

function extrude(points: Point[], length: number, depth: number, bevel: number) {
  const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u * length, v)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.75,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

// Pulls the sides inward with height so bodies get a tumblehome instead of slab sides.
function taper(geometry: THREE.BufferGeometry, from: number, to: number, amount: number) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const squeeze = 1 - amount * THREE.MathUtils.smoothstep(position.getY(i), from, to);
    position.setX(i, position.getX(i) * squeeze);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function box(width: number, height: number, depth: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export type CarModel = {
  group: THREE.Group;
  update: (state: CarState, headingDot: number) => void;
  dispose: () => void;
};

export function buildCarModel(spec: CarSpec, headlightsOn = false): CarModel {
  const profile = profiles[spec.style];
  const { length, width } = spec;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshPhongMaterial({ color: spec.color, shininess: 70, specular: 0x777777, flatShading: true });
  const trim = new THREE.MeshPhongMaterial({ color: spec.trim, shininess: 30, flatShading: true });
  const glass = new THREE.MeshPhongMaterial({ color: 0x18202c, shininess: 110, specular: 0xb0c0d0, flatShading: true });
  const black = new THREE.MeshLambertMaterial({ color: 0x111215 });
  const tail = new THREE.MeshLambertMaterial({ color: 0x5a0606, emissive: 0xff1a10, emissiveIntensity: 0.35 });
  const head = new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xfff2c0, emissiveIntensity: headlightsOn ? 1 : 0.25 });
  const materials: THREE.Material[] = [paint, trim, glass, black, tail, head];

  body.add(new THREE.Mesh(taper(extrude(profile.body, length, width - 0.16, 0.08), 0.45, 0.9, 0.16), paint));
  const cabinWidth = width * 0.72;
  body.add(new THREE.Mesh(taper(extrude(profile.cabin, length, cabinWidth, 0.05), 0.75, 1.3, 0.24), glass));

  const [, roofStart, roofEnd] = profile.cabin;
  const roofLength = (roofEnd[0] - roofStart[0]) * length + 0.25;
  const roof = box(
    cabinWidth * 0.8,
    0.06,
    roofLength,
    spec.id === 'nxr' ? black : paint,
    0,
    (roofStart[1] + roofEnd[1]) / 2 + 0.04,
    ((roofStart[0] + roofEnd[0]) / 2) * length,
  );
  body.add(roof);

  if (spec.stripe) {
    const stripe = new THREE.MeshPhongMaterial({ color: spec.stripe, shininess: 70, flatShading: true });
    materials.push(stripe);
    for (const side of [-0.24, 0.24]) {
      const geometry = extrude(profile.body, length, 0.22, 0.095);
      geometry.translate(side, 0, 0);
      taper(geometry, 0.45, 0.9, 0.16);
      body.add(new THREE.Mesh(geometry, stripe));
    }
  }

  const nose = length / 2;
  const sill = box(width - 0.06, 0.12, length * 0.62, black, 0, 0.3, 0);
  body.add(sill);
  body.add(box(width * 0.5, 0.12, 0.06, black, 0, 0.36, nose + 0.06));
  body.add(box(width - 0.3, 0.2, 0.06, black, 0, 0.4, -nose - 0.06));
  for (const side of [-0.3, 0.3]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), trim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side, 0.32, -nose - 0.08);
    body.add(pipe);
  }

  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.34);
    if (spec.popups) body.add(box(0.42, 0.05, 0.3, trim, x, profile.nose + 0.04, nose - 0.32));
    if (spec.style === 'rear') {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), head);
      lamp.rotation.x = Math.PI / 2 - 0.5;
      lamp.position.set(x, profile.nose + 0.02, nose - 0.18);
      body.add(lamp);
    } else body.add(box(0.4, 0.08, 0.06, head, x, profile.nose - 0.1, nose + 0.04));
    body.add(box(0.5, 0.1, 0.06, tail, side * (width / 2 - 0.4), profile.tail - 0.06, -nose - 0.05));
    if (spec.style === 'mid' || spec.style === 'gt1' || spec.style === 'wedge')
      body.add(box(0.06, 0.18, 0.6, black, side * (width / 2 - 0.04), 0.52, -length * 0.12));
  }

  if (spec.wing) {
    const height = profile.tail + 0.3;
    const wingLength = spec.style === 'gt1' ? 0.42 : 0.32;
    body.add(box(width - 0.2, 0.05, wingLength, spec.style === 'gt1' ? black : paint, 0, height, -nose + 0.25));
    for (const side of [-1, 1]) body.add(box(0.05, 0.3, 0.16, black, side * (width / 2 - 0.4), height - 0.15, -nose + 0.25));
  }

  const tire = new THREE.MeshLambertMaterial({ color: 0x18181a, flatShading: true });
  const rim = new THREE.MeshPhongMaterial({ color: 0xc8ccd0, shininess: 80, flatShading: true });
  materials.push(tire, rim);
  const tireGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 12);
  tireGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, 0.27, 5);
  rimGeometry.rotateZ(Math.PI / 2);

  const spinners: THREE.Group[] = [];
  const steerers: THREE.Group[] = [];
  const axle = profile.axle * length;
  for (const z of [axle, -axle]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (width / 2 - 0.16), WHEEL_RADIUS, z);
      const spinner = new THREE.Group();
      spinner.add(new THREE.Mesh(tireGeometry, tire), new THREE.Mesh(rimGeometry, rim));
      pivot.add(spinner);
      group.add(pivot);
      spinners.push(spinner);
      if (z > 0) steerers.push(pivot);
    }
  }

  sharedShadow ??= shadowTexture();
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: sharedShadow, transparent: true, depthWrite: false });
  materials.push(shadowMaterial);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.9, length + 1.1), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  shadow.renderOrder = 1;
  group.add(shadow);
  group.rotation.order = 'YXZ';

  return {
    group,
    update(state, headingDot) {
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.yaw;
      group.rotation.x = -Math.atan(state.pitch) * headingDot;
      const speed = Math.hypot(state.vx, state.vz);
      body.rotation.z = -state.steer * Math.min(1, speed / 45) * 0.035 - Math.min(0.05, state.slip * 0.004) * Math.sign(state.steer);
      body.position.y = state.surface === 'grass' ? Math.sin(state.wheelSpin * 2.3) * 0.025 : 0;
      for (const spinner of spinners) spinner.rotation.x = state.wheelSpin;
      for (const pivot of steerers) pivot.rotation.y = -state.steer * 0.45;
      tail.emissiveIntensity = state.braking ? 1.4 : 0.35;
    },
    dispose() {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      for (const material of materials) material.dispose();
    },
  };
}

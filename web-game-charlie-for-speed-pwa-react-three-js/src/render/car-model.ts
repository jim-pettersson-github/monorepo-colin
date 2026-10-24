import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarSpec } from '../game/cars';
import type { CarState } from '../game/physics';
import { type CarDesign, designs, type Point } from './car-designs';
import { shadowTexture } from './textures';

const WHEEL_RADIUS = 0.34;
const ARCH_RADIUS = 0.43;
const SILL = 0.24;
let sharedShadow: THREE.Texture | undefined;
let sharedEnvironment: THREE.CubeTexture | undefined;

// A tiny sky-and-road cube map: flat-shaded paint picks up a bright horizon band like late-90s chrome.
function environment() {
  if (sharedEnvironment) return sharedEnvironment;
  const face = (kind: 'side' | 'up' | 'down') => {
    const element = document.createElement('canvas');
    element.width = element.height = 64;
    const context = element.getContext('2d');
    if (context) {
      if (kind === 'side') {
        const gradient = context.createLinearGradient(0, 0, 0, 64);
        gradient.addColorStop(0, '#5f8fe0');
        gradient.addColorStop(0.45, '#cfe2ff');
        gradient.addColorStop(0.52, '#ffffff');
        gradient.addColorStop(0.56, '#6d7177');
        gradient.addColorStop(1, '#2b2d31');
        context.fillStyle = gradient;
      } else context.fillStyle = kind === 'up' ? '#7aa8f0' : '#26282b';
      context.fillRect(0, 0, 64, 64);
    }
    return element;
  };
  sharedEnvironment = new THREE.CubeTexture([face('side'), face('side'), face('up'), face('down'), face('side'), face('side')]);
  sharedEnvironment.colorSpace = THREE.SRGBColorSpace;
  sharedEnvironment.needsUpdate = true;
  return sharedEnvironment;
}

// Height of the upper outline at u, ignoring the bottom corners of the rear and front faces.
function heightAt(top: Point[], u: number) {
  const chain = top.slice(1, -1);
  if (u <= chain[0][0]) return chain[0][1];
  for (let i = 1; i < chain.length; i++) {
    const [u0, v0] = chain[i - 1];
    const [u1, v1] = chain[i];
    if (u <= u1) return u1 === u0 ? Math.max(v0, v1) : v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
  }
  return chain[chain.length - 1][1];
}

function axles(design: CarDesign, length: number) {
  const shift = (design.axleShift ?? 0) * length;
  return { front: design.axle * length + shift, rear: -design.axle * length + shift };
}

// Side silhouette with wheel arches cut out of the lower edge.
function bodyOutline(design: CarDesign, length: number) {
  const points = design.top.map(([u, v]) => new THREE.Vector2(u * length, v));
  const { front, rear } = axles(design, length);
  for (const center of [front, rear]) {
    const room = heightAt(design.top, center / length) - 0.1 - WHEEL_RADIUS;
    const rise = Math.max(0.1, Math.min(ARCH_RADIUS, room));
    points.push(new THREE.Vector2(center + ARCH_RADIUS, SILL), new THREE.Vector2(center + ARCH_RADIUS, WHEEL_RADIUS));
    for (let step = 1; step < 7; step++) {
      const angle = (step / 7) * Math.PI;
      points.push(new THREE.Vector2(center + Math.cos(angle) * ARCH_RADIUS, WHEEL_RADIUS + Math.sin(angle) * rise));
    }
    points.push(new THREE.Vector2(center - ARCH_RADIUS, WHEEL_RADIUS), new THREE.Vector2(center - ARCH_RADIUS, SILL));
  }
  points.push(new THREE.Vector2(-length / 2, SILL));
  return points;
}

function extrude(points: THREE.Vector2[], depth: number, bevel: number) {
  const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
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

const scaled = (points: Point[], length: number) => points.map(([u, v]) => new THREE.Vector2(u * length, v));

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
  const top = Math.max(...design.top.map(([, v]) => v));
  const roofTop = Math.max(...design.cabin.map(([, v]) => v));
  const noseHeight = heightAt(design.top, 0.47);
  const tailHeight = heightAt(design.top, -0.49);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // Plan-view shaping: lean the sides in, narrow the nose and widen the rear hips.
  const widthScale = (y: number, z: number, lean = design.tumble, from = 0.48, to = top) =>
    (1 - lean * THREE.MathUtils.smoothstep(y, from, to)) *
    (1 - design.pinch * THREE.MathUtils.smoothstep(z / length, 0.12, 0.5)) *
    (1 + (design.hips ?? 0) * THREE.MathUtils.smoothstep(-z / length, 0.02, 0.28));
  const shape = (geometry: THREE.BufferGeometry, lean?: number, from?: number, to?: number) => {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) * widthScale(position.getY(i), position.getZ(i), lean, from, to));
    // Smooth across gently curved panels but keep the creases at shut lines and edges.
    const creased = toCreasedNormals(geometry, 0.6);
    geometry.dispose();
    return creased;
  };
  const sideAt = (y: number, z: number) => ((width - 0.12) / 2) * widthScale(y, z);

  const env = environment();
  const paint = new THREE.MeshPhongMaterial({
    color: spec.color,
    shininess: 90,
    specular: 0x777777,
    envMap: env,
    reflectivity: 0.14,
    combine: THREE.MixOperation,
  });
  const trim = new THREE.MeshPhongMaterial({ color: spec.trim, shininess: 40, flatShading: true });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x141b26,
    shininess: 120,
    specular: 0xb0c0d0,
    envMap: env,
    reflectivity: 0.4,
    combine: THREE.MixOperation,
  });
  const black = new THREE.MeshLambertMaterial({ color: 0x111215 });
  const tail = new THREE.MeshLambertMaterial({ color: 0x5a0606, emissive: 0xff1a10, emissiveIntensity: 0.35 });
  const head = new THREE.MeshLambertMaterial({ color: 0xdddddd, emissive: 0xfff2c0, emissiveIntensity: headlightsOn ? 1 : 0.3 });
  const amber = new THREE.MeshLambertMaterial({ color: 0xff9a1a, emissive: 0xff7a00, emissiveIntensity: 0.4 });
  const materials: THREE.Material[] = [paint, trim, glass, black, tail, head, amber];

  const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotateX = 0, rotateZ = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotateX, 0, rotateZ);
    body.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, rotateX = 0, rotateZ = 0) =>
    part(new THREE.BoxGeometry(w, h, d), material, x, y, z, rotateX, rotateZ);
  const disc = (radius: number, material: THREE.Material, x: number, y: number, z: number, tilt = 0) =>
    part(new THREE.CylinderGeometry(radius, radius, 0.06, 10), material, x, y, z, Math.PI / 2 + tilt);

  // Body, glasshouse and a painted roof skin that follows the roofline.
  part(shape(extrude(bodyOutline(design, length), width - 0.12, 0.07)), paint, 0, 0, 0);
  const cabinWidth = width * 0.76;
  const cabinBottom = Math.min(...design.cabin.map(([, v]) => v));
  part(shape(extrude(scaled(design.cabin, length), cabinWidth, 0.04), 0.3, cabinBottom, roofTop), glass, 0, 0, 0);
  const [, roofStart, roofEnd] = design.cabin;
  const roof = extrude(
    scaled(
      [
        [roofStart[0] - 0.03, roofStart[1] - 0.07],
        [roofStart[0], roofStart[1] + 0.02],
        [roofEnd[0], roofEnd[1] + 0.02],
        [roofEnd[0] + 0.05, roofEnd[1] - 0.07],
      ],
      length,
    ),
    cabinWidth * 0.97,
    0,
  );
  part(shape(roof, 0.3, cabinBottom, roofTop), features.has('blackRoof') ? black : paint, 0, 0, 0);

  if (spec.stripe) {
    const stripe = new THREE.MeshPhongMaterial({ color: spec.stripe, shininess: 90, envMap: env, reflectivity: 0.14, combine: THREE.MixOperation });
    materials.push(stripe);
    for (const side of [-0.22, 0.22]) {
      const geometry = extrude(bodyOutline(design, length), 0.2, 0.085);
      geometry.translate(side, 0, 0);
      part(shape(geometry), stripe, 0, 0, 0);
    }
  }

  // Sills, bumpers and exhausts.
  const { front, rear } = axles(design, length);
  const sillLength = front - rear - ARCH_RADIUS * 2;
  box(sideAt(0.3, 0) * 2 + 0.04, 0.12, sillLength, features.has('skirts') ? trim : black, 0, SILL + 0.06, (front + rear) / 2);
  box(width * 0.5, 0.1, 0.06, black, 0, 0.36, nose + 0.05);
  box(sideAt(0.4, -nose) * 2 - 0.1, 0.18, 0.06, black, 0, 0.38, -nose - 0.05);
  for (const side of [-0.32, 0.32]) part(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), trim, side, 0.32, -nose - 0.08, Math.PI / 2);

  // Headlights.
  const lampX = sideAt(noseHeight, nose * 0.85) - 0.3;
  for (const side of [-1, 1]) {
    const x = side * lampX;
    if (design.headlights === 'popup') {
      box(0.44, 0.04, 0.3, paint, x, heightAt(design.top, 0.4) + 0.03, nose - 0.4, 0.12);
      box(0.32, 0.06, 0.04, amber, x, noseHeight - 0.14, nose + 0.03);
    } else if (design.headlights === 'round') disc(0.12, head, x, noseHeight + 0.02, nose - 0.18, -0.5);
    else if (design.headlights === 'quad') {
      disc(0.08, head, x - side * 0.1, noseHeight - 0.08, nose + 0.02, -0.2);
      disc(0.08, head, x + side * 0.1, noseHeight - 0.08, nose + 0.0, -0.2);
    } else if (design.headlights === 'covered') {
      box(0.42, 0.1, 0.26, head, x, noseHeight - 0.02, nose - 0.1, 0.35);
      box(0.46, 0.04, 0.3, glass, x, noseHeight + 0.03, nose - 0.1, 0.35);
    } else box(0.52, 0.05, 0.05, head, x, noseHeight - 0.08, nose + 0.03);
  }

  // Tail lights.
  const tailX = sideAt(tailHeight, -nose) - 0.32;
  const tailY = tailHeight - 0.13;
  if (design.taillights === 'grille') box(sideAt(tailHeight, -nose) * 2 - 0.1, 0.24, 0.05, black, 0, tailY, -nose - 0.04);
  for (const side of [-1, 1]) {
    const x = side * tailX;
    if (design.taillights === 'round' || design.taillights === 'quad') {
      const radius = design.taillights === 'round' ? 0.085 : 0.1;
      disc(radius, tail, x + side * 0.08, tailY, -nose - 0.05);
      disc(radius, tail, x - side * 0.17, tailY, -nose - 0.05);
    } else if (design.taillights === 'slim') box(0.62, 0.05, 0.06, tail, x, tailY + 0.04, -nose - 0.05);
    else if (design.taillights === 'grille') {
      box(0.44, 0.16, 0.06, tail, x, tailY, -nose - 0.07);
      box(0.12, 0.16, 0.06, amber, x - side * 0.3, tailY, -nose - 0.07);
    } else box(0.52, 0.11, 0.06, tail, x, tailY, -nose - 0.05);
  }

  // Model-specific details.
  if (features.has('airboxes')) {
    const z = -length * 0.25;
    for (const side of [-1, 1]) {
      const x = side * (sideAt(top, z) - 0.22);
      box(0.38, 0.16, 0.66, paint, x, heightAt(design.top, z / length) + 0.07, z);
      box(0.3, 0.1, 0.03, black, x, heightAt(design.top, z / length) + 0.08, z + 0.34);
    }
  }
  if (features.has('naca')) {
    for (const side of [-1, 1]) box(0.03, 0.12, 0.8, black, side * (sideAt(0.7, 0) + 0.005), 0.7, length * 0.02, 0.18);
  }
  if (features.has('sideIntakes')) {
    for (const side of [-1, 1]) box(0.05, 0.22, 0.62, black, side * (sideAt(0.56, -length * 0.13) + 0.005), 0.56, -length * 0.13);
  }
  if (features.has('louvres')) {
    for (let i = 0; i < 5; i++) {
      const z = -length * (0.43 - i * 0.03);
      box(width * 0.48, 0.02, 0.05, black, 0, heightAt(design.top, z / length) + 0.012, z);
    }
  }
  if (features.has('hoodBulge')) box(width * 0.36, 0.08, length * 0.3, paint, 0, heightAt(design.top, 0.22) + 0.02, length * 0.22, 0.12);
  if (features.has('hoodVents')) {
    for (const side of [-1, 1]) box(0.22, 0.02, 0.42, black, side * 0.42, heightAt(design.top, 0.25) + 0.015, length * 0.25, 0.12);
  }
  if (features.has('splitter')) box(width - 0.05, 0.04, 0.24, black, 0, 0.24, nose + 0.04);
  if (features.has('roofScoop')) box(0.32, 0.12, 0.62, paint, 0, roofTop + 0.06, ((roofStart[0] + roofEnd[0]) / 2) * length - 0.2);
  if (features.has('doubleBubble')) {
    for (const side of [-1, 1])
      box(
        cabinWidth * 0.3,
        0.04,
        (roofEnd[0] - roofStart[0]) * length,
        paint,
        side * cabinWidth * 0.2,
        roofTop + 0.035,
        ((roofStart[0] + roofEnd[0]) / 2) * length,
      );
  }

  // Rear wings.
  const wingZ = -nose + 0.3;
  if (design.wing === 'v') {
    // Wide, low and plate-less, rising toward the tips.
    box(0.1, 0.16, 0.22, paint, 0, tailHeight + 0.08, wingZ - 0.05);
    for (const side of [-1, 1]) box(width * 0.5, 0.045, 0.42, paint, side * width * 0.24, tailHeight + 0.2, wingZ - 0.05, -0.06, side * 0.12);
  } else if (design.wing === 'gt') {
    box(width - 0.06, 0.05, 0.46, black, 0, tailHeight + 0.4, wingZ - 0.06, -0.08);
    for (const side of [-1, 1]) {
      box(0.04, 0.32, 0.54, black, side * (width / 2 - 0.02), tailHeight + 0.38, wingZ - 0.06);
      box(0.06, 0.38, 0.14, black, side * 0.42, tailHeight + 0.19, wingZ);
    }
  } else if (design.wing === 'whale') {
    box(width * 0.74, 0.07, 0.5, paint, 0, heightAt(design.top, -0.42) + 0.12, -length * 0.42, -0.28);
    box(width * 0.76, 0.03, 0.06, black, 0, heightAt(design.top, -0.42) + 0.08, -length * 0.42 - 0.27);
  } else if (design.wing === 'lip') box(sideAt(tailHeight, -nose) * 1.7, 0.05, 0.14, paint, 0, tailHeight + 0.03, -nose + 0.1, -0.3);
  else if (design.wing === 'low') {
    box(width - 0.22, 0.04, 0.34, paint, 0, tailHeight + 0.18, wingZ);
    for (const side of [-1, 1]) box(0.05, 0.18, 0.18, paint, side * (width / 2 - 0.45), tailHeight + 0.09, wingZ);
  }

  // Wheels.
  const tire = new THREE.MeshLambertMaterial({ color: 0x18181a, flatShading: true });
  const rim = new THREE.MeshPhongMaterial({ color: 0xc8ccd0, shininess: 90, envMap: env, reflectivity: 0.4, combine: THREE.MixOperation, flatShading: true });
  materials.push(tire, rim);
  const tireGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 14);
  tireGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.64, WHEEL_RADIUS * 0.64, 0.27, 5);
  rimGeometry.rotateZ(Math.PI / 2);
  const spinners: THREE.Group[] = [];
  const steerers: THREE.Group[] = [];
  for (const z of [front, rear]) {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (sideAt(WHEEL_RADIUS, z) - 0.06), WHEEL_RADIUS, z);
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

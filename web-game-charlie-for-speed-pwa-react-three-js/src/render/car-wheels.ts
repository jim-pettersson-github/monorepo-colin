import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHEEL_RADIUS } from './car-body';
import type { RimStyle } from './car-designs';

type WheelGeometry = { rubber: THREE.BufferGeometry; metal: THREE.BufferGeometry; brake: THREE.BufferGeometry };
const cache = new Map<RimStyle, WheelGeometry>();

function merge(parts: THREE.BufferGeometry[]) {
  const plain = parts.map((part) => {
    const geometry = part.index ? part.toNonIndexed() : part;
    geometry.deleteAttribute('uv');
    return geometry;
  });
  const result = mergeGeometries(plain);
  for (const part of new Set([...parts, ...plain])) part.dispose();
  return result;
}

// Geometry is shared across cars; only three instanced draws are needed for four rotating wheels.
export function wheelGeometry(style: RimStyle): WheelGeometry {
  const found = cache.get(style);
  if (found) return found;
  if (style === 'countach' || style === 'diablo' || style === 'clkgtr') {
    const shared = wheelGeometry('five');
    const result = { rubber: shared.rubber, brake: shared.brake, metal: favoriteRim(style) };
    cache.set(style, result);
    return result;
  }
  const radius = 0.245;
  const tyreProfile = [
    [radius, -0.12],
    [0.28, -0.135],
    [0.31, -0.13],
    [0.332, -0.105],
    [WHEEL_RADIUS, -0.065],
    [WHEEL_RADIUS - 0.003, -0.03],
    [WHEEL_RADIUS, 0],
    [WHEEL_RADIUS - 0.003, 0.03],
    [WHEEL_RADIUS, 0.065],
    [0.332, 0.105],
    [0.31, 0.13],
    [0.28, 0.135],
    [radius, 0.12],
  ]
    .map(([r, axial]) => new THREE.Vector2(r, -axial))
    .reverse();
  const rubber = new THREE.LatheGeometry(tyreProfile, 32);
  rubber.rotateZ(Math.PI / 2);
  rubber.deleteAttribute('uv');
  const barrelProfile = [
    [radius, -0.12],
    [radius, 0.09],
    [radius - 0.003, 0.12],
    [radius - 0.012, 0.13],
    [radius - 0.02, 0.115],
    [radius - 0.018, 0.085],
  ]
    .map(([r, axial]) => new THREE.Vector2(r, -axial))
    .reverse();
  const barrel = new THREE.LatheGeometry(barrelProfile, 32);
  barrel.rotateZ(Math.PI / 2);
  const parts: THREE.BufferGeometry[] = [barrel];
  const extrude = (shape: THREE.Shape) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.023,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
      curveSegments: 3,
    });
    geometry.rotateY(Math.PI / 2);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const r = Math.hypot(positions.getY(i), positions.getZ(i));
      positions.setX(i, positions.getX(i) + 0.068 + 0.035 * (r / radius) ** 2);
    }
    geometry.computeVertexNormals();
    return geometry;
  };
  if (style === 'dial') {
    const face = new THREE.Shape();
    face.absarc(0, 0, radius - 0.018, 0, Math.PI * 2, false);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2,
        hole = new THREE.Path();
      hole.absarc(Math.cos(angle) * 0.151, Math.sin(angle) * 0.151, 0.052, 0, Math.PI * 2, true);
      face.holes.push(hole);
    }
    parts.push(extrude(face));
  } else {
    const spokes = style === 'multi' ? 16 : style === 'mesh' ? 24 : style === 'split' ? 10 : style === 'turbine' ? 7 : 5;
    const halfWidth = style === 'five' ? 0.031 : style === 'turbine' ? 0.024 : 0.009;
    const shape = new THREE.Shape();
    shape.moveTo(0.043, -halfWidth * 0.7);
    shape.quadraticCurveTo(0.13, -halfWidth * 1.2, 0.228, -halfWidth);
    shape.lineTo(0.231, halfWidth);
    shape.quadraticCurveTo(0.14, halfWidth * 0.7, 0.043, halfWidth * 0.7);
    shape.closePath();
    const spoke = extrude(shape);
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + (style === 'split' ? (i % 2 ? -0.08 : 0.08) : 0);
      const part = spoke.clone();
      part.rotateX(angle);
      parts.push(part);
    }
    spoke.dispose();
  }
  const hub = new THREE.CylinderGeometry(0.057, 0.06, 0.035, 16);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.084, 0, 0);
  parts.push(hub);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2,
      bolt = new THREE.CylinderGeometry(0.008, 0.008, 0.009, 6);
    bolt.rotateZ(Math.PI / 2);
    bolt.translate(0.106, Math.cos(angle) * 0.04, Math.sin(angle) * 0.04);
    parts.push(bolt);
  }
  const brake = new THREE.CylinderGeometry(0.193, 0.193, 0.018, 24);
  brake.rotateZ(Math.PI / 2);
  brake.translate(0.018, 0, 0);
  const result = { rubber, metal: merge(parts), brake };
  cache.set(style, result);
  return result;
}

// These three rims have their own dish, spoke pattern and finishes; the remaining styles stay unchanged.
function favoriteRim(style: 'countach' | 'diablo' | 'clkgtr') {
  const parts: THREE.BufferGeometry[] = [];
  const tint = (geometry: THREE.BufferGeometry, hex: number) => {
    const color = new THREE.Color(hex),
      values = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < values.length; i += 3) values.set([color.r, color.g, color.b], i);
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
    parts.push(geometry);
  };
  const rimRadius = style === 'clkgtr' ? 0.242 : 0.232;
  const barrel = new THREE.LatheGeometry(
    [
      [rimRadius, -0.12],
      [rimRadius, 0.116],
      [rimRadius - 0.003, 0.142],
      [rimRadius - 0.014, 0.147],
      [rimRadius - 0.021, 0.13],
      [rimRadius - 0.023, 0.061],
    ]
      .map(([r, x]) => new THREE.Vector2(r, -x))
      .reverse(),
    48,
  );
  barrel.rotateZ(Math.PI / 2);
  tint(barrel, 0xdce0e5);
  const extrude = (shape: THREE.Shape) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelSize: 0.003,
      bevelThickness: 0.004,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geometry.rotateY(Math.PI / 2);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const r = Math.hypot(positions.getY(i), positions.getZ(i));
      positions.setX(i, positions.getX(i) + 0.041 + 0.035 * (r / rimRadius) ** 2);
    }
    geometry.computeVertexNormals();
    return geometry;
  };
  if (style !== 'clkgtr') {
    const face = new THREE.Shape();
    face.absarc(0, 0, rimRadius - 0.02, 0, Math.PI * 2, false);
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5,
        hole = new THREE.Path();
      hole.absarc(Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, style === 'countach' ? 0.059 : 0.054, 0, Math.PI * 2, true);
      face.holes.push(hole);
    }
    tint(extrude(face), style === 'diablo' ? 0x33363d : 0xbcc2ca);
  } else {
    const spokeShape = new THREE.Shape();
    spokeShape.moveTo(0.045, -0.008);
    spokeShape.quadraticCurveTo(0.14, -0.015, 0.223, -0.007);
    spokeShape.lineTo(0.226, 0.007);
    spokeShape.quadraticCurveTo(0.14, 0.002, 0.045, 0.008);
    spokeShape.closePath();
    const spoke = extrude(spokeShape);
    for (let i = 0; i < 24; i++) {
      const part = spoke.clone();
      part.rotateX((Math.floor(i / 2) * Math.PI * 2) / 12 + (i % 2 ? 0.032 : -0.032));
      tint(part, 0xb9c1ca);
    }
    spoke.dispose();
  }
  const hub = new THREE.CylinderGeometry(0.048, 0.055, 0.027, 24);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.07, 0, 0);
  tint(hub, style === 'diablo' ? 0x262a31 : 0xaab1ba);
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5,
      bolt = new THREE.CylinderGeometry(0.007, 0.008, 0.01, 6);
    bolt.rotateZ(Math.PI / 2);
    bolt.translate(0.087, Math.cos(angle) * 0.036, Math.sin(angle) * 0.036);
    tint(bolt, 0xdce0e5);
  }
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24,
      rivet = new THREE.CylinderGeometry(0.0035, 0.0035, 0.005, 5);
    rivet.rotateZ(Math.PI / 2);
    rivet.translate(0.145, Math.cos(angle) * (rimRadius - 0.014), Math.sin(angle) * (rimRadius - 0.014));
    tint(rivet, 0xb8bec7);
  }
  return merge(parts);
}

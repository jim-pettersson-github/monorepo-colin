import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A root-local copy of one material group, reduced to the attributes every batch shares.
function bake(source: THREE.BufferGeometry, matrix: THREE.Matrix4, withColor: boolean, range?: { start: number; count: number }) {
  let geometry = source.index ? source.toNonIndexed() : source.clone();
  if (range) {
    const sliced = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const array = attribute.array.slice(range.start * attribute.itemSize, (range.start + range.count) * attribute.itemSize);
      sliced.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    geometry.dispose();
    geometry = sliced;
  }
  for (const name of Object.keys(geometry.attributes)) {
    if (!['position', 'normal', 'uv', ...(withColor ? ['color'] : [])].includes(name)) geometry.deleteAttribute(name);
  }
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  if (withColor && !geometry.attributes.color) {
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  }
  geometry.applyMatrix4(matrix);
  geometry.groups = [];
  return geometry;
}

/**
 * Merges every static mesh under `root` into one mesh per material and map cell.
 * Objects flagged with `userData.dynamic` (and their children) are left untouched.
 */
export function batchStatic(root: THREE.Object3D, cellSize = 450) {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[]; castShadow: boolean; receiveShadow: boolean }>();
  const merged: THREE.Mesh[] = [];
  const replaced: THREE.Mesh[] = [];
  const center = new THREE.Vector3();
  const rootInverse = root.matrixWorld.clone().invert();
  const localMatrix = new THREE.Matrix4();

  const visit = (object: THREE.Object3D) => {
    if (object.userData.dynamic) return;
    for (const child of [...object.children]) visit(child);
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;

    const { geometry } = object;
    geometry.computeBoundingSphere();
    center.copy(geometry.boundingSphere?.center ?? center.set(0, 0, 0)).applyMatrix4(object.matrixWorld);
    const cell = Number.isFinite(cellSize) ? `${Math.floor(center.x / cellSize)},${Math.floor(center.z / cellSize)}` : 'all';
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some((material) => material.transparent)) return;
    const groups =
      Array.isArray(object.material) && geometry.groups.length ? geometry.groups : [{ start: 0, count: Number.POSITIVE_INFINITY, materialIndex: 0 }];

    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      if (!material) continue;
      const withColor = 'vertexColors' in material && !!material.vertexColors;
      const key = `${material.uuid}|${cell}|${object.castShadow}|${object.receiveShadow}`;
      const range = Number.isFinite(group.count) ? { start: group.start, count: group.count } : undefined;
      const bucket = buckets.get(key) ?? { material, parts: [] as THREE.BufferGeometry[], castShadow: object.castShadow, receiveShadow: object.receiveShadow };
      localMatrix.multiplyMatrices(rootInverse, object.matrixWorld);
      bucket.parts.push(bake(geometry, localMatrix, withColor, range));
      buckets.set(key, bucket);
    }
    replaced.push(object);
  };
  visit(root);

  for (const mesh of replaced) mesh.removeFromParent();
  for (const geometry of new Set(replaced.map((mesh) => mesh.geometry))) geometry.dispose();
  for (const { material, parts, castShadow, receiveShadow } of buckets.values()) {
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
    mesh.userData.batched = true;
    root.add(mesh);
    merged.push(mesh);
  }

  return {
    meshes: merged.length,
    dispose() {
      for (const mesh of merged) mesh.geometry.dispose();
    },
  };
}

import { Group, InstancedMesh, Mesh, type Object3D } from 'three';

// Keep the articulated source figures off-scene; matching parts share one GPU draw.
export function instanceParts(root: Object3D) {
  const buckets = new Map<string, Mesh[]>();
  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    const key = `${object.geometry.uuid}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    const parts = buckets.get(key) ?? [];
    parts.push(object);
    buckets.set(key, parts);
  });
  const group = new Group();
  const batches = [...buckets.values()].map((parts) => {
    const first = parts[0];
    const mesh = new InstancedMesh(first.geometry, first.material, parts.length);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    group.add(mesh);
    return { parts, mesh };
  });
  const update = () => {
    root.updateMatrixWorld(true);
    for (const { parts, mesh } of batches) {
      parts.forEach((part, index) => {
        mesh.setMatrixAt(index, part.matrixWorld);
      });
      mesh.instanceMatrix.needsUpdate = true;
      // Players move beyond the initial kickoff bounds, including on portrait cameras.
      mesh.computeBoundingSphere();
    }
  };
  update();
  return {
    group,
    update,
    dispose() {
      group.removeFromParent();
      for (const { mesh } of batches) mesh.dispose();
    },
  };
}

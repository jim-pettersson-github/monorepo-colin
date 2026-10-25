import * as THREE from 'three';
import type { Race } from '../game/race';
import { locate } from '../game/track-path';
import { canvas, texture } from './textures';

const CAPACITY = 1024;
type Contact = { x: number; y: number; z: number; rx: number; rz: number };

// Two draw calls, fixed storage, and no per-frame creation of meshes or textures.
export class DrivingEffects {
  readonly marks: THREE.Mesh;
  readonly lights: THREE.InstancedMesh;
  private positions = new Float32Array(CAPACITY * 18);
  private colors = new Float32Array(CAPACITY * 24);
  private born = new Float32Array(CAPACITY).fill(-100);
  private previous: (Contact | undefined)[] = [];
  private next = 0;
  private count = 0;
  private transform = new THREE.Object3D();
  private lightMap: THREE.Texture;
  private tint = new THREE.Color();

  constructor(cars: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    this.marks = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.marks.frustumCulled = false;
    this.marks.renderOrder = 1;
    this.lightMap = texture(
      canvas(128, 256, (context) => {
        // The narrow end sits at the bumper; the broad, softly faded end illuminates the road ahead.
        for (let y = 0; y < 256; y++) {
          const distance = y / 256;
          const width = 11 + distance * 53;
          const strength = Math.sin(distance * Math.PI) ** 0.7 * 0.32;
          const gradient = context.createLinearGradient(64 - width, 0, 64 + width, 0);
          gradient.addColorStop(0, 'rgba(255,239,199,0)');
          gradient.addColorStop(0.3, `rgba(255,239,199,${strength})`);
          gradient.addColorStop(0.7, `rgba(255,239,199,${strength})`);
          gradient.addColorStop(1, 'rgba(255,239,199,0)');
          context.fillStyle = gradient;
          context.fillRect(0, y, 128, 1);
        }
      }),
      false,
      false,
    );
    this.lights = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(9, 18),
      new THREE.MeshBasicMaterial({
        map: this.lightMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      cars,
    );
    this.lights.frustumCulled = false;
    this.lights.renderOrder = 2;
    this.transform.rotation.order = 'YXZ';
  }

  update(race: Race, time: number, night: boolean, camera: THREE.Camera) {
    let lights = 0;
    let changed = false;
    for (const racer of race.racers) {
      const car = racer.state;
      const sin = Math.sin(car.yaw);
      const cos = Math.cos(car.yaw);
      const speed = Math.hypot(car.vx, car.vz);
      const nearby = (car.x - camera.position.x) ** 2 + (car.z - camera.position.z) ** 2 < 150 ** 2;
      const inside = Math.min(car.s - race.track.tunnel.start, race.track.tunnel.end - car.s);
      const strength = Math.max(night ? 0.6 : 0, THREE.MathUtils.smoothstep(inside, 0, 12));
      if (nearby && strength > 0.01) {
        const x = car.x + sin * 10;
        const z = car.z + cos * 10;
        const ground = locate(race.track.path, x, z, car.index, 8);
        const heading = sin * ground.sample.tx + cos * ground.sample.tz;
        this.transform.position.set(x, ground.y + 0.055, z);
        this.transform.rotation.set(-Math.PI / 2 - Math.atan(ground.sample.slope) * heading, car.yaw, 0);
        this.transform.updateMatrix();
        this.lights.setMatrixAt(lights, this.transform.matrix);
        this.lights.setColorAt(lights++, this.tint.setScalar(strength));
      }
      for (const side of [-1, 1]) {
        const key = racer.id * 2 + (side > 0 ? 1 : 0);
        if (race.phase !== 'racing' || !nearby || car.surface !== 'road' || speed < 5 || (car.slip < 3.5 && !(car.braking && speed > 18))) {
          this.previous[key] = undefined;
          continue;
        }
        const x = car.x - sin * racer.spec.length * 0.28 + cos * side * racer.spec.width * 0.38;
        const z = car.z - cos * racer.spec.length * 0.28 - sin * side * racer.spec.width * 0.38;
        const last = this.previous[key];
        const distance = last ? Math.hypot(x - last.x, z - last.z) : 0;
        if (last && distance < 0.3) continue;
        const ground = locate(race.track.path, x, z, car.index, 3);
        const contact = { x, y: ground.y + 0.035, z, rx: cos * 0.11, rz: -sin * 0.11 };
        if (last && distance < 4) {
          const corners = [last, last, contact, contact];
          [0, 2, 1, 1, 2, 3].forEach((corner, vertex) => {
            const point = corners[corner];
            const edge = corner % 2 ? 1 : -1;
            const offset = this.next * 18 + vertex * 3;
            this.positions[offset] = point.x + point.rx * edge;
            this.positions[offset + 1] = point.y;
            this.positions[offset + 2] = point.z + point.rz * edge;
          });
          this.born[this.next] = time;
          this.next = (this.next + 1) % CAPACITY;
          this.count = Math.min(CAPACITY, this.count + 1);
          changed = true;
        }
        this.previous[key] = contact;
      }
    }
    this.lights.count = lights;
    this.lights.visible = lights > 0;
    if (lights) {
      this.lights.instanceMatrix.needsUpdate = true;
      if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    }
    let visible = false;
    for (let i = 0; i < this.count; i++) {
      const alpha = Math.max(0, 1 - (time - this.born[i]) / 35) * 0.3;
      visible ||= alpha > 0;
      for (let vertex = 0; vertex < 6; vertex++) {
        const offset = i * 24 + vertex * 4;
        this.colors[offset] = 0.015;
        this.colors[offset + 1] = 0.018;
        this.colors[offset + 2] = 0.022;
        this.colors[offset + 3] = alpha;
      }
    }
    this.marks.visible = visible;
    if (visible) this.marks.geometry.attributes.color.needsUpdate = true;
    if (changed) {
      this.marks.geometry.attributes.position.needsUpdate = true;
      this.marks.geometry.setDrawRange(0, this.count * 6);
    }
  }

  dispose() {
    this.marks.geometry.dispose();
    (this.marks.material as THREE.Material).dispose();
    this.lights.geometry.dispose();
    (this.lights.material as THREE.Material).dispose();
    this.lights.dispose();
    this.lightMap.dispose();
  }
}

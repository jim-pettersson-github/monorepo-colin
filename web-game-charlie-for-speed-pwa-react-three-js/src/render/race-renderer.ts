import * as THREE from 'three';
import type { Race } from '../game/race';
import { buildCarModel, type CarModel } from './car-model';
import { Particles } from './effects';
import { buildTrackWorld, type TrackWorld } from './track-world';

export type CameraMode = 'chase' | 'far' | 'bumper';
export const cameraModes: CameraMode[] = ['chase', 'far', 'bumper'];

const views: Record<CameraMode, { back: number; height: number; look: number; lookHeight: number }> = {
  chase: { back: 7.2, height: 2.5, look: 6, lookHeight: 1.1 },
  far: { back: 12, height: 4.4, look: 8, lookHeight: 1.2 },
  bumper: { back: -2.0, height: 0.75, look: 30, lookHeight: 0.7 },
};

export class RaceRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.3, 2600);
  private world: TrackWorld;
  private models: CarModel[];
  private race: Race;
  private cameraYaw = 0;
  private cameraPosition = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private retro: boolean;
  private elapsed = 0;
  private smoke = new Particles({ capacity: 600, opacity: 0.5, gravity: -0.8, growth: 2.4 });
  private sparks = new Particles({ capacity: 240, opacity: 1, gravity: 9, growth: -0.4 });
  private emitPosition = new THREE.Vector3();
  private emitVelocity = new THREE.Vector3();
  private colors = { smoke: new THREE.Color('#d8d8d4'), dust: new THREE.Color('#8f8058'), spark: new THREE.Color('#ffb43a') };
  private drawingSize = new THREE.Vector2();
  private size = { width: 1, height: 1 };
  private maxPixelRatio: number;
  private pixelRatio: number;
  private frameAverage = 1 / 60;
  private qualityTimer = 0;
  mode: CameraMode = 'chase';

  constructor(canvas: HTMLCanvasElement, race: Race, retro: boolean) {
    this.race = race;
    this.retro = retro;
    // High-density phone screens hide jaggies anyway, so they skip the costly multisampling.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !retro && window.devicePixelRatio < 1.5, powerPreference: 'high-performance' });
    this.maxPixelRatio = retro ? 0.5 : Math.min(window.devicePixelRatio, 1.5);
    this.pixelRatio = this.maxPixelRatio;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.world = buildTrackWorld(race.track);
    this.models = race.racers.map((racer) => {
      const model = buildCarModel(racer.spec, this.world.look.headlights);
      this.world.scene.add(model.group);
      return model;
    });
    this.world.scene.add(this.smoke.points, this.sparks.points);
    this.cameraYaw = race.player.state.yaw;
  }

  resize(width: number, height: number) {
    this.size = { width, height };
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  // Lowers the render resolution when frames run long and raises it again once there is headroom.
  private adaptQuality(frameTime: number) {
    if (this.retro) return;
    this.frameAverage += (frameTime - this.frameAverage) * 0.05;
    this.qualityTimer += frameTime;
    if (this.qualityTimer < 1.5) return;
    this.qualityTimer = 0;
    let next = this.pixelRatio;
    if (this.frameAverage > 1 / 45) next = Math.max(0.6, this.pixelRatio - 0.15);
    else if (this.frameAverage < 1 / 57) next = Math.min(this.maxPixelRatio, this.pixelRatio + 0.1);
    if (Math.abs(next - this.pixelRatio) < 0.01) return;
    this.pixelRatio = next;
    this.resize(this.size.width, this.size.height);
  }

  render(frameTime: number) {
    const { race } = this;
    this.elapsed += frameTime;
    this.adaptQuality(frameTime);
    const { samples } = race.track.path;

    race.racers.forEach((racer, index) => {
      const sample = samples[racer.state.index];
      const headingDot = Math.sin(racer.state.yaw) * sample.tx + Math.cos(racer.state.yaw) * sample.tz;
      this.models[index].update(racer.state, Math.sign(headingDot) || 1);
    });

    const lit = race.phase === 'countdown' ? Math.min(5, Math.floor((3.4 - race.countdown) / 0.6)) : 0;
    this.world.setStartLights(lit, race.phase !== 'countdown' && race.time < 3);
    this.updateCamera(frameTime);
    this.emitEffects(frameTime);
    this.renderer.getDrawingBufferSize(this.drawingSize);
    this.smoke.update(frameTime, this.drawingSize.y, this.camera.fov);
    this.sparks.update(frameTime, this.drawingSize.y, this.camera.fov);
    const { tunnel } = race.track;
    const s = race.player.state.s;
    const inside = Math.min(s - tunnel.start, tunnel.end - s);
    this.world.setShade(THREE.MathUtils.smoothstep(inside, -5, 18));
    this.world.update(this.camera, this.elapsed);
    this.renderer.render(this.world.scene, this.camera);
  }

  // Tyre smoke when sliding, dust on the grass and sparks along the barriers.
  private emitEffects(frameTime: number) {
    const { race, camera } = this;
    if (race.phase === 'countdown') return;
    const rate = frameTime * 60;
    for (const racer of race.racers) {
      const car = racer.state;
      if ((car.x - camera.position.x) ** 2 + (car.z - camera.position.z) ** 2 > 160 ** 2) continue;
      const speed = Math.hypot(car.vx, car.vz);
      const fx = Math.sin(car.yaw);
      const fz = Math.cos(car.yaw);
      const sliding = car.surface !== 'grass' && car.slip > 3.5;
      const dusty = car.surface === 'grass' && speed > 6;
      if (sliding || dusty) {
        for (const side of [-0.8, 0.8]) {
          if (Math.random() > Math.min(1, (dusty ? 0.6 : (car.slip - 3) / 5) * rate)) continue;
          this.emitPosition.set(car.x - fx * 1.3 - fz * side, car.y + 0.3, car.z - fz * 1.3 + fx * side);
          this.emitVelocity.set(car.vx * 0.12 + (Math.random() - 0.5), 0.5 + Math.random() * 0.6, car.vz * 0.12 + (Math.random() - 0.5));
          this.smoke.emit(this.emitPosition, this.emitVelocity, dusty ? this.colors.dust : this.colors.smoke, dusty ? 0.9 : 1.2, dusty ? 0.9 : 1.5);
        }
      }
      if ((car.scraping && speed > 6) || car.impact > 3) {
        const side = Math.sign(car.lateral) || 1;
        const sample = race.track.path.samples[car.index];
        for (let i = 0; i < Math.ceil(3 * rate); i++) {
          // From the rear corner against the barrier, trailing back toward the camera.
          const along = -racer.spec.length / 2 + Math.random() * 0.6;
          const edge = racer.spec.width / 2 + 0.05;
          const spray = Math.random() * 1.5;
          this.emitPosition.set(car.x + sample.rx * side * edge + fx * along, car.y + 0.45, car.z + sample.rz * side * edge + fz * along);
          this.emitVelocity.set(car.vx * 0.4 - sample.rx * side * spray, 1.5 + Math.random() * 3, car.vz * 0.4 - sample.rz * side * spray);
          this.sparks.emit(this.emitPosition, this.emitVelocity, this.colors.spark, 0.3, 0.25 + Math.random() * 0.25);
        }
      }
    }
  }

  private updateCamera(frameTime: number) {
    const { race, camera } = this;
    const car = race.player.state;
    const speed = Math.hypot(car.vx, car.vz);
    const ease = 1 - Math.exp(-frameTime * 6);

    // Follow the direction of travel a little during slides, NFS-style.
    let targetYaw = car.yaw;
    if (speed > 8 && this.mode !== 'bumper') {
      const travel = Math.atan2(car.vx, car.vz);
      const forward = Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vz;
      if (forward > 0) targetYaw = car.yaw + Math.atan2(Math.sin(travel - car.yaw), Math.cos(travel - car.yaw)) * 0.45;
    }
    const delta = Math.atan2(Math.sin(targetYaw - this.cameraYaw), Math.cos(targetYaw - this.cameraYaw));
    this.cameraYaw += this.mode === 'bumper' ? delta : delta * ease;

    let view = views[this.mode];
    let yaw = this.cameraYaw;
    let fov = 62 + Math.min(14, speed * 0.16);

    if (race.phase === 'countdown') {
      // Sweep from in front of the car round to the chase position.
      const progress = THREE.MathUtils.smoothstep(1 - race.countdown / 3.4, 0, 0.85);
      yaw = car.yaw + Math.PI * (1 - progress);
      view = {
        back: THREE.MathUtils.lerp(9, views.chase.back, progress),
        height: THREE.MathUtils.lerp(1.6, views.chase.height, progress),
        look: 0,
        lookHeight: 0.9,
      };
      fov = 60;
      this.cameraYaw = car.yaw;
    } else if (race.phase === 'finished') {
      yaw = car.yaw + Math.PI * 0.6 + (race.time - race.finishedAt) * 0.35;
      view = { back: 9, height: 3, look: 0, lookHeight: 1 };
    }

    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const shake = car.surface === 'grass' ? Math.sin(this.elapsed * 60) * Math.min(0.08, speed * 0.003) : 0;
    this.cameraPosition.set(car.x - sin * view.back, car.y + view.height + shake, car.z - cos * view.back);
    this.lookTarget.set(car.x + Math.sin(car.yaw) * view.look, car.y + view.lookHeight, car.z + Math.cos(car.yaw) * view.look);
    if (race.phase === 'countdown' || race.phase === 'finished') this.lookTarget.set(car.x, car.y + view.lookHeight, car.z);

    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.lookTarget);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * ease;
      camera.updateProjectionMatrix();
    }
    this.models[race.player.id].group.visible = this.mode !== 'bumper' || race.phase !== 'racing';
  }

  dispose() {
    for (const model of this.models) model.dispose();
    this.smoke.dispose();
    this.sparks.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}

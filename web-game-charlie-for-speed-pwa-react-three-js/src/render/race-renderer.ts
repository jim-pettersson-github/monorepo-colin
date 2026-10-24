import * as THREE from 'three';
import type { Race } from '../game/race';
import { buildCarModel, type CarModel } from './car-model';
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
  mode: CameraMode = 'chase';

  constructor(canvas: HTMLCanvasElement, race: Race, retro: boolean) {
    this.race = race;
    this.retro = retro;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !retro, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.world = buildTrackWorld(race.track);
    this.models = race.racers.map((racer) => {
      const model = buildCarModel(racer.spec, this.world.look.headlights);
      this.world.scene.add(model.group);
      return model;
    });
    this.cameraYaw = race.player.state.yaw;
  }

  resize(width: number, height: number) {
    const pixelRatio = this.retro ? 0.5 : Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  render(frameTime: number) {
    const { race } = this;
    this.elapsed += frameTime;
    const { samples } = race.track.path;

    race.racers.forEach((racer, index) => {
      const sample = samples[racer.state.index];
      const headingDot = Math.sin(racer.state.yaw) * sample.tx + Math.cos(racer.state.yaw) * sample.tz;
      this.models[index].update(racer.state, Math.sign(headingDot) || 1);
    });

    const lit = race.phase === 'countdown' ? Math.min(5, Math.floor((3.4 - race.countdown) / 0.6)) : 0;
    this.world.setStartLights(lit, race.phase !== 'countdown' && race.time < 3);
    this.updateCamera(frameTime);
    this.world.update(this.camera, this.elapsed);
    this.renderer.render(this.world.scene, this.camera);
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
    this.world.dispose();
    this.renderer.dispose();
  }
}

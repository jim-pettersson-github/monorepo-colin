import * as THREE from 'three';
import type { Race } from '../game/race';
import { loadQuality, saveQuality } from '../game/storage';
import { buildCarModel, type CarModel } from './car-model';
import { DrivingEffects } from './driving-effects';
import { Particles, skyEnvironment } from './effects';
import { NameTags } from './name-tags';
import { QualityGovernor, qualityLadder } from './quality';
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
  private elapsed = 0;
  private smoke = new Particles({ capacity: 600, opacity: 0.28, gravity: -0.8, growth: 1.7 });
  private sparks = new Particles({ capacity: 240, opacity: 1, gravity: 9, growth: -0.4 });
  private emitPosition = new THREE.Vector3();
  private emitVelocity = new THREE.Vector3();
  private colors = { smoke: new THREE.Color('#d8d8d4'), dust: new THREE.Color('#8f8058'), spark: new THREE.Color('#ffb43a') };
  private drawingSize = new THREE.Vector2();
  private size = { width: 1, height: 1 };
  private environment: THREE.WebGLRenderTarget;
  private quality: QualityGovernor;
  private lastFrame = 0;
  private drivingEffects: DrivingEffects;
  private nameTags: NameTags;
  mode: CameraMode = 'chase';

  constructor(canvas: HTMLCanvasElement, race: Race) {
    this.race = race;
    // High-density phone screens hide jaggies anyway, so they skip the costly multisampling.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, powerPreference: 'high-performance' });
    const phone = matchMedia('(pointer: coarse)').matches;
    this.quality = new QualityGovernor(qualityLadder(Math.min(window.devicePixelRatio, 1.5), !phone), loadQuality());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.world = buildTrackWorld(race.track);
    const { look } = this.world;

    // Filmic tone mapping, sky reflections and a sun shadow that follows the player.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = !phone;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const sun = this.world.sunLight;
    sun.shadow.mapSize.setScalar(window.devicePixelRatio >= 2 ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 320 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.world.scene.add(sun.target);
    this.environment = skyEnvironment(this.renderer, {
      top: look.skyTop,
      horizon: look.skyHorizon,
      ground: look.hemiGround,
      sun: look.sunColor,
      direction: look.sun,
    });
    this.world.scene.environment = this.environment.texture;
    this.world.scene.environmentIntensity = 0.9;
    this.models = race.racers.map((racer) => {
      const model = buildCarModel(racer.spec, this.world.look.headlights);
      this.world.scene.add(model.group);
      return model;
    });
    this.nameTags = new NameTags(race);
    this.world.scene.add(this.nameTags.group);
    this.drivingEffects = new DrivingEffects(race.racers.length);
    this.world.scene.add(this.drivingEffects.marks, this.drivingEffects.lights);
    this.world.scene.add(this.smoke.points, this.sparks.points);
    this.cameraYaw = race.player.state.yaw;
    this.applyQuality();
  }

  resize(width: number, height: number) {
    this.size = { width, height };
    this.renderer.setPixelRatio(this.quality.level.ratio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  // Steps graphics down while frames come slower than 30 a second, and back up once there is room (see quality.ts).
  // Measured between drawn frames in real time, so a phone below 10 fps counts as slow as it really is.
  private adaptQuality() {
    const now = performance.now();
    const seconds = this.lastFrame ? (now - this.lastFrame) / 1000 : 0;
    this.lastFrame = now;
    if (this.quality.frame(seconds)) this.applyQuality();
  }

  private applyQuality() {
    const { level } = this.quality;
    this.renderer.domElement.dataset.quality = String(this.quality.index);
    this.world.sunLight.castShadow = level.shadows;
    this.world.setViewDistance(level.view);
    if (this.renderer.getPixelRatio() !== level.ratio) this.resize(this.size.width, this.size.height);
  }

  // The current render resolution, for the online performance report.
  get resolution() {
    return this.quality.level.ratio;
  }

  render(frameTime: number) {
    const { race } = this;
    this.elapsed += frameTime;
    this.adaptQuality();
    const { samples } = race.track.path;

    race.racers.forEach((racer, index) => {
      const sample = samples[racer.state.index];
      const headingDot = Math.sin(racer.state.yaw) * sample.tx + Math.cos(racer.state.yaw) * sample.tz;
      this.models[index].update(racer.state, Math.sign(headingDot) || 1);
    });

    const lit = race.phase === 'countdown' ? Math.min(5, Math.floor((3.4 - race.countdown) / 0.6)) : 0;
    this.world.setStartLights(lit, race.phase !== 'countdown' && race.time < 3);
    this.updateCamera(frameTime);
    const { detail } = this.quality.level;
    for (const model of this.models) model.setDistance(model.group.position.distanceTo(this.camera.position) / detail);
    this.nameTags.update(race, this.camera);
    const car = race.player.state;
    const sun = this.world.sunLight;
    sun.target.position.set(car.x, car.y, car.z);
    sun.position.set(car.x, car.y, car.z).addScaledVector(this.world.look.sun, 160);
    this.emitEffects(frameTime);
    this.renderer.getDrawingBufferSize(this.drawingSize);
    this.smoke.update(frameTime, this.drawingSize.y, this.camera.fov);
    this.sparks.update(frameTime, this.drawingSize.y, this.camera.fov);
    const { tunnel } = race.track;
    const s = race.player.state.s;
    const inside = Math.min(s - tunnel.start, tunnel.end - s);
    this.world.setShade(THREE.MathUtils.smoothstep(inside, -5, 18));
    this.world.update(this.camera, this.elapsed);
    this.drivingEffects.update(race, this.elapsed, this.world.look.headlights, this.camera);
    this.renderer.render(this.world.scene, this.camera);
  }

  // Tyre smoke when sliding, dust on the grass and sparks along the barriers.
  private emitEffects(frameTime: number) {
    const { race, camera } = this;
    const { effects } = this.quality.level;
    if (race.phase === 'countdown' || effects === 0) return;
    const rate = frameTime * 60 * effects;
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
          this.smoke.emit(this.emitPosition, this.emitVelocity, dusty ? this.colors.dust : this.colors.smoke, 0.65, dusty ? 0.9 : 1.25);
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
        back: THREE.MathUtils.lerp(6.5, views.chase.back, progress),
        height: THREE.MathUtils.lerp(2.4, views.chase.height, progress),
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
    saveQuality(this.quality.index);
    this.drivingEffects.dispose();
    for (const model of this.models) model.dispose();
    this.nameTags.dispose();
    this.smoke.dispose();
    this.environment.dispose();
    this.sparks.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}

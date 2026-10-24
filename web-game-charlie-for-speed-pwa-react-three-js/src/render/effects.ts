import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { cloudTexture, glowTexture, texture } from './textures';

function puffTexture() {
  const element = document.createElement('canvas');
  element.width = element.height = 32;
  const context = element.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
  }
  return texture(element, false, false);
}

function ringTexture(color: string, filled: boolean) {
  const element = document.createElement('canvas');
  element.width = element.height = 64;
  const context = element.getContext('2d');
  if (context) {
    context.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      context.lineTo(32 + Math.cos(angle) * 28, 32 + Math.sin(angle) * 28);
    }
    context.closePath();
    context.globalAlpha = filled ? 0.35 : 0.6;
    if (filled) {
      context.fillStyle = color;
      context.fill();
    } else {
      context.strokeStyle = color;
      context.lineWidth = 4;
      context.stroke();
    }
  }
  return texture(element, false, false);
}

type ParticleOptions = { capacity: number; opacity: number; gravity: number; growth: number };

// Pooled billboard particles for tyre smoke, grass dust and barrier sparks.
export class Particles {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private ages: Float32Array;
  private lives: Float32Array;
  private next = 0;
  private options: ParticleOptions;
  private material: THREE.ShaderMaterial;
  private map: THREE.Texture;

  constructor(options: ParticleOptions) {
    this.options = options;
    const { capacity } = options;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.ages = new Float32Array(capacity).fill(1);
    this.lives = new Float32Array(capacity).fill(1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    this.map = puffTexture();
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.map }, scale: { value: 400 } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
          vAlpha = alpha;
          vColor = color;
        }`,
      fragmentShader: `
        uniform sampler2D map;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 sprite = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * sprite.rgb, sprite.a * vAlpha);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  emit(position: THREE.Vector3, velocity: THREE.Vector3, color: THREE.Color, size: number, life: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.options.capacity;
    this.positions.set([position.x, position.y, position.z], i * 3);
    this.velocities.set([velocity.x, velocity.y, velocity.z], i * 3);
    this.colors.set([color.r, color.g, color.b], i * 3);
    this.sizes[i] = size;
    this.ages[i] = 0;
    this.lives[i] = life;
  }

  update(delta: number, viewportHeight: number, fov: number) {
    const { capacity, gravity, growth } = this.options;
    let active = false;
    for (let i = 0; i < capacity; i++) {
      if (this.ages[i] >= this.lives[i]) {
        this.alphas[i] = 0;
        continue;
      }
      this.ages[i] += delta;
      active = true;
      const t = this.ages[i] / this.lives[i];
      this.velocities[i * 3 + 1] -= gravity * delta;
      for (let axis = 0; axis < 3; axis++) this.positions[i * 3 + axis] += this.velocities[i * 3 + axis] * delta;
      this.velocities[i * 3] *= 1 - delta * 1.5;
      this.velocities[i * 3 + 2] *= 1 - delta * 1.5;
      this.sizes[i] += growth * delta;
      this.alphas[i] = Math.max(0, 1 - t) * this.options.opacity;
    }
    this.points.visible = active;
    if (!active) return;
    const geometry = this.points.geometry;
    for (const name of ['position', 'color', 'size', 'alpha']) geometry.attributes[name].needsUpdate = true;
    this.material.uniforms.scale.value = viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    this.map.dispose();
  }
}

// Hexagonal ghosts along the line through the sun, hidden automatically when the sun is blocked.
export function buildLensFlare(sunColor: string) {
  const glow = glowTexture(sunColor);
  const ghost = ringTexture('#ffe2a8', true);
  const ring = ringTexture('#bfe0ff', false);
  const flare = new Lensflare();
  flare.addElement(new LensflareElement(glow, 380, 0, new THREE.Color(sunColor)));
  flare.addElement(new LensflareElement(ghost, 50, 0.35));
  flare.addElement(new LensflareElement(ring, 90, 0.55));
  flare.addElement(new LensflareElement(ghost, 70, 0.7));
  flare.addElement(new LensflareElement(ghost, 130, 0.9));
  flare.addElement(new LensflareElement(ring, 60, 1.05));
  return {
    flare,
    dispose() {
      flare.dispose();
      for (const map of [glow, ghost, ring]) map.dispose();
    },
  };
}

// A blurred copy of the track's sky, ground and sun for image-based reflections on the cars.
export function skyEnvironment(renderer: THREE.WebGLRenderer, colors: { top: string; horizon: string; ground: string; sun: string; direction: THREE.Vector3 }) {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 32, 16);
  const top = new THREE.Color(colors.top);
  const horizon = new THREE.Color(colors.horizon);
  const ground = new THREE.Color(colors.ground);
  const tint = new THREE.Color();
  const shades: number[] = [];
  for (let i = 0; i < dome.attributes.position.count; i++) {
    const y = dome.attributes.position.getY(i) / 50;
    if (y >= 0) tint.copy(horizon).lerp(top, Math.min(1, y * 1.8) ** 0.7);
    else tint.copy(horizon).lerp(ground, Math.min(1, -y * 6));
    shades.push(tint.r, tint.g, tint.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  const domeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(dome, domeMaterial));
  const sunGeometry = new THREE.SphereGeometry(3, 12, 8);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.sun).multiplyScalar(18) });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.copy(colors.direction).multiplyScalar(42);
  scene.add(sun);
  // Broad cloud reflections describe the curved paint and glass better than a single sun hotspot.
  const clouds = cloudTexture(3);
  const cloudMaterial = new THREE.MeshBasicMaterial({ map: clouds, transparent: true, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) });
  const cloudGeometry = new THREE.PlaneGeometry(34, 15);
  for (const [x, y, z] of [
    [-25, 26, 12],
    [18, 32, -19],
    [12, 18, 32],
  ]) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set(x, y, z);
    cloud.lookAt(0, 0, 0);
    scene.add(cloud);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(scene, 0.015);
  generator.dispose();
  for (const item of [dome, domeMaterial, sunGeometry, sunMaterial, clouds, cloudMaterial, cloudGeometry]) item.dispose();
  return target;
}

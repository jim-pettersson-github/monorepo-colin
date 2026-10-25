import * as THREE from 'three';
import type { Race } from '../game/race';
import { palette } from '../palette';

const FADE_START = 70;
const HIDE = 120;

function tagTexture(name: string, human: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    let size = 40;
    context.font = `italic ${size}px Impact, "Arial Black", sans-serif`;
    // Long names shrink to fit instead of being cut off.
    while (size > 22 && context.measureText(name).width > 236) {
      size -= 2;
      context.font = `italic ${size}px Impact, "Arial Black", sans-serif`;
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 7;
    context.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    context.strokeText(name, 128, 34);
    context.fillStyle = human ? palette.accent : '#ffffff';
    context.fillText(name, 128, 34);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Names above the other cars: screen-sized so they stay readable, fading out with distance. Other people are in the accent colour.
export class NameTags {
  readonly group = new THREE.Group();
  private tags: { sprite: THREE.Sprite; material: THREE.SpriteMaterial; texture: THREE.CanvasTexture }[];

  constructor(race: Race) {
    this.tags = race.racers.map((racer) => {
      const texture = tagTexture(racer.driverName, racer.isPlayer);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false, toneMapped: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.22, 0.055, 1);
      sprite.renderOrder = 2;
      sprite.visible = false;
      this.group.add(sprite);
      return { sprite, material, texture };
    });
  }

  update(race: Race, camera: THREE.PerspectiveCamera) {
    // Tags are sized against the screen height, so narrow portrait screens get smaller ones.
    const scale = Math.max(0.6, Math.min(1, camera.aspect / 0.7));
    race.racers.forEach((racer, index) => {
      const { sprite, material } = this.tags[index];
      sprite.scale.set(0.22 * scale, 0.055 * scale, 1);
      const { x, y, z } = racer.state;
      const distance = camera.position.distanceTo(sprite.position.set(x, y + 1.9, z));
      sprite.visible = racer !== race.player && distance < HIDE;
      material.opacity = Math.min(1, (HIDE - distance) / (HIDE - FADE_START));
    });
  }

  dispose() {
    for (const { material, texture } of this.tags) {
      material.dispose();
      texture.dispose();
    }
  }
}

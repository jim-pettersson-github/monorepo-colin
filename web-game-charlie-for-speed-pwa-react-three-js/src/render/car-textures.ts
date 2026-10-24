import * as THREE from 'three';

// Number plate: blue EU band and a short registration.
export function plateTexture() {
  const element = document.createElement('canvas');
  element.width = 128;
  element.height = 32;
  const context = element.getContext('2d');
  if (context) {
    context.fillStyle = '#f4f4ee';
    context.fillRect(0, 0, 128, 32);
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, 125, 29);
    context.fillStyle = '#1d4fb8';
    context.fillRect(3, 3, 14, 26);
    context.fillStyle = '#111';
    context.font = 'bold 22px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('CFS 099', 72, 17);
  }
  const map = new THREE.CanvasTexture(element);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

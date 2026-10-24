import * as THREE from 'three';
import type { CarSpec } from '../game/cars';
import type { CarDesign, RimStyle } from './car-designs';
import { texture } from './textures';

// Painted texture maps in the spirit of late-90s racers: low resolution, pre-lit, detail drawn rather than modelled.

export const SIDE_BOTTOM = 0.2;
export const SIDE_HEIGHT = 1.2;

function canvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (context) draw(context);
  return element;
}

function shade(color: string, amount: number) {
  return `#${new THREE.Color(color).multiplyScalar(amount).getHexString()}`;
}

// Body sides in white so the paint colour tints them: shut lines, handles, arch shadows and a top-lit gradient.
export function sideTexture(design: CarDesign, spec: CarSpec, axles: number[], archRadius: number) {
  const width = 512;
  const height = 128;
  const x = (meters: number) => (meters / spec.length + 0.5) * width;
  const y = (meters: number) => height * (1 - (meters - SIDE_BOTTOM) / SIDE_HEIGHT);
  const map = texture(
    canvas(width, height, (context) => {
      const light = context.createLinearGradient(0, y(1.1), 0, y(0.25));
      light.addColorStop(0, '#ffffff');
      light.addColorStop(0.55, '#f0f0f0');
      light.addColorStop(1, '#a8a8a8');
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);

      // Character line catching the light, and a darker rocker panel.
      context.fillStyle = 'rgba(255,255,255,0.9)';
      context.fillRect(0, y(0.66), width, 2);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(0, y(0.66) + 2, width, 2);
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(0, y(0.38), width, y(0.2) - y(0.38));

      // Doors between the windscreen base and the rear of the glasshouse.
      const doorFront = design.cabin[3][0] * spec.length - 0.05;
      const doorRear = Math.max(design.cabin[0][0] * spec.length + 0.1, doorFront - 1.25);
      context.strokeStyle = 'rgba(0,0,0,0.55)';
      context.lineWidth = 2;
      context.beginPath();
      for (const meters of [doorFront, doorRear]) {
        context.moveTo(x(meters), y(0.34));
        context.lineTo(x(meters), y(0.95));
      }
      context.moveTo(x(doorRear), y(0.34));
      context.lineTo(x(doorFront), y(0.34));
      context.stroke();
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x(doorRear + 0.12), y(0.76), 12, 3);
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.fillRect(x(doorRear + 0.12), y(0.76) - 1, 12, 1);

      // Shadowed lips around the wheel arches.
      for (const axle of axles) {
        const gradient = context.createRadialGradient(x(axle), y(0.34), 0, x(axle), y(0.34), (archRadius + 0.14) * (width / spec.length));
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.45)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(x(axle - 0.7), y(0.95), x(axle + 0.7) - x(axle - 0.7), y(0.2) - y(0.95));
      }

      if (design.features?.includes('sideIntakes') || design.features?.includes('naca')) {
        const intake = context.createLinearGradient(x(-0.2 * spec.length), 0, x(-0.05 * spec.length), 0);
        intake.addColorStop(0, 'rgba(0,0,0,0.65)');
        intake.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = intake;
        context.fillRect(x(-0.2 * spec.length), y(0.74), x(-0.05 * spec.length) - x(-0.2 * spec.length), y(0.44) - y(0.74));
      }
    }),
  );
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(1 / spec.length, 1 / SIDE_HEIGHT);
  map.offset.set(0.5, -SIDE_BOTTOM / SIDE_HEIGHT);
  return map;
}

function plate(context: CanvasRenderingContext2D, cx: number, cy: number, text: string) {
  context.fillStyle = '#1a1a1a';
  context.fillRect(cx - 34, cy - 10, 68, 20);
  context.fillStyle = '#f4f4ee';
  context.fillRect(cx - 32, cy - 8, 64, 16);
  context.fillStyle = '#1d4fb8';
  context.fillRect(cx - 32, cy - 8, 7, 16);
  context.fillStyle = '#111';
  context.font = 'bold 11px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, cx + 4, cy + 1);
}

function roundLamp(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, inner: string) {
  context.fillStyle = '#d8dce0';
  context.beginPath();
  context.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  context.fill();
  const gradient = context.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 1, cx, cy, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.25, inner);
  gradient.addColorStop(1, shade(inner, 0.45));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
}

function lampBar(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  context.fillStyle = '#d8dce0';
  context.fillRect(x - 1, y - 1, w + 2, h + 2);
  const gradient = context.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.3, color);
  gradient.addColorStop(1, shade(color, 0.5));
  context.fillStyle = gradient;
  context.fillRect(x, y, w, h);
  context.fillStyle = 'rgba(0,0,0,0.25)';
  for (let px = x + 6; px < x + w; px += 8) context.fillRect(px, y, 1, h);
}

function slats(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  context.fillStyle = '#121214';
  context.fillRect(x, y, w, h);
  context.fillStyle = '#3a3c40';
  for (let py = y + 2; py < y + h; py += 4) context.fillRect(x + 1, py, w - 2, 1);
}

export type Lamp = { u: number; v: number };

// Rear fascia: lights, plate, grille and diffuser. Returns lamp centres in 0–1 texture space for brake glows.
export function rearTexture(design: CarDesign, spec: CarSpec) {
  const width = 256;
  const height = 96;
  const lamps: Lamp[] = [];
  const map = texture(
    canvas(width, height, (context) => {
      context.fillStyle = spec.color;
      context.fillRect(0, 0, width, height);
      const light = context.createLinearGradient(0, 0, 0, height);
      light.addColorStop(0, 'rgba(255,255,255,0.18)');
      light.addColorStop(1, 'rgba(0,0,0,0.35)');
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);

      slats(context, 0, height * 0.72, width, height * 0.28);
      const lampY = height * 0.3;
      const kind = design.taillights;
      if (kind === 'grille') {
        slats(context, 6, height * 0.12, width - 12, height * 0.4);
        for (const side of [-1, 1]) {
          const cx = width / 2 + side * width * 0.33;
          lampBar(context, cx - 30, height * 0.16, 60, height * 0.3, '#e0141a');
          lampBar(context, cx + side * 34 - 8, height * 0.16, 16, height * 0.3, '#ff9a1a');
          lamps.push({ u: cx / width, v: 1 - 0.31 });
        }
      } else if (kind === 'round' || kind === 'quad') {
        if (kind === 'quad') slats(context, width * 0.3, height * 0.18, width * 0.4, height * 0.26);
        const radius = kind === 'round' ? 11 : 13;
        for (const side of [-1, 1]) {
          for (const offset of [0.28, 0.4]) {
            const cx = width / 2 + side * width * offset;
            roundLamp(context, cx, lampY, radius, '#e0141a');
            lamps.push({ u: cx / width, v: 1 - lampY / height });
          }
        }
      } else if (kind === 'slim') {
        lampBar(context, 10, height * 0.2, width - 20, height * 0.12, '#d8121a');
        for (const side of [-1, 1]) lamps.push({ u: 0.5 + side * 0.36, v: 1 - 0.26 });
      } else {
        for (const side of [-1, 1]) {
          const cx = width / 2 + side * width * 0.33;
          lampBar(context, cx - 36, height * 0.18, 72, height * 0.22, '#e0141a');
          context.fillStyle = '#ff9a1a';
          context.fillRect(cx + side * 22 - 8, height * 0.18, 16, height * 0.22);
          lamps.push({ u: cx / width, v: 1 - 0.29 });
        }
      }
      plate(context, width / 2, height * 0.6, 'CFS 99');
    }),
    false,
  );
  return { map, lamps };
}

// Front fascia: intake mesh, indicators, fog lamps and plate.
export function frontTexture(design: CarDesign, spec: CarSpec) {
  return texture(
    canvas(256, 96, (context) => {
      context.fillStyle = spec.color;
      context.fillRect(0, 0, 256, 96);
      const light = context.createLinearGradient(0, 0, 0, 96);
      light.addColorStop(0, 'rgba(255,255,255,0.22)');
      light.addColorStop(1, 'rgba(0,0,0,0.3)');
      context.fillStyle = light;
      context.fillRect(0, 0, 256, 96);

      // Mesh intake across the lower nose.
      context.fillStyle = '#121214';
      context.fillRect(18, 52, 220, 34);
      context.strokeStyle = '#34363a';
      context.lineWidth = 1;
      context.beginPath();
      for (let px = 18; px < 238; px += 6) {
        context.moveTo(px, 52);
        context.lineTo(px + 6, 86);
        context.moveTo(px + 6, 52);
        context.lineTo(px, 86);
      }
      context.stroke();

      for (const side of [-1, 1]) {
        const cx = 128 + side * 92;
        lampBar(context, cx - 14, 30, 28, 10, '#ff9a1a');
        if (design.headlights === 'popup' || design.headlights === 'slim') roundLamp(context, cx - side * 26, 68, 7, '#ffe680');
      }
      plate(context, 128, 70, 'CFS 99');
    }),
    false,
  );
}

export function rimTexture(style: RimStyle) {
  return texture(
    canvas(64, 64, (context) => {
      context.fillStyle = '#141416';
      context.beginPath();
      context.arc(32, 32, 32, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#2c2c30';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(32, 32, 28, 0, Math.PI * 2);
      context.stroke();

      const rim = context.createRadialGradient(26, 24, 2, 32, 32, 21);
      rim.addColorStop(0, '#ffffff');
      rim.addColorStop(0.6, '#c4c8cc');
      rim.addColorStop(1, '#7c8086');
      context.fillStyle = rim;
      context.beginPath();
      context.arc(32, 32, 21, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = '#1c1d20';
      if (style === 'dial') {
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          context.beginPath();
          context.arc(32 + Math.cos(angle) * 12, 32 + Math.sin(angle) * 12, 4.5, 0, Math.PI * 2);
          context.fill();
        }
      } else {
        const count = style === 'five' ? 5 : style === 'turbine' ? 10 : 12;
        const gap = style === 'five' ? 0.42 : 0.16;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          context.beginPath();
          context.moveTo(32 + Math.cos(angle) * 7, 32 + Math.sin(angle) * 7);
          context.arc(32, 32, 19, angle - gap / 2 + (style === 'turbine' ? 0.2 : 0), angle + gap / 2);
          context.closePath();
          context.fill();
        }
      }
      context.fillStyle = '#9da2a8';
      context.beginPath();
      context.arc(32, 32, 5, 0, Math.PI * 2);
      context.fill();
    }),
    false,
    false,
  );
}

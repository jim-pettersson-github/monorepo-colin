import * as THREE from 'three';

export function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function canvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  draw(context);
  return element;
}

// Retro mode keeps small textures with nearest magnification for the chunky late-90s look.
let retroLook = false;

export function setRetroLook(on: boolean) {
  retroLook = on;
}

export function isRetro() {
  return retroLook;
}

// Texture resolution multiplier: the modern look draws the same art four times finer.
const detail = () => (retroLook ? 1 : 4);

export function texture(element: HTMLCanvasElement, repeat = true, pixelated = retroLook) {
  const result = new THREE.CanvasTexture(element);
  result.colorSpace = THREE.SRGBColorSpace;
  if (repeat) result.wrapS = result.wrapT = THREE.RepeatWrapping;
  if (pixelated) result.magFilter = THREE.NearestFilter;
  result.anisotropy = retroLook ? 4 : 8;
  return result;
}

function speckle(context: CanvasRenderingContext2D, width: number, height: number, colors: string[], count: number, seed: number, size = 1) {
  const random = seeded(seed);
  for (let i = 0; i < count; i++) {
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    context.fillRect(Math.floor(random() * width), Math.floor(random() * height), size, size);
  }
}

export function asphaltTexture(edge: string) {
  const k = detail();
  const size = 128 * k;
  return texture(
    canvas(size, size, (context) => {
      context.fillStyle = '#4b4d52';
      context.fillRect(0, 0, size, size);
      speckle(context, size, size, ['#45474c', '#505257', '#484a4f', '#55575c'], 9000 * k * k, 11);
      speckle(context, size, size, ['#3f4146', '#5a5c61'], 500 * k * k, 12, 2);
      if (k > 1) {
        // Soft patches and rubbered-in tyre lines read as real tarmac up close.
        const random = seeded(19);
        for (let i = 0; i < 40; i++) {
          const x = random() * size;
          const y = random() * size;
          const radius = 20 + random() * 60;
          const patch = context.createRadialGradient(x, y, 0, x, y, radius);
          patch.addColorStop(0, random() < 0.5 ? 'rgba(30,30,34,0.18)' : 'rgba(110,110,116,0.1)');
          patch.addColorStop(1, 'rgba(0,0,0,0)');
          context.fillStyle = patch;
          context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        context.fillStyle = 'rgba(18,18,22,0.22)';
        for (const lane of [0.36, 0.42, 0.58, 0.64]) context.fillRect(lane * size, 0, 0.035 * size, size);
      }
      // Darker racing line worn into the middle of the road.
      context.fillStyle = 'rgba(20, 20, 24, 0.16)';
      context.fillRect(40 * k, 0, 48 * k, size);
      context.fillStyle = edge;
      context.fillRect(3 * k, 0, 3 * k, size);
      context.fillRect(122 * k, 0, 3 * k, size);
    }),
  );
}

export function curbTexture() {
  return texture(
    canvas(8, 32, (context) => {
      context.fillStyle = '#d8231f';
      context.fillRect(0, 0, 8, 16);
      context.fillStyle = '#f2f2ee';
      context.fillRect(0, 16, 8, 16);
    }),
  );
}

export function grassTexture(base: string, shades: string[], seed: number) {
  const k = detail();
  const size = 64 * k;
  return texture(
    canvas(size, size, (context) => {
      context.fillStyle = base;
      context.fillRect(0, 0, size, size);
      speckle(context, size, size, shades, 1400 * k * k, seed);
      speckle(context, size, size, shades, 60 * k * k, seed + 1, 3);
      if (k > 1) {
        // Short blades of grass.
        const random = seeded(seed + 7);
        for (let i = 0; i < 6000; i++) {
          context.fillStyle = shades[Math.floor(random() * shades.length)];
          context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 1, 2 + Math.floor(random() * 3));
        }
      }
    }),
  );
}

export function checkerTexture() {
  return texture(
    canvas(16, 4, (context) => {
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 4; y++) {
          context.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
          context.fillRect(x, y, 1, 1);
        }
      }
    }),
  );
}

export function barrierTexture(kind: 'armco' | 'concrete' | 'wood') {
  return texture(
    canvas(32, 16, (context) => {
      if (kind === 'wood') {
        context.fillStyle = 'rgba(0,0,0,0)';
        context.clearRect(0, 0, 32, 16);
        context.fillStyle = '#8a6440';
        context.fillRect(0, 2, 32, 3);
        context.fillRect(0, 9, 32, 3);
        context.fillStyle = '#6a4a2e';
        context.fillRect(0, 4, 32, 1);
        context.fillRect(0, 11, 32, 1);
        context.fillRect(14, 0, 4, 16);
      } else if (kind === 'armco') {
        context.fillStyle = '#9aa3aa';
        context.fillRect(0, 0, 32, 16);
        context.fillStyle = '#c9d0d4';
        context.fillRect(0, 3, 32, 3);
        context.fillRect(0, 10, 32, 3);
        context.fillStyle = '#5a6168';
        context.fillRect(0, 7, 32, 1);
        context.fillRect(0, 14, 32, 2);
        context.fillRect(15, 0, 2, 16);
      } else {
        context.fillStyle = '#c9c6bd';
        context.fillRect(0, 0, 32, 16);
        speckle(context, 32, 16, ['#b9b6ad', '#d6d3ca'], 120, 5);
        context.fillStyle = '#d8231f';
        context.fillRect(0, 0, 16, 4);
        context.fillStyle = '#f4f4f4';
        context.fillRect(16, 0, 16, 4);
        context.fillStyle = '#8e8b83';
        context.fillRect(31, 0, 1, 16);
      }
    }),
  );
}

export function crowdTexture(seed: number) {
  return texture(
    canvas(64, 32, (context) => {
      context.fillStyle = '#2a2e38';
      context.fillRect(0, 0, 64, 32);
      speckle(context, 64, 32, ['#e8322b', '#f2c400', '#2a6fd6', '#f4f4f4', '#3fa34d', '#ff8a2a', '#d9b38c', '#8a5a3c'], 900, seed, 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      for (let y = 0; y < 32; y += 4) context.fillRect(0, y, 64, 1);
    }),
  );
}

export function signTexture(lines: string[], background: string, ink: string, accent?: string) {
  return texture(
    canvas(256, 64, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, 256, 64);
      if (accent) {
        context.fillStyle = accent;
        context.fillRect(0, 50, 256, 14);
      }
      context.fillStyle = ink;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `italic 900 ${lines.length > 1 ? 24 : 36}px Arial, sans-serif`;
      lines.forEach((line, index) => {
        context.fillText(line, 128, lines.length > 1 ? 18 + index * 24 : accent ? 26 : 32, 240);
      });
    }),
    false,
    false,
  );
}

export function chevronTexture() {
  return texture(
    canvas(32, 16, (context) => {
      context.fillStyle = '#111';
      context.fillRect(0, 0, 32, 16);
      context.fillStyle = '#f2c400';
      for (const x of [2, 13, 24]) {
        context.beginPath();
        context.moveTo(x, 2);
        context.lineTo(x + 6, 8);
        context.lineTo(x, 14);
        context.lineTo(x + 3, 14);
        context.lineTo(x + 9, 8);
        context.lineTo(x + 3, 2);
        context.fill();
      }
    }),
  );
}

export function windowsTexture(wall: string, frame: string, glass: string, timbered = false) {
  return texture(
    canvas(32, 32, (context) => {
      context.fillStyle = wall;
      context.fillRect(0, 0, 32, 32);
      if (timbered) {
        context.fillStyle = '#4a3020';
        context.fillRect(0, 0, 32, 2);
        context.fillRect(0, 15, 32, 2);
        context.fillRect(0, 30, 32, 2);
        context.fillRect(0, 0, 2, 32);
        context.beginPath();
        context.moveTo(2, 15);
        context.lineTo(6, 15);
        context.lineTo(16, 2);
        context.lineTo(12, 2);
        context.fill();
      }
      context.fillStyle = frame;
      context.fillRect(18, 6, 10, 11);
      context.fillStyle = glass;
      context.fillRect(19, 7, 8, 9);
      context.fillStyle = frame;
      context.fillRect(22, 7, 1, 9);
    }),
  );
}

export function cloudTexture(seed: number) {
  return texture(
    canvas(128, 64, (context) => {
      const random = seeded(seed);
      for (let i = 0; i < 22; i++) {
        const x = 20 + random() * 88;
        const y = 24 + random() * 20;
        const radius = 8 + random() * 16;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.75)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }),
    false,
    false,
  );
}

export function glowTexture(color: string) {
  return texture(
    canvas(64, 64, (context) => {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.2, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }),
    false,
    false,
  );
}

export function shadowTexture() {
  return texture(
    canvas(32, 64, (context) => {
      const gradient = context.createRadialGradient(16, 32, 4, 16, 32, 30);
      gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 64);
    }),
    false,
    false,
  );
}

export function ridgeTexture(color: string, seed: number, jagged: boolean) {
  return texture(
    canvas(512, 64, (context) => {
      const random = seeded(seed);
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, 64);
      let height = 30;
      for (let x = 0; x <= 512; x += jagged ? 4 : 16) {
        height = Math.max(6, Math.min(56, height + (random() - 0.5) * (jagged ? 18 : 14)));
        context.lineTo(x, jagged ? height + (x % 8 === 0 ? -6 : 4) : height);
      }
      context.lineTo(512, 64);
      context.fill();
    }),
  );
}

export function concreteTexture() {
  return texture(
    canvas(32, 32, (context) => {
      context.fillStyle = '#a9a69e';
      context.fillRect(0, 0, 32, 32);
      speckle(context, 32, 32, ['#9c9991', '#b5b2aa', '#a19e96'], 300, 21);
      context.fillStyle = '#4a4844';
      context.fillRect(0, 26, 32, 6);
      context.fillStyle = '#8c8982';
      context.fillRect(31, 0, 1, 32);
    }),
  );
}

export function pavingTexture() {
  return texture(
    canvas(32, 32, (context) => {
      context.fillStyle = '#d4d2cc';
      context.fillRect(0, 0, 32, 32);
      speckle(context, 32, 32, ['#c8c6c0', '#dcdad4', '#c2c0ba'], 200, 31);
      context.fillStyle = '#9c9a94';
      for (let i = 0; i < 32; i += 8) {
        context.fillRect(i, 0, 1, 32);
        context.fillRect(0, i, 32, 1);
      }
    }),
  );
}

import * as THREE from 'three';

export function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function canvas(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  draw(context);
  return element;
}

// Texture resolution multiplier: the art is drawn four times finer than its base grid.
const DETAIL = 4;

export function texture(element: HTMLCanvasElement, repeat = true, pixelated = false) {
  const result = new THREE.CanvasTexture(element);
  result.colorSpace = THREE.SRGBColorSpace;
  if (repeat) result.wrapS = result.wrapT = THREE.RepeatWrapping;
  if (pixelated) result.magFilter = THREE.NearestFilter;
  result.anisotropy = 8;
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
  const k = DETAIL;
  const size = 128 * k;
  return texture(
    canvas(size, size, (context) => {
      context.fillStyle = '#48494b';
      context.fillRect(0, 0, size, size);
      speckle(context, size, size, ['#454648', '#4c4d4f', '#47484a', '#505153'], 9000 * k * k, 11);
      speckle(context, size, size, ['#414244', '#555658'], 500 * k * k, 12);
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
        for (const lane of [0.36, 0.42, 0.58, 0.64]) {
          const wear = context.createLinearGradient((lane - 0.03) * size, 0, (lane + 0.03) * size, 0);
          wear.addColorStop(0, 'rgba(18,18,22,0)');
          wear.addColorStop(0.5, 'rgba(18,18,22,0.12)');
          wear.addColorStop(1, 'rgba(18,18,22,0)');
          context.fillStyle = wear;
          context.fillRect((lane - 0.03) * size, 0, size * 0.06, size);
        }
      }
      // Darker racing line worn into the middle of the road.
      context.fillStyle = 'rgba(20, 20, 24, 0.07)';
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
  const k = DETAIL;
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

// Circuit verges: grass mown in alternating bands across the track, half a texture each.
export function mowedGrassTexture(base: string, shades: string[], seed: number) {
  const grass = grassTexture(base, shades, seed);
  const element = grass.image as HTMLCanvasElement;
  const context = element.getContext('2d');
  if (context) {
    const { width, height } = element;
    context.fillStyle = 'rgba(255, 255, 230, 0.15)';
    context.fillRect(0, 0, width, height / 2);
    context.fillStyle = 'rgba(0, 20, 0, 0.13)';
    context.fillRect(0, height / 2, width, height / 2);
  }
  return grass;
}

export function gravelTexture() {
  const k = DETAIL;
  const size = 64 * k;
  return texture(
    canvas(size, size, (context) => {
      context.fillStyle = '#b3a283';
      context.fillRect(0, 0, size, size);
      speckle(context, size, size, ['#a39272', '#c4b495', '#9a8a6c', '#d2c4a6', '#8c7e64'], 2600 * k * k, 41);
      if (k > 1) {
        // Pebbles: a lit top edge and a shadow below give them body.
        const random = seeded(43);
        for (let i = 0; i < 2600; i++) {
          const x = random() * size;
          const y = random() * size;
          const radius = 1 + random() * 2.2;
          const tone = 150 + Math.floor(random() * 70);
          context.fillStyle = 'rgba(60, 50, 36, 0.35)';
          context.beginPath();
          context.ellipse(x + 0.6, y + 0.8, radius, radius * 0.75, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = `rgb(${tone + 12}, ${tone}, ${tone - 22})`;
          context.beginPath();
          context.ellipse(x, y, radius, radius * 0.75, 0, 0, Math.PI * 2);
          context.fill();
        }
      }
    }),
  );
}

// Diamond wire mesh with a top rail; transparent between the wires.
export function fenceTexture() {
  const k = DETAIL;
  const width = 64 * k;
  const height = 64 * k;
  return texture(
    canvas(width, height, (context) => {
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(70, 76, 84, 0.85)';
      context.lineWidth = Math.max(1, k * 0.45);
      const step = width / 10;
      for (let x = -height; x < width + height; x += step) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + height, height);
        context.moveTo(x, height);
        context.lineTo(x + height, 0);
        context.stroke();
      }
      context.fillStyle = '#5c636c';
      context.fillRect(0, 0, width, 2 * k);
      context.fillRect(0, height - 2 * k, width, 2 * k);
    }),
    true,
    false,
  );
}

export function checkerTexture() {
  const cell = 16;
  return texture(
    canvas(16 * cell, 4 * cell, (context) => {
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 4; y++) {
          context.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4';
          context.fillRect(x * cell, y * cell, cell, cell);
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
        // Two galvanised W-beam rails with daylight between and below them; posts are real geometry.
        context.clearRect(0, 0, 32, 16);
        for (const top of [1, 6]) {
          const rail = context.createLinearGradient(0, top, 0, top + 4);
          rail.addColorStop(0, '#e2e7ea');
          rail.addColorStop(0.35, '#a9b2b8');
          rail.addColorStop(0.55, '#6c757c');
          rail.addColorStop(0.8, '#b8c0c5');
          rail.addColorStop(1, '#7c858c');
          context.fillStyle = rail;
          context.fillRect(0, top, 32, 4);
        }
        context.fillStyle = '#4e555b';
        context.fillRect(15, 1, 1, 9);
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
  // One row of spectators per step: shirts, heads, a few raised arms and flags.
  const shirts = ['#e8322b', '#f2c400', '#2a6fd6', '#f4f4f4', '#3fa34d', '#ff8a2a', '#1d2a44', '#8a3c8a', '#5a5f66'];
  const skin = ['#f1c9a5', '#e0ac85', '#c68863', '#8d5a3c', '#f5d6bc'];
  const random = seeded(seed);
  return texture(
    canvas(512, 64, (context) => {
      context.fillStyle = '#3a3f48';
      context.fillRect(0, 0, 512, 64);
      context.fillStyle = '#2a2e36';
      context.fillRect(0, 44, 512, 20);
      for (let x = 4; x < 512; x += 12 + random() * 6) {
        if (random() < 0.12) continue;
        const lean = (random() - 0.5) * 3;
        const shirt = shirts[Math.floor(random() * shirts.length)];
        context.fillStyle = shirt;
        context.beginPath();
        context.roundRect(x - 5 + lean, 26, 11, 22, 4);
        context.fill();
        context.fillStyle = skin[Math.floor(random() * skin.length)];
        context.beginPath();
        context.arc(x + lean * 1.4, 19, 4.4, 0, Math.PI * 2);
        context.fill();
        if (random() < 0.15) {
          context.fillRect(x + 4 + lean, 6, 2, 20);
          if (random() < 0.5) {
            context.fillStyle = random() < 0.5 ? '#e8322b' : '#f2c400';
            context.fillRect(x + 6 + lean, 2, 9, 6);
          }
        }
        if (random() < 0.3) {
          context.fillStyle = random() < 0.5 ? '#1a1a1a' : shirt;
          context.fillRect(x - 4 + lean * 1.4, 13, 9, 3);
        }
      }
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(0, 48, 512, 16);
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

// City facade at 32 px per metre: two floors of two windows over 8 × 7 m, with frames, sills and floor cornices.
export function facadeDetailTexture(wall: string, lit: number, seed: number) {
  const random = seeded(seed);
  return texture(
    canvas(256, 224, (context) => {
      context.fillStyle = wall;
      context.fillRect(0, 0, 256, 224);
      speckle(context, 256, 224, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.1)'], 5000, seed + 1, 2);
      for (const floor of [0, 112]) {
        // Weathering darkens each storey toward its sill line.
        const grime = context.createLinearGradient(0, floor, 0, floor + 112);
        grime.addColorStop(0, 'rgba(0,0,0,0)');
        grime.addColorStop(1, 'rgba(0,0,0,0.12)');
        context.fillStyle = grime;
        context.fillRect(0, floor, 256, 112);
        context.fillStyle = 'rgba(255,255,255,0.28)';
        context.fillRect(0, floor, 256, 5);
        context.fillStyle = 'rgba(0,0,0,0.22)';
        context.fillRect(0, floor + 5, 256, 3);
        for (const center of [64, 192]) {
          const x = center - 30;
          const y = floor + 22;
          const glow = random() < lit;
          context.fillStyle = 'rgba(0,0,0,0.25)';
          context.fillRect(x - 6, y - 10, 72, 8);
          context.fillStyle = '#ece8de';
          context.fillRect(x - 5, y - 5, 70, 90);
          const glass = context.createLinearGradient(x, y, x + 40, y + 80);
          if (glow) {
            glass.addColorStop(0, '#ffe2a0');
            glass.addColorStop(1, '#e89a48');
          } else {
            glass.addColorStop(0, '#5d7590');
            glass.addColorStop(0.45, '#2b3a4c');
            glass.addColorStop(1, '#3c4e63');
          }
          context.fillStyle = glass;
          context.fillRect(x, y, 60, 80);
          if (!glow) {
            context.fillStyle = 'rgba(255,255,255,0.14)';
            context.beginPath();
            context.moveTo(x + 8, y);
            context.lineTo(x + 26, y);
            context.lineTo(x + 6, y + 40);
            context.lineTo(x, y + 40);
            context.fill();
          } else if (random() < 0.5) {
            context.fillStyle = 'rgba(120, 50, 20, 0.35)';
            context.fillRect(x, y, 14, 80);
            context.fillRect(x + 46, y, 14, 80);
          }
          // Recess: shadow under the lintel and down the left reveal.
          context.fillStyle = 'rgba(0,0,0,0.35)';
          context.fillRect(x, y, 60, 6);
          context.fillRect(x, y, 5, 80);
          context.fillStyle = '#ece8de';
          context.fillRect(x + 28, y, 4, 80);
          context.fillRect(x, y + 28, 60, 4);
          context.fillStyle = '#f4f1ea';
          context.fillRect(x - 8, y + 84, 76, 6);
          context.fillStyle = 'rgba(0,0,0,0.3)';
          context.fillRect(x - 8, y + 90, 76, 4);
        }
      }
    }),
  );
}

const shopColors = ['#b8352a', '#1f5e8a', '#2f7a4a', '#d9a020', '#5a3a6a', '#222222'];

// Street-level shop front over 8 × 4.5 m: sign board, striped awning and a lit window.
export function shopTexture(seed: number) {
  const random = seeded(seed);
  const color = shopColors[seed % shopColors.length];
  return texture(
    canvas(256, 144, (context) => {
      context.fillStyle = '#3a3634';
      context.fillRect(0, 0, 256, 144);
      context.fillStyle = color;
      context.fillRect(0, 8, 256, 26);
      context.fillStyle = 'rgba(255,255,255,0.85)';
      for (let x = 30; x < 220; x += 12 + random() * 10) context.fillRect(x, 16, 6 + random() * 6, 10);
      for (let x = 0; x < 256; x += 32) {
        context.fillStyle = x % 64 ? '#f2efe6' : color;
        context.beginPath();
        context.moveTo(x, 36);
        context.lineTo(x + 32, 36);
        context.lineTo(x + 32, 52);
        context.arc(x + 16, 52, 16, 0, Math.PI);
        context.fill();
      }
      const pane = context.createLinearGradient(0, 60, 0, 140);
      pane.addColorStop(0, random() < 0.5 ? '#ffd890' : '#cfe0ea');
      pane.addColorStop(1, '#6a5a48');
      context.fillStyle = pane;
      context.fillRect(12, 62, 150, 74);
      context.fillStyle = 'rgba(40,30,20,0.55)';
      for (let x = 20; x < 150; x += 22) context.fillRect(x, 100 + random() * 16, 14, 40);
      context.fillStyle = '#2a2624';
      context.fillRect(184, 62, 52, 82);
      context.fillStyle = '#5a4a3a';
      context.fillRect(190, 68, 40, 76);
      context.fillStyle = '#d8d0c0';
      context.fillRect(222, 104, 4, 4);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(0, 56, 256, 6);
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
      // Haze thickens toward the horizon so the hills sit back in the distance.
      context.globalCompositeOperation = 'source-atop';
      const haze = context.createLinearGradient(0, 0, 0, 64);
      haze.addColorStop(0, 'rgba(255, 255, 255, 0)');
      haze.addColorStop(1, 'rgba(255, 255, 255, 0.22)');
      context.fillStyle = haze;
      context.fillRect(0, 0, 512, 64);
      if (jagged) {
        // A darker tree line along the crest of the near hills.
        const crest = context.createLinearGradient(0, 0, 0, 64);
        crest.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        crest.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        context.fillStyle = crest;
        context.fillRect(0, 0, 512, 64);
      }
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

import sharp from 'sharp';

// Companions share Colin's painted poses but never his look: other hair, other clothes, and shoes.
// Run after prepare-painted-art.mjs; reads the exported Colin sprites and writes kompis-<n>-<pose>.webp.
const poses = [
  ['colin-0', '0'],
  ['colin-1', '1'],
  ['colin-2', '2'],
  ['colin-3', '3'],
  ['colin-back', 'back'],
  ['reach', 'reach'],
];
const companions = [
  { slot: 1, hair: [52, 34, 26], shirt: 128, vivid: 0.9, shorts: [88, 88, 92], shoes: [236, 232, 222] },
  { slot: 2, hair: [26, 22, 24], shirt: 354, vivid: 0.95, shorts: [150, 128, 92], shoes: [70, 52, 40] },
  { slot: 3, hair: [150, 62, 30], shirt: 282, vivid: 0.68, shorts: [70, 74, 82], shoes: [236, 232, 222] },
];

function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max / 255];
}

function rgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const shade = (color, light) => color.map((channel) => Math.max(0, Math.min(255, channel * light)));

for (const companion of companions) {
  for (const [source, pose] of poses) {
    const { data, info } = await sharp(`public/painted/${source}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    // The back view shows more hair and a higher collar.
    const head = height * (pose === 'back' ? 0.26 : 0.3);
    const waist = height * 0.53;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 8) continue;
        const [h, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
        let color = null;
        if (h > 190 && h < 270 && s > 0.22) {
          // Blue shirt and shorts: a new shirt colour, neutral shorts.
          color = y < waist ? rgb(companion.shirt, Math.min(1, s * companion.vivid), Math.min(1, v * 1.08)) : shade(companion.shorts, v / 0.5);
        } else if (y < head && h < 52 && s > 0.42 && (v < 0.56 || (h >= 24 && !(s < 0.62 && v > 0.84)))) {
          color = shade(companion.hair, v / 0.62);
        } else if (y > height * 0.88 && h < 40 && s > 0.2) {
          color = shade(companion.shoes, Math.min(1.05, 0.45 + v * 0.6));
        }
        if (color) [data[i], data[i + 1], data[i + 2]] = color;
      }
    }
    await sharp(data, { raw: { width, height, channels: 4 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(`public/painted/kompis-${companion.slot}-${pose}.webp`);
  }
}
console.log('Prepared three companion characters.');

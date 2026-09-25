import sharp from 'sharp';

// Keep the generated alpha and each pose's natural proportions. Runtime height
// ratios preserve Colin's head size when he lowers himself to the ground.
const source = 'art-source/colin-idle.png';
const { hasAlpha } = await sharp(source).metadata();
if (!hasAlpha) throw new Error('Colin idle poses need actual alpha transparency');
const cells = [
  ['crouch', 180, 0, 290, 480],
  ['squat', 650, 65, 260, 415],
  ['sit', 1080, 105, 350, 375],
  ['scratch', 645, 485, 230, 539],
  ['jump', 1080, 485, 305, 490],
];
for (const [name, left, top, width, height] of cells) {
  const cell = await sharp(source).extract({ left, top, width, height }).toBuffer();
  await sharp(cell).trim({ background: '#00000000', threshold: 10 }).webp({ quality: 92, alphaQuality: 100 }).toFile(`public/painted/colin-${name}.webp`);
}

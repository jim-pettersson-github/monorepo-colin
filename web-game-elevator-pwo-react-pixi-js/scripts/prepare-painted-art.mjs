import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// Export generated source plates and sprite-sheet cells without changing their artwork.
await mkdir('public/painted', { recursive: true });
const output = (name) => `public/painted/${name}.webp`;
for (const name of ['hotel-wall', 'mall-wall', 'house-wall', 'outside-sky']) {
  await sharp(`art-source/${name}.png`).resize({ width: 1650, withoutEnlargement: true }).webp({ quality: 88 }).toFile(output(name));
}

const materials = 'art-source/materials.png';
const { width, height } = await sharp(materials).metadata();
for (const [index, name] of ['wood', 'brass', 'marble', 'glass'].entries()) {
  const left = Math.floor(((index % 2) * width) / 2);
  const top = Math.floor((Math.floor(index / 2) * height) / 2);
  await sharp(materials)
    .extract({ left, top, width: Math.floor(width / 2), height: Math.floor(height / 2) })
    .resize(512, 512)
    .webp({ quality: 88 })
    .toFile(output(name));
}

for (const [name, count, prefix] of [
  ['colin', 4, 'colin'],
  ['passengers', 3, 'passenger'],
]) {
  const source = `art-source/${name}.png`;
  const meta = await sharp(source).metadata();
  if (!meta.hasAlpha) throw new Error(`${source} must have a transparent background`);
  for (let index = 0; index < count; index++) {
    const left = Math.floor((index * meta.width) / count);
    const right = Math.floor(((index + 1) * meta.width) / count);
    const cell = await sharp(source)
      .extract({ left, top: 0, width: right - left, height: meta.height })
      .toBuffer();
    await sharp(cell)
      .trim({ background: '#00000000', threshold: 10 })
      .resize({ height: 640 })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(output(`${prefix}-${index}`));
  }
}
for (const name of ['hotel', 'mall', 'house'])
  for (const level of ['entry', 'upper'])
    await sharp(`art-source/room-${name}-${level}.png`)
      .resize(1448, 1086)
      .webp({ quality: 91 })
      .toFile(output(`room-${name}-${level}`));

const props = 'art-source/floor-props.png';
const propMeta = await sharp(props).metadata();
if (!propMeta.hasAlpha) throw new Error('Floor props need actual alpha transparency');
for (let index = 0; index < 22; index++) {
  const left = Math.floor(((index % 4) * propMeta.width) / 4);
  const top = Math.floor((Math.floor(index / 4) * propMeta.height) / 6);
  const cell = await sharp(props)
    .extract({ left, top, width: Math.floor(propMeta.width / 4), height: Math.floor(propMeta.height / 6) })
    .toBuffer();
  await sharp(cell)
    .trim({ background: '#00000000', threshold: 10 })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(output(`prop-${index}`));
}
await sharp('art-source/depth-reach.png')
  .trim({ background: '#00000000', threshold: 10 })
  .resize({ height: 800 })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(output('reach'));
await sharp('art-source/colin-back.png')
  .trim({ background: '#00000000', threshold: 10 })
  .resize({ height: 800 })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(output('colin-back'));
console.log('Prepared painted rooms, materials, characters, and floor landmarks.');

import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await mkdir('public/depth-study', { recursive: true });
await sharp('art-source/depth-room.png').resize(1448, 1086).webp({ quality: 91 }).toFile('public/depth-study/room.webp');
const source = sharp('art-source/depth-reach.png');
if (!(await source.metadata()).hasAlpha) throw new Error('The reaching sprite must have a transparent background');
await source
  .trim({ background: '#00000000', threshold: 10 })
  .resize({ height: 800 })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile('public/depth-study/reach.webp');
console.log('Prepared the isolated depth study background and reaching sprite.');

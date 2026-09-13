import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

for (const size of [192, 512]) {
  await sharp(fileURLToPath(new URL('../public/icon.svg', import.meta.url)))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)));
}

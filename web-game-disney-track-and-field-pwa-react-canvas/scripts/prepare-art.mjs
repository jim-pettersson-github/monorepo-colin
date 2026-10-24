import sharp from 'sharp';

await sharp(new URL('../art-source/stadium.png', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'))
  .webp({ quality: 88 })
  .toFile(new URL('../public/art/stadium.webp', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'));

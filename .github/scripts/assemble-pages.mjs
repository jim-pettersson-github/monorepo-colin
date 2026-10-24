import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const site = resolve(root, 'pages-site');
await mkdir(site, { recursive: true });
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'monorepo-colin';
const games = [
  ['web-game-elevator-pwo-react-pixi-js', 'colin-elevator'],
  ['web-game-alfred-lego-fc-pwa-react-three-js', 'alfred-fc'],
  ['web-game-charlie-for-speed-pwa-react-three-js', 'charlie-fs'],
  ['web-game-disney-track-and-field-pwa-react-canvas', 'sagospelen'],
];
for (const [folder, slug] of games) {
  const dist = resolve(root, folder, 'dist');
  const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'));
  if (manifest.scope !== `/${repository}/${slug}/`) throw new Error(`Build ${folder} with VITE_BASE_PATH=/${repository}/${slug}/ before assembling`);
  await cp(dist, resolve(site, slug), { recursive: true });
}
for (const file of ['index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'assets'])
  await cp(resolve(root, 'game-selector', file), resolve(site, file), { recursive: true });
console.log('Assembled root selector plus colin-elevator/, alfred-fc/, charlie-fs/ and sagospelen/.');

const hash = createHash('sha256');
for (const file of [
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'assets/colin.webp',
  'assets/alfred.svg',
  'assets/charlie.svg',
  'assets/athletics.webp',
])
  hash.update(await readFile(resolve(root, 'game-selector', file)));
const worker = await readFile(resolve(root, 'game-selector/sw.js'), 'utf8');
await writeFile(resolve(site, 'sw.js'), worker.replace('spelhornan-v1', `spelhornan-${hash.digest('hex').slice(0, 12)}`));

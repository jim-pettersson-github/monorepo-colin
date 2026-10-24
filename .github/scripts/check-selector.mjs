import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const result = spawnSync(
  process.execPath,
  [resolve(root, 'web-game-disney-track-and-field-pwa-react-canvas/node_modules/@biomejs/biome/bin/biome'), 'check', '.', '../.github/scripts'],
  { cwd: resolve(root, 'game-selector'), stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;

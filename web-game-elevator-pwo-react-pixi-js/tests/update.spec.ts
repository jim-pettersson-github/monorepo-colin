import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { showControls } from './room-helpers';

test('downloads an update without interrupting play, then applies it with the save intact', async ({ page }) => {
  const base = process.env.VITE_BASE_PATH || '/';
  const root = resolve('dist');
  let revision = 1;
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.webmanifest': 'application/manifest+json',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = resolve(root, pathname.slice(base.length) || 'index.html');
    if (!pathname.startsWith(base) || !file.startsWith(`${root}${sep}`)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(file === resolve(root, 'sw.js') ? `${content.toString()}\n// Test deployment ${revision}` : content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing update test server');
  try {
    await page.goto(`http://127.0.0.1:${address.port}${base}`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.getByRole('button', { name: 'Spela', exact: true }).click();
    await showControls(page);
    await expect(page.locator('.game-scene canvas')).toBeVisible();
    await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
    await expect(page.getByText('Du har den senaste versionen.')).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}'));
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });

    revision++;
    await page.getByRole('button', { name: 'Sök efter uppdatering', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Uppdatera spelet', exact: true })).toBeEnabled();
    expect(navigations).toBe(0);
    await page.getByRole('button', { name: 'Uppdatera spelet', exact: true }).click();
    await expect.poll(() => navigations).toBe(1);
    await expect(page.locator('.game-scene canvas')).toBeVisible();
    const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem('colin-game-v1') ?? '{}'));
    expect(resumed).toMatchObject({ version: saved.version, started: true, random: saved.random, player: saved.player, settings: saved.settings });
    // The resumed simulation advances its clock and passenger timers immediately.
    expect(resumed.time).toBeGreaterThanOrEqual(saved.time);
    await expect(page.getByRole('dialog')).not.toBeVisible();
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});

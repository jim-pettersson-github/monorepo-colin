const CACHE = 'spelhornan-v1';
const root = new URL('./', self.location.href);
const files = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'assets/colin.webp',
  'assets/alfred.svg',
  'assets/charlie.svg',
  'assets/athletics.webp',
].map((file) => new URL(file, root).href);
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(files))));
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('spelhornan-') && name !== CACHE).map((name) => caches.delete(name)))),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== root.origin) return;
  const home = url.pathname === root.pathname || url.pathname === `${root.pathname}index.html`;
  if (home && event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', root).href)));
    return;
  }
  if (files.includes(url.href)) event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  // Game paths always use their own workers and caches.
});

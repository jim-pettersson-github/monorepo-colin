import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE_PATH || '/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('VITE_BASE_PATH must start and end with /');

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      base,
      scope: base,
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: base,
        name: 'Alfred FC',
        short_name: 'Alfred FC',
        description: 'Fotboll i en värld av byggklossar. Under utveckling.',
        lang: 'sv',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#101e2b',
        theme_color: '#101e2b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cacheId: 'alfred-fc',
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{html,js,css,json,svg,png,webp,woff2,mp3,ogg,wav}'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 4012, strictPort: true },
  preview: { host: '127.0.0.1', port: 4013, strictPort: true },
});

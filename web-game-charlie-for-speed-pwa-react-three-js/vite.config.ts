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
        name: 'Charlie for Speed',
        short_name: 'Charlie for Speed',
        description: 'Sportbilsracing på riktiga banor. Under utveckling.',
        lang: 'sv',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#0b0f1e',
        theme_color: '#0b0f1e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cacheId: 'charlie-for-speed',
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{html,js,css,json,svg,png,webp,woff2,mp3,ogg,wav}'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 4014, strictPort: true },
  preview: { host: '127.0.0.1', port: 4015, strictPort: true },
});

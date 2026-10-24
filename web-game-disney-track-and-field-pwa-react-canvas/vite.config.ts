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
        name: 'Sagospelen',
        short_name: 'Sagospelen',
        description: 'Spring, hoppa och kasta med Disney-figurer.',
        lang: 'sv',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8f3e7',
        theme_color: '#292055',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        cacheId: 'sagospelen',
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{html,js,css,json,svg,png,webp,woff2}'],
      },
    }),
  ],
  server: { host: '127.0.0.1', port: 4016, strictPort: true },
  preview: { host: '127.0.0.1', port: 4017, strictPort: true },
});

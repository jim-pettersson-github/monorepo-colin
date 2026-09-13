import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { menuPalette, palette } from './palette';
import { registerOfflineMenu } from './pwa';
import './styles.css';

for (const [role, color] of Object.entries(palette)) {
  document.documentElement.style.setProperty(`--${role}`, color);
}
for (const [role, color] of Object.entries(menuPalette)) {
  document.documentElement.style.setProperty(`--menu-${role}`, color);
}
for (const material of ['wood', 'brass', 'glass']) {
  document.documentElement.style.setProperty(`--menu-${material}-texture`, `url("${import.meta.env.BASE_URL}painted/${material}.webp")`);
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
const ArtStudy = lazy(() => import('./components/ArtStudy').then((module) => ({ default: module.ArtStudy })));
const DepthStudy = lazy(() => import('./components/DepthStudy').then((module) => ({ default: module.DepthStudy })));
const view = new URLSearchParams(window.location.search).get('view');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p role='status'>Laddar…</p>}>{view === 'art' ? <ArtStudy /> : view === 'depth' ? <DepthStudy /> : <App />}</Suspense>
  </StrictMode>,
);

registerOfflineMenu();

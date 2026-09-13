import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { palette } from './palette';
import { registerOfflineMenu } from './pwa';
import './styles.css';

for (const [role, color] of Object.entries(palette)) {
  document.documentElement.style.setProperty(`--${role}`, color);
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
const ArtStudy = lazy(() => import('./components/ArtStudy').then((module) => ({ default: module.ArtStudy })));
const artStudy = new URLSearchParams(window.location.search).get('view') === 'art';

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p role='status'>Laddar…</p>}>{artStudy ? <ArtStudy /> : <App />}</Suspense>
  </StrictMode>,
);

registerOfflineMenu();

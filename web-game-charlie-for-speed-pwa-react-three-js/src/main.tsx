import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { palette } from './palette';
import { registerOfflineApp } from './pwa';
import './styles.css';

for (const [role, color] of Object.entries(palette)) {
  document.documentElement.style.setProperty(`--${role}`, color);
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerOfflineApp();

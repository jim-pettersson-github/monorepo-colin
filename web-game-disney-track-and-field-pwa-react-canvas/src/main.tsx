import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerOfflineApp } from './pwa';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
registerOfflineApp();

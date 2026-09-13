import { registerSW } from 'virtual:pwa-register';

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'latest' | 'offline' | 'error' | 'applying';
let status: UpdateStatus = 'idle';
let registration: ServiceWorkerRegistration | undefined;
let activate: (() => Promise<void>) | undefined;
let reloadRequested = false;
let lastCheck = 0;
const listeners = new Set<() => void>();

function publish(value: UpdateStatus) {
  status = value;
  for (const listener of listeners) listener();
}

export const gameUpdates = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => status,
  async check() {
    if (['checking', 'downloading', 'ready', 'applying'].includes(status)) return;
    if (!navigator.onLine) return publish('offline');
    if (!registration) return publish('error');
    lastCheck = Date.now();
    publish('checking');
    try {
      await registration.update();
      if (registration.waiting) publish('ready');
      else if (registration.installing) {
        publish('downloading');
        const worker = registration.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') publish(registration?.waiting ? 'ready' : 'latest');
          if (worker.state === 'redundant') publish('error');
        });
      } else publish('latest');
    } catch {
      publish('error');
    }
  },
  async apply() {
    if (status !== 'ready' || !activate) return;
    reloadRequested = true;
    publish('applying');
    try {
      // Another open tab may already have activated the downloaded worker.
      const worker = registration?.waiting;
      if (!worker) window.location.reload();
      else {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated' && reloadRequested) {
            reloadRequested = false;
            window.location.reload();
          }
          if (worker.state === 'redundant') {
            reloadRequested = false;
            publish('error');
          }
        });
        await activate();
      }
    } catch {
      reloadRequested = false;
      publish('error');
    }
  },
};

export function registerOfflineMenu() {
  if (!import.meta.env.PROD) return;

  activate = registerSW({
    immediate: true,
    onNeedRefresh: () => publish('ready'),
    onNeedReload() {
      if (reloadRequested) {
        reloadRequested = false;
        window.location.reload();
      } else publish('ready');
    },
    onRegisteredSW(_url, value) {
      registration = value;
      void gameUpdates.check();
      window.addEventListener('online', () => void gameUpdates.check());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastCheck > 60_000) void gameUpdates.check();
      });
    },
    onRegisterError(error) {
      console.warn('Offline installation unavailable; the online menu still works.', error);
    },
  });
}

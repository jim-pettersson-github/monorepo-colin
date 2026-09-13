import { registerSW } from 'virtual:pwa-register';

export function registerOfflineMenu() {
  if (!import.meta.env.PROD) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      const checkForUpdate = () => {
        if (navigator.onLine) void registration?.update().catch(() => undefined);
      };
      checkForUpdate();
      window.addEventListener('online', checkForUpdate);
    },
    onRegisterError(error) {
      console.warn('Offline installation unavailable; the online menu still works.', error);
    },
  });
}

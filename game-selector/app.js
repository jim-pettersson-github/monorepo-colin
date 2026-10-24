// Legacy study bookmarks still open the elevator game. Saves stay on this origin.
const query = new URLSearchParams(location.search);
if (['art', 'depth', 'cafe'].includes(query.get('view'))) location.replace(`colin-elevator/${location.search}${location.hash}`);
const button = document.getElementById('update');
const status = document.getElementById('update-status');
let registration;
let requested = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requested) location.reload();
  });
  navigator.serviceWorker
    .register('sw.js')
    .then((value) => {
      registration = value;
      button.hidden = false;
      const ready = () => {
        button.textContent = 'Uppdatera spelmenyn';
        status.textContent = 'En ny spelmeny är redo. Uppdatera när det passar dig.';
      };
      if (value.waiting) ready();
      value.addEventListener('updatefound', () => {
        const worker = value.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && value.waiting) ready();
        });
      });
      const check = () =>
        value.update().catch(() => {
          status.textContent = 'Uppdateringar kan sökas när du är online.';
        });
      check();
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    })
    .catch(() => {
      status.textContent = 'Spelen kan öppnas online. Offline-menyn kunde inte aktiveras.';
    });
  button.addEventListener('click', async () => {
    if (registration?.waiting) {
      requested = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      try {
        await registration?.update();
        if (!registration?.waiting) status.textContent = 'Spelmenyn är uppdaterad. Varje spel har även en egen uppdateringsknapp.';
      } catch {
        status.textContent = 'Anslut till internet för att söka efter uppdateringar.';
      }
    }
  });
}

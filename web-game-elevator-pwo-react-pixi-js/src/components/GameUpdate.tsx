import { useSyncExternalStore } from 'react';
import { gameUpdates } from '../pwa';

const messages = {
  idle: 'Sök efter en ny version av spelet.',
  checking: 'Letar efter uppdateringar…',
  downloading: 'Hämtar den nya versionen…',
  ready: 'En ny version är redo. Uppdatera när det passar dig.',
  latest: 'Du har den senaste versionen.',
  offline: 'Anslut till internet för att söka efter uppdateringar.',
  error: 'Kunde inte söka efter uppdateringar. Försök igen.',
  applying: 'Öppnar den nya versionen…',
};

export function GameUpdate({ onSave }: { onSave: () => void }) {
  const status = useSyncExternalStore(gameUpdates.subscribe, gameUpdates.getSnapshot);
  if (!import.meta.env.PROD) return null;
  return (
    <section className='game-update' aria-label='Speluppdateringar'>
      <p role='status'>{messages[status]}</p>
      <button
        type='button'
        disabled={['checking', 'downloading', 'applying'].includes(status)}
        onClick={() => {
          if (status === 'ready') {
            onSave();
            void gameUpdates.apply();
          } else void gameUpdates.check();
        }}
      >
        {status === 'ready' || status === 'applying' ? 'Uppdatera spelet' : 'Sök efter uppdatering'}
      </button>
    </section>
  );
}

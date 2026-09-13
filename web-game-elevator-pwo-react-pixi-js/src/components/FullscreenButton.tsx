import { useEffect, useState } from 'react';

export function FullscreenButton({ compact = false }: { compact?: boolean }) {
  const [active, setActive] = useState(!!document.fullscreenElement);
  const [installedFullscreen, setInstalledFullscreen] = useState(matchMedia('(display-mode: fullscreen)').matches);
  const [error, setError] = useState('');

  useEffect(() => {
    const display = matchMedia('(display-mode: fullscreen)');
    const update = () => {
      setActive(!!document.fullscreenElement);
      setInstalledFullscreen(display.matches);
      setError('');
    };
    document.addEventListener('fullscreenchange', update);
    display.addEventListener('change', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      display.removeEventListener('change', update);
    };
  }, []);

  if (!document.fullscreenEnabled || (installedFullscreen && !active)) return null;
  const label = active ? 'Avsluta helskärm' : 'Helskärm';

  return (
    <span className='fullscreen-control'>
      <button
        type='button'
        className={compact ? 'round-control' : 'about-button'}
        aria-label={label}
        title={label}
        aria-pressed={active}
        onClick={async () => {
          setError('');
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          } catch {
            setError('Helskärm kunde inte ändras. Försök igen.');
          }
        }}
      >
        <span aria-hidden='true'>⛶</span>
        {!compact && label}
      </button>
      {error && (
        <span className='fullscreen-error' role='status'>
          {error}
        </span>
      )}
    </span>
  );
}

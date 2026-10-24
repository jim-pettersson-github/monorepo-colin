import { useSyncExternalStore } from 'react';
import { gameSound } from '../game/sound';
import './sound-controls.css';

export function SoundToggle({ className = '' }: { className?: string }) {
  useSyncExternalStore(gameSound.subscribe, gameSound.getSnapshot);
  const label = gameSound.enabled ? 'Stäng av ljud' : 'Slå på ljud';
  return (
    <button
      type='button'
      className={`sound-toggle ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={gameSound.enabled}
      onClick={() => gameSound.setEnabled(!gameSound.enabled)}
    >
      <svg
        viewBox='0 0 24 24'
        width='23'
        height='23'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        <path d='M11 4 5 9H2v6h3l6 5V4Z' />
        {gameSound.enabled ? (
          <>
            <path d='M15 8a6 6 0 0 1 0 8' />
            <path d='M18 4a11 11 0 0 1 0 16' />
          </>
        ) : (
          <path d='m16 9 6 6m0-6-6 6' />
        )}
      </svg>
    </button>
  );
}

export function SoundSettings() {
  useSyncExternalStore(gameSound.subscribe, gameSound.getSnapshot);
  return (
    <section className='sound-settings' aria-label='Ljudinställningar'>
      <SoundToggle />
      <label>
        Ljudeffekter · {gameSound.enabled ? `${gameSound.volume}%` : 'Av'}
        <input
          type='range'
          aria-label='Ljudvolym'
          min='0'
          max='100'
          step='5'
          value={gameSound.volume}
          onChange={(event) => gameSound.setVolume(Number(event.target.value))}
        />
      </label>
    </section>
  );
}

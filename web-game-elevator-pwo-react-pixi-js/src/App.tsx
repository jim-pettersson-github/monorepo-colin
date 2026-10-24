import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';
import { Together } from './components/Together';
import { copy } from './copy';
import { GameSession } from './game/session';
import type { GuestSession } from './game/shared-guest';
import { SharedHost } from './game/shared-host';
import type { Storage } from './game/storage';

// Recreate the session from its save when development refresh replaces game logic.
// @refresh reset

const MenuScene = lazy(() => import('./components/MenuScene').then((module) => ({ default: module.MenuScene })));
const GameView = lazy(() => import('./components/GameView').then((module) => ({ default: module.GameView })));

const noHost = { subscribe: () => () => {}, getSnapshot: () => 0 };
const storage: Storage = { getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };

export function App() {
  const about = useRef<HTMLDialogElement>(null);
  const togetherPanel = useRef<HTMLDialogElement>(null);
  const [session] = useState(() => new GameSession(storage));
  const [playing, setPlaying] = useState(session.state.started);
  // Shared play: this device either hosts Colin's world or visits someone else's as a companion.
  const [host, setHost] = useState<SharedHost | null>(null);
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [farewell, setFarewell] = useState('');
  const active = guest ?? session;
  useSyncExternalStore((host ?? noHost).subscribe, (host ?? noHost).getSnapshot);

  useEffect(() => {
    const visibility = () => active.pause(active.paused, document.hidden);
    const save = () => active.save();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', save);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', save);
      active.audio.pause();
    };
  }, [active]);

  const play = () => {
    togetherPanel.current?.close();
    session.state.started = true;
    session.pause(false);
    session.audio.unlock();
    session.save();
    setPlaying(true);
  };
  const startHost = () => {
    host?.stop();
    // Guests see a calm pause until Colin is back in the game.
    if (!playing) session.pause(true);
    const shared = new SharedHost(session);
    setHost(shared);
    void shared.start();
  };
  const stopHost = () => {
    host?.stop();
    setHost(null);
  };
  const joined = (visit: GuestSession) => {
    togetherPanel.current?.close();
    // The single-player session waits, untouched and unsaved, until the visit ends.
    session.pause(true);
    setFarewell('');
    visit.onEnd = (message) => {
      setFarewell(message);
      setGuest(null);
    };
    setGuest(visit);
  };
  const together = (inGame: boolean) => (
    <Together
      session={session}
      host={host}
      guest={guest}
      storage={storage}
      inGame={inGame}
      onHost={startHost}
      onStopHost={stopHost}
      onPlay={play}
      onJoined={joined}
      onLeave={() => guest?.leave()}
    />
  );
  const loading = (
    <main className='menu'>
      <p role='status'>{copy.loading}</p>
    </main>
  );

  if (guest)
    return (
      <Suspense fallback={loading}>
        <GameView session={guest} together={together(true)} onMenu={() => guest.leave()} />
      </Suspense>
    );

  if (playing)
    return (
      <Suspense fallback={loading}>
        <GameView
          session={session}
          together={host ? together(true) : undefined}
          onMenu={() => {
            session.pause(true);
            setPlaying(false);
          }}
        />
      </Suspense>
    );

  return (
    <main className='menu'>
      <header className='masthead'>
        <a className='brand' href={import.meta.env.BASE_URL} aria-label={copy.title}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt='' width='36' height='36' />
          <span>{copy.brand}</span>
        </a>
        <span className='edition'>{copy.edition}</span>
        <a className='all-games-link' href={`${import.meta.env.BASE_URL}../`}>
          {copy.allGames}
        </a>
      </header>

      <div className='menu-content'>
        <section className='welcome' aria-labelledby='game-title'>
          <p className='eyebrow'>
            <span className='tiny-line' />
            {copy.eyebrow}
          </p>
          <h1 id='game-title'>
            {copy.titleName}
            <br />
            <em>{copy.titleAdventure}</em>
          </h1>
          <p className='intro'>{copy.intro}</p>
          <p className='description'>{copy.description}</p>
          <div className='menu-actions'>
            <button className='play-button' type='button' onClick={play}>
              <span aria-hidden='true'>▷</span>
              {session.state.started ? 'Fortsätt' : copy.play}
              <span aria-hidden='true'>→</span>
            </button>
            <button className='about-button together-button' type='button' onClick={() => togetherPanel.current?.showModal()}>
              Spela tillsammans
              <span aria-hidden='true'>{host ? `· ${host.room?.code ?? '…'}` : '↗'}</span>
            </button>
            {farewell && (
              <p className='together-farewell' role='status'>
                {farewell}
              </p>
            )}
            <p className='coming-soon'>Tre hus. Helt i din egen takt.</p>
            <FullscreenButton />
            <button className='about-button' type='button' onClick={() => about.current?.showModal()}>
              {copy.about}
              <span aria-hidden='true'>↗</span>
            </button>
          </div>
        </section>

        <figure className='illustration' aria-label={copy.sceneLabel}>
          <div className='scene-caption'>
            <span>{copy.welcome}</span>
            <span>{copy.floor}</span>
          </div>
          <Suspense
            fallback={
              <div className='scene'>
                <p className='scene-loading' role='status'>
                  {copy.loading}
                </p>
              </div>
            }
          >
            <MenuScene />
          </Suspense>
          <figcaption>
            <span className='status-dot' />
            {copy.caption}
          </figcaption>
        </figure>
      </div>

      <footer className='menu-footer'>
        <span>{copy.footer}</span>
        <a href={`${import.meta.env.BASE_URL}?view=art`}>Jämför tre konststilar ↗</a>
      </footer>

      <dialog ref={about} className='info-panel' aria-labelledby='about-title'>
        <form method='dialog'>
          <button className='close-button' type='submit' aria-label={copy.close}>
            ×
          </button>
        </form>
        <p className='eyebrow'>{copy.brand}</p>
        <h2 id='about-title'>{copy.panelTitle}</h2>
        <p className='panel-intro'>{copy.panelIntro}</p>
        <p>{copy.panelBody}</p>
        <p className='panel-note'>{copy.panelNote}</p>
        <GameUpdate onSave={() => session.save()} />
      </dialog>

      <dialog ref={togetherPanel} className='info-panel' aria-labelledby='together-title'>
        <form method='dialog'>
          <button className='close-button' type='submit' aria-label={copy.close}>
            ×
          </button>
        </form>
        <p className='eyebrow'>EN SPELARE PÅ VARJE ENHET</p>
        <h2 id='together-title'>Spela tillsammans</h2>
        <p className='panel-intro'>Två till fyra kompisar i samma hus. Alla ser samma hissar, dörrar och lampor.</p>
        {together(false)}
      </dialog>
    </main>
  );
}

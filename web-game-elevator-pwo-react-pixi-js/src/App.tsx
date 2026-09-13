import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';
import { copy } from './copy';
import { GameSession } from './game/session';

const MenuScene = lazy(() => import('./components/MenuScene').then((module) => ({ default: module.MenuScene })));
const GameView = lazy(() => import('./components/GameView').then((module) => ({ default: module.GameView })));

export function App() {
  const about = useRef<HTMLDialogElement>(null);
  const [session] = useState(() => new GameSession({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }));
  const [playing, setPlaying] = useState(session.state.started);

  useEffect(() => {
    const visibility = () => session.pause(session.paused, document.hidden);
    const save = () => session.save();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', save);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', save);
      session.audio.pause();
    };
  }, [session]);

  if (playing)
    return (
      <Suspense
        fallback={
          <main className='menu'>
            <p role='status'>{copy.loading}</p>
          </main>
        }
      >
        <GameView
          session={session}
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
            <button
              className='play-button'
              type='button'
              onClick={() => {
                session.state.started = true;
                session.pause(false);
                session.audio.unlock();
                session.save();
                setPlaying(true);
              }}
            >
              <span aria-hidden='true'>▷</span>
              {session.state.started ? 'Fortsätt' : copy.play}
              <span aria-hidden='true'>→</span>
            </button>
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
    </main>
  );
}

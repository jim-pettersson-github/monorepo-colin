import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';
import { PitchPreview } from './components/PitchPreview';

export function App() {
  return (
    <main className='app-shell'>
      <header className='app-header'>
        <a className='wordmark' href={import.meta.env.BASE_URL} aria-label='Alfred FC startsida'>
          <span className='club-mark' aria-hidden='true'>
            A
          </span>
          ALFRED <span>FC</span>
        </a>
        <FullscreenButton />
      </header>
      <section className='intro' aria-labelledby='intro-title'>
        <div className='intro-copy'>
          <p className='eyebrow'>EN LITEN PLAN. STORA DRÖMMAR.</p>
          <h1 id='intro-title'>
            Här börjar
            <br />
            <span>Alfred FC.</span>
          </h1>
          <p className='description'>Fotboll i en värld av byggklossar.</p>
          <div className='foundation-note'>
            <span className='status-dot' aria-hidden='true' />
            <div>
              <strong>Grunden är på plats</strong>
              <p>Det här är en förhandsvisning. Matcherna kommer i nästa steg.</p>
            </div>
          </div>
        </div>
        <div className='pitch-card'>
          <div className='pitch-caption'>
            <span>ALFRED ARENA</span>
            <span>3D · FÖRHANDSVISNING</span>
          </div>
          <PitchPreview />
          <p className='pitch-footer'>Byggt för nästa avspark.</p>
        </div>
      </section>
      <footer className='app-footer'>
        <span>
          ALFRED FC <span className='footer-divider'>/</span> UNDER UTVECKLING
        </span>
        <span>Dator · Mobil · PWA</span>
      </footer>
      <GameUpdate />
    </main>
  );
}

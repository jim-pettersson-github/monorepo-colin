import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';

export function App() {
  return (
    <main className='title-screen'>
      <a className='home-link' href={import.meta.env.BASE_URL} aria-label='Charlie for Speed startsida'>
        Charlie for Speed
      </a>
      <h1>Charlie for Speed</h1>
      <p>Sportbilsracing på riktiga banor. Under utveckling.</p>
      <FullscreenButton />
      <GameUpdate />
    </main>
  );
}

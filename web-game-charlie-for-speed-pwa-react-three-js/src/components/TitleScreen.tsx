import { carById, carName } from '../game/cars';
import type { Settings } from '../game/storage';
import { trackById } from '../game/tracks';
import { Showroom } from './Showroom';

type Props = {
  settings: Settings;
  onRace: () => void;
  onGarage: () => void;
  onCareer: () => void;
  onSettings: () => void;
  onWifi: () => void;
  onWifiCareer: () => void;
};

export function TitleScreen({ settings, onRace, onGarage, onCareer, onSettings, onWifi, onWifiCareer }: Props) {
  const car = carById(settings.carId);
  const track = trackById(settings.trackId);
  return (
    <main className='menu-screen title-screen'>
      <Showroom carId={settings.carId} />
      <a className='home-link all-games-link' href={`${import.meta.env.BASE_URL}../`}>
        ← Alla spel
      </a>
      <header className='logo'>
        <h1>
          <span className='logo-top'>Charlie</span> <span className='logo-bottom'>for Speed</span>
        </h1>
        <p>Sportbilar · Racerbanor · Full fart</p>
      </header>
      <nav className='title-menu' aria-label='Huvudmeny'>
        <button type='button' className='primary' onClick={onCareer}>
          Karriär
          <small>Turneringar, prispengar och uppgraderingar</small>
        </button>
        <button type='button' onClick={onGarage}>
          Nytt race
        </button>
        <button type='button' onClick={onRace}>
          Snabbstart
          <small>
            {carName(car)} · {track.name} · {settings.laps} varv
          </small>
        </button>
        <button type='button' onClick={onWifi}>
          Spela online
          <small>Upp till 8 enheter · öppna spel eller rumskod</small>
        </button>
        <button type='button' onClick={onWifiCareer}>
          Online-karriär
          <small>Cuper och uppgraderingar med kompisar</small>
        </button>
        <button type='button' onClick={onSettings}>
          Inställningar
        </button>
      </nav>
      <p className='app-version' data-testid='app-version'>
        Version {__APP_VERSION__}
      </p>
    </main>
  );
}

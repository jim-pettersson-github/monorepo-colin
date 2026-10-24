import { useState } from 'react';
import { Garage } from './components/Garage';
import { RaceView } from './components/RaceView';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import { TrackSelect } from './components/TrackSelect';
import { loadSettings, type Settings, saveSettings } from './game/storage';

type Screen = 'title' | 'garage' | 'tracks' | 'race';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const update = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  return (
    <>
      {screen === 'title' && (
        <TitleScreen settings={settings} onRace={() => setScreen('race')} onGarage={() => setScreen('garage')} onSettings={() => setSettingsOpen(true)} />
      )}
      {screen === 'garage' && (
        <Garage
          carId={settings.carId}
          onChange={(carId) => update({ ...settings, carId })}
          onBack={() => setScreen('title')}
          onNext={() => setScreen('tracks')}
        />
      )}
      {screen === 'tracks' && <TrackSelect settings={settings} onChange={update} onBack={() => setScreen('garage')} onStart={() => setScreen('race')} />}
      {screen === 'race' && <RaceView settings={settings} onSettings={update} onExit={setScreen} />}
      {settingsOpen && <SettingsPanel settings={settings} onChange={update} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

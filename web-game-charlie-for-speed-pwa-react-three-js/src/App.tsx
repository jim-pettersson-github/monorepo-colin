import { useState } from 'react';
import { CareerHub } from './components/CareerHub';
import { Garage } from './components/Garage';
import { RaceView } from './components/RaceView';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import { TrackSelect } from './components/TrackSelect';
import { type Career, cupById, cupField, currentTrack, recordRace } from './game/career';
import { loadCareer, loadSettings, type Settings, saveCareer, saveSettings } from './game/storage';

type Screen = 'title' | 'garage' | 'tracks' | 'race' | 'career' | 'career-race';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState(loadSettings);
  const [career, setCareer] = useState<Career | undefined>(loadCareer);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const update = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const updateCareer = (next: Career | undefined) => {
    setCareer(next);
    saveCareer(next);
  };

  const cup = career?.run ? cupById(career.run.cupId) : undefined;
  const careerTrack = career ? currentTrack(career) : undefined;

  return (
    <>
      {screen === 'title' && (
        <TitleScreen
          settings={settings}
          onRace={() => setScreen('race')}
          onGarage={() => setScreen('garage')}
          onCareer={() => setScreen('career')}
          onSettings={() => setSettingsOpen(true)}
        />
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
      {screen === 'career' && <CareerHub career={career} onChange={updateCareer} onRace={() => setScreen('career-race')} onBack={() => setScreen('title')} />}
      {screen === 'career-race' && career && cup && careerTrack && (
        <RaceView
          settings={{ ...settings, trackId: careerTrack, laps: cup.laps, carId: career.activeCarId, difficulty: 'normal' }}
          onSettings={update}
          onExit={setScreen}
          career={{
            title: `${cup.name} ${(career.run?.race ?? 0) + 1}/${cup.tracks.length}`,
            field: cupField(career),
            onFinish: (rows) => {
              updateCareer(recordRace(career, rows));
              setScreen('career');
            },
            onQuit: () => setScreen('career'),
          }}
        />
      )}
      {settingsOpen && <SettingsPanel settings={settings} onChange={update} onClose={() => setSettingsOpen(false)} />}
    </>
  );
}

import { useState } from 'react';
import { CareerHub } from './components/CareerHub';
import { Garage } from './components/Garage';
import { RaceView } from './components/RaceView';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import { TrackSelect } from './components/TrackSelect';
import { WifiLobby } from './components/WifiLobby';
import { type Career, cupById, cupField, currentTrack, recordRace } from './game/career';
import { carName, cars } from './game/cars';
import { MAX_PLAYERS, NetworkRace, type RaceConfig, validRaceConfig } from './game/network-race';
import { loadCareer, loadSettings, type Settings, saveCareer, saveSettings } from './game/storage';
import { trackById, trackDefs } from './game/tracks';

// Guests who have not chosen yet get a different car from the host's class.
function defaultGuestCar(hostCar: string, player: number) {
  const host = cars.find((car) => car.id === hostCar) ?? cars[0];
  const options = cars.filter((car) => car.carClass === host.carClass && car.id !== host.id);
  return (options.length ? options[(player - 1) % options.length] : host).id;
}

const carLabel = (id: string) => carName(cars.find((car) => car.id === id) ?? cars[0]);

function CarSelect({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {carName(c)} · klass {c.carClass}
          </option>
        ))}
      </select>
    </label>
  );
}

type Screen = 'wifi' | 'network-race' | 'title' | 'garage' | 'tracks' | 'race' | 'career' | 'career-race';

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState(loadSettings);
  const [career, setCareer] = useState<Career | undefined>(loadCareer);
  const [network, setNetwork] = useState<NetworkRace>();
  const [wifiConfig, setWifiConfig] = useState<RaceConfig>(() => ({
    settings: { trackId: settings.trackId, carId: settings.carId, laps: settings.laps, difficulty: settings.difficulty, transmission: settings.transmission },
    cars: [settings.carId],
    seed: Date.now() % 2147483647,
  }));
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
          onWifi={() => setScreen('wifi')}
        />
      )}
      {screen === 'wifi' && (
        <WifiLobby
          name='Charlie for Speed'
          maxPlayers={MAX_PLAYERS}
          config={wifiConfig}
          configure={(c, count, picks) => ({
            ...c,
            cars: Array.from({ length: count }, (_, player) => {
              if (player === 0) return c.settings.carId;
              const pick = picks[player];
              return cars.some((car) => car.id === pick) ? pick : defaultGuestCar(c.settings.carId, player);
            }),
          })}
          guestPick={(c, slot, pick) => <CarSelect label='Din bil' value={c.cars[slot] ?? c.cars[0]} onChange={pick} />}
          validConfig={validRaceConfig}
          validStart={validRaceConfig}
          summary={(c) => (
            <>
              <p>
                {trackById(c.settings.trackId).name} · {c.settings.laps} varv · {c.cars.length} spelare
                {c.cars.length < 8 ? ` och ${8 - c.cars.length} datorförare` : ''}
              </p>
              <ol className='wifi-player-cars'>
                {c.cars.map((id, player) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: players are identified by their slot
                  <li key={player}>
                    Spelare {player + 1}: {carLabel(id)}
                  </li>
                ))}
              </ol>
            </>
          )}
          controls={<p>Piltangenter eller WASD styr din bil. USB/Bluetooth-handkontroll fungerar också. På telefon visas pekknappar under racet.</p>}
          available={true}
          hostSettings={
            <>
              <label>
                Bana
                <select
                  value={wifiConfig.settings.trackId}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, settings: { ...wifiConfig.settings, trackId: e.target.value } })}
                >
                  {trackDefs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Varv
                <select
                  aria-label='Varv'
                  value={wifiConfig.settings.laps}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, settings: { ...wifiConfig.settings, laps: Number(e.target.value) } })}
                >
                  {[1, 2, 3, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <CarSelect
                label='Din bil (spelare 1)'
                value={wifiConfig.settings.carId}
                onChange={(carId) => setWifiConfig({ ...wifiConfig, settings: { ...wifiConfig.settings, carId } })}
              />
              <p className='hint'>Gästerna väljer sina bilar på sina egna enheter.</p>
            </>
          }
          onBack={() => setScreen('title')}
          onLaunch={(connections, config, state) => {
            const session = new NetworkRace(config, connections, state ? connections[0].slot : 0);
            setNetwork(session);
            setScreen('network-race');
          }}
        />
      )}
      {screen === 'network-race' && network && (
        <RaceView
          network={network}
          settings={{ ...settings, ...network.config.settings }}
          onSettings={(next) => update({ ...settings, camera: next.camera, sound: next.sound })}
          onExit={() => {
            setNetwork(undefined);
            setScreen('wifi');
          }}
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

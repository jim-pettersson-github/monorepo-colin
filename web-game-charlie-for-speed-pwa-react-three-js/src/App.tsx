import { useEffect, useState } from 'react';
import { CareerHub } from './components/CareerHub';
import { Garage } from './components/Garage';
import { RaceView } from './components/RaceView';
import { Scoreboard } from './components/Scoreboard';
import { SettingsPanel } from './components/SettingsPanel';
import { Showroom } from './components/Showroom';
import { TitleScreen } from './components/TitleScreen';
import { TrackMap } from './components/TrackMap';
import { TrackSelect } from './components/TrackSelect';
import { WifiCareerRun, WifiCareerStart } from './components/WifiCareer';
import { WifiLobby } from './components/WifiLobby';
import { type Career, cupById, cupField, currentTrack, recordRace } from './game/career';
import { type CareerLobbyConfig, CareerSession, validLobbyConfig } from './game/career-session';
import { carName, cars } from './game/cars';
import { flushLaps } from './game/leaderboard';
import { newSession, type Session } from './game/multi-career';
import { MAX_PLAYERS, NetworkRace, type RaceConfig, validRaceConfig } from './game/network-race';
import {
  deleteSession,
  loadCareer,
  loadIdentity,
  loadSessions,
  loadSettings,
  type Settings,
  saveCareer,
  saveIdentity,
  saveSession,
  saveSettings,
} from './game/storage';
import { trackById, trackDefs } from './game/tracks';

// Guests who have not chosen yet get a different car from the full online roster.
function defaultGuestCar(hostCar: string, player: number) {
  const host = cars.find((car) => car.id === hostCar) ?? cars[0];
  const options = cars.filter((car) => car.id !== host.id);
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

// The chosen car turning in a small showroom beside the track map, so online players see what they are about to race.
function RacePreview({ carId, trackId }: { carId: string; trackId: string }) {
  const track = trackById(trackId);
  return (
    <div className='lobby-preview'>
      <Showroom carId={carId} className='lobby-showroom' />
      <figure className='lobby-track'>
        <TrackMap track={track} size={150} />
        <figcaption>{track.name}</figcaption>
      </figure>
    </div>
  );
}

type Screen =
  | 'wifi'
  | 'network-race'
  | 'title'
  | 'garage'
  | 'tracks'
  | 'race'
  | 'career'
  | 'career-race'
  | 'wifi-career'
  | 'wifi-career-lobby'
  | 'wifi-career-hub'
  | 'scoreboard';

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
  const [identity, setIdentity] = useState(loadIdentity);
  const [sessions, setSessions] = useState(loadSessions);
  // The session the host is about to open; undefined when this device joins someone else's.
  const [hostSession, setHostSession] = useState<Session>();
  const [careerLobby, setCareerLobby] = useState<CareerLobbyConfig>({ kind: 'career', session: '', mode: 'fresh' });
  const [careerSession, setCareerSession] = useState<CareerSession>();

  const changeIdentity = (next: typeof identity) => {
    setIdentity(next);
    saveIdentity(next);
  };
  const changeName = (name: string) => changeIdentity({ ...identity, name });

  // Laps saved while offline go to the scoreboard once the game opens with a connection.
  useEffect(() => {
    void flushLaps(loadIdentity()).catch(() => {});
  }, []);

  const openCareerLobby = (session: Session | undefined) => {
    setHostSession(session);
    setCareerLobby({ kind: 'career', session: session?.name ?? '', mode: session?.mode ?? 'fresh' });
    setScreen('wifi-career-lobby');
  };

  const leaveCareerSession = () => {
    careerSession?.close();
    setCareerSession(undefined);
    setSessions(loadSessions());
    setScreen('wifi-career');
  };

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
          onWifiCareer={() => setScreen('wifi-career')}
          onScoreboard={() => setScreen('scoreboard')}
        />
      )}
      {screen === 'scoreboard' && <Scoreboard onBack={() => setScreen('title')} />}
      {screen === 'wifi-career' && (
        <WifiCareerStart
          identity={identity}
          onIdentity={changeIdentity}
          sessions={sessions}
          onCreate={(name, mode) => openCareerLobby(newSession(name, mode))}
          onResume={(session) => openCareerLobby(session)}
          onDelete={(id) => {
            deleteSession(id);
            setSessions(loadSessions());
          }}
          onJoin={() => openCareerLobby(undefined)}
          onBack={() => setScreen('title')}
        />
      )}
      {screen === 'wifi-career-lobby' && (
        <WifiLobby
          name='Charlie for Speed'
          title='Online-karriär'
          maxPlayers={MAX_PLAYERS}
          config={careerLobby}
          validConfig={validLobbyConfig}
          validStart={validLobbyConfig}
          startLabel='Öppna sessionen'
          playerName={identity.name}
          listing={(c) => `Online-karriär · ${c.session || 'ny session'} · ${c.mode === 'fresh' ? 'ny start' : 'egna bilar'}`}
          summary={(c) => (
            <p>
              Online-karriär: {c.session || 'ny session'} · {c.mode === 'fresh' ? 'Ny start' : 'Egna bilar'}
            </p>
          )}
          controls={
            <p>
              {hostSession
                ? 'Para ihop de som är med nu. Fler kan bjudas in senare från sessionen.'
                : 'Välj Anslut och läs in värdens kod. Har du varit med i sessionen förut får du tillbaka dina bilar och pengar.'}
            </p>
          }
          available={true}
          hostSettings={<p>Session: {careerLobby.session}</p>}
          onBack={() => setScreen('wifi-career')}
          onLaunch={(connections, config, state, room) => {
            const solo = loadCareer();
            const options = {
              identity,
              own: solo ? { garage: solo.garage, activeCarId: solo.activeCarId } : undefined,
              transmission: settings.transmission,
              save: saveSession,
              room,
            };
            const controller =
              state || !hostSession
                ? CareerSession.joinSession(connections[0], config, options)
                : CareerSession.hostSession(hostSession, connections, config, options);
            setCareerSession(controller);
            setScreen('wifi-career-hub');
          }}
        />
      )}
      {screen === 'wifi-career-hub' && careerSession && (
        <WifiCareerRun controller={careerSession} settings={settings} onSettings={update} onExit={leaveCareerSession} />
      )}
      {screen === 'wifi' && (
        <WifiLobby
          name='Charlie for Speed'
          maxPlayers={MAX_PLAYERS}
          config={wifiConfig}
          readyKey={(c) => JSON.stringify(c.settings)}
          playerName={identity.name}
          onPlayerName={(name) => changeIdentity({ ...identity, name })}
          listing={(c) => `${trackById(c.settings.trackId).name} · ${c.settings.laps} varv · utjämnade bilar`}
          configure={(c, count, picks, names) => ({
            ...c,
            names: Array.from({ length: count }, (_, player) => (names[player] ?? '').slice(0, 16)),
            cars: Array.from({ length: count }, (_, player) => {
              if (player === 0) return c.settings.carId;
              const pick = cars.find((car) => car.id === picks[player]);
              return pick?.id ?? defaultGuestCar(c.settings.carId, player);
            }),
          })}
          guestPick={(c, slot, pick) => (
            <>
              <CarSelect label='Din bil' value={c.cars[slot] ?? c.cars[0]} onChange={pick} />
              <p className='hint'>Välj fritt bland alla 19 bilar. Prestandan är utjämnad mellan alla klasser i onlinerace.</p>
              <RacePreview carId={c.cars[slot] ?? c.cars[0]} trackId={c.settings.trackId} />
            </>
          )}
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
                    {c.names?.[player] || `Spelare ${player + 1}`}: {carLabel(id)}
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
              <p className='hint'>
                Alla 19 bilar kan mötas här. Acceleration, toppfart, bromsar och grepp är utjämnade mellan klasserna. Karriären behåller klassernas prestanda.
              </p>
              <RacePreview carId={wifiConfig.settings.carId} trackId={wifiConfig.settings.trackId} />
            </>
          }
          onBack={() => setScreen('title')}
          onLaunch={(connections, config, state, room) => {
            // A quick race keeps its players; new ones join the next lobby.
            room?.close();
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
          onSettings={(next) => update({ ...settings, camera: next.camera, sound: next.sound, volume: next.volume })}
          onPlayerName={changeName}
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
      {screen === 'race' && <RaceView settings={settings} onSettings={update} onExit={setScreen} onPlayerName={changeName} />}
      {screen === 'career' && <CareerHub career={career} onChange={updateCareer} onRace={() => setScreen('career-race')} onBack={() => setScreen('title')} />}
      {screen === 'career-race' && career && cup && careerTrack && (
        <RaceView
          settings={{ ...settings, trackId: careerTrack, laps: cup.laps, carId: career.activeCarId, difficulty: 'normal' }}
          onSettings={update}
          onExit={setScreen}
          onPlayerName={changeName}
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
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={update}
          name={identity.name}
          onName={(name) => changeIdentity({ ...identity, name })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

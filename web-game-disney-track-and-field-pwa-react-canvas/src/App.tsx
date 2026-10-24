import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Portrait, Stadium } from './components/Artwork';
import { ControlLegend, ControlSetup, controlsReady, TouchControls } from './components/Controls';
import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';
import { SportIcon } from './components/Icons';
import { WifiLobby } from './components/WifiLobby';
import { gameAudio } from './game/audio';
import { GameInput } from './game/input';
import type { CharacterId, GameState, Settings, Source } from './game/model';
import {
  angle,
  barHeight,
  character,
  characters,
  createGame,
  defaultSettings,
  eventInfo,
  events,
  formatResult,
  jumpEvent,
  obstacleCount,
  programme,
  raceScale,
  ranking,
  skillEvent,
  stationaryEvent,
  verticalEvent,
} from './game/model';
import { NetworkSession, validNetworkSettings, validNetworkState } from './game/network-session';
import { roomServer } from './game/room-server';
import { Session } from './game/session';
import { clearGame, loadGame, loadRecords, loadSettings, recordKey, saveSettings } from './game/storage';
import './styles.css';

function SoundToggle() {
  const [enabled, setEnabled] = useState(gameAudio.enabled);
  return (
    <button
      type='button'
      className='icon-button'
      aria-label={enabled ? 'Stäng av ljud' : 'Slå på ljud'}
      aria-pressed={enabled}
      onClick={() => {
        gameAudio.toggle();
        setEnabled(gameAudio.enabled);
      }}
    >
      <SportIcon kind={enabled ? 'sound' : 'mute'} />
    </button>
  );
}
function Logo() {
  return (
    <span className='wordmark'>
      <span className='logo-star'>
        <SportIcon kind='star' />
      </span>
      <span>
        SAGO<span>SPELEN</span>
      </span>
    </span>
  );
}
function CharacterPicker({ player, settings, onChange }: { player: number; settings: Settings; onChange: (s: Settings) => void }) {
  const selected = character(settings.characters[player]);
  return (
    <section className='character-selection' aria-label={`Välj figur spelare ${player + 1}`}>
      <div className='section-title'>
        <h3>
          <span className={`player-dot player-${player}`}>P{player + 1}</span> {character(settings.characters[player]).name}
        </h3>
        <span>{characters.length} figurer · välj din favorit</span>
      </div>
      <div className='character-spotlight' style={{ '--character': selected.color } as React.CSSProperties}>
        <div className='character-stage'>
          <Portrait id={selected.id} animated />
        </div>
        <div className='character-intro'>
          <span className='character-eyebrow'>DIN DELTAGARE · P{player + 1}</span>
          <h4>{selected.name}</h4>
          <p>{selected.film}</p>
          <small>Alla figurer har samma fart. Välj den du gillar mest!</small>
        </div>
        <SportIcon kind='star' />
      </div>
      <div className='character-grid'>
        {characters.map((c, index) => (
          <button
            type='button'
            key={c.id}
            aria-label={`Spelare ${player + 1}: ${c.name}`}
            aria-pressed={settings.characters[player] === c.id}
            style={{ '--character': c.color } as React.CSSProperties}
            onClick={() => {
              const ids = [...settings.characters];
              const other = ids.indexOf(c.id);
              if (other >= 0 && other !== player) ids[other] = ids[player];
              ids[player] = c.id;
              onChange({ ...settings, characters: ids });
            }}
          >
            <span className='character-choice' aria-hidden='true'>
              {selected.id === c.id ? '✓' : String(index + 1).padStart(2, '0')}
            </span>
            <Portrait id={c.id} />
            <strong>{c.name}</strong>
            <small>{c.film}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
function Menu({
  input,
  settings,
  onChange,
  saved,
  onStart,
  onResume,
  onWifi,
}: {
  input: GameInput;
  settings: Settings;
  onChange: (s: Settings) => void;
  saved: GameState | null;
  onStart: () => void;
  onResume: () => void;
  onWifi: () => void;
}) {
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  const event = eventInfo(settings.event);
  const records = loadRecords();
  const best = records[recordKey(settings.event, settings.assist)];
  const [category, setCategory] = useState<'all' | 'run' | 'jump' | 'throw' | 'skill'>('all');
  const visibleEvents = events.filter(
    (e) =>
      category === 'all' ||
      (category === 'run' ? e.type === 'run' : category === 'jump' ? e.icon === 'jump' : category === 'throw' ? e.icon === 'throw' : e.type === 'skill'),
  );
  const preview = useRef<CharacterId[]>(['mickey', 'stitch', 'elsa']);
  return (
    <main className='menu-shell'>
      <header className='app-header'>
        <Logo />
        <div className='header-tools'>
          <a className='all-games-link' href={`${import.meta.env.BASE_URL}../`}>
            ← Alla spel
          </a>
          <SoundToggle />
          <FullscreenButton />
        </div>
      </header>
      <GameUpdate />
      <div className='menu-intro'>
        <div>
          <p className='eyebrow'>DISNEY-FIGURER · FRIIDROTT I ARKADSTIL</p>
          <h1>
            Klara.
            <br />
            Färdiga.
            <br />
            <em>Magi.</em>
          </h1>
          <p className='intro-copy'>Små steg. Stora språng. Dina favoriter möts i helt olika sporter.</p>
          <div className='feature-pills'>
            <span>{events.length} individuella grenar</span>
            <span>1–4 spelare</span>
            <span>Spela offline</span>
          </div>
        </div>
        <div className='hero-art'>
          <div className='hero-art-caption'>
            <span>VÄLKOMMEN TILL SAGO ARENA</span>
            <span>EST. 1994 ★</span>
          </div>
          <Stadium cast={preview.current} />
          <span className='hero-sticker'>
            <SportIcon kind='star' />
            Alla kan
            <br />
            vara med!
          </span>
        </div>
      </div>
      <section className='play-section' aria-label='Välj tävling'>
        <div className='section-title'>
          <div>
            <p className='eyebrow'>DITT NÄSTA PERSONBÄSTA</p>
            <h2>Vad vill du spela?</h2>
          </div>
          <fieldset className='segmented' aria-label='Tävlingsform'>
            <button type='button' aria-pressed={!settings.championship} onClick={() => onChange({ ...settings, championship: false })}>
              En gren
            </button>
            <button type='button' aria-pressed={settings.championship} onClick={() => onChange({ ...settings, championship: true })}>
              Sexkamp <span>★</span>
            </button>
          </fieldset>
        </div>
        <fieldset className='event-filters' aria-label='Grentyp'>
          {(['all', 'run', 'jump', 'throw', 'skill'] as const).map((c) => (
            <button type='button' key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {
                {
                  run: `Löpning · ${events.filter((e) => e.type === 'run').length}`,
                  jump: 'Hopp · 4',
                  throw: 'Kast · 4',
                  skill: 'Andra sporter · 3',
                  all: `Alla · ${events.length}`,
                }[c]
              }
            </button>
          ))}
        </fieldset>
        <div className='event-grid'>
          {visibleEvents.map((e, index) => (
            <button
              type='button'
              key={e.id}
              className={`event-card event-${index}`}
              aria-label={`Välj ${e.name}`}
              aria-pressed={settings.event === e.id && !settings.championship}
              onClick={() => onChange({ ...settings, event: e.id, championship: false })}
            >
              <span className='event-number'>{String(events.findIndex((event) => event.id === e.id) + 1).padStart(2, '0')}</span>
              <SportIcon kind={e.icon} />
              <strong>{e.name}</strong>
              <small>
                {e.type === 'run' ? 'LÖPNING' : e.id === 'archery' ? 'TRE PILAR · TOTALPOÄNG' : e.id === 'weightlifting' ? 'LYFT & BALANS' : 'BÄST AV TRE'}
              </small>
            </button>
          ))}
        </div>
        <div className='event-description'>
          <div>
            <span className='eyebrow'>{settings.championship ? 'SEX GRENAR · EN POKAL' : event.label}</span>
            <h3>{settings.championship ? 'Hela arenan är din.' : event.name}</h3>
            <p>
              {settings.championship
                ? '100 m, bågskytte, längdhopp, tyngdlyftning, simhopp och spjut. Sex olika utmaningar. Flest poäng vinner!'
                : event.description}
            </p>
          </div>
          <span className='record-badge'>
            <SportIcon kind='star' />
            <small>DITT REKORD · {skillEvent(settings.event) ? 'SPORT' : settings.assist ? 'HÅLL' : 'RYTM'}</small>
            <strong>{best ? formatResult(best.value, settings.event) : 'Ditt första väntar'}</strong>
          </span>
        </div>
      </section>
      <section className='start-section' aria-label='Starta tävlingen'>
        <div>
          <span className='eyebrow'>KLAR PÅ STARTLINJEN?</span>
          <h2>{settings.championship ? 'Dags för sexkamp.' : `${event.name}. Nu kör vi.`}</h2>
          <p>
            {settings.players === 1
              ? 'Du och tre datorfigurer'
              : settings.players === 4
                ? 'Ni fyra spelar mot varandra'
                : `${settings.players} spelare och ${4 - settings.players} datorfigurer`}{' '}
            · {settings.assist ? 'Hjälpläge · håll för jämn fart' : 'Klassisk knapprytm'}
          </p>
        </div>
        <div className='start-actions'>
          <button type='button' className='primary' disabled={!controlsReady(settings, input)} onClick={onStart}>
            Starta {settings.championship ? 'sexkamp' : 'grenen'} <span>↗</span>
          </button>
          {saved && (
            <button type='button' className='resume' disabled={!controlsReady(saved.settings, input)} onClick={onResume}>
              Fortsätt sparad {saved.settings.championship ? 'sexkamp' : 'gren'} · {eventInfo(saved.event).name}
            </button>
          )}
        </div>
      </section>
      <section className='setup-section'>
        <button type='button' className='wifi-entry' onClick={onWifi}>
          {roomServer() ? 'Spela online · 2–4 enheter' : 'Spela via Wi-Fi · 2–4 enheter'}
        </button>
        <div className='section-title'>
          <h2>Vilka är med?</h2>
          <fieldset className='segmented' aria-label='Antal spelare'>
            {([1, 2, 3, 4] as const).map((players) => (
              <button key={players} type='button' aria-pressed={settings.players === players} onClick={() => onChange({ ...settings, players })}>
                {['En spelare', 'Två spelare', 'Tre spelare', 'Fyra spelare'][players - 1]}
              </button>
            ))}
          </fieldset>
        </div>
        {([0, 1, 2, 3] as const).slice(0, settings.players).map((player) => (
          <CharacterPicker key={player} player={player} settings={settings} onChange={onChange} />
        ))}
        <div className='settings-grid'>
          <section className='settings-card'>
            <h3>Spela på ditt sätt</h3>
            <div className='options-grid'>
              <label>
                Motstånd
                <select value={settings.difficulty} onChange={(e) => onChange({ ...settings, difficulty: e.target.value as Settings['difficulty'] })}>
                  <option value='easy'>Lätt</option>
                  <option value='normal'>Vanlig</option>
                  <option value='hard'>Svår</option>
                </select>
              </label>
              <label>
                Löpstil
                <select value={settings.assist ? 'hold' : 'rhythm'} onChange={(e) => onChange({ ...settings, assist: e.target.value === 'hold' })}>
                  <option value='hold'>Hjälpläge · håll för jämn fart</option>
                  <option value='rhythm'>Arkad · snabbare tryck ger mer fart</option>
                </select>
              </label>
            </div>
            <p className='small muted'>
              {settings.assist
                ? 'Hjälpläge ger jämn fart när du håller en stegknapp. Alla får samma maxfart.'
                : 'Tryck vänster–höger–vänster–höger. Snabbare växling ger högre fart. Samma knapp eller att hålla räknas inte.'}
            </p>
            <p className='small muted'>Figurerna är lika snabba. Välj den du gillar bäst.</p>
          </section>
          <ControlSetup input={input} settings={settings} onChange={onChange} />
        </div>
        <button type='button' className='primary' disabled={!controlsReady(settings, input)} onClick={onStart}>
          Till startlinjen med mina val →
        </button>
      </section>
      <footer className='app-footer'>
        <Logo />
        <span>SPRING. HOPPA. KASTA. HA KUL.</span>
        <span>Ett personligt fanspel · v0.1.0</span>
      </footer>
    </main>
  );
}
function EventHint({ state }: { state: GameState }) {
  if (state.event === 'archery') return <>Vänster/höger siktar. Skjut när siktet är i mitten. Tre pilar räknas ihop.</>;
  if (state.event === 'diving') return <>Hoppa · Håll vänster/höger för volt · Sträck ut och landa med huvudet först.</>;
  if (state.event === 'weightlifting') return <>Lyft i grönt · Balansera med vänster/höger · Lås när stången är uppe.</>;
  if (obstacleCount(state.event)) return <>Hoppa strax före hindret. Fortsätt springa!</>;
  if (state.event === 'raceWalk') return <>Håll en jämn gångrytm. Hoppa inte.</>;
  if (state.event === 'tripleJump') return <>Hoppa före plankan. Tryck igen vid varje landning.</>;
  if (verticalEvent(state.event)) return <>Ta sats. Hoppa nära linjen. Ribba: {barHeight(state.event, state.attempt).toFixed(2)} m.</>;
  if (state.event === 'longJump') return <>Bygg fart · Hoppa före den vita plankan.</>;
  if (state.event === 'javelin') return <>Bygg fart · Kasta före den vita linjen.</>;
  if (stationaryEvent(state.event)) return <>Bygg kraft med stegknapparna · Tryck Kasta.</>;
  return (
    <>
      {state.settings.assist ? 'Hjälpläge: håll en stegknapp för jämn fart.' : 'Växla vänster–höger. Snabbare rena tryck ger högre fart.'}
      {raceScale(state.event) > 1 ? ' Kort arkadversion.' : ''}
    </>
  );
}
function Match({ session, onMenu, onReplay }: { session: Session; onMenu: () => void; onReplay: () => void }) {
  useSyncExternalStore(session.subscribe, session.getSnapshot);
  useSyncExternalStore(session.input.subscribe, session.input.getSnapshot);
  const s = session.state;
  const info = eventInfo(s.event);
  const [exit, setExit] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const results = s.phase === 'results' || s.phase === 'attempt-result';
  const modal = session.paused || results;
  const localRunner = s.runners[session.localPlayers[0]];
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    else if (!modal) {
      dialog.current?.close();
      setExit(false);
    }
  }, [modal]);
  const final = s.phase === 'results' && (!s.settings.championship || s.round === 5);
  const order = s.settings.championship && s.round === 5 && s.phase === 'results' ? [0, 1, 2, 3].sort((a, b) => s.points[b] - s.points[a]) : ranking(s);
  return (
    <main className={`game-shell ${skillEvent(s.event) ? 'skill-game' : ''}`}>
      <header className='race-header'>
        <Logo />
        {session.networkRole && <span className='network-player'>WI-FI · DU ÄR P{session.localSlot + 1}</span>}
        <div className='event-heading'>
          <span>
            {s.settings.championship ? `SEXKAMP · GREN ${s.round + 1}/6` : 'SNABB GREN'}
            {info.type !== 'run' ? ` · FÖRSÖK ${s.attempt + 1}/3` : ''}
          </span>
          <h1>{info.name}</h1>
        </div>
        <div className='race-time'>
          <time role='timer'>{s.time.toFixed(2).replace('.', ',')}</time>
          <small>SEKUNDER</small>
        </div>
        <div className='header-tools'>
          <SoundToggle />
          <button type='button' aria-label='Pausa tävlingen' onClick={() => session.pause()}>
            Ⅱ <span>Paus</span>
          </button>
        </div>
      </header>
      <section className='race-stage' aria-label='På arenan'>
        <Stadium session={session} />
        <div className='event-tip'>
          <SportIcon kind={info.icon} />
          <span>
            <EventHint state={s} />
          </span>
        </div>
        {s.phase === 'countdown' && !session.paused && (
          <div className='countdown' role='status'>
            <span>{s.countdown > 2 ? 'PÅ ERA PLATSER' : s.countdown > 1 ? 'KLARA' : 'FÄRDIGA'}</span>
            <strong>{Math.ceil(s.countdown)}</strong>
            <small>
              {skillEvent(s.event) ? 'Gör dig redo för din sport' : s.settings.assist ? 'Håll en stegknapp när starten går' : 'Hitta rytmen när starten går'}
            </small>
          </div>
        )}
        {info.type === 'field' && s.phase === 'playing' && (
          <div className='angle-meter'>
            <span>{jumpEvent(s.event) ? 'AVSTAMP' : `KASTVINKEL · ${Math.round(angle(s.time))}°`}</span>
            <div>
              <i style={{ left: `${jumpEvent(s.event) ? Math.min(100, (localRunner.x / 18) * 100) : ((angle(s.time) - 30) / 26) * 100}%` }} />
            </div>
            <small>
              {jumpEvent(s.event)
                ? localRunner.landingWindow > 0
                  ? 'TRYCK IGEN FÖR NÄSTA STEG'
                  : `${Math.max(0, 18 - localRunner.x).toFixed(1)} m till avstamp`
                : 'Den gula zonen ger en bra vinkel'}
            </small>
          </div>
        )}
      </section>
      <section className='runner-status' aria-label='Deltagarnas läge'>
        {s.runners.map((r, i) => (
          <div key={r.character} className={`status-player player-${i}`}>
            <span className='lane-number'>{i + 1}</span>
            <div>
              <strong>
                {character(r.character).name}
                <small>{r.human === null ? 'DATOR' : `SPELARE ${r.human + 1}`}</small>
              </strong>
              <progress
                aria-label={`${skillEvent(s.event) ? 'Läge' : 'Fart'} ${character(r.character).name}`}
                max={skillEvent(s.event) ? 1 : 11}
                value={skillEvent(s.event) ? (r.skill?.progress ?? 0) : r.speed}
              />
            </div>
            <span>
              {r.done
                ? formatResult(r.result, s.event)
                : skillEvent(s.event)
                  ? r.skill?.stage === 'ready'
                    ? 'Redo'
                    : r.skill?.stage === 'released'
                      ? 'På väg'
                      : 'Pågår'
                  : info.type === 'run'
                    ? `${Math.floor(r.x)} m`
                    : r.foul
                      ? 'Övertramp'
                      : `${r.speed.toFixed(1)} m/s`}
            </span>
          </div>
        ))}
      </section>
      <footer className={`race-controls ${session.localPlayers.length > 2 ? 'many-players' : ''}`}>
        {session.localPlayers.map((i) =>
          session.controlSource(i) === 'touch' ? (
            <TouchControls key={s.settings.characters[i]} input={session.input} player={session.inputPlayer(i)} labelPlayer={i} event={s.event} />
          ) : (
            <div className='keyboard-controls' key={s.settings.characters[i]}>
              <strong className={`player-dot player-${i}`}>P{i + 1}</strong>
              <ControlLegend player={i} input={session.input} source={session.controlSource(i)} assist={s.settings.assist} event={s.event} />
            </div>
          ),
        )}
      </footer>
      <dialog
        ref={dialog}
        className='game-dialog'
        aria-labelledby='dialog-title'
        onCancel={(e) => {
          e.preventDefault();
          if (exit) setExit(false);
          else if (!results) session.resume();
        }}
      >
        {exit ? (
          <>
            <span className='eyebrow'>TILL STARTMENYN</span>
            <h2 id='dialog-title'>Pausa här och gå tillbaka?</h2>
            <p>
              {session.networkRole
                ? 'Wi-Fi-kopplingen avslutas för alla. Dina lokala sparade tävlingar behålls.'
                : 'Din gren och sexkamp sparas. Du kan fortsätta från startmenyn.'}
            </p>
            <button type='button' className='primary' onClick={onMenu}>
              {session.networkRole ? 'Lämna Wi-Fi-tävlingen' : 'Spara och gå till menyn'}
            </button>
            <button type='button' onClick={() => setExit(false)}>
              Stanna här
            </button>
          </>
        ) : session.paused ? (
          <>
            <span className='eyebrow'>INGEN BRÅDSKA</span>
            <h2 id='dialog-title'>Vi tar en paus.</h2>
            <p>{session.reason}</p>
            <button type='button' className='primary' disabled={!session.canResume} onClick={session.resume}>
              Fortsätt tävlingen →
            </button>
            {!session.canResume && <p className='warning'>Återvänd till spelet och anslut den valda handkontrollen igen.</p>}
            <button type='button' onClick={() => setExit(true)}>
              Till startmenyn
            </button>
            <FullscreenButton />
            <GameUpdate onSave={session.save} />
          </>
        ) : (
          <>
            <span className='eyebrow'>
              {s.phase === 'attempt-result' ? `FÖRSÖK ${s.attempt + 1} AV 3` : s.settings.championship && s.round === 5 ? 'SEXKAMPEN ÄR KLAR' : 'SNYGGT JOBBAT'}
            </span>
            <h2 id='dialog-title'>
              {s.phase === 'attempt-result'
                ? 'Ett försök till!'
                : s.settings.championship && s.round === 5
                  ? `${character(s.runners[order[0]].character).name} vinner sexkampen!`
                  : `${character(s.runners[order[0]].character).name} ${s.runners[order[0]].result === null ? 'är klar' : 'vinner'}!`}
            </h2>
            <div className='result-list'>
              {order.map((index, place) => (
                <div key={index} className={`result-row ${s.runners[index].human !== null ? 'human-result' : ''}`}>
                  <span className='place'>{place + 1}</span>
                  <Portrait id={s.runners[index].character} />
                  <div>
                    <strong>{character(s.runners[index].character).name}</strong>
                    <small>
                      {s.runners[index].human === null ? 'Dator' : `Spelare ${(s.runners[index].human ?? 0) + 1}`}
                      {s.settings.championship ? ` · ${s.points[index]} poäng` : ''}
                    </small>
                    {info.type === 'field' && <small>{s.runners[index].attempts.map((n) => formatResult(n, s.event)).join(' / ')}</small>}
                  </div>
                  <strong>{formatResult(s.runners[index].result, s.event)}</strong>
                </div>
              ))}
            </div>
            {s.settings.championship && <p className='small muted'>Placering ger 5, 3, 2 eller 1 poäng. Delad placering ger samma poäng.</p>}
            {session.networkRole === 'guest' ? (
              <p role='status'>Väntar på att värden fortsätter tävlingen.</p>
            ) : !final ? (
              <button type='button' className='primary' onClick={session.next}>
                {s.phase === 'attempt-result' ? 'Nästa försök' : `Nästa gren · ${eventInfo(programme(s)[s.round + 1]).name}`} →
              </button>
            ) : (
              <button type='button' className='primary' onClick={onReplay}>
                Spela igen ↗
              </button>
            )}
            <button type='button' onClick={onMenu}>
              Till startmenyn
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
export function App() {
  const [input] = useState(() => new GameInput());
  const [settings, setSettings] = useState(() => {
    const s = loadSettings() ?? defaultSettings();
    if (!loadSettings() && matchMedia('(pointer:coarse)').matches) s.sources[0] = 'touch';
    return s;
  });
  const [wifi, setWifi] = useState(false);
  const [wifiSource, setWifiSource] = useState<Source>(() => settings.sources[0]);
  const [wifiSettings, setWifiSettings] = useState<Settings>(() => ({ ...settings, players: 2, sources: defaultSettings().sources }));
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  const [session, setSession] = useState<Session | null>(null);
  const current = useRef(session);
  current.current = session;
  const [saved, setSaved] = useState(loadGame);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    let frame = 0;
    const poll = () => {
      input.poll();
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    input.onPause = () => {
      const s = current.current;
      if (s?.paused) s.resume();
      else s?.pause();
    };
    input.onDisconnect = () => current.current?.pause('En handkontroll kopplades från. Anslut den igen.');
    const blur = () => {
      current.current?.setForeground(false);
      gameAudio.stop();
    };
    const focus = () => {
      if (!document.hidden) current.current?.setForeground(true);
    };
    const visibility = () => {
      if (document.hidden) blur();
      else focus();
    };
    window.addEventListener('keydown', input.keyDown);
    window.addEventListener('keyup', input.keyUp);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', blur);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerdown', gameAudio.unlock, true);
    window.addEventListener('keydown', gameAudio.unlock, true);
    return () => {
      cancelAnimationFrame(frame);
      current.current?.dispose();
      window.removeEventListener('keydown', input.keyDown);
      window.removeEventListener('keyup', input.keyUp);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', blur);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pointerdown', gameAudio.unlock, true);
      window.removeEventListener('keydown', gameAudio.unlock, true);
    };
  }, [input]);
  const launch = (state: GameState) => {
    if (!controlsReady(state.settings, input)) return;
    session?.dispose();
    setSession(new Session(state, input));
  };
  const menu = () => {
    session?.save();
    session?.dispose();
    setSession(null);
    setSaved(loadGame());
  };
  if (session)
    return (
      <Match
        session={session}
        onMenu={menu}
        onReplay={() => {
          if (session instanceof NetworkSession) {
            session.rematch();
            return;
          }
          clearGame();
          launch(createGame(session.state.settings));
        }}
      />
    );
  if (wifi) {
    const local = { ...wifiSettings, players: 1 as const, sources: [wifiSource] };
    return (
      <WifiLobby
        name='Sagospelen'
        maxPlayers={4}
        config={wifiSettings}
        configure={(c, count) => ({ ...c, players: count as Settings['players'] })}
        readyKey={(c) => JSON.stringify({ ...c, players: 0 })}
        validConfig={validNetworkSettings}
        validStart={validNetworkState}
        summary={(c) => (
          <p>
            {c.championship ? 'Sexkamp' : eventInfo(c.event).name} · {c.players} spelare ·{' '}
            {c.characters
              .slice(0, c.players)
              .map((id) => character(id).name)
              .join(' / ')}
          </p>
        )}
        available={controlsReady(local, input)}
        controls={<ControlSetup input={input} settings={local} onChange={(s) => setWifiSource(s.sources[0])} />}
        hostSettings={
          <>
            <label>
              Tävling
              <select
                aria-label='Tävling'
                value={wifiSettings.championship ? 'championship' : wifiSettings.event}
                onChange={(e) =>
                  setWifiSettings({
                    ...wifiSettings,
                    championship: e.target.value === 'championship',
                    event: e.target.value === 'championship' ? wifiSettings.event : (e.target.value as Settings['event']),
                  })
                }
              >
                <option value='championship'>Sexkamp</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Löpstil
              <select value={wifiSettings.assist ? 'hold' : 'rhythm'} onChange={(e) => setWifiSettings({ ...wifiSettings, assist: e.target.value === 'hold' })}>
                <option value='hold'>Hjälpläge · håll för jämn fart</option>
                <option value='rhythm'>Arkad · snabbare tryck ger mer fart</option>
              </select>
            </label>
            {([0, 1, 2, 3] as const).map((player) => (
              <label key={player}>
                Figur spelare {player + 1}
                <select
                  value={wifiSettings.characters[player]}
                  onChange={(e) => {
                    const ids = [...wifiSettings.characters];
                    const id = e.target.value as CharacterId;
                    const other = ids.indexOf(id);
                    if (other >= 0) ids[other] = ids[player];
                    ids[player] = id;
                    setWifiSettings({ ...wifiSettings, characters: ids });
                  }}
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </>
        }
        onBack={() => setWifi(false)}
        onLaunch={(connections, config, state, room) => {
          // The room is only for pairing; the event keeps the players it started with.
          room?.close();
          const slot = state ? connections[0].slot : 0;
          setSession(new NetworkSession((state as GameState) ?? createGame(config), input, wifiSource, connections, slot));
          setWifi(false);
        }}
      />
    );
  }
  return (
    <Menu
      input={input}
      settings={settings}
      onChange={setSettings}
      onWifi={() => setWifi(true)}
      saved={saved}
      onStart={() => {
        clearGame();
        launch(createGame(settings));
      }}
      onResume={() => saved && launch(structuredClone(saved))}
    />
  );
}

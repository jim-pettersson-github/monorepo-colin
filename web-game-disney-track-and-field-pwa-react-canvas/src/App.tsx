import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Portrait, Stadium } from './components/Artwork';
import { ControlLegend, ControlSetup, controlsReady, TouchControls } from './components/Controls';
import { FullscreenButton } from './components/FullscreenButton';
import { GameUpdate } from './components/GameUpdate';
import { SportIcon } from './components/Icons';
import { gameAudio } from './game/audio';
import { GameInput } from './game/input';
import type { CharacterId, GameState, Settings } from './game/model';
import {
  angle,
  barHeight,
  championshipEvents,
  character,
  characters,
  createGame,
  defaultSettings,
  eventInfo,
  events,
  formatResult,
  jumpEvent,
  obstacleCount,
  raceScale,
  ranking,
  stationaryEvent,
  verticalEvent,
} from './game/model';
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
  return (
    <section className='character-selection' aria-label={`Välj figur spelare ${player + 1}`}>
      <div className='section-title'>
        <h3>
          <span className={`player-dot player-${player}`}>P{player + 1}</span> {character(settings.characters[player]).name}
        </h3>
        <span>Välj din favorit</span>
      </div>
      <div className='character-grid'>
        {characters.map((c) => (
          <button
            type='button'
            key={c.id}
            aria-label={`Spelare ${player + 1}: ${c.name}`}
            aria-pressed={settings.characters[player] === c.id}
            style={{ '--character': c.color } as React.CSSProperties}
            onClick={() => {
              const ids: [CharacterId, CharacterId] = [...settings.characters];
              const other = player === 0 ? 1 : 0;
              if (ids[other] === c.id) ids[other] = ids[player];
              ids[player] = c.id;
              onChange({ ...settings, characters: ids });
            }}
          >
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
}: {
  input: GameInput;
  settings: Settings;
  onChange: (s: Settings) => void;
  saved: GameState | null;
  onStart: () => void;
  onResume: () => void;
}) {
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  const event = eventInfo(settings.event);
  const records = loadRecords();
  const best = records[recordKey(settings.event, settings.assist)];
  const [category, setCategory] = useState<'all' | 'run' | 'jump' | 'throw'>('run');
  const visibleEvents = events.filter(
    (e) => category === 'all' || (category === 'run' ? e.type === 'run' : category === 'jump' ? e.icon === 'jump' : e.icon === 'throw'),
  );
  const preview = useRef<CharacterId[]>(['mickey', 'stitch', 'elsa']);
  return (
    <main className='menu-shell'>
      <header className='app-header'>
        <Logo />
        <div className='header-tools'>
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
          <p className='intro-copy'>Små steg. Stora språng. Dina favoriter möts på löparbanan.</p>
          <div className='feature-pills'>
            <span>20 individuella grenar</span>
            <span>1–2 spelare</span>
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
          {(['run', 'jump', 'throw', 'all'] as const).map((c) => (
            <button type='button' key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {{ run: 'Löpning & gång · 12', jump: 'Hopp · 4', throw: 'Kast · 4', all: 'Alla · 20' }[c]}
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
              <small>{e.type === 'run' ? 'LÖPNING' : 'BÄST AV TRE'}</small>
            </button>
          ))}
        </div>
        <div className='event-description'>
          <div>
            <span className='eyebrow'>{settings.championship ? 'SEX GRENAR · EN POKAL' : event.label}</span>
            <h3>{settings.championship ? 'Hela arenan är din.' : event.name}</h3>
            <p>{settings.championship ? '100 m, 200 m, häck, längdhopp, spjut och kula. Poäng efter varje gren. Flest poäng vinner!' : event.description}</p>
          </div>
          <span className='record-badge'>
            <SportIcon kind='star' />
            <small>DITT REKORD · {settings.assist ? 'HÅLL' : 'RYTM'}</small>
            <strong>{best ? formatResult(best.value, settings.event) : 'Ditt första väntar'}</strong>
          </span>
        </div>
      </section>
      <section className='start-section' aria-label='Starta tävlingen'>
        <div>
          <span className='eyebrow'>KLAR PÅ STARTLINJEN?</span>
          <h2>{settings.championship ? 'Dags för sexkamp.' : `${event.name}. Nu kör vi.`}</h2>
          <p>
            {settings.players === 1 ? 'Du och tre datorfigurer' : 'Ni två och två datorfigurer'} ·{' '}
            {settings.assist ? 'Håll för att springa' : 'Klassisk knapprytm'}
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
        <div className='section-title'>
          <h2>Vilka är med?</h2>
          <fieldset className='segmented' aria-label='Antal spelare'>
            <button type='button' aria-pressed={settings.players === 1} onClick={() => onChange({ ...settings, players: 1 })}>
              En spelare
            </button>
            <button type='button' aria-pressed={settings.players === 2} onClick={() => onChange({ ...settings, players: 2 })}>
              Två spelare
            </button>
          </fieldset>
        </div>
        <CharacterPicker player={0} settings={settings} onChange={onChange} />
        {settings.players === 2 && <CharacterPicker player={1} settings={settings} onChange={onChange} />}
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
                  <option value='hold'>Håll för att springa</option>
                  <option value='rhythm'>Växla knappar · arkad</option>
                </select>
              </label>
            </div>
            <p className='small muted'>
              {settings.assist
                ? 'Håll en av stegknapparna för att springa. Hoppa eller kasta med stjärnknappen.'
                : 'Tryck vänster–höger–vänster–höger för att bygga fart. Håll inte knapparna intryckta.'}
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
  if (obstacleCount(state.event)) return <>Hoppa strax före hindret. Fortsätt springa!</>;
  if (state.event === 'raceWalk') return <>Håll en jämn gångrytm. Hoppa inte.</>;
  if (state.event === 'tripleJump') return <>Hoppa före plankan. Tryck igen vid varje landning.</>;
  if (verticalEvent(state.event)) return <>Ta sats. Hoppa nära linjen. Ribba: {barHeight(state.event, state.attempt).toFixed(2)} m.</>;
  if (state.event === 'longJump') return <>Bygg fart · Hoppa före den vita plankan.</>;
  if (state.event === 'javelin') return <>Bygg fart · Kasta före den vita linjen.</>;
  if (stationaryEvent(state.event)) return <>Bygg kraft med stegknapparna · Tryck Kasta.</>;
  return (
    <>
      {state.settings.assist ? 'Håll en stegknapp hela vägen till mål.' : 'Växla vänster och höger för att bygga fart.'}
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
    <main className='game-shell'>
      <header className='race-header'>
        <Logo />
        <div className='event-heading'>
          <span>
            {s.settings.championship ? `SEXKAMP · GREN ${s.round + 1}/6` : 'SNABB GREN'}
            {info.type === 'field' ? ` · FÖRSÖK ${s.attempt + 1}/3` : ''}
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
            <small>{s.settings.assist ? 'Håll en stegknapp när starten går' : 'Hitta rytmen när starten går'}</small>
          </div>
        )}
        {info.type === 'field' && s.phase === 'playing' && (
          <div className='angle-meter'>
            <span>{jumpEvent(s.event) ? 'AVSTAMP' : `KASTVINKEL · ${Math.round(angle(s.time))}°`}</span>
            <div>
              <i style={{ left: `${jumpEvent(s.event) ? Math.min(100, (s.runners[0].x / 18) * 100) : ((angle(s.time) - 30) / 26) * 100}%` }} />
            </div>
            <small>
              {jumpEvent(s.event)
                ? s.runners[0].landingWindow > 0
                  ? 'TRYCK IGEN FÖR NÄSTA STEG'
                  : `${Math.max(0, 18 - s.runners[0].x).toFixed(1)} m till avstamp`
                : 'Den gula zonen ger en bra vinkel'}
            </small>
          </div>
        )}
      </section>
      <section className='runner-status' aria-label='Löparnas läge'>
        {s.runners.map((r, i) => (
          <div key={r.character} className={`status-player player-${i}`}>
            <span className='lane-number'>{i + 1}</span>
            <div>
              <strong>
                {character(r.character).name}
                <small>{r.human === null ? 'DATOR' : `SPELARE ${r.human + 1}`}</small>
              </strong>
              <progress aria-label={`Fart ${character(r.character).name}`} max={11} value={r.speed} />
            </div>
            <span>
              {r.done ? formatResult(r.result, s.event) : info.type === 'run' ? `${Math.floor(r.x)} m` : r.foul ? 'Övertramp' : `${r.speed.toFixed(1)} m/s`}
            </span>
          </div>
        ))}
      </section>
      <footer className='race-controls'>
        {Array.from({ length: s.settings.players }, (_, i) =>
          s.settings.sources[i] === 'touch' ? (
            <TouchControls key={s.settings.characters[i]} input={session.input} player={i} event={s.event} />
          ) : (
            <div className='keyboard-controls' key={s.settings.characters[i]}>
              <strong className={`player-dot player-${i}`}>P{i + 1}</strong>
              <ControlLegend player={i} input={session.input} source={s.settings.sources[i]} assist={s.settings.assist} />
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
            <p>Din gren och sexkamp sparas. Du kan fortsätta från startmenyn.</p>
            <button type='button' className='primary' onClick={onMenu}>
              Spara och gå till menyn
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
            {!final ? (
              <button type='button' className='primary' onClick={session.next}>
                {s.phase === 'attempt-result' ? 'Nästa försök' : `Nästa gren · ${eventInfo(championshipEvents[s.round + 1]).name}`} →
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
          clearGame();
          launch(createGame(session.state.settings));
        }}
      />
    );
  return (
    <Menu
      input={input}
      settings={settings}
      onChange={setSettings}
      saved={saved}
      onStart={() => {
        clearGame();
        launch(createGame(settings));
      }}
      onResume={() => saved && launch(structuredClone(saved))}
    />
  );
}

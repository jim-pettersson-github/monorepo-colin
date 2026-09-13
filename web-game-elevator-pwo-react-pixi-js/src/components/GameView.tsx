import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { buildings, currentBuilding, definition, isOpen, layout, liftPhase, playerLevel } from '../game/model';
import type { GameSession } from '../game/session';
import { FullscreenButton } from './FullscreenButton';
import { GameScene } from './GameScene';
import { GameUpdate } from './GameUpdate';
import '../game.css';

export function GameView({ session, onMenu }: { session: GameSession; onMenu: () => void }) {
  useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [tab, setTab] = useState<'lift' | 'room'>('lift');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [offline, setOffline] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const settings = useRef<HTMLDialogElement>(null);
  const sign = useRef<HTMLDialogElement>(null);
  const floorPanel = useRef<HTMLElement>(null);
  const player = session.state.player;
  const building = currentBuilding(session.state);
  const lift = building?.lift;
  const moving = lift?.destination !== null && lift !== undefined;
  const manual = building?.id === 'house';
  const currentFloor = Math.round(playerLevel(session.state));
  const localOpen = lift && isOpen(lift) && lift.position === player.floor;
  const thresholdReachable = lift && !moving && lift.position === player.floor && Math.min(lift.landing.open, lift.gate.open) > 0.15;
  const frozen = session.paused || session.hidden;
  const panel = session.ui.panel;

  useEffect(() => {
    if (panel !== 'floors') return;
    const opener = document.activeElement;
    floorPanel.current?.querySelector<HTMLButtonElement>('.floor-buttons button')?.focus();
    const dismissFloorPanel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      session.ui.panel = null;
      session.notify();
    };
    document.addEventListener('keydown', dismissFloorPanel);
    return () => {
      document.removeEventListener('keydown', dismissFloorPanel);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [panel, session]);

  useEffect(() => {
    if (panel === 'sign' && !sign.current?.open) {
      sign.current?.showModal();
      session.pause(true);
    }
  }, [panel, session]);

  useEffect(() => {
    let active = true;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (active) setOffline(true);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  const closePanel = () => {
    session.ui.panel = null;
    session.pause(false);
  };

  return (
    <main className={`game${controlsOpen ? ' controls-open' : ''}`} data-place={player.place} data-floor={currentFloor} data-riding={player.riding}>
      <button
        type='button'
        className='controls-toggle'
        aria-expanded={controlsOpen}
        aria-controls='game-controls'
        onClick={() => setControlsOpen((open) => !open)}
      >
        {controlsOpen ? '× Dölj kontroller' : '☰ Kontroller'}
      </button>
      <header className='game-header'>
        <button type='button' className='round-control' aria-label='Till menyn' onClick={onMenu}>
          ←
        </button>
        <div className='location'>
          <strong>{building ? definition(building.id).name : 'Mellan husen'}</strong>
          <span>{building ? `${definition(building.id).rooms[currentFloor]} · Våning ${currentFloor}` : 'Välj ett hus att besöka'}</span>
        </div>
        <div className='header-actions'>
          <FullscreenButton compact />
          <button
            type='button'
            className='round-control'
            aria-label='Inställningar'
            onClick={() => {
              setConfirmRestart(false);
              session.pause(true);
              settings.current?.showModal();
            }}
          >
            ☰
          </button>
        </div>
      </header>

      <div className='world-wrap'>
        <GameScene session={session} paused={frozen} />
        {player.stairs && <span className='journey-label'>I trappan {player.stairs.to > player.stairs.from ? '↑' : '↓'}</span>}
        {player.riding && <span className='journey-label'>I hissen · {moving ? 'på väg' : `våning ${currentFloor}`}</span>}
      </div>

      <section id='game-controls' className='game-controls' aria-label='Spelkontroller'>
        {building && lift ? (
          <>
            <div className='lift-status'>
              <span className='floor-display'>
                {moving ? (lift.destination !== null && lift.destination > lift.position ? '↑' : '↓') : '•'} {Math.round(lift.position)}
              </span>
              <output aria-label='Hissens läge'>{liftPhase(lift)}</output>
              {manual && <span className='lift-kind'>GRINDHISS</span>}
            </div>
            <fieldset className='action-tabs' aria-label='Välj kontroller'>
              <button type='button' aria-pressed={tab === 'lift'} onClick={() => setTab('lift')}>
                Hissen
              </button>
              <button type='button' aria-pressed={tab === 'room'} onClick={() => setTab('room')}>
                Upptäck rummet
              </button>
            </fieldset>
            {tab === 'lift' ? (
              <>
                <div className='action-grid'>
                  <button type='button' disabled={player.riding || !!player.stairs} onClick={() => session.send({ type: 'call' })}>
                    <span aria-hidden='true'>↕</span>Hämta hiss
                  </button>
                  <button
                    type='button'
                    disabled={!!player.stairs || (!player.riding && !localOpen)}
                    onClick={() => session.send({ type: player.riding ? 'leave' : 'board' })}
                  >
                    <span aria-hidden='true'>{player.riding ? '←' : '→'}</span>
                    {player.riding ? 'Gå ut' : 'Gå in'}
                  </button>
                  <button type='button' disabled={!!player.stairs || !thresholdReachable} onClick={() => session.send({ type: 'threshold' })}>
                    <span aria-hidden='true'>↔</span>Stå i dörren
                  </button>
                  <button type='button' disabled={!player.riding || !!player.stairs} onClick={() => session.send({ type: 'panel' })}>
                    <span aria-hidden='true'>0 1 2</span>Välj våning
                  </button>
                </div>
                {!manual && (
                  <div className='gate-controls'>
                    <button
                      type='button'
                      disabled={moving || !!player.stairs || lift.position !== player.floor}
                      onClick={() => session.send({ type: 'landing' })}
                    >
                      {lift.landing.target ? 'Stäng dörrarna' : 'Öppna dörrarna'}
                    </button>
                  </div>
                )}
                {manual && (
                  <div className='gate-controls'>
                    <button type='button' disabled={moving || lift.position !== player.floor} onClick={() => session.send({ type: 'landing' })}>
                      {lift.landing.target ? 'Stäng dörren' : 'Öppna dörren'}
                    </button>
                    <button type='button' disabled={moving || lift.position !== player.floor} onClick={() => session.send({ type: 'gate' })}>
                      {lift.gate.target ? 'Stäng grinden' : 'Öppna grinden'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className='action-grid'>
                <button type='button' aria-pressed={building.lights[player.floor]} onClick={() => session.send({ type: 'light' })}>
                  <span aria-hidden='true'>☼</span>
                  {building.lights[player.floor] ? 'Släck ljuset' : 'Tänd ljuset'}
                </button>
                <button type='button' onClick={() => session.send({ type: 'roomDoor' })}>
                  <span aria-hidden='true'>▯</span>
                  {building.roomDoors[player.floor] ? 'Stäng rumsdörr' : 'Öppna rumsdörr'}
                </button>
                <button type='button' onClick={() => session.send({ type: 'sign' })}>
                  <span aria-hidden='true'>△ !</span>Varningsskylt
                </button>
                <button type='button' aria-pressed={session.ui.alarmRemaining > 0} onClick={() => session.send({ type: 'alarm' })}>
                  <span aria-hidden='true'>{session.ui.alarmRemaining > 0 ? '■' : '♪'}</span>
                  {session.ui.alarmRemaining > 0 ? 'Stoppa ljudprov' : 'Prova larmljud'}
                </button>
              </div>
            )}
            <div className='travel-controls'>
              <button
                type='button'
                disabled={player.floor === 0 || !!player.stairs || (player.riding && moving)}
                onClick={() => session.send({ type: 'stairs', direction: -1 })}
              >
                ↓ Trappa
              </button>
              <button
                type='button'
                disabled={player.floor === 2 || !!player.stairs || (player.riding && moving)}
                onClick={() => session.send({ type: 'stairs', direction: 1 })}
              >
                ↑ Trappa
              </button>
              <button
                type='button'
                className='exit-control'
                disabled={!!player.stairs || (player.riding && moving)}
                onClick={() => session.send(player.floor === 0 ? { type: 'exit' } : { type: 'walk', floor: 0, x: layout.exit, depth: 0.3 })}
              >
                {player.floor === 0 ? '→ Utgång' : '↓ Till entrén'}
              </button>
            </div>
            <section className='passenger-controls' aria-label='Personer att hjälpa'>
              {building.people
                .filter((person) => person.phase === 'idle' && person.floor === player.floor)
                .map((person) => (
                  <button
                    key={person.id}
                    type='button'
                    disabled={player.riding || !!player.stairs}
                    onClick={() => session.send({ type: 'invite', id: person.id })}
                    aria-label={`Hjälp ${definition(building.id).people[person.id]} till våning ${person.wanted}`}
                  >
                    {definition(building.id).people[person.id]} <span aria-hidden='true'>→</span> <b>{person.wanted}</b>
                  </button>
                ))}
            </section>
          </>
        ) : (
          <div className='building-choices'>
            {buildings.map((building, index) => (
              <button type='button' key={building.id} onClick={() => session.send({ type: 'enter', building: building.id })}>
                <span aria-hidden='true'>0{index + 1}</span>
                {building.name}
              </button>
            ))}
          </div>
        )}
        <p className='game-notice' role='status'>
          {session.ui.notice}
        </p>
      </section>

      {panel === 'floors' && (
        <section ref={floorPanel} className='floor-panel' aria-label='Välj våning i hissen'>
          <div>
            <strong>Vart ska hissen åka?</strong>
            <button
              type='button'
              className='round-control'
              aria-label='Stäng våningspanelen'
              onClick={() => {
                session.ui.panel = null;
                session.notify();
              }}
            >
              ×
            </button>
          </div>
          <div className='floor-buttons'>
            {[0, 1, 2].map((floor) => (
              <button
                type='button'
                key={floor}
                aria-label={`Våning ${floor}`}
                aria-pressed={lift?.queue.includes(floor) || lift?.destination === floor}
                onClick={() => session.send({ type: 'floor', floor })}
              >
                {floor}
              </button>
            ))}
          </div>
        </section>
      )}

      <dialog ref={sign} className='info-panel' aria-labelledby='warning-title' onClose={closePanel}>
        <form method='dialog'>
          <button className='close-button' type='submit' aria-label='Stäng skylten'>
            ×
          </button>
        </form>
        <div className='warning-art' aria-hidden='true'>
          !
        </div>
        <h2 id='warning-title'>{manual ? 'Akta grinden' : 'Akta dörrarna'}</h2>
        <p>En varningsskylt vid hissen. Titta på formen, färgen och utropstecknet.</p>
        <p className='panel-note'>Gröna skyltar visar istället vägen till utgången.</p>
      </dialog>

      <dialog ref={settings} className='info-panel settings-panel' aria-labelledby='settings-title' onClose={() => session.pause(false)}>
        <form method='dialog'>
          <button className='close-button' type='submit' aria-label='Stäng inställningar'>
            ×
          </button>
        </form>
        <p className='eyebrow'>EN PAUS I ÄVENTYRET</p>
        <h2 id='settings-title'>Inställningar</h2>
        <label className='toggle-setting'>
          <span>Alla ljud av</span>
          <input type='checkbox' checked={session.state.settings.muted} onChange={(event) => session.settings({ muted: event.target.checked })} />
        </label>
        <label className='slider-setting' htmlFor='lift-volume'>
          Hissljud <output>{Math.round(session.state.settings.liftVolume * 100)} %</output>
          <input
            id='lift-volume'
            type='range'
            min='0'
            max='100'
            value={session.state.settings.liftVolume * 100}
            onChange={(event) => session.settings({ liftVolume: Number(event.target.value) / 100 })}
          />
        </label>
        <label className='slider-setting' htmlFor='alarm-volume'>
          Larmljud <output>{Math.round(session.state.settings.alarmVolume * 100)} %</output>
          <input
            id='alarm-volume'
            type='range'
            min='0'
            max='100'
            value={session.state.settings.alarmVolume * 100}
            onChange={(event) => session.settings({ alarmVolume: Number(event.target.value) / 100 })}
          />
        </label>
        <label className='toggle-setting'>
          <span>Mjuk kamerarörelse</span>
          <input type='checkbox' checked={session.state.settings.smoothCamera} onChange={(event) => session.settings({ smoothCamera: event.target.checked })} />
        </label>
        <p className='save-status' role='status'>
          {session.storageMessage || 'Spelet sparas automatiskt på den här enheten.'}
          {offline && (
            <>
              <br />
              Spelet är redo för offline.
            </>
          )}
        </p>
        <GameUpdate onSave={() => session.save()} />
        <details className='game-help'>
          <summary>Så fungerar det</summary>
          <p>Tryck på golvet för att gå. Hämta hissen, gå in och välj en våning. Du kan kliva ut igen och ta trapporna.</p>
          <p>Välj en våning i husöversikten för att titta. Tryck sedan i rummet så tar Colin trappan dit. Följ Colin tar dig tillbaka till honom.</p>
          <p>
            Den gröna skylten visar trapphuset. Dörren märkt UT på entréplanet leder ut ur huset. Zooma med mushjulet och dra med musen eller ett finger för att
            titta närmare.
          </p>
          <p>Stå i dörröppningen för att hålla hissen kvar. I gamla huset öppnar och stänger du både dörren och grinden själv.</p>
          <p>Tryck på en person med en siffra för att hjälpa till. Personen väntar tills du trycker på hissknapparna.</p>
        </details>
        {confirmRestart ? (
          <section className='restart-confirm' aria-label='Bekräfta omstart'>
            <p>Börja om i hotellets lobby? Dina ljudinställningar behålls.</p>
            <button
              type='button'
              onClick={() => {
                session.restart();
                setConfirmRestart(false);
                settings.current?.close();
              }}
            >
              Ja, börja om
            </button>
            <button type='button' onClick={() => setConfirmRestart(false)}>
              Fortsätt mitt spel
            </button>
          </section>
        ) : (
          <button type='button' className='restart-button' onClick={() => setConfirmRestart(true)}>
            Börja om från entrén
          </button>
        )}
      </dialog>
    </main>
  );
}

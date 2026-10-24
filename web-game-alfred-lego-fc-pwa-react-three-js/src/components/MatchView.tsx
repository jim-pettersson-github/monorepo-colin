import type { CSSProperties } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getMatchClubs } from '../game/clubs';
import type { MatchSession } from '../game/session';
import { ControlGuide } from './ControlGuide';
import { ControlSetup, controlsReady } from './ControlSetup';
import { FullscreenButton } from './FullscreenButton';
import { GameCanvas } from './GameCanvas';
import { GameUpdate } from './GameUpdate';
import { PitchOverview } from './PitchOverview';
import { PlaybackSpeedSelect } from './PlaybackSpeedSelect';
import { SoundSettings, SoundToggle } from './SoundControls';
import { TouchControls } from './TouchControls';

export function MatchView({ session, onExit, onRematch }: { session: MatchSession; onExit: () => void; onRematch: () => void }) {
  useSyncExternalStore(session.subscribe, session.getSnapshot);
  useSyncExternalStore(session.input.subscribe, session.input.getSnapshot);
  const state = session.state;
  const input = session.input;
  const network = session.networkRole !== null;
  const localTeam = session.localTeam ?? 0;
  const canResume = session.canResume && (network ? input.available(0) : state.watching || controlsReady(input, state.mode));
  const clubs = getMatchClubs(state);
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const stayButton = useRef<HTMLButtonElement>(null);
  const modal = session.paused || state.phase === 'finished';
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal) {
      dialog.current?.close();
      setConfirmExit(false);
    }
  }, [modal]);
  useEffect(() => {
    if (confirmExit && dialog.current) {
      dialog.current.scrollTop = 0;
      stayButton.current?.focus();
    }
  }, [confirmExit]);
  const seconds = Math.ceil(state.remaining);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const touchTeam = state.watching
    ? null
    : network
      ? input.sources[0] === 'touch'
        ? localTeam
        : null
      : input.sources[0] === 'touch'
        ? 0
        : state.mode === 'versus' && input.sources[1] === 'touch'
          ? 1
          : null;
  const cards = [0, 1].map((team) => state.players.filter((player) => player.team === team).reduce((sum, player) => sum + (player.yellowCards || 0), 0));
  return (
    <main className={`match-shell ${touchTeam !== null ? 'touch-active' : ''}`} style={{ '--home': clubs[0].shirt, '--away': clubs[1].shirt } as CSSProperties}>
      <header className='match-header'>
        <span className='match-brand'>
          A<span>FC</span>
        </span>
        <section className='scoreboard' aria-label='Resultat'>
          <span className='team-name home-name'>
            {clubs[0].name}
            {cards[0] > 0 && (
              <span className='yellow-card-count' role='img' aria-label={`${cards[0]} gula kort`}>
                ▮ {cards[0]}
              </span>
            )}
          </span>
          <output className='score' aria-label={`${state.score[0]} mot ${state.score[1]}`}>
            {state.score[0]}
            <span>:</span>
            {state.score[1]}
          </output>
          <span className='team-name away-name'>
            {clubs[1].name}
            {cards[1] > 0 && (
              <span className='yellow-card-count' role='img' aria-label={`${cards[1]} gula kort`}>
                ▮ {cards[1]}
              </span>
            )}
          </span>
          <time role='timer' aria-label='Tid kvar'>
            {clock}
          </time>
        </section>
        <button className='pause-button' type='button' aria-label='Pausa matchen' onClick={() => session.pause()}>
          Ⅱ<span>Paus</span>
        </button>
      </header>
      <div className='match-stage'>
        <GameCanvas session={session} />
        <SoundToggle className='match-sound-toggle' />
        <div className='match-ribbon'>
          <span>ALFRED ARENA</span>
          <span>
            5 MOT 5 · {network ? `WI-FI · DU ÄR P${localTeam + 1}` : state.watching ? 'MATCHVISNING' : state.mode === 'solo' ? 'MOT DATORN' : 'TVÅ SPELARE'}
          </span>
        </div>
        {(state.phase === 'kickoff' || state.phase === 'goal') && !session.paused && (
          <div className={`match-announcement ${state.phase === 'goal' ? 'goal-announcement' : ''}`} role='status'>
            <span>{state.phase === 'goal' ? 'SNYGGT SPELAT' : `${clubs[state.kickoffTeam].name.toUpperCase()} HAR BOLLEN`}</span>
            <strong>{state.phase === 'goal' ? 'MÅÅÅL!' : 'Avspark!'}</strong>
            <small>{state.phase === 'goal' ? state.message : 'Gör dig redo'}</small>
          </div>
        )}
        {(state.phase === 'yellow-card' || state.phase === 'free-kick' || state.phase === 'penalty') && !session.paused && (
          <div className='match-announcement decision-announcement' role='status'>
            <span>
              KONTAKT UTAN BOLL · {state.foul ? `${clubs[state.players[state.foul.offender].team].name} #${state.players[state.foul.offender].role + 1}` : ''}
            </span>
            {state.phase === 'yellow-card' && <span className='referee-card' aria-hidden='true' />}
            <strong>{state.phase === 'yellow-card' ? 'Gult kort!' : state.phase === 'penalty' ? 'Straff!' : 'Frispark!'}</strong>
            <small>{state.message}</small>
          </div>
        )}
        {state.phase === 'penalty-ready' && state.foul && !session.paused && (
          <div className={`penalty-hint ${state.foul.team === 0 ? 'penalty-home' : ''}`} role='status'>
            <strong>Straff · {clubs[state.foul.team].name}</strong>
            <span>
              {state.watching || (state.mode === 'solo' && state.foul.team === 1)
                ? 'Datorn gör sig redo att skjuta'
                : 'Sikta med rörelsekontrollen · Tryck Skjut'}
            </span>
          </div>
        )}
        <div className='player-badges'>
          <span className='player-badge team-0'>{state.watching ? clubs[0].code : `● P1 · #${(state.selected[0] % 5) + 1}`}</span>
          <span className='player-badge team-1'>{state.mode === 'solo' ? 'DATOR' : `● P2 · #${(state.selected[1] % 5) + 1}`}</span>
        </div>
        {state.phase !== 'penalty' && state.phase !== 'penalty-ready' && <PitchOverview state={state} />}
      </div>
      {state.watching ? (
        <section className='watch-controls' aria-label='Matchvisning'>
          <span>Datorn spelar båda lagen</span>
          <PlaybackSpeedSelect value={state.playbackSpeed} onChange={session.setPlaybackSpeed.bind(session)} />
        </section>
      ) : touchTeam !== null ? (
        <TouchControls input={input} team={touchTeam} />
      ) : (
        <footer className='match-controls-hint'>
          <ControlGuide source={input.sources[0]} input={input} team={localTeam} compact />
          {!network && state.mode === 'versus' && <ControlGuide source={input.sources[1]} input={input} team={1} compact />}
        </footer>
      )}
      <dialog
        ref={dialog}
        className='match-dialog'
        aria-labelledby='pause-title'
        onCancel={(event) => {
          event.preventDefault();
          if (confirmExit) setConfirmExit(false);
          else if (state.phase !== 'finished' && canResume) session.resume();
        }}
      >
        <p className='eyebrow'>{state.phase === 'finished' ? 'SLUTSIGNAL' : confirmExit ? 'AVSLUTA' : 'MATCHPAUS'}</p>
        <h2 id='pause-title'>{state.phase === 'finished' ? state.message : confirmExit ? 'Avsluta matchen?' : 'Vi tar en paus.'}</h2>
        {confirmExit ? (
          <div className='exit-confirm'>
            <p>
              {network
                ? 'Wi-Fi-matchen avslutas för båda. Ni behöver koppla ihop enheterna igen för en ny match.'
                : state.league
                  ? 'Matchen avbryts. Du kan spela om den från ligan. Dina tidigare ligaresultat sparas.'
                  : 'Vill du avsluta och gå till startmenyn?'}
            </p>
            <button type='button' className='primary-button' onClick={onExit}>
              Ja, avsluta
            </button>
            <button type='button' ref={stayButton} onClick={() => setConfirmExit(false)}>
              Stanna här
            </button>
          </div>
        ) : state.phase === 'finished' ? (
          <>
            <p className='final-score'>
              <span className='home-name'>{state.score[0]}</span>
              <span>–</span>
              <span className='away-name'>{state.score[1]}</span>
            </p>
            {!state.league && session.networkRole !== 'guest' && (
              <button type='button' className='primary-button' disabled={network && !session.canResume} onClick={onRematch}>
                Spela igen <span>↗</span>
              </button>
            )}
            {session.networkRole === 'guest' && <p className='small-copy'>Värden kan starta en returmatch med samma anslutning.</p>}
            <button type='button' onClick={onExit}>
              {state.league ? 'Till ligan' : 'Till startmenyn'}
            </button>
          </>
        ) : (
          <>
            <p className='small-copy'>{session.pauseReason}</p>
            <button
              type='button'
              className='primary-button'
              disabled={!canResume}
              onClick={() => {
                setConfirmExit(false);
                session.resume();
              }}
            >
              Fortsätt matchen <span>▶</span>
            </button>
            <SoundSettings />
            {network && !session.canResume && (
              <p className='control-warning' role='status'>
                Båda behöver vara kvar i spelet med anslutna kontroller och fungerande Wi-Fi. Vid bruten anslutning: avsluta och koppla ihop igen.
              </p>
            )}
            {!state.watching && (
              <ControlSetup
                input={input}
                mode={network ? 'solo' : state.mode}
                clubs={network && localTeam === 1 ? [state.clubs[1], state.clubs[0]] : state.clubs}
                localTeam={network ? localTeam : undefined}
                playerLabel={network ? `Din kontroll · Spelare ${localTeam + 1}` : undefined}
              />
            )}
            <div className='pause-tools'>
              <FullscreenButton />
              <button type='button' onClick={() => setConfirmExit(!confirmExit)}>
                Avsluta matchen
              </button>
            </div>
            <GameUpdate onSave={session.save} />
          </>
        )}
      </dialog>
    </main>
  );
}

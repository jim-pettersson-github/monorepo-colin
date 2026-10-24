import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ClubId, MatchClubs } from '../game/clubs';
import { getClub } from '../game/clubs';
import type { InputManager } from '../game/input';
import type { LeagueAction, Season } from '../game/league';
import { nextFixture } from '../game/league';
import type { Difficulty, MatchMode, MatchState, PlaybackSpeed, Team } from '../game/model';
import { difficultyNames } from '../game/model';
import { ControlSetup, controlsReady } from './ControlSetup';
import { FullscreenButton } from './FullscreenButton';
import { GameUpdate } from './GameUpdate';
import { LeagueView } from './LeagueView';
import { PitchPreview } from './PitchPreview';
import { PlaybackSpeedSelect } from './PlaybackSpeedSelect';
import { TeamSelection } from './TeamSelection';
import './start-menu.css';

interface Props {
  input: InputManager;
  screen: 'quick' | 'league';
  onScreen: (screen: 'quick' | 'league') => void;
  mode: MatchMode;
  onMode: (mode: MatchMode) => void;
  clubs: MatchClubs;
  onClub: (team: Team, id: ClubId) => void;
  duration: number;
  onDuration: (value: number) => void;
  difficulty: Difficulty;
  onDifficulty: (value: Difficulty) => void;
  season: Season | null;
  saved: MatchState | null;
  onQuick: () => void;
  onResume: () => void;
  onSeason: () => void;
  onLeagueMatch: (action: LeagueAction, speed: PlaybackSpeed) => void;
  simulating: boolean;
  simulationError: string;
}

export function StartMenu(props: Props) {
  const { input, screen, onScreen, mode, onMode, clubs, onClub, duration, onDuration, difficulty, onDifficulty, season, saved } = props;
  const [leagueSetup, setLeagueSetup] = useState(false);
  const [replaceSeason, setReplaceSeason] = useState(false);
  const [leagueAction, setLeagueAction] = useState<LeagueAction>(saved?.watching ? 'watch' : 'play');
  const [watchSpeed, setWatchSpeed] = useState<PlaybackSpeed>(saved?.playbackSpeed || 1);
  const { simulating, simulationError } = props;
  const confirm = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (replaceSeason) confirm.current?.showModal();
    else confirm.current?.close();
  }, [replaceSeason]);
  const league = screen === 'league';
  const hub = league && !!season && !leagueSetup;
  const activeMode = league ? 'solo' : mode;
  const next = season ? nextFixture(season) : undefined;
  const beginSeason = () => {
    props.onSeason();
    setLeagueSetup(false);
    setReplaceSeason(false);
  };
  const needsControls = !hub || leagueAction === 'play';
  const ready = !simulating && (!needsControls || controlsReady(input, activeMode));
  const action = hub ? () => props.onLeagueMatch(leagueAction, watchSpeed) : league ? () => (season ? setReplaceSeason(true) : beginSeason()) : props.onQuick;
  const actionText = hub
    ? next
      ? simulating
        ? 'Simulerar matchen…'
        : leagueAction === 'watch'
          ? 'Se nästa ligamatch'
          : leagueAction === 'simulate'
            ? 'Simulera nästa ligamatch'
            : 'Spela nästa ligamatch'
      : 'Säsongen är klar'
    : league
      ? season
        ? 'Starta ny säsong'
        : 'Starta ligan'
      : 'Starta snabbmatch';
  return (
    <main
      className='app-shell menu-shell'
      style={{ '--home': getClub(hub ? season.club : clubs[0]).shirt, '--away': getClub(clubs[1]).shirt } as CSSProperties}
    >
      <header className='app-header'>
        <a className='wordmark' href={import.meta.env.BASE_URL} aria-label='Alfred FC startsida'>
          <span className='club-mark' aria-hidden='true'>
            A
          </span>
          ALFRED <span>FC</span>
        </a>
        <FullscreenButton />
      </header>
      <nav className='play-mode-tabs' aria-label='Välj spelsätt'>
        <button type='button' disabled={simulating} aria-pressed={!league} onClick={() => onScreen('quick')}>
          <strong>Snabbmatch</strong>
          <small>Välj lag och spela direkt</small>
        </button>
        <button type='button' disabled={simulating} aria-pressed={league} onClick={() => onScreen('league')}>
          <strong>Divisionsspel</strong>
          <small>{season ? getClub(season.club).name : '12 lag · En hel säsong'}</small>
        </button>
      </nav>
      {hub ? (
        <>
          <div className='league-toolbar'>
            <p className='small-copy'>Din säsong sparas automatiskt. Du styr ditt lag till vänster på matchens resultattavla.</p>
            <button
              type='button'
              disabled={simulating}
              onClick={() => {
                onClub(0, season.club);
                onDuration(season.duration);
                onDifficulty(season.difficulty);
                setLeagueSetup(true);
              }}
            >
              Ny säsong
            </button>
          </div>
          <LeagueView season={season}>
            {next && (
              <section className='league-match-choice' aria-label='Hur vill du spela ligamatchen?'>
                <h2>Välj hur matchen spelas</h2>
                <fieldset className='league-action-options' aria-label='Ligamatchens spelläge' disabled={simulating}>
                  <button type='button' aria-pressed={leagueAction === 'play'} onClick={() => setLeagueAction('play')}>
                    Spela själv
                  </button>
                  <button type='button' aria-pressed={leagueAction === 'watch'} onClick={() => setLeagueAction('watch')}>
                    Se matchen
                  </button>
                  <button type='button' aria-pressed={leagueAction === 'simulate'} onClick={() => setLeagueAction('simulate')}>
                    Simulera direkt
                  </button>
                </fieldset>
                <p className='small-copy'>
                  {leagueAction === 'play'
                    ? 'Styr ditt lag som vanligt.'
                    : leagueAction === 'watch'
                      ? 'Datorn styr båda lagen. Välj hastighet och följ hela matchen.'
                      : 'Samma match räknas ut utan bild. Resultatet och tabellen sparas direkt.'}
                </p>
                {leagueAction === 'watch' && <PlaybackSpeedSelect value={watchSpeed} onChange={setWatchSpeed} />}
              </section>
            )}
            {simulating && (
              <p className='simulation-status' role='status'>
                Simulerar matchen och uppdaterar ligatabellen…
              </p>
            )}
            {simulationError && (
              <p className='control-warning' role='alert'>
                {simulationError}
              </p>
            )}
          </LeagueView>
          <details className='league-control-details'>
            <summary>Kontroller för ligamatchen</summary>
            <ControlSetup input={input} mode='solo' clubs={[season.club, clubs[1]]} />
          </details>
        </>
      ) : (
        <section className='intro' aria-label={league ? 'Skapa en liga' : 'Skapa en snabbmatch'}>
          <div className='intro-copy'>
            <p className='eyebrow'>5 MOT 5 · KLASSISK KLOSSBOLL</p>
            <h1>
              Dags för
              <br />
              <span>avspark.</span>
            </h1>
            <p className='description'>
              {league
                ? 'Ditt lag. Din division. Hela vägen till sista omgången.'
                : 'Välj dina lag och tryck på den gröna startknappen. Inställningarna kan du ändra när du vill.'}
            </p>
            <div className='pitch-card'>
              <div className='pitch-caption'>
                <span>ALFRED ARENA</span>
                <span>5 MOT 5</span>
              </div>
              <PitchPreview clubs={clubs} />
            </div>
          </div>
          <section className='match-setup' aria-label='Matchinställningar'>
            <p className='eyebrow'>{league ? 'BYGG DIN SÄSONG' : 'SPELA DIREKT'}</p>
            <h2>{league ? 'Välj ditt ligalag.' : 'Din snabbmatch.'}</h2>
            {league ? (
              <p className='small-copy'>Du spelar mot datorn. Alla 12 lag möts hemma och borta: 22 omgångar och ett färdigt spelschema.</p>
            ) : (
              <fieldset className='mode-options' aria-label='Spelläge'>
                <button type='button' aria-pressed={mode === 'solo'} onClick={() => onMode('solo')}>
                  <span>01</span>
                  <strong>Mot datorn</strong>
                  <small>Du och ditt lag mot AI</small>
                </button>
                <button type='button' aria-pressed={mode === 'versus'} onClick={() => onMode('versus')}>
                  <span>02</span>
                  <strong>Två spelare</strong>
                  <small>En kompis. Samma skärm.</small>
                </button>
              </fieldset>
            )}
            <TeamSelection key={league ? 'league' : 'quick'} selected={clubs} mode={activeMode} single={league} onChange={onClub} />
            <div className='match-options'>
              <label>
                Matchlängd
                <select value={duration} onChange={(event) => onDuration(Number(event.target.value))}>
                  <option value={60}>1 minut</option>
                  <option value={180}>3 minuter</option>
                  <option value={300}>5 minuter</option>
                </select>
              </label>
              {activeMode === 'solo' && (
                <label>
                  Motstånd
                  <select value={difficulty} onChange={(event) => onDifficulty(event.target.value as Difficulty)}>
                    {(['easy', 'normal', 'hard'] as const).map((level) => (
                      <option key={level} value={level}>
                        {difficultyNames[level]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {activeMode === 'solo' && (
              <p className='difficulty-description'>
                {difficulty === 'easy'
                  ? 'Gott om tid med bollen. Långsammare motståndare som inte glidtacklar.'
                  : difficulty === 'normal'
                    ? 'Ett lugnare matchtempo med aktiva motståndare.'
                    : 'Snabba motståndare, tätare press och säkrare skott.'}
              </p>
            )}
            <ControlSetup input={input} mode={activeMode} clubs={clubs} />
            <p className='setup-footnote'>AI sköter medspelare och målvakt. Bara kontakt utan bollvinst kan ge kort, frispark eller straff.</p>
          </section>
        </section>
      )}
      <footer className='app-footer'>
        <span>ALFRED FC / BRICK FOOTBALL CLUB</span>
        <span>Dator · Mobil · Handkontroll</span>
      </footer>
      <GameUpdate />
      <section className='start-dock' aria-label='Starta spelet'>
        <div className='start-dock-summary'>
          <strong>{hub ? getClub(season.club).name : league ? 'Din nya liga' : `${getClub(clubs[0]).name} – ${getClub(clubs[1]).name}`}</strong>
          <small>
            {hub
              ? next
                ? `Omgång ${next.round + 1} av 22`
                : 'Alla matcher är spelade'
              : `${league ? 'Divisionsspel' : mode === 'solo' ? 'Mot datorn' : 'Två spelare'} · ${duration / 60} min${activeMode === 'solo' ? ` · ${difficultyNames[difficulty]}` : ''}`}
          </small>
        </div>
        <div className='start-dock-actions'>
          {saved && (
            <button
              type='button'
              className='resume-save'
              disabled={simulating || (!saved.watching && !controlsReady(input, saved.mode))}
              onClick={props.onResume}
            >
              Fortsätt sparad {saved.watching ? 'matchvisning' : saved.league ? 'ligamatch' : saved.mode === 'solo' ? 'solomatch' : 'tvåspelarmatch'} ·{' '}
              {saved.score[0]}–{saved.score[1]}
            </button>
          )}
          <button type='button' className='primary-button start-button' disabled={!ready || (hub && !next)} onClick={action}>
            {actionText}
            <span aria-hidden='true'>▶</span>
          </button>
        </div>
        {needsControls && !controlsReady(input, activeMode) && <p className='control-warning'>Välj olika, anslutna kontroller för spelarna ovan.</p>}
      </section>
      <dialog
        ref={confirm}
        className='match-dialog'
        aria-labelledby='replace-season-title'
        onCancel={(event) => {
          event.preventDefault();
          setReplaceSeason(false);
        }}
      >
        <p className='eyebrow'>NY SÄSONG</p>
        <h2 id='replace-season-title'>Börja om ligan?</h2>
        <p>Den nuvarande säsongens tabell och resultat ersätts när du startar den nya.</p>
        <button type='button' className='primary-button' onClick={beginSeason}>
          Ja, starta ny säsong
        </button>
        <button
          type='button'
          onClick={() => {
            setReplaceSeason(false);
            setLeagueSetup(false);
          }}
        >
          Behåll min säsong
        </button>
      </dialog>
    </main>
  );
}

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ClubId, MatchClubs } from '../game/clubs';
import { getClub } from '../game/clubs';
import type { Cup } from '../game/cups';
import type { InputManager } from '../game/input';
import type { LeagueAction, Season } from '../game/league';
import { initialDivisions, nextFixture, opponentClub, seasonRounds } from '../game/league';
import type { CupKind, Difficulty, MatchMode, MatchState, PlaybackSpeed, Team } from '../game/model';
import { difficultyNames } from '../game/model';
import { roomServer } from '../game/room-server';
import { ControlSetup, controlsReady } from './ControlSetup';
import { CupPanel } from './CupPanel';
import { FullscreenButton } from './FullscreenButton';
import { GameUpdate } from './GameUpdate';
import { LeagueView } from './LeagueView';
import { PitchPreview } from './PitchPreview';
import { PlaybackSpeedSelect } from './PlaybackSpeedSelect';
import { SoundSettings, SoundToggle } from './SoundControls';
import { TeamSelection } from './TeamSelection';
import './start-menu.css';
import type { TransferSave } from '../game/transfers';
import { TransferPanel } from './TransferPanel';

interface Props {
  transfers: TransferSave;
  onTransfers: (save: TransferSave) => void;
  cups: Record<CupKind, Cup | null>;
  cupKind: CupKind;
  onCupKind: (kind: CupKind) => void;
  onCreateCup: (kind: CupKind, club: ClubId, difficulty: Difficulty, duration: number) => void;
  onCupMatch: (kind: CupKind, action: LeagueAction, speed: PlaybackSpeed) => void;
  onWifi: () => void;
  input: InputManager;
  screen: 'quick' | 'league' | 'cups' | 'market';
  onScreen: (screen: 'quick' | 'league' | 'cups' | 'market') => void;
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
  onSeason: (continuing?: boolean) => void;
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
  const activeMode = league ? (hub && leagueAction === 'local' ? 'versus' : 'solo') : mode;
  const next = season ? nextFixture(season) : undefined;
  const beginSeason = () => {
    props.onSeason();
    setLeagueSetup(false);
    setReplaceSeason(false);
  };
  const needsControls = !hub || leagueAction === 'play' || leagueAction === 'local';
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
            : leagueAction === 'wifi'
              ? 'Koppla upp ligamatch via Wi-Fi'
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
        <div className='header-tools'>
          <a className='all-games-link' href={`${import.meta.env.BASE_URL}../`}>
            ← Alla spel
          </a>
          <SoundToggle />
          <FullscreenButton />
        </div>
      </header>
      <GameUpdate />
      <nav className='play-mode-tabs' aria-label='Välj spelsätt'>
        <button type='button' disabled={simulating} aria-pressed={screen === 'quick'} onClick={() => onScreen('quick')}>
          <strong>Snabbmatch</strong>
          <small>Välj lag och spela direkt</small>
        </button>
        <button type='button' disabled={simulating} aria-pressed={league} onClick={() => onScreen('league')}>
          <strong>Divisionsspel</strong>
          <small>{season ? getClub(season.club).name : '20 lag · Två divisioner'}</small>
        </button>
        <button type='button' disabled={simulating} aria-pressed={screen === 'cups'} onClick={() => onScreen('cups')}>
          <strong>Cupspel</strong>
          <small>Klubbcuper & Världscupen</small>
        </button>
        <button type='button' disabled={simulating} aria-pressed={screen === 'market'} onClick={() => onScreen('market')}>
          <strong>Trupp & transfers</strong>
          <small>{props.transfers.money[props.transfers.activeClub].toLocaleString('sv-SE')} mynt</small>
        </button>
      </nav>
      {screen === 'market' ? (
        <TransferPanel save={props.transfers} onChange={props.onTransfers} locked={!!saved || simulating} />
      ) : screen === 'cups' ? (
        <CupPanel
          input={input}
          cups={props.cups}
          kind={props.cupKind}
          onKind={props.onCupKind}
          saved={saved}
          onResume={props.onResume}
          onCreate={props.onCreateCup}
          onPlay={props.onCupMatch}
          simulating={simulating}
          error={simulationError}
        />
      ) : (
        <>
          <section className='start-panel' aria-label='Starta spelet'>
            <div className='start-panel-summary'>
              <strong>
                {hub
                  ? `${getClub(season.club).name}${next ? ` – ${getClub(opponentClub(season, next)).name}` : ''}`
                  : league
                    ? 'Din nya liga'
                    : `${getClub(clubs[0]).name} – ${getClub(clubs[1]).name}`}
              </strong>
              <small>
                {hub
                  ? next
                    ? `Omgång ${next.round + 1} av ${seasonRounds(season)} · ${leagueAction === 'local' ? 'Två på samma skärm' : leagueAction === 'wifi' ? 'Två via Wi-Fi' : leagueAction === 'play' ? 'Mot datorn' : leagueAction === 'watch' ? 'Matchvisning' : 'Simulering'}`
                    : 'Alla matcher är spelade'
                  : `${league ? 'Divisionsspel' : mode === 'solo' ? 'Mot datorn' : 'Två spelare'} · ${duration / 60} min${activeMode === 'solo' ? ` · ${difficultyNames[difficulty]}` : ''}`}
              </small>
            </div>
            <div className='start-panel-actions'>
              {saved && (
                <button
                  type='button'
                  className='resume-save'
                  disabled={simulating || (!saved.watching && !controlsReady(input, saved.mode))}
                  onClick={props.onResume}
                >
                  Fortsätt sparad{' '}
                  {saved.watching
                    ? 'matchvisning'
                    : saved.cup
                      ? 'cupmatch'
                      : saved.league
                        ? 'ligamatch'
                        : saved.mode === 'solo'
                          ? 'solomatch'
                          : 'tvåspelarmatch'}{' '}
                  · {saved.score[0]}–{saved.score[1]}
                </button>
              )}
              <button type='button' className='primary-button start-button' disabled={!ready || (hub && !next)} onClick={action}>
                {actionText}
                <span aria-hidden='true'>▶</span>
              </button>
            </div>
            {needsControls && !controlsReady(input, activeMode) && <p className='control-warning'>Välj olika, anslutna kontroller under Spelkontroller.</p>}
          </section>
          <button type='button' className='wifi-entry' disabled={simulating} onClick={props.onWifi}>
            <strong>{roomServer() ? 'Spela online' : 'Spela via Wi-Fi'}</strong>
            <span>{roomServer() ? 'Två enheter · rumskod, eller QR på samma Wi-Fi ↗' : 'Två enheter · Koppla ihop med QR-koder ↗'}</span>
          </button>
          {hub ? (
            <>
              <div className='league-toolbar'>
                <p className='small-copy'>Din säsong sparas automatiskt. Spelare 1 styr ditt lag; spelare 2 styr motståndarlaget i nästa omgång.</p>
                {!next && (
                  <button type='button' className='primary-button' onClick={() => props.onSeason(true)}>
                    Starta nästa säsong
                  </button>
                )}
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
                      <button type='button' aria-pressed={leagueAction === 'local'} onClick={() => setLeagueAction('local')}>
                        Två på samma skärm
                      </button>
                      <button type='button' aria-pressed={leagueAction === 'wifi'} onClick={() => setLeagueAction('wifi')}>
                        Två via Wi-Fi
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
                        : leagueAction === 'local'
                          ? 'Spela mot varandra på samma skärm. Välj varsin kontroll nedan. Resultatet räknas i din liga.'
                          : leagueAction === 'wifi'
                            ? 'Du är värd för nästa ligamatch. Kompisen ansluter från Spela via Wi-Fi och styr motståndarlaget. Säsongen sparas på din enhet.'
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
                <ControlSetup input={input} mode={activeMode} clubs={[season.club, next ? opponentClub(season, next) : clubs[1]]} />
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
                  <p className='small-copy'>
                    20 klubbar i två divisioner med tio lag. Hemma och borta i 18 omgångar. Två lag flyttas upp och två ned efter varje säsong.
                  </p>
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
                {league && (
                  <p className='small-copy'>
                    Ditt lag börjar i division {initialDivisions().findIndex((group) => group.includes(clubs[0])) + 1}. Alla lag börjar med balanserade
                    stjärntrupper.
                  </p>
                )}
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
        </>
      )}
      <footer className='app-footer'>
        <span>ALFRED FC / BRICK FOOTBALL CLUB</span>
        <span>Dator · Mobil · Handkontroll</span>
      </footer>
      <details className='sound-options'>
        <summary>Ljudinställningar</summary>
        <SoundSettings />
      </details>

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

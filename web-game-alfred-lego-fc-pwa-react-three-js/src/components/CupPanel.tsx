import { useEffect, useRef, useState } from 'react';
import { type ClubId, getClub, type MatchClubs } from '../game/clubs';
import {
  type Cup,
  cupChampion,
  cupFinalRound,
  cupGroupRounds,
  cupGroups,
  cupName,
  cupOpponent,
  cupRoundName,
  cupTeams,
  cupThirdPlaces,
  cupTypes,
  nextCupFixture,
} from '../game/cups';
import type { InputManager } from '../game/input';
import type { LeagueAction } from '../game/league';
import { type CupKind, type Difficulty, difficultyNames, type MatchState, type PlaybackSpeed } from '../game/model';
import { rankingSource } from '../game/nations';
import type { TransferSave } from '../game/transfers';
import { ControlSetup, controlsReady } from './ControlSetup';
import { LineupPicker } from './LineupPicker';
import { NationalFlag } from './NationalFlag';
import { PlaybackSpeedSelect } from './PlaybackSpeedSelect';
import { MatchTeams } from './TeamBrowser';
import { TeamSelection } from './TeamSelection';
import './cups.css';

function Trophy({ masters = false, world = false }: { masters?: boolean; world?: boolean }) {
  if (world)
    return (
      <svg viewBox='0 0 100 110' className='cup-trophy' aria-hidden='true'>
        <circle cx='50' cy='29' r='25' fill='#edc467' stroke='#fff0b7' strokeWidth='2' />
        <path d='m33 11 9 6-3 9 10 5 2 12 10 7m-1-44-4 13 13 7 2 10' fill='none' stroke='#b48635' strokeWidth='5' />
        <path d='M29 52q10 17 10 35h22q0-18 10-35l-12 7-9 19-9-19Z' fill='#dfad48' />
        <path d='M29 87h42v15H29Z' fill='#327268' />
        <path d='M34 92h32' stroke='#edc467' strokeWidth='4' />
      </svg>
    );
  return (
    <svg viewBox='0 0 100 110' className='cup-trophy' aria-hidden='true'>
      <path d='M24 24H9v12q0 25 29 26m38-38h15v12Q91 61 62 62' fill='none' stroke={masters ? '#a8cbd1' : '#dab365'} strokeWidth='7' />
      <path
        d='M25 15h50v25Q74 64 56 69v15h12v9H32v-9h12V69Q26 64 25 40Z'
        fill={masters ? '#bddfe2' : '#f0c66b'}
        stroke={masters ? '#67989f' : '#b48a3f'}
        strokeWidth='2'
      />
      <path d='M31 20v19q0 15 12 21' fill='none' stroke='#fff4cf' strokeWidth='4' strokeLinecap='round' />
      <path d='m50 29 4 8 9 2-6 6 1 9-8-4-8 4 1-9-6-6 9-2Z' fill={masters ? '#648c9a' : '#b98435'} />
      <path d='M25 95h50v9H25Z' fill='#354d57' />
    </svg>
  );
}
interface Props {
  transfers: TransferSave;
  onTransfers: (save: TransferSave) => void;
  input: InputManager;
  cups: Record<CupKind, Cup | null>;
  kind: CupKind;
  onKind: (kind: CupKind) => void;
  saved: MatchState | null;
  onResume: () => void;
  onCreate: (kind: CupKind, club: ClubId, difficulty: Difficulty, duration: number) => void;
  onPlay: (kind: CupKind, action: LeagueAction, speed: PlaybackSpeed) => void;
  simulating: boolean;
  error: string;
}
export function CupPanel({ transfers, onTransfers, input, cups, kind, onKind, saved, onResume, onCreate, onPlay, simulating, error }: Props) {
  const cup = cups[kind];
  const [setup, setSetup] = useState(false);
  const [club, setClub] = useState<ClubId>(cup?.club ?? (kind === 'world' ? 'swe' : 'alfred'));
  const [difficulty, setDifficulty] = useState<Difficulty>(cup?.difficulty ?? 'easy');
  const [duration, setDuration] = useState(cup?.duration ?? 180);
  const [action, setAction] = useState<LeagueAction>('play');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [replace, setReplace] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (replace) dialog.current?.showModal();
    else dialog.current?.close();
  }, [replace]);
  const fixture = cup ? nextCupFixture(cup) : undefined;
  const winner = cup ? cupChampion(cup) : null;
  const create = () => {
    onCreate(kind, club, difficulty, duration);
    setSetup(false);
    setReplace(false);
  };
  const changeKind = (next: CupKind) => {
    onKind(next);
    setSetup(false);
    setClub(cups[next]?.club ?? (next === 'world' ? 'swe' : 'alfred'));
    setDifficulty(cups[next]?.difficulty ?? 'easy');
    setDuration(cups[next]?.duration ?? 180);
  };
  const roster = cupTeams(kind);
  const pair: MatchClubs = [club, roster.find((c) => c.id !== club)?.id ?? 'brick'];
  const groupRounds = cupGroupRounds(kind, cup?.draw.length);
  const bestThirds = cup && kind === 'world' ? cupThirdPlaces(cup) : [];
  const activeMode = action === 'local' ? 'versus' : 'solo';
  const ready = action === 'watch' || action === 'simulate' || action === 'wifi' || controlsReady(input, activeMode);
  const resumed = !!cup && saved?.cup?.runId === cup.id && saved.cup.fixtureId === fixture?.id;
  return (
    <section className='cups-panel' aria-label='Cupspel'>
      <div className='cup-choices'>
        {cupTypes.map((option) => (
          <button
            type='button'
            className={`cup-choice cup-${option.id}`}
            key={option.id}
            aria-pressed={kind === option.id}
            disabled={simulating}
            onClick={() => changeKind(option.id)}
          >
            <Trophy masters={option.id === 'masters'} world={option.id === 'world'} />
            <span>
              <small>{option.label}</small>
              <strong>{option.name}</strong>
              <span>{option.description}</span>
              <em>{cups[option.id] ? 'Fortsätt din cup' : 'Starta en ny cup'}</em>
            </span>
          </button>
        ))}
      </div>
      {!cup || setup ? (
        <section className='cup-setup' aria-label='Skapa en cup'>
          <p className='eyebrow'>{cupName(kind).toUpperCase()}</p>
          <h1>Vilket lag tar pokalen?</h1>
          <p>
            {kind === 'world'
              ? '24 landslag, inklusive hela Norden. Tre gruppmatcher, sedan slutspel. Välj ditt land och spela om världspokalen!'
              : 'Alla 20 klubbar från båda divisionerna är med. Cuperna och ligan sparas var för sig. Oavgjorda utslagsmatcher fortsätter med gyllene mål.'}
          </p>
          <button type='button' className='primary-button' disabled={simulating} onClick={() => (cup ? setReplace(true) : create())}>
            Starta {cupName(kind)}
          </button>
          <TeamSelection selected={pair} mode='solo' single roster={roster} onChange={(_, id) => setClub(id)} />
          <LineupPicker save={transfers} club={club} onChange={onTransfers} disabled={!!saved || simulating} />
          <div className='match-options'>
            <label>
              Matchlängd
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={60}>1 minut</option>
                <option value={180}>3 minuter</option>
                <option value={300}>5 minuter</option>
              </select>
            </label>
            <label>
              Motstånd
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {(['easy', 'normal', 'hard'] as const).map((level) => (
                  <option value={level} key={level}>
                    {difficultyNames[level]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {cup && (
            <button type='button' onClick={() => setSetup(false)}>
              Behåll min cup
            </button>
          )}
        </section>
      ) : (
        <>
          <div className='cup-heading'>
            <div>
              <p className='eyebrow'>DIN CUP · {getClub(cup.club).name.toUpperCase()}</p>
              <h1>{cupName(kind)}</h1>
            </div>
            <button
              type='button'
              disabled={simulating}
              onClick={() => {
                setClub(cup.club);
                setDifficulty(cup.difficulty);
                setDuration(cup.duration);
                setSetup(true);
              }}
            >
              Ny cup
            </button>
          </div>
          {winner ? (
            <section className='cup-winner' role='status'>
              <Trophy masters={kind === 'masters'} world={kind === 'world'} />
              <div>
                <p className='eyebrow'>POKALEN ÄR AVGJORD</p>
                <h2>
                  {getClub(winner).name} vinner {cupName(kind)}!
                </h2>
                <p>{winner === cup.club ? 'Ditt lag är cupmästare!' : 'Ditt lag är utslaget. Hela slutspelsresultatet finns nedan.'}</p>
              </div>
            </section>
          ) : (
            fixture && (
              <section className='cup-next' aria-label='Nästa cupmatch'>
                <MatchTeams save={transfers} clubs={[cup.club, cupOpponent(cup, fixture)]} match={resumed ? (saved ?? undefined) : undefined} />
                <LineupPicker save={transfers} club={cup.club} onChange={onTransfers} disabled={!!saved || simulating} />
                {action === 'local' && (
                  <LineupPicker save={transfers} club={cupOpponent(cup, fixture)} onChange={onTransfers} disabled={!!saved || simulating} />
                )}
                <span className='eyebrow'>{cupRoundName(cup, fixture.round)}</span>
                <h2>
                  {getClub(cup.club).name} – {getClub(cupOpponent(cup, fixture)).name}
                </h2>
                <p>
                  {fixture.stage === 'group'
                    ? kind === 'world'
                      ? 'Vinst ger 3 poäng. De två bästa i varje grupp och de fyra bästa treorna går till åttondelsfinal.'
                      : 'Vinst ger 3 poäng. Gruppens två bästa går till semifinal.'
                    : 'Vinn och gå vidare. Oavgjort avgörs med gyllene mål.'}
                </p>
                <fieldset className='league-action-options' aria-label='Cupmatchens spelläge' disabled={simulating}>
                  {(
                    [
                      ['play', 'Spela själv'],
                      ['local', 'Två på samma skärm'],
                      ['wifi', 'Två via Wi-Fi'],
                      ['watch', 'Se matchen'],
                      ['simulate', 'Simulera direkt'],
                    ] as const
                  ).map(([value, label]) => (
                    <button type='button' key={value} aria-pressed={action === value} onClick={() => setAction(value)}>
                      {label}
                    </button>
                  ))}
                </fieldset>
                {action === 'watch' && <PlaybackSpeedSelect value={speed} onChange={setSpeed} />}
                <p className='small-copy'>
                  {action === 'wifi'
                    ? 'Du styr ditt cuplag. Kompisen styr motståndarna. Cupen sparas bara på värdens enhet.'
                    : action === 'local'
                      ? 'Spelare 1 styr ditt cuplag och spelare 2 styr motståndarna.'
                      : action === 'simulate'
                        ? 'Samma AI och matchregler räknar ut din match utan bild. Övriga cupmatcher avgörs automatiskt.'
                        : action === 'watch'
                          ? 'Datorn styr båda lagen. Följ matchen i 1×, 2× eller 5× fart.'
                          : 'Spela din cupmatch mot datorn. Övriga matcher i omgången avgörs automatiskt.'}
                </p>
                <div className='cup-actions'>
                  <button type='button' className='primary-button' disabled={simulating || !ready} onClick={() => onPlay(kind, action, speed)}>
                    {simulating
                      ? 'Simulerar cupmatchen…'
                      : action === 'simulate'
                        ? 'Simulera cupmatch'
                        : action === 'watch'
                          ? 'Se cupmatchen'
                          : action === 'wifi'
                            ? 'Koppla upp cupmatch via Wi-Fi'
                            : 'Spela cupmatch'}
                  </button>
                  {resumed && (
                    <button type='button' disabled={simulating || (!saved.watching && !controlsReady(input, saved.mode))} onClick={onResume}>
                      Fortsätt sparad cupmatch
                    </button>
                  )}
                </div>
                {(action === 'play' || action === 'local') && <ControlSetup input={input} mode={activeMode} clubs={[cup.club, cupOpponent(cup, fixture)]} />}
              </section>
            )
          )}
          {error && (
            <p role='alert' className='control-warning'>
              {error}
            </p>
          )}
          {groupRounds > 0 && (
            <div className='cup-groups'>
              {cupGroups(cup).map((rows, group) => (
                <section
                  key={rows
                    .map((row) => row.club)
                    .sort()
                    .join(':')}
                  aria-label={`Grupp ${String.fromCharCode(65 + group)}`}
                >
                  <h2>Grupp {String.fromCharCode(65 + group)}</h2>
                  <table className='cup-table'>
                    <thead>
                      <tr>
                        <th>Lag</th>
                        <th>M</th>
                        <th>+/−</th>
                        <th>P</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          className={`${row.club === cup.club ? 'your-club' : ''} ${i < 2 || bestThirds.slice(0, 4).some((third) => third.club === row.club) ? 'qualified' : ''}`}
                          key={row.club}
                        >
                          <th scope='row'>
                            {i + 1}. <NationalFlag id={row.club} /> {getClub(row.club).name}
                          </th>
                          <td>{row.played}</td>
                          <td>{row.goalsFor - row.goalsAgainst}</td>
                          <td>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}
          {groupRounds > 0 && (
            <p className='small-copy'>
              Lika poäng avgörs av målskillnad, sedan gjorda mål och sist alfabetisk lagordning.{' '}
              {kind === 'world'
                ? 'De sex gruppvinnarna och de två bästa tvåorna seedas i åttondelsfinalen. Lag från samma grupp möts inte där. Markeringarna visar vilka som går vidare just nu.'
                : 'A1 möter B2 och B1 möter A2.'}
            </p>
          )}
          {kind === 'world' && (
            <section className='cup-third-places cup-round' aria-label='Bästa grupptreor'>
              <h2>Bästa grupptreor</h2>
              <p className='small-copy'>De fyra bästa går vidare. Ordningen avgörs av poäng, målskillnad, gjorda mål och lagets namn.</p>
              <table className='cup-table'>
                <thead>
                  <tr>
                    <th>Lag</th>
                    <th>M</th>
                    <th>+/−</th>
                    <th>P</th>
                  </tr>
                </thead>
                <tbody>
                  {bestThirds.map((row, i) => (
                    <tr key={row.club} className={`${i < 4 ? 'qualified' : ''} ${row.club === cup.club ? 'your-club' : ''}`}>
                      <th scope='row'>
                        {i + 1}. <NationalFlag id={row.club} /> {getClub(row.club).name} <small>({String.fromCharCode(65 + row.group)})</small>
                      </th>
                      <td>{row.played}</td>
                      <td>{row.goalsFor - row.goalsAgainst}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {kind === 'alfred' && (
            <p className='cup-byes'>
              Direkt till kvartsfinal:{' '}
              {cup.draw
                .slice(0, 4)
                .map((id) => getClub(id).name)
                .join(', ')}
              .
            </p>
          )}
          <section className='cup-bracket' aria-label='Cupens slutspel'>
            {Array.from({ length: cupFinalRound(kind, cup.draw.length) - groupRounds + 1 }, (_, i) => groupRounds + i).map((round) => (
              <section className='cup-round' key={round}>
                <h2>{cupRoundName(cup, round)}</h2>
                {!cup.fixtures.some((f) => f.round === round) && (
                  <p className='small-copy cup-pending-round'>
                    {round === cupFinalRound(kind, cup.draw.length)
                      ? 'Vinnarna i semifinalerna möts här.'
                      : 'Lagen blir klara när föregående omgång är spelad.'}
                  </p>
                )}
                {cup.fixtures
                  .filter((f) => f.round === round)
                  .map((f) => (
                    <div className={`cup-fixture ${f.home === cup.club || f.away === cup.club ? 'your-club' : ''}`} key={f.id}>
                      <span>{getClub(f.home).name}</span>
                      <strong>
                        {f.score ? `${f.score[0]}–${f.score[1]}` : '–'}
                        {f.extraTime && <small> gyllene mål</small>}
                      </strong>
                      <span>{getClub(f.away).name}</span>
                    </div>
                  ))}
              </section>
            ))}
          </section>
          {groupRounds > 0 && (
            <details className='cup-group-results'>
              <summary>Gruppspelets matcher och resultat</summary>
              {Array.from({ length: groupRounds }, (_, i) => i).map((round) => (
                <section key={round}>
                  <h3>Gruppomgång {round + 1}</h3>
                  {cup.fixtures
                    .filter((f) => f.round === round)
                    .map((f) => (
                      <div className='cup-fixture' key={f.id}>
                        <span>{getClub(f.home).name}</span>
                        <strong>{f.score ? `${f.score[0]}–${f.score[1]}` : '–'}</strong>
                        <span>{getClub(f.away).name}</span>
                      </div>
                    ))}
                </section>
              ))}
            </details>
          )}
        </>
      )}
      {kind === 'world' && (
        <details className='cup-ranking-source'>
          <summary>Om landslagen och urvalet</summary>
          <p>
            Urval ur FIFA:s herrranking den 22 december 2025: plats 1–18, Iran (20) för ytterligare ett asiatiskt lag, plus Sverige, Danmark, Norge, Finland och
            Island. UEFA rankar europeiska lag; FIFA används här för hela världen.
          </p>
          <p>Det här är spelets egen 24-lagscup med fem spelare per lag. Rankingen används för lagurvalet; motståndet styrs av vald svårighet.</p>
          <a href={rankingSource} target='_blank' rel='noreferrer'>
            FIFA:s årsavslutning 2025 ↗
          </a>
        </details>
      )}
      <dialog
        className='match-dialog'
        ref={dialog}
        aria-labelledby='replace-cup-title'
        onCancel={(e) => {
          e.preventDefault();
          setReplace(false);
        }}
      >
        <h2 id='replace-cup-title'>Starta om {cupName(kind)}?</h2>
        <p>Den här cupens matcher ersätts. Dina andra cuper och din liga behålls.</p>
        <button type='button' className='primary-button' onClick={create}>
          Ja, starta ny cup
        </button>
        <button type='button' onClick={() => setReplace(false)}>
          Behåll min cup
        </button>
      </dialog>
    </section>
  );
}

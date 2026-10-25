import type { CSSProperties } from 'react';
import { useRef, useState } from 'react';
import { type ClubId, clubs, getClub, type MatchClubs } from '../game/clubs';
import { initialDivisions, type Season, seasonDivisions } from '../game/league';
import type { MatchState } from '../game/model';
import { nations } from '../game/nations';
import { type Footballer, footballer } from '../game/players';
import { starRoleNames } from '../game/stars';
import { lineupFor, squadFor, type TransferSave } from '../game/transfers';
import { PlayerPortrait, PlayerStats } from './PlayerProfile';
import { ClubCrest } from './TeamSelection';
import './team-browser.css';

const searchable = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('sv');
const roleName = (player: Footballer) => (player.star ? starRoleNames[player.star.position] : player.keeper ? 'Målvakt' : 'Utespelare');
const positions = [
  [50, 86],
  [50, 63],
  [24, 40],
  [76, 40],
  [50, 17],
];

export function TeamSquad({
  club,
  squad,
  five,
  label = 'Startfemma',
}: {
  club: ClubId;
  squad: readonly Footballer[];
  five: readonly string[];
  label?: string;
}) {
  const [selected, setSelected] = useState(five[4]);
  const detail = useRef<HTMLElement>(null);
  const player = squad.find((p) => p.id === selected) ?? squad.find((p) => p.id === five[4]) ?? squad[0];
  const team = getClub(club);
  const starters = five.map((id) => squad.find((p) => p.id === id)).filter((p): p is Footballer => !!p);
  const ordered = [...starters, ...squad.filter((p) => !five.includes(p.id)).sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'sv'))];
  const select = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      detail.current?.focus({ preventScroll: true });
      detail.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };
  return (
    <section className='team-squad' aria-label={`Trupp för ${team.name}`} style={{ '--squad-shirt': team.shirt, '--squad-trim': team.trim } as CSSProperties}>
      <header className='squad-heading'>
        <ClubCrest id={club} />
        <div>
          <p className='eyebrow'>{label}</p>
          <h2>{team.name}</h2>
          <p>
            {squad.length} spelare · {starters.length} startar · {squad.length - starters.length} avbytare
          </p>
        </div>
        {starters.length > 0 && (
          <div className='squad-average'>
            <strong>{(starters.reduce((sum, p) => sum + p.overall, 0) / starters.length).toFixed(1).replace('.', ',')}</strong>
            <span>Startfemmans snitt</span>
          </div>
        )}
      </header>
      <div className='squad-showcase'>
        <section className='squad-pitch' aria-label={`${label} för ${team.name}`}>
          <svg viewBox='0 0 400 400' preserveAspectRatio='none' aria-hidden='true'>
            <rect x='1' y='1' width='398' height='398' rx='18' fill='#276445' />
            <path d='M1 80h398M1 160h398M1 240h398M1 320h398' stroke='#398456' strokeWidth='40' />
            <path d='M18 18h364v364H18ZM18 200h364M140 18v52h120V18M140 382v-52h120v52' fill='none' stroke='#ffffff88' strokeWidth='2' />
            <circle cx='200' cy='200' r='46' stroke='#ffffff88' strokeWidth='2' fill='none' />
          </svg>
          {starters.map((p, i) => (
            <button
              key={p.id}
              type='button'
              className={`pitch-starter ${player?.id === p.id ? 'selected' : ''}`}
              style={{ left: `${positions[i][0]}%`, top: `${positions[i][1]}%` }}
              aria-label={`Visa ${p.name}, ${p.overall} i betyg`}
              aria-pressed={player?.id === p.id}
              onClick={() => select(p.id)}
            >
              <span>
                {i === 0 ? 'MV' : `#${i + 1}`} · {p.overall}
              </span>
              <PlayerPortrait player={p} club={club} />
              <strong>{p.name}</strong>
            </button>
          ))}
        </section>
        {player && (
          <article ref={detail} tabIndex={-1} className='athlete-card squad-player-detail' aria-label={`Spelarkort för ${player.name}`}>
            <header>
              <PlayerPortrait player={player} club={club} />
              <div>
                <small>{roleName(player)}</small>
                <h3>{player.name}</h3>
                <span>{five.includes(player.id) ? `${label} · ${player.keeper ? 'MV' : `#${five.indexOf(player.id) + 1}`}` : 'Avbytare'}</span>
              </div>
              <strong className='overall-rating' role='img' aria-label={`Totalbetyg ${player.overall} av 100`}>
                {player.overall}
                <small>BETYG</small>
              </strong>
            </header>
            {player.star && (
              <p className={`star-prime ${player.star.era}`}>
                <strong>
                  {player.star.era === 'family' ? 'FAMILJESPELARE' : `${player.star.era === 'legend' ? 'LEGEND' : 'STJÄRNA'} · PRIME ${player.star.prime}`}
                </strong>
                <span>{player.star.country}</span>
              </p>
            )}
            <PlayerStats player={player} />
            <p className='small-copy'>Betyg och egenskaper visas på skalan 0–100.</p>
            <div className='squad-player-arrows'>
              <button type='button' disabled={ordered.indexOf(player) <= 0} onClick={() => select(ordered[ordered.indexOf(player) - 1].id)}>
                ← Förra spelaren
              </button>
              <button type='button' disabled={ordered.indexOf(player) >= ordered.length - 1} onClick={() => select(ordered[ordered.indexOf(player) + 1].id)}>
                Nästa spelare →
              </button>
            </div>
          </article>
        )}
      </div>
      <h3>Alla spelare</h3>
      <section className='squad-player-list' aria-label={`Spelare i ${team.name}`}>
        {ordered.map((p) => (
          <button type='button' key={p.id} aria-label={`Visa spelarkort för ${p.name}`} aria-pressed={player?.id === p.id} onClick={() => select(p.id)}>
            <PlayerPortrait player={p} club={club} />
            <span>
              <strong>{p.name}</strong>
              <small>
                {roleName(p)} · {five.includes(p.id) ? `${label} · ${p.keeper ? 'MV' : `#${five.indexOf(p.id) + 1}`}` : 'Avbytare'}
                {p.star?.era === 'family' ? ' · Familj' : ''}
              </small>
            </span>
            <b>{p.overall}</b>
          </button>
        ))}
      </section>
    </section>
  );
}

export function MatchTeams({ save, clubs: pair, match }: { save?: TransferSave; clubs: MatchClubs; match?: MatchState }) {
  const [side, setSide] = useState(0);
  const id = pair[side];
  const ids = match?.squads?.[side] ?? match?.lineups?.[side];
  const squad = ids ? ids.map(footballer).filter((p): p is Footballer => !!p) : save ? squadFor(save, id) : [];
  const five = match?.lineups?.[side] ?? (save ? lineupFor(save, id) : []);
  return (
    <details className='match-team-browser'>
      <summary>Matchens lag & spelare</summary>
      <label>
        Lag att titta på
        <select value={side} onChange={(e) => setSide(Number(e.target.value))}>
          {pair.map((club, i) => (
            <option key={club} value={i}>
              {getClub(club).name}
            </option>
          ))}
        </select>
      </label>
      <TeamSquad key={id} club={id} squad={squad} five={five} label={match ? 'Matchens femma' : 'Vald startfemma'} />
    </details>
  );
}

export function TeamBrowser({ save, season, onClose }: { save: TransferSave; season: Season | null; onClose: () => void }) {
  const [kind, setKind] = useState<'clubs' | 'nations'>('clubs');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClubId>(save.activeClub);
  const teams = (kind === 'clubs' ? clubs : nations).filter((team) =>
    searchable(
      `${team.name} ${squadFor(save, team.id)
        .map((p) => p.name)
        .join(' ')}`,
    ).includes(searchable(search)),
  );
  const active = teams.find((t) => t.id === selected) ?? teams[0];
  const index = active ? teams.findIndex((t) => t.id === active.id) : -1;
  const division = active && kind === 'clubs' && season ? seasonDivisions(season).findIndex((group) => group.includes(active.id)) : -1;
  const initialDivision = active ? initialDivisions().findIndex((group) => group.includes(active.id)) : -1;
  return (
    <section className='team-browser' aria-label='Lag och spelare'>
      <header className='browser-heading'>
        <div>
          <p className='eyebrow'>KLUBBAR · LANDSLAG · STJÄRNOR</p>
          <h1>Lag & spelare</h1>
          <p>Se lagen, startfemman och avbytarna. Tryck på en spelare för namn och alla egenskaper.</p>
        </div>
        <button type='button' onClick={onClose}>
          Tillbaka till menyn
        </button>
      </header>
      <fieldset className='browser-kinds' aria-label='Typ av lag'>
        <button
          type='button'
          aria-pressed={kind === 'clubs'}
          onClick={() => {
            setKind('clubs');
            setSearch('');
            setSelected(save.activeClub);
          }}
        >
          Klubblag · {clubs.length}
        </button>
        <button
          type='button'
          aria-pressed={kind === 'nations'}
          onClick={() => {
            setKind('nations');
            setSearch('');
            setSelected(nations[0].id);
          }}
        >
          Landslag · {nations.length}
        </button>
      </fieldset>
      <div className='browser-controls'>
        <label>
          Sök lag eller spelare
          <input type='search' value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Till exempel Katona, Zlatan eller Sverige' />
        </label>
        <label>
          Bläddra bland lag
          <select value={active?.id ?? ''} disabled={!active} onChange={(e) => setSelected(e.target.value as ClubId)}>
            {!active && <option value=''>Inga lag hittades</option>}
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className='browser-paging'>
        <button type='button' disabled={index <= 0} onClick={() => setSelected(teams[index - 1].id)}>
          ← Föregående lag
        </button>
        <span role='status'>
          {active
            ? `${index + 1} av ${teams.length} lag${kind === 'clubs' ? ` · Division ${(division >= 0 ? division : initialDivision) + 1}` : ''}`
            : 'Inga lag matchar sökningen.'}
        </span>
        <button type='button' disabled={index < 0 || index >= teams.length - 1} onClick={() => setSelected(teams[index + 1].id)}>
          Nästa lag →
        </button>
      </div>
      <details className='team-catalogue'>
        <summary>Visa alla lag · {teams.length}</summary>
        <div>
          {teams.map((team) => (
            <button key={team.id} type='button' aria-label={`Visa lag ${team.name}`} aria-pressed={active?.id === team.id} onClick={() => setSelected(team.id)}>
              <ClubCrest id={team.id} />
              <strong>{team.name}</strong>
            </button>
          ))}
        </div>
      </details>
      {active && (
        <TeamSquad
          key={active.id}
          club={active.id}
          squad={squadFor(save, active.id)}
          five={lineupFor(save, active.id)}
          label={save.lineups?.[active.id] ? 'Din valda startfemma' : 'Automatisk startfemma'}
        />
      )}
    </section>
  );
}

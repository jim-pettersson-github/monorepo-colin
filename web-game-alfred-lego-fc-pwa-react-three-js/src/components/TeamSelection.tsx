import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { ClubId, FootballTeam, MatchClubs } from '../game/clubs';
import { clubs, getClub } from '../game/clubs';
import type { MatchMode, Team } from '../game/model';
import { nations } from '../game/nations';
import { NationalFlag } from './NationalFlag';

export function ClubCrest({ id }: { id: ClubId }) {
  const club = getClub(id);
  if (nations.some((nation) => nation.id === id)) return <NationalFlag id={id} />;
  return (
    <span className='club-crest' aria-hidden='true' style={{ '--club-shirt': club.shirt, '--club-trim': club.trim } as CSSProperties}>
      {club.code}
    </span>
  );
}

export function TeamSelection({
  selected,
  mode,
  single = false,
  roster = clubs,
  onChange,
}: {
  selected: MatchClubs;
  mode: MatchMode;
  single?: boolean;
  roster?: readonly FootballTeam[];
  onChange: (team: Team, id: ClubId) => void;
}) {
  const [active, setActive] = useState<Team>(0);
  return (
    <fieldset className='team-selection' aria-label='Välj lag'>
      <legend>
        VÄLJ LAG{' '}
        <span>
          {roster.length} {roster === nations ? 'LANDSLAG' : 'LAG'}
        </span>
      </legend>
      <div className='selected-clubs'>
        {(single ? ([0] as const) : ([0, 1] as const)).map((team) => (
          <button key={team} type='button' className={`selected-club team-${team}`} aria-pressed={active === team} onClick={() => setActive(team)}>
            <ClubCrest id={selected[team]} />
            <span>
              <small>{mode === 'versus' ? `Spelare ${team + 1}` : team === 0 ? 'Ditt lag' : 'Motståndarlag'}</small>
              <strong>{getClub(selected[team]).name}</strong>
            </span>
          </button>
        ))}
      </div>
      <p className='team-selection-hint'>Välj {mode === 'versus' ? `lag för spelare ${active + 1}` : active === 0 ? 'ditt lag' : 'motståndarlag'}:</p>
      <div className='club-grid'>
        {roster.map((club) => (
          <button
            key={club.id}
            type='button'
            className='club-option'
            aria-label={`Välj ${club.name}`}
            aria-pressed={selected[active] === club.id}
            onClick={() => onChange(active, club.id)}
          >
            <ClubCrest id={club.id} />
            <span>{club.name}</span>
            <small>{selected[0] === club.id ? 'P1' : !single && selected[1] === club.id ? (mode === 'solo' ? 'AI' : 'P2') : ' '}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

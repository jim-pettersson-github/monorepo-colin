import { useState } from 'react';
import { getClub } from '../game/clubs';
import type { Team } from '../game/model';
import { footballer } from '../game/players';
import type { MatchSession } from '../game/session';
import './lineups.css';

export function Substitutions({ session }: { session: MatchSession }) {
  const state = session.state;
  const [team, setTeam] = useState<Team>(session.localTeam ?? 0);
  const [slot, setSlot] = useState(1);
  const [incoming, setIncoming] = useState('');
  const teams = ([0, 1] as const).filter((t) => session.canManageTeam(t));
  const five = state.lineups?.[team];
  const bench = state.squads?.[team].filter((id) => !five?.includes(id) && footballer(id)?.keeper === (slot === 0)) ?? [];
  const selected = bench.includes(incoming) ? incoming : (bench[0] ?? '');
  return (
    <details className='match-substitutions lineup-picker'>
      <summary>Spelarbyten</summary>
      <p>Fria byten i paus. Målvakt byts mot målvakt. Byten gäller den här matchen; din sparade startfemma behålls.</p>
      {!state.squads ? (
        <p>Avbytarbänken blir tillgänglig från nästa match.</p>
      ) : (
        <>
          {teams.length > 1 && (
            <label>
              Lag för bytet
              <select
                value={team}
                onChange={(e) => {
                  setTeam(Number(e.target.value) as Team);
                  setIncoming('');
                }}
              >
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {getClub(state.clubs[t]).name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className='eyebrow'>{getClub(state.clubs[team]).name}</p>
          <label>
            Spelare ut
            <select
              value={slot}
              onChange={(e) => {
                setSlot(Number(e.target.value));
                setIncoming('');
              }}
            >
              {five?.map((id, i) => (
                <option key={id} value={i}>
                  {i === 0 ? 'MV' : `#${i + 1}`} · {footballer(id)?.name} · {footballer(id)?.overall}
                </option>
              ))}
            </select>
          </label>
          <label>
            Spelare in
            <select disabled={!bench.length || session.substitutionPending} value={selected} onChange={(e) => setIncoming(e.target.value)}>
              {!bench.length && <option value=''>Ingen tillgänglig avbytare</option>}
              {bench.map((id) => (
                <option key={id} value={id}>
                  {footballer(id)?.name} · {footballer(id)?.overall}
                  {footballer(id)?.star?.era === 'family' ? ' · Familj' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type='button' disabled={!selected || session.substitutionPending} onClick={() => session.substitute(team, slot, selected)}>
            Genomför byte
          </button>
          {session.substitutionNotice && (
            <p className='substitution-notice' role='status'>
              {session.substitutionNotice}
            </p>
          )}
          <ul className='substitution-five' aria-label='Spelare på planen'>
            {five?.map((id, i) => (
              <li key={id}>
                {i === 0 ? 'MV' : `#${i + 1}`} · {footballer(id)?.name} · {footballer(id)?.overall}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

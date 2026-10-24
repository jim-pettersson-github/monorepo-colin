import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getClub } from '../game/clubs';
import type { Season } from '../game/league';
import { nextFixture, opponentClub, standings } from '../game/league';
import { difficultyNames } from '../game/model';

export function LeagueView({ season, children }: { season: Season; children?: ReactNode }) {
  const next = nextFixture(season);
  const rows = standings(season);
  const completed = rows.find((row) => row.club === season.club)?.played || 0;
  const last = [...season.fixtures].reverse().find((fixture) => fixture.score && (fixture.home === season.club || fixture.away === season.club));
  const [tab, setTab] = useState<'table' | 'fixtures'>('table');
  const [round, setRound] = useState(next?.round ?? 21);
  useEffect(() => setRound(next?.round ?? 21), [next?.round]);
  return (
    <section className='league-panel' aria-label='Din liga'>
      <div className='league-heading'>
        <div>
          <p className='eyebrow'>DIVISION 1 · 12 LAG</p>
          <h1>{getClub(season.club).name}</h1>
        </div>
        <span className='season-progress'>{completed} / 22 matcher</span>
      </div>
      {last?.score && (
        <p className='last-league-result' role='status'>
          Senaste resultat: {getClub(last.home).name} {last.score[0]}–{last.score[1]} {getClub(last.away).name}
        </p>
      )}
      <div className='next-fixture'>
        {next ? (
          <>
            <p className='eyebrow'>NÄSTA MATCH · OMGÅNG {next.round + 1}</p>
            <h2>{getClub(opponentClub(season, next)).name}</h2>
            <p>
              {next.home === season.club ? 'Hemmamatch' : 'Bortamatch'} · {difficultyNames[season.difficulty]} · {season.duration / 60} min
            </p>
          </>
        ) : (
          <>
            <p className='eyebrow'>SÄSONGEN ÄR KLAR</p>
            <h2>{getClub(rows[0].club).name} vinner ligan!</h2>
            <p>Ditt lag slutade på plats {rows.findIndex((row) => row.club === season.club) + 1}.</p>
          </>
        )}
      </div>
      {children}
      <fieldset className='league-tabs' aria-label='Ligavy'>
        <button type='button' aria-pressed={tab === 'table'} onClick={() => setTab('table')}>
          Tabell
        </button>
        <button type='button' aria-pressed={tab === 'fixtures'} onClick={() => setTab('fixtures')}>
          Spelschema
        </button>
      </fieldset>
      {tab === 'table' ? (
        <>
          <div className='standings-scroll'>
            <table className='league-table'>
              <caption>Division 1</caption>
              <thead>
                <tr>
                  <th scope='col'>#</th>
                  <th scope='col'>Lag</th>
                  <th scope='col' title='Matcher'>
                    M
                  </th>
                  <th scope='col' title='Vinster'>
                    V
                  </th>
                  <th scope='col' title='Oavgjorda'>
                    O
                  </th>
                  <th scope='col' title='Förluster'>
                    F
                  </th>
                  <th scope='col'>Mål</th>
                  <th scope='col' title='Poäng'>
                    P
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.club} className={row.club === season.club ? 'your-club' : ''}>
                    <td>{index + 1}</td>
                    <th scope='row'>
                      {getClub(row.club).name}
                      {row.club === season.club && <small> DITT LAG</small>}
                    </th>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td>
                      {row.goalsFor}–{row.goalsAgainst}
                    </td>
                    <td>
                      <strong>{row.points}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='small-copy'>
            Vinst ger 3 poäng, oavgjort 1. Lika poäng avgörs av målskillnad, sedan gjorda mål. Övriga matcher i omgången spelas automatiskt efter din match.
          </p>
        </>
      ) : (
        <section className='fixture-list' aria-label='Säsongens spelschema'>
          <label>
            Visa omgång
            <select value={round} onChange={(event) => setRound(Number(event.target.value))}>
              {Array.from({ length: 22 }, (_, i) => i).map((i) => (
                <option key={i} value={i}>
                  Omgång {i + 1}
                </option>
              ))}
            </select>
          </label>
          {season.fixtures
            .filter((fixture) => fixture.round === round)
            .map((fixture) => (
              <div key={fixture.id} className={`fixture-row ${fixture.home === season.club || fixture.away === season.club ? 'your-club' : ''}`}>
                <span>{getClub(fixture.home).name}</span>
                <strong>{fixture.score ? `${fixture.score[0]}–${fixture.score[1]}` : '–'}</strong>
                <span>{getClub(fixture.away).name}</span>
              </div>
            ))}
          <details>
            <summary>Alla dina matcher</summary>
            {season.fixtures
              .filter((fixture) => fixture.home === season.club || fixture.away === season.club)
              .map((fixture) => (
                <div className='season-fixture' key={fixture.id}>
                  <span>
                    {fixture.round + 1}. {getClub(opponentClub(season, fixture)).name} <small>({fixture.home === season.club ? 'hemma' : 'borta'})</small>
                  </span>
                  <strong>{fixture.score ? `${fixture.score[0]}–${fixture.score[1]}` : 'Ej spelad'}</strong>
                </div>
              ))}
          </details>
        </section>
      )}
    </section>
  );
}

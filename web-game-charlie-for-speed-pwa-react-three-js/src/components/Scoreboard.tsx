import { useEffect, useState } from 'react';
import { carById, carName } from '../game/cars';
import { flushLaps, loadOverview, loadTrackBoard, type Overview, type Period, pendingLaps, type TrackBoard } from '../game/leaderboard';
import { formatTime } from '../game/race';
import { loadIdentity, loadRecords } from '../game/storage';
import { trackDefs } from '../game/tracks';

type Props = { onBack: () => void };

const periods: [Period, string][] = [
  ['all', 'Alla tider'],
  ['month', '30 dagar'],
  ['week', '7 dagar'],
];

const dates = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
const trackName = (id: string) => trackDefs.find((track) => track.id === id)?.name ?? id;
const car = (id: string) => carName(carById(id));
const lapTime = (ms: number) => formatTime(ms / 1000);

// Best laps from every device, per track and over all tracks, read from the room server.
export function Scoreboard({ onBack }: Props) {
  const [period, setPeriod] = useState<Period>('all');
  // undefined shows every track; a track id shows that track's top list.
  const [track, setTrack] = useState<string>();
  const [overview, setOverview] = useState<Overview>();
  const [board, setBoard] = useState<TrackBoard>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(pendingLaps);
  const player = loadIdentity().id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    // Laps saved while offline go up first, so they are on the lists shown.
    const load = flushLaps(loadIdentity())
      .catch(() => undefined)
      .then(() => {
        if (active) setWaiting(pendingLaps());
        return track ? loadTrackBoard(track, period, player).then(setBoard) : loadOverview(period, player).then(setOverview);
      });
    load.catch((e) => active && setError(e instanceof Error ? e.message : 'Topplistan kunde inte hämtas.')).finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [track, period, player]);

  const records = loadRecords();
  return (
    <main className='menu-screen scoreboard'>
      <header className='screen-header'>
        <button type='button' onClick={track ? () => setTrack(undefined) : onBack}>
          ◀ {track ? 'Alla banor' : 'Meny'}
        </button>
        <h2>{track ? trackName(track) : 'Topplistor'}</h2>
      </header>

      <div className='scoreboard-body'>
        <div className='scoreboard-filters'>
          <fieldset className='choice'>
            <legend>Period</legend>
            {periods.map(([value, label]) => (
              <button key={value} type='button' aria-pressed={period === value} onClick={() => setPeriod(value)}>
                {label}
              </button>
            ))}
          </fieldset>
          <fieldset className='choice track-choice'>
            <legend>Bana</legend>
            <button type='button' aria-pressed={!track} onClick={() => setTrack(undefined)}>
              Alla banor
            </button>
            {trackDefs.map((def) => (
              <button key={def.id} type='button' aria-pressed={track === def.id} onClick={() => setTrack(def.id)}>
                {def.name}
              </button>
            ))}
          </fieldset>
        </div>

        {waiting > 0 && (
          <p className='hint'>
            {waiting === 1 ? 'Ett varv' : `${waiting} varv`} från den här enheten väntar på att skickas. Det sker när du är online och har ett namn under
            Inställningar.
          </p>
        )}
        {loading && <p role='status'>Hämtar topplistan…</p>}
        {error && !loading && (
          <section className='panel'>
            <p role='alert'>{error}</p>
            <h3>Dina rekord på den här enheten</h3>
            <ul className='local-records'>
              {trackDefs.map((def) => (
                <li key={def.id}>
                  {def.name}: {records[def.id] ? `${formatTime(records[def.id].time)} (${car(records[def.id].carId)})` : 'inget varv ännu'}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!loading && !error && track && board && (
          <section className='panel scoreboard-panel' aria-label={`Topplista ${trackName(track)}`}>
            {board.board.length === 0 ? (
              <p>Inga varv här under den här perioden. Kör ett race så hamnar du överst!</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Plats</th>
                    <th>Förare</th>
                    <th>Bil</th>
                    <th>Bästa varv</th>
                    <th className='wide'>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {board.board.map((row, index) => (
                    <tr key={`${row.name}-${row.at}-${row.time}`} className={row.me ? 'me' : undefined}>
                      <td>{index + 1}</td>
                      <td>{row.name}</td>
                      <td>{car(row.car)}</td>
                      <td>{lapTime(row.time)}</td>
                      <td className='wide'>{dates.format(row.at * 1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className='hint'>
              {board.me
                ? `Du ligger på plats ${board.me.rank} av ${board.drivers} med ${lapTime(board.me.time)} (${car(board.me.car)}).`
                : board.drivers
                  ? `${board.drivers} förare har kört här. Du har inget varv här under perioden.`
                  : ''}
            </p>
          </section>
        )}

        {!loading && !error && !track && overview && (
          <>
            <section className='panel scoreboard-panel' aria-label='Totalt'>
              <h3>Totalt</h3>
              <p className='hint'>Placeringen på varje bana ger poäng: 10 för bästa varvet, sedan 8, 6, 5, 4, 3, 2 och 1.</p>
              {overview.overall.length === 0 ? (
                <p>Inga varv under den här perioden ännu.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Plats</th>
                      <th>Förare</th>
                      <th>Poäng</th>
                      <th>Rekord</th>
                      <th className='wide'>Banor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.overall.map((row, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: two players may share a name, and the server sends no ids
                      <tr key={`${row.name}-${index}`} className={row.me ? 'me' : undefined}>
                        <td>{index + 1}</td>
                        <td>{row.name}</td>
                        <td>{row.points}</td>
                        <td>{row.records}</td>
                        <td className='wide'>{row.tracks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className='panel scoreboard-panel' aria-label='Banrekord'>
              <h3>Banrekord</h3>
              <ul className='track-records'>
                {trackDefs.map((def) => {
                  const record = overview.tracks.find((entry) => entry.track === def.id);
                  return (
                    <li key={def.id}>
                      <button type='button' onClick={() => setTrack(def.id)}>
                        <strong>{def.name}</strong>
                        <span>{record ? `${lapTime(record.time)} · ${record.name} · ${car(record.car)}` : 'Inget varv ännu'}</span>
                        {record?.mine && (
                          <small>
                            Du: plats {record.mine.rank} av {record.drivers}, {lapTime(record.mine.time)}
                          </small>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

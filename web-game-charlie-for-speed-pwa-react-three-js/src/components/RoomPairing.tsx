import { useEffect, useRef, useState } from 'react';
import type { PeerLink } from '../game/peer-link';
import { type JoinPhase, joinRoom, listGames, normalizeRoomCode, type OpenGame, type Room } from '../game/room-server';

// Host: the room code everyone types to join.
export function RoomCodeCard({ room }: { room: Room }) {
  return (
    <div className='room-card'>
      <p className='eyebrow'>RUMSKOD</p>
      <strong className='room-code' data-testid='room-code'>
        {room.code}
      </strong>
      <p>Kompisarna väljer ditt spel i listan eller skriver koden, var de än är.</p>
    </div>
  );
}

// Host: publishes the open invitation in the room and connects whoever answers it. Renders nothing.
export function RoomInvite({ room, link, onError }: { room: Room; link: PeerLink; onError: (message: string) => void }) {
  const report = useRef(onError);
  report.current = onError;
  const code = link.code;
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    room
      .invite(link, () => cancelled)
      .catch((error) => {
        if (!cancelled) report.current(error instanceof Error ? error.message : 'Rumskoden slutade fungera. Försök igen.');
      });
    return () => {
      cancelled = true;
    };
  }, [room, link, code]);
  return null;
}

// Guest: the games people are hosting right now, refreshed every few seconds. Picking one joins it.
export function GameList({ onPick }: { onPick: (code: string) => void }) {
  const [games, setGames] = useState<OpenGame[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () =>
      listGames().then(
        (found) => {
          if (!active) return;
          setGames(found);
          setError('');
        },
        (e) => active && setError(e instanceof Error ? e.message : 'Listan kunde inte hämtas.'),
      );
    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className='game-list'>
      {error && <p role='alert'>{error}</p>}
      {games === null && !error && <p role='status'>Hämtar öppna spel…</p>}
      {games?.length === 0 && <p role='status'>Inga öppna spel just nu. Be en kompis bli värd, eller skriv en rumskod.</p>}
      {!!games?.length && (
        <ul aria-label='Öppna spel'>
          {games.map((game) => (
            <li key={game.code}>
              <span>
                <strong>{game.title}</strong>
                <small>{game.info}</small>
              </span>
              <button type='button' className='primary' onClick={() => onPick(game.code)}>
                Gå med · {game.players}/{game.capacity}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A guest's way into a room, step by step, with the time so far. The last steps run after the room code form is gone.
export type JoinStep = JoinPhase | 'connecting';
const JOIN_STEPS: { label: string; phases: JoinStep[] }[] = [
  { label: 'Hittar rummet', phases: ['finding', 'waiting'] },
  { label: 'Svarar värden', phases: ['answering'] },
  { label: 'Kopplar upp mot värden', phases: ['connecting'] },
];

export function JoinProgress({ step, since }: { step: JoinStep; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const current = JOIN_STEPS.findIndex((entry) => entry.phases.includes(step));
  // Most joins take a few seconds; past that, say what the wait usually is.
  const hint =
    step === 'waiting'
      ? 'Värden gör i ordning en plats. Värdens skärm måste vara tänd med spelet öppet.'
      : step === 'connecting' && seconds >= 6
        ? 'Det tar en stund när enheterna går via reläservern. Håll båda skärmarna tända.'
        : '';
  return (
    <div className='join-progress' data-testid='join-progress'>
      <div className='join-bar' aria-hidden='true'>
        <span className='join-fill' style={{ width: `${((current + 0.5) / JOIN_STEPS.length) * 100}%` }} />
      </div>
      <ol aria-label='Går med'>
        {JOIN_STEPS.map((entry, index) => (
          <li
            key={entry.label}
            className={index < current ? 'done' : index === current ? 'current' : undefined}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className='join-mark' aria-hidden='true'>
              {index < current ? '✓' : index === current ? <span className='join-spinner' /> : index + 1}
            </span>
            {index === current && step === 'waiting' ? 'Väntar på en ledig plats' : entry.label}
          </li>
        ))}
      </ol>
      <p className='join-time'>
        <span aria-hidden='true'>{seconds} s</span>
        {hint && <span role='status'> {hint}</span>}
      </p>
    </div>
  );
}

// Guest: types the host's room code and waits for a free place; a pick from the game list joins straight away.
export function RoomJoin({
  onLink,
  onBusy,
  initialCode = '',
  pick,
}: {
  onLink: (link: PeerLink, code: string, since: number) => void;
  // When an attempt starts (its start time) or ends (null), so the screen can hide the game list meanwhile.
  onBusy?: (since: number | null) => void;
  initialCode?: string;
  pick?: { code: string; at: number };
}) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | JoinPhase>('idle');
  const [since, setSince] = useState(0);
  const [error, setError] = useState('');
  const busy = useRef(onBusy);
  busy.current = onBusy;
  // Each attempt has its own number: a new pick, Avbryt or leaving the screen retires the one in progress.
  const attempt = useRef(0);
  const done = useRef(onLink);
  done.current = onLink;
  useEffect(
    () => () => {
      attempt.current++;
    },
    [],
  );
  const join = async (value = code) => {
    // One attempt at a time: a second tap on the list would leave the host waiting on an answer nobody uses.
    if (state !== 'idle') return;
    const id = ++attempt.current;
    const cancelled = () => attempt.current !== id;
    const started = Date.now();
    setError('');
    setState('finding');
    setSince(started);
    busy.current?.(started);
    try {
      const link = await joinRoom(value, cancelled, (phase) => !cancelled() && setState(phase));
      if (cancelled()) link.close();
      else done.current(link, value, started);
    } catch (e) {
      if (!cancelled()) {
        setError(e instanceof Error ? e.message : 'Det gick inte att gå med.');
        busy.current?.(null);
      }
    } finally {
      if (!cancelled()) setState('idle');
    }
  };
  const joinRef = useRef(join);
  joinRef.current = join;
  useEffect(() => {
    if (!pick) return;
    setCode(pick.code);
    void joinRef.current(pick.code);
  }, [pick]);
  return (
    <form
      className='room-join'
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 4 && state === 'idle') void join();
      }}
    >
      <label>
        Rumskod
        <input
          value={code}
          maxLength={4}
          autoCapitalize='characters'
          autoComplete='off'
          spellCheck={false}
          placeholder='ABCD'
          disabled={state !== 'idle'}
          onChange={(event) => setCode(normalizeRoomCode(event.target.value).slice(0, 4))}
        />
      </label>
      {state === 'idle' ? (
        <button type='submit' className='primary' disabled={code.length !== 4}>
          Gå med i rummet
        </button>
      ) : (
        <button
          type='button'
          onClick={() => {
            attempt.current++;
            setState('idle');
            busy.current?.(null);
          }}
        >
          Avbryt
        </button>
      )}
      {state !== 'idle' && <JoinProgress step={state} since={since} />}
      {error && <p role='alert'>{error}</p>}
    </form>
  );
}

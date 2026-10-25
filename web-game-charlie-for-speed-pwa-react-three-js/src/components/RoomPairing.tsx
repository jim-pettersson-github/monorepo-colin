import { useEffect, useRef, useState } from 'react';
import type { PeerLink } from '../game/peer-link';
import { joinRoom, listGames, normalizeRoomCode, type OpenGame, type Room } from '../game/room-server';

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

// Guest: types the host's room code and waits for a free place; a pick from the game list joins straight away.
export function RoomJoin({
  onLink,
  initialCode = '',
  pick,
}: {
  onLink: (link: PeerLink, code: string) => void;
  initialCode?: string;
  pick?: { code: string; at: number };
}) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'joining' | 'waiting'>('idle');
  const [error, setError] = useState('');
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
    const id = ++attempt.current;
    const cancelled = () => attempt.current !== id;
    setError('');
    setState('joining');
    try {
      const link = await joinRoom(value, cancelled, () => !cancelled() && setState('waiting'));
      if (cancelled()) link.close();
      else done.current(link, value);
    } catch (e) {
      if (!cancelled()) setError(e instanceof Error ? e.message : 'Det gick inte att gå med.');
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
          }}
        >
          Avbryt
        </button>
      )}
      {state === 'joining' && <p role='status'>Ansluter till rummet…</p>}
      {state === 'waiting' && <p role='status'>Rummet är hittat. Väntar på att värden har en ledig plats…</p>}
      {error && <p role='alert'>{error}</p>}
    </form>
  );
}

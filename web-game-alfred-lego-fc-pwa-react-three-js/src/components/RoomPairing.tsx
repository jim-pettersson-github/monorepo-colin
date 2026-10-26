import { useEffect, useRef, useState } from 'react';
import type { PeerLink } from '../game/peer-link';
import { joinRoom, normalizeRoomCode, type Room } from '../game/room-server';

// Host: the room code everyone types to join.
export function RoomCodeCard({ room }: { room: Room }) {
  return (
    <div className='room-card'>
      <p className='eyebrow'>RUMSKOD</p>
      <strong className='room-code' data-testid='room-code'>
        {room.code}
      </strong>
      <p>Kompisen väljer Anslut och skriver koden. Ni kan vara hemma tillsammans eller på olika ställen.</p>
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
        if (!cancelled) report.current(error instanceof Error ? error.message : 'Rumskoden slutade fungera. Börja om kopplingen.');
      });
    return () => {
      cancelled = true;
    };
  }, [room, link, code]);
  return null;
}

// Guest: types the host's room code and waits for a free place.
export function RoomJoin({ onLink, initialCode = '' }: { onLink: (link: PeerLink, code: string) => void; initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'joining' | 'waiting'>('idle');
  const [error, setError] = useState('');
  const cancel = useRef(false);
  const done = useRef(onLink);
  done.current = onLink;
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );
  const join = async () => {
    cancel.current = false;
    setError('');
    setState('joining');
    try {
      const link = await joinRoom(
        code,
        () => cancel.current,
        () => setState('waiting'),
      );
      if (cancel.current) link.close();
      else done.current(link, code);
    } catch (e) {
      if (!cancel.current) setError(e instanceof Error ? e.message : 'Det gick inte att gå med.');
    } finally {
      if (!cancel.current) setState('idle');
    }
  };
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
            cancel.current = true;
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

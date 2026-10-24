import { useEffect, useRef, useState } from 'react';
import type { PeerLink } from '../game/peer-link';
import { joinRoom, normalizeRoomCode } from '../game/room-server';

// Host: the room code everyone types to join. The host's invitations run in SharedHost, also during play.
export function RoomCodeCard({ code }: { code: string }) {
  return (
    <div className='room-card'>
      <p className='eyebrow'>RUMSKOD</p>
      <strong className='room-code' data-testid='room-code'>
        {code}
      </strong>
      <p>Kompisarna väljer Jag går med och skriver koden på sin egen telefon eller dator.</p>
    </div>
  );
}

// Guest: types the host's room code and waits for a free place.
export function RoomJoin({ onLink }: { onLink: (link: PeerLink) => void }) {
  const [code, setCode] = useState('');
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
      else done.current(link);
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
        <button type='submit' className='together-primary' disabled={code.length !== 4}>
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
      {state === 'joining' && <p role='status'>Letar efter rummet…</p>}
      {state === 'waiting' && <p role='status'>Rummet är hittat. Väntar på en ledig plats…</p>}
      {error && <p role='alert'>{error}</p>}
    </form>
  );
}

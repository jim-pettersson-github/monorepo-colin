import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { characterName, maxPlayers } from '../game/model';
import type { PeerLink } from '../game/peer-link';
import { roomServer } from '../game/room-server';
import type { GameSession } from '../game/session';
import { type GuestSession, joinWorld } from '../game/shared-guest';
import type { SharedHost } from '../game/shared-host';
import type { Storage } from '../game/storage';
import { RoomCodeCard, RoomJoin } from './RoomPairing';

const noHost = { subscribe: () => () => {}, getSnapshot: () => 0 };

// "Spela tillsammans": one player per device in the same building. Single play always stays available.
export function Together({
  session,
  host,
  guest,
  storage,
  inGame,
  onHost,
  onStopHost,
  onPlay,
  onJoined,
  onLeave,
}: {
  session: GameSession;
  host: SharedHost | null;
  guest: GuestSession | null;
  storage: Storage;
  inGame: boolean;
  onHost: () => void;
  onStopHost: () => void;
  onPlay: () => void;
  onJoined: (guest: GuestSession) => void;
  onLeave: () => void;
}) {
  const shared = host ?? noHost;
  useSyncExternalStore(shared.subscribe, shared.getSnapshot);
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const cancel = useRef(false);
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );

  if (guest)
    return (
      <section className='together' aria-label='Spela tillsammans'>
        <p>
          Du spelar som <b>{guest.name}</b> i Colins värld. Ditt eget spel väntar orört på den här enheten.
        </p>
        <button type='button' onClick={onLeave}>
          Lämna och spela själv
        </button>
      </section>
    );

  if (typeof RTCPeerConnection === 'undefined')
    return <p className='together-note'>Den här webbläsaren kan inte spela tillsammans. Du kan spela själv precis som vanligt.</p>;
  if (!roomServer())
    return <p className='together-note'>Att spela tillsammans behöver internet och spelservern. Den finns inte här just nu, så du spelar själv som vanligt.</p>;

  if (host) {
    const joined = host.guests.map((entry) => entry.slot).sort();
    return (
      <section className='together' aria-label='Spela tillsammans'>
        {host.status === 'opening' && <p role='status'>Öppnar ett rum…</p>}
        {host.status === 'error' && (
          <>
            <p role='alert'>{host.error} Du kan spela själv så länge, eller försöka igen.</p>
            <button type='button' onClick={onHost}>
              Försök igen
            </button>
          </>
        )}
        {host.room && host.status === 'open' && <RoomCodeCard code={host.room.code} />}
        {host.status === 'open' && (
          <ul className='together-players' aria-label='Spelare'>
            <li>✓ Colin – du</li>
            {joined.map((slot) => (
              <li key={slot}>✓ {characterName(slot)} – med i spelet</li>
            ))}
            {joined.length < maxPlayers - 1 && <li className='waiting'>… Väntar på nästa kompis</li>}
          </ul>
        )}
        {host.error && host.status === 'open' && <p role='status'>{host.error}</p>}
        {!inGame && host.status !== 'error' && (
          <button type='button' className='together-primary' onClick={onPlay}>
            {session.state.started ? 'Fortsätt spela' : 'Börja spela'}
          </button>
        )}
        <button type='button' onClick={onStopHost}>
          Sluta spela tillsammans
        </button>
      </section>
    );
  }

  return (
    <section className='together' aria-label='Spela tillsammans'>
      {role === null && (
        <div className='together-roles'>
          <button
            type='button'
            className='together-primary'
            onClick={() => {
              setRole('host');
              onHost();
            }}
          >
            <strong>Jag är värd</strong>
            <span>Du är Colin. Kompisarna kommer in i din värld.</span>
          </button>
          <button type='button' onClick={() => setRole('guest')}>
            <strong>Jag går med</strong>
            <span>Du skriver rumskoden från Colins skärm.</span>
          </button>
        </div>
      )}
      {role === 'guest' && !connecting && (
        <>
          <RoomJoin
            onLink={(link: PeerLink) => {
              cancel.current = false;
              setError('');
              setConnecting(true);
              joinWorld(link, storage, () => cancel.current).then(
                (joined) => {
                  if (cancel.current) joined.leave();
                  else onJoined(joined);
                },
                (reason: unknown) => {
                  if (cancel.current) return;
                  setConnecting(false);
                  setError(reason instanceof Error ? reason.message : 'Det gick inte att komma in. Försök igen.');
                },
              );
            }}
          />
          <button type='button' onClick={() => setRole(null)}>
            Tillbaka
          </button>
        </>
      )}
      {connecting && (
        <>
          <p role='status'>Ansluter till Colins värld…</p>
          <button
            type='button'
            onClick={() => {
              cancel.current = true;
              setConnecting(false);
            }}
          >
            Avbryt
          </button>
        </>
      )}
      {error && <p role='alert'>{error}</p>}
      <p className='together-note'>Två till fyra spelare, en på varje telefon eller dator. Det behövs internet.</p>
    </section>
  );
}

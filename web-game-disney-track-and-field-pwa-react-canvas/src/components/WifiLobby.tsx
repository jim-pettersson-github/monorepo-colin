import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Connection } from '../game/network-play';
import { decodeSignal, PeerLink } from '../game/peer-link';
import { QrExchange } from './QrExchange';
import './wifi.css';

export function WifiLobby<T>({
  name,
  maxPlayers,
  config: baseConfig,
  configure,
  validConfig,
  validStart,
  summary,
  controls,
  available,
  hostSettings,
  onBack,
  onLaunch,
}: {
  name: string;
  maxPlayers: number;
  config: T;
  configure?: (config: T, count: number) => T;
  validConfig: (value: unknown) => value is T;
  validStart: (value: unknown) => boolean;
  summary: (config: T) => ReactNode;
  controls: ReactNode;
  available: boolean;
  hostSettings: ReactNode;
  onBack: () => void;
  onLaunch: (connections: Connection[], config: T, state?: unknown) => void;
}) {
  const [foreground, setForeground] = useState(!document.hidden);
  const localAvailable = available && foreground;
  useEffect(() => {
    const blur = () => setForeground(false);
    const focus = () => {
      if (!document.hidden) setForeground(true);
    };
    const visibility = () => setForeground(!document.hidden);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [count, setCount] = useState(2);
  const config = configure ? configure(baseConfig, count) : baseConfig;
  const [links, setLinks] = useState<Connection[]>([]);
  const [invite, setInvite] = useState<PeerLink | null>(null);
  const [guestConfig, setGuestConfig] = useState<T | null>(null);
  const [slot, setSlot] = useState(1);
  const [ready, setReady] = useState('');
  const [guestReady, setGuestReady] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [, refresh] = useState(0);
  const owned = useRef<PeerLink[]>([]);
  const transferred = useRef(false);
  const launch = useRef(onLaunch);
  launch.current = onLaunch;
  const token = JSON.stringify(config);
  const receivedToken = guestConfig === null ? '' : JSON.stringify(guestConfig);
  const supported = window.isSecureContext && typeof RTCPeerConnection !== 'undefined';
  const connected = role === 'guest' && links[0]?.link.status === 'connected';
  useEffect(
    () => () => {
      if (!transferred.current) for (const link of owned.current) link.close();
    },
    [],
  );
  useEffect(() => {
    const subscriptions = links.map(({ link }) => link.subscribe(() => refresh((n) => n + 1)));
    const timer = window.setInterval(() => refresh((n) => n + 1), 500);
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      clearInterval(timer);
    };
  }, [links]);
  useEffect(() => {
    const removals = links.map(({ slot: player, link }) =>
      link.onMessage((value) => {
        if (!value || typeof value !== 'object') return;
        const m = value as Record<string, unknown>;
        if (role === 'host' && m.kind === 'lobby-ready' && typeof m.token === 'string') {
          setGuestReady((old) => (old[player] === m.token ? old : { ...old, [player]: m.token as string }));
        }
        if (
          role === 'guest' &&
          m.kind === 'lobby-settings' &&
          validConfig(m.config) &&
          Number.isInteger(m.slot) &&
          Number(m.slot) >= 1 &&
          Number(m.slot) < maxPlayers
        ) {
          setGuestConfig(m.config);
          setSlot(Number(m.slot));
        }
        if (
          role === 'guest' &&
          m.kind === 'start' &&
          m.version === 1 &&
          validConfig(m.config) &&
          validStart(m.state) &&
          m.slot === slot &&
          link.status === 'connected'
        ) {
          transferred.current = true;
          launch.current([{ slot, link }], m.config, m.state);
        }
      }),
    );
    const send = () => {
      if (role === 'host') for (const { slot, link } of links) link.send({ kind: 'lobby-settings', config, slot });
    };
    send();
    const timer = window.setInterval(send, 250);
    return () => {
      for (const remove of removals) remove();
      clearInterval(timer);
    };
  }, [links, role, config, validConfig, validStart, maxPlayers, slot]);
  useEffect(() => {
    if (role === 'guest' && ready && (!localAvailable || ready !== receivedToken)) {
      setReady('');
      links[0]?.link.send({ kind: 'lobby-ready', token: '' });
    }
  }, [role, ready, localAvailable, receivedToken, links]);
  const reset = () => {
    for (const link of owned.current) link.close();
    owned.current = [];
    setLinks([]);
    setInvite(null);
    setRole(null);
    setGuestConfig(null);
    setReady('');
    setGuestReady({});
    setError('');
  };
  const addGuest = async () => {
    setError('');
    try {
      const link = new PeerLink('host');
      owned.current.push(link);
      setLinks((old) => [...old, { slot: old.length + 1, link }]);
      setInvite(link);
      await link.createOffer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Koden kunde inte skapas. Börja om kopplingen.');
    }
  };
  const allReady = links.length === count - 1 && links.every(({ slot, link }) => link.status === 'connected' && guestReady[slot] === token);
  return (
    <main className='wifi-shell'>
      <button type='button' onClick={onBack}>
        ← Startmenyn
      </button>
      <header>
        <p className='eyebrow'>FLERA ENHETER · SAMMA WI-FI</p>
        <h1>Spela via Wi-Fi</h1>
        <p>Öppna {name} på varje enhet. Gästerna skannar värdens kod, sedan skannar värden varje svarskod. Datorer och telefoner kan spela tillsammans.</p>
      </header>
      {!supported && <p role='alert'>Öppna spelets HTTPS-adress i en webbläsare med WebRTC. Kamera kräver HTTPS eller localhost.</p>}
      {!role ? (
        <>
          {maxPlayers > 2 && (
            <label>
              Antal enheter
              <select aria-label='Antal enheter' value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {Array.from({ length: maxPlayers - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} spelare
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className='wifi-role-options'>
            <button
              type='button'
              className='primary'
              disabled={!supported}
              onClick={() => {
                setRole('host');
                void addGuest();
              }}
            >
              Skapa tävling
            </button>
            <button type='button' disabled={!supported} onClick={() => setRole('guest')}>
              Anslut
            </button>
          </div>
        </>
      ) : (
        <>
          <section className='wifi-connection-state' aria-label='Anslutning' aria-live='polite'>
            <strong>{role === 'host' ? 'Du är värd · Spelare 1' : `Du ansluter · Spelare ${slot + 1}`}</strong>
            {links.map(({ slot, link }) => (
              <p key={slot}>
                Spelare {slot + 1}:{' '}
                {link.status === 'connected'
                  ? 'Enheterna är anslutna!'
                  : link.status === 'gathering'
                    ? 'Skapar QR-kod…'
                    : link.status === 'error' || link.status === 'closed'
                      ? 'Anslutningen är stängd.'
                      : 'Väntar på QR-kopplingen.'}
                {role === 'host' && guestReady[slot] === token ? ' Redo ✓' : ''}
                {link.error && <span role='alert'> {link.error}</span>}
              </p>
            ))}
            {role === 'host' && links.length < count - 1 && links.every(({ link }) => link.status === 'connected') && (
              <button type='button' onClick={() => void addGuest()}>
                Anslut spelare {links.length + 2}
              </button>
            )}
            <button type='button' onClick={reset}>
              Börja om kopplingen
            </button>
          </section>
          {role === 'host' && (
            <section className='wifi-settings'>
              <h2>Värdens val</h2>
              {hostSettings}
            </section>
          )}
          {((role === 'guest' && !connected) || (role === 'host' && invite && invite.status !== 'connected')) &&
            invite?.status !== 'error' &&
            invite?.status !== 'closed' && (
              <QrExchange
                role={role}
                code={invite?.code || ''}
                onCode={async (value) => {
                  if (role === 'host') {
                    if (!invite?.code) throw new Error('Vänta tills QR-koden är klar.');
                    await invite.acceptAnswer(value);
                  } else {
                    const signal = await decodeSignal(value);
                    if (signal.type !== 'offer') throw new Error('Börja med värdens matchkod.');
                    for (const link of owned.current) link.close();
                    const link = new PeerLink('guest');
                    owned.current = [link];
                    setLinks([{ slot: 1, link }]);
                    setInvite(link);
                    try {
                      await link.createAnswer(value);
                    } catch (e) {
                      link.close();
                      setInvite(null);
                      setLinks([]);
                      throw e;
                    }
                  }
                }}
              />
            )}
          <section className='wifi-settings'>
            <h2>Din kontroll</h2>
            {controls}
          </section>
          {(role === 'host' || guestConfig) && (
            <section className='wifi-start'>
              {summary(role === 'host' ? config : (guestConfig as T))}
              {role === 'host' ? (
                <>
                  <p role='status'>{allReady ? 'Alla är redo!' : 'Vänta tills alla enheter är anslutna och alla gäster är redo.'}</p>
                  <button
                    type='button'
                    className='primary'
                    disabled={!allReady || !localAvailable || !validConfig(config)}
                    onClick={() => {
                      transferred.current = true;
                      onLaunch(links, config);
                    }}
                  >
                    Starta Wi-Fi-tävling
                  </button>
                </>
              ) : (
                <>
                  <p role='status'>{ready === receivedToken && ready ? 'Du är redo! Väntar på värden.' : 'Kontrollera värdens val och välj din kontroll.'}</p>
                  <button
                    type='button'
                    className='primary'
                    disabled={!connected || !localAvailable || !!ready || !receivedToken}
                    onClick={() => {
                      if (links[0]?.link.send({ kind: 'lobby-ready', token: receivedToken })) setReady(receivedToken);
                    }}
                  >
                    Jag är redo
                  </button>
                </>
              )}
            </section>
          )}
        </>
      )}
      {error && <p role='alert'>{error}</p>}
      <details>
        <summary>Så fungerar kopplingen</summary>
        <p>
          Använd samma vanliga Wi-Fi. Gästnätverk kan blockera kontakt mellan enheter. Ingen spelserver, STUN eller TURN används. När spelet har laddats behövs
          inte internet för själva tävlingen.
        </p>
        <p>
          Du kan också kopiera koder eller välja QR-bilder. Håll alla skärmar öppna. Om någon lämnar spelet eller tappar anslutningen pausas tävlingen för alla.
          Vid omladdning behöver ni koppla ihop igen. Wi-Fi-tävlingar ersätter inte dina lokala sparade spel eller karriärresultat.
        </p>
      </details>
    </main>
  );
}

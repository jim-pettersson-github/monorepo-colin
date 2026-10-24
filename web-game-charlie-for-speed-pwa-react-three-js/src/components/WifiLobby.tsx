import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Connection } from '../game/network-play';
import { decodeSignal, PeerLink } from '../game/peer-link';
import { CodeRead, CodeShow, InviteSteps } from './QrExchange';
import './wifi.css';

export function WifiLobby<T>({
  name,
  title = 'Spela via Wi-Fi',
  maxPlayers,
  config: baseConfig,
  configure,
  readyKey = (value) => JSON.stringify(value),
  validConfig,
  validStart,
  summary,
  controls,
  available,
  hostSettings,
  guestPick,
  startLabel = 'Starta Wi-Fi-tävling',
  onBack,
  onLaunch,
}: {
  name: string;
  title?: string;
  maxPlayers: number;
  config: T;
  // Picks are the choices guests sent from their own devices, by slot; count includes the host.
  configure?: (config: T, count: number, picks: Record<number, string>) => T;
  // The part of the settings a guest confirms with Redo; changing it asks every guest again.
  readyKey?: (config: T) => string;
  validConfig: (value: unknown) => value is T;
  validStart: (value: unknown) => boolean;
  summary: (config: T) => ReactNode;
  controls: ReactNode;
  available: boolean;
  hostSettings: ReactNode;
  // Lets a guest choose something for themself, such as their car.
  guestPick?: (config: T, slot: number, pick: (value: string) => void) => ReactNode;
  startLabel?: string;
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
  const [picks, setPicks] = useState<Record<number, string>>({});
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
  const joined = links.filter(({ link }) => link.status === 'connected');
  const config = configure ? configure(baseConfig, joined.length + 1, picks) : baseConfig;
  const token = readyKey(config);
  const receivedToken = guestConfig === null ? '' : readyKey(guestConfig);
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
        if (role === 'host' && m.kind === 'lobby-pick' && typeof m.value === 'string' && m.value.length <= 40) {
          setPicks((old) => (old[player] === m.value ? old : { ...old, [player]: m.value as string }));
        }
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
    setPicks({});
    setError('');
  };
  // Removing a player renumbers the rest, so player numbers always run 2, 3, 4…
  const removeLink = (target: PeerLink) => {
    target.close();
    owned.current = owned.current.filter((link) => link !== target);
    if (invite === target) setInvite(null);
    setLinks((old) => old.filter(({ link }) => link !== target).map((entry, index) => ({ ...entry, slot: index + 1 })));
    setGuestReady({});
    setPicks({});
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
      setError(e instanceof Error ? e.message : 'Koden kunde inte skapas. Försök igen.');
    }
  };
  const pending = invite && invite.status !== 'connected' ? invite : null;
  const pendingSlot = pending ? (links.find(({ link }) => link === pending)?.slot ?? links.length) : 0;
  const allReady = joined.length > 0 && joined.every(({ slot, link }) => link.status === 'connected' && guestReady[slot] === token);
  const guestStep = connected ? 3 : invite ? 2 : 1;
  const linkState = (link: PeerLink, player: number) => {
    if (link.status === 'connected') return guestReady[player] === token ? 'Ansluten · Redo ✓' : 'Ansluten · väntar på Redo';
    if (link.status === 'error' || link.status === 'closed') return 'Anslutningen bröts';
    return 'Bjuds in…';
  };

  return (
    <main className='wifi-shell'>
      <header className='wifi-header'>
        <button type='button' onClick={role ? reset : onBack}>
          ← {role ? 'Byt roll' : 'Tillbaka'}
        </button>
        <p className='eyebrow'>SAMMA WI-FI · EN ENHET PER SPELARE</p>
        <h1>{title}</h1>
      </header>
      {!supported && <p role='alert'>Öppna spelets HTTPS-adress i en webbläsare med WebRTC. Kamera kräver HTTPS eller localhost.</p>}

      {!role && (
        <>
          <div className='wifi-role-options'>
            <button
              type='button'
              className='role-card primary'
              disabled={!supported}
              onClick={() => {
                setRole('host');
                void addGuest();
              }}
            >
              <strong>Jag är värd</strong>
              <span>Du väljer inställningarna och bjuder in kompisarna, en i taget.</span>
            </button>
            <button type='button' className='role-card' disabled={!supported} onClick={() => setRole('guest')}>
              <strong>Jag går med</strong>
              <span>Du läser in värdens kod och skickar ditt svar tillbaka.</span>
            </button>
          </div>
          <p className='hint'>Öppna {name} på varje telefon eller dator. En av er är värd.</p>
        </>
      )}

      {role === 'host' && (
        <>
          <section className='wifi-panel'>
            <h2>Spelare</h2>
            <ul className='player-list'>
              <li className='done'>✓ Spelare 1 – du (värd)</li>
              {links.map(({ slot: player, link }) => (
                <li key={player} className={link.status === 'connected' ? 'done' : undefined}>
                  {link.status === 'connected' ? '✓' : '…'} Spelare {player + 1} – {linkState(link, player)}
                  {link.error && <span role='alert'> {link.error}</span>}
                  {link !== pending && link.status !== 'connected' && (
                    <button type='button' onClick={() => removeLink(link)}>
                      Ta bort
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {pending && pending.status !== 'error' && pending.status !== 'closed' ? (
              <>
                <InviteSteps
                  code={pending.code}
                  player={pendingSlot + 1}
                  onAnswer={async (value) => {
                    if (!pending.code) throw new Error('Vänta tills koden är klar.');
                    await pending.acceptAnswer(value);
                  }}
                />
                <button type='button' onClick={() => removeLink(pending)}>
                  Avbryt inbjudan
                </button>
              </>
            ) : (
              links.length + 1 < maxPlayers && (
                <button type='button' className={joined.length ? undefined : 'primary'} onClick={() => void addGuest()}>
                  Bjud in spelare {links.length + 2}
                </button>
              )
            )}
          </section>
          <section className='wifi-panel'>
            <h2>Inställningar</h2>
            {hostSettings}
          </section>
          <section className='wifi-panel wifi-start'>
            {summary(config)}
            <p role='status'>
              {allReady ? 'Alla är redo!' : joined.length ? 'Väntar på att alla anslutna spelare trycker Redo.' : 'Bjud in minst en spelare för att starta.'}
            </p>
            <button
              type='button'
              className='primary'
              disabled={!allReady || !localAvailable || !validConfig(config)}
              onClick={() => {
                transferred.current = true;
                for (const { link } of links) if (link.status !== 'connected') link.close();
                onLaunch(joined, config);
              }}
            >
              {startLabel}
            </button>
          </section>
        </>
      )}

      {role === 'guest' && (
        <>
          <ol className='wifi-progress' aria-label='Steg'>
            {['Läs in värdens kod', 'Skicka ditt svar', 'Redo'].map((label, index) => (
              <li key={label} className={index + 1 < guestStep ? 'done' : index + 1 === guestStep ? 'current' : undefined}>
                <span className='step-number'>{index + 1 < guestStep ? '✓' : index + 1}</span> {label}
              </li>
            ))}
          </ol>
          {guestStep === 1 && (
            <section className='wifi-step'>
              <h2>Läs in värdens kod</h2>
              <p>Skanna QR-bilden på värdens skärm, eller klistra in koden om värden skickade den i ett meddelande.</p>
              <CodeRead
                placeholder='Klistra in värdens kod här'
                onCode={async (value) => {
                  const signal = await decodeSignal(value);
                  if (signal.type !== 'offer') throw new Error('Det här är en svarskod. Läs in värdens kod istället.');
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
                }}
              />
            </section>
          )}
          {guestStep === 2 && invite && (
            <section className='wifi-step'>
              <h2>Visa ditt svar för värden</h2>
              {invite.status === 'error' || invite.status === 'closed' ? (
                <p role='alert'>{invite.error || 'Anslutningen bröts.'}</p>
              ) : (
                <>
                  <p>Låt värden skanna bilden, eller dela svarskoden tillbaka via SMS eller chatt.</p>
                  <CodeShow code={invite.code} label='Din svarskod' alt='QR-kod med svar till värden' />
                  <p role='status'>Väntar på att värden läser in ditt svar…</p>
                </>
              )}
              <button type='button' onClick={reset}>
                Börja om
              </button>
            </section>
          )}
          {guestStep === 3 && (
            <section className='wifi-step'>
              <h2>Ansluten som spelare {slot + 1}</h2>
              <p>Enheterna är anslutna!</p>
              {guestConfig ? summary(guestConfig) : <p role='status'>Hämtar värdens inställningar…</p>}
              {guestConfig && guestPick?.(guestConfig, slot, (value) => links[0]?.link.send({ kind: 'lobby-pick', value }))}
              <p role='status'>{ready === receivedToken && ready ? 'Du är redo! Väntar på att värden startar.' : 'Kolla inställningarna och tryck Redo.'}</p>
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
            </section>
          )}
        </>
      )}

      {error && <p role='alert'>{error}</p>}
      <details>
        <summary>Kontroller och hur kopplingen fungerar</summary>
        {controls}
        <p>
          Alla behöver vara på samma vanliga Wi-Fi; gästnätverk kan blockera kontakt mellan enheter. Ingen spelserver används, och när spelet har laddats behövs
          inte internet. Om någon lämnar spelet eller tappar anslutningen pausas tävlingen för alla.
        </p>
      </details>
    </main>
  );
}

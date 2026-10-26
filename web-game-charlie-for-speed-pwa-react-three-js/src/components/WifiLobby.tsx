import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Connection } from '../game/network-play';
import type { PeerLink } from '../game/peer-link';
import { Room } from '../game/room-server';
import { GameList, JoinProgress, RoomCodeCard, RoomInvite, RoomJoin } from './RoomPairing';
import './wifi.css';

// What every device shows in the lobby's player list; the host sends it with the settings.
type RosterEntry = { name: string; state: 'host' | 'ready' | 'waiting' | 'joining' };

const cleanLabel = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/\p{Cc}/gu, '')
        .trim()
        .slice(0, 20)
    : '';

function validRoster(value: unknown, maxPlayers: number): value is RosterEntry[] {
  return (
    Array.isArray(value) &&
    value.length <= maxPlayers &&
    value.every(
      (entry) => entry && typeof entry.name === 'string' && entry.name.length <= 20 && ['host', 'ready', 'waiting', 'joining'].includes(entry.state as string),
    )
  );
}

// "Charlies spel", "Klaus spel": Swedish genitive for the open-game list.
const gameTitle = (name: string) => (name ? `${name}${/[sxz]$/i.test(name) ? '' : 's'} spel` : 'Öppet spel');

const rosterText = { host: 'värd', ready: 'Redo ✓', waiting: 'väntar på Redo', joining: 'ansluter…' };

export function WifiLobby<T>({
  name,
  title = 'Spela online',
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
  startLabel = 'Starta racet',
  playerName = '',
  onPlayerName,
  listing,
  onBack,
  onLaunch,
}: {
  name: string;
  title?: string;
  maxPlayers: number;
  config: T;
  // Picks are the choices guests sent from their own devices, by slot; count includes the host. Names are by slot, the host's at 0.
  configure?: (config: T, count: number, picks: Record<number, string>, names: Record<number, string>) => T;
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
  // This device's player name in the lobby list; with onPlayerName the lobby lets the player change it.
  playerName?: string;
  onPlayerName?: (name: string) => void;
  // One line about the game for the open-game list, such as the track and laps.
  listing?: (config: T) => string;
  onBack: () => void;
  // The host's room moves with the connections, so the next screen can invite more players or close it.
  onLaunch: (connections: Connection[], config: T, state?: unknown, room?: Room) => void;
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
  const [room, setRoom] = useState<Room | null>(null);
  const [opening, setOpening] = useState(false);
  const [names, setNames] = useState<Record<number, string>>({});
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [notice, setNotice] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [listed, setListed] = useState(true);
  const [pick, setPick] = useState<{ code: string; at: number }>();
  // When the guest's current join attempt started; the progress steps count from it until the devices connect.
  const [joinSince, setJoinSince] = useState<number | null>(null);
  const kicked = useRef(false);
  const [, refresh] = useState(0);
  const owned = useRef<PeerLink[]>([]);
  const ownedRoom = useRef<Room | null>(null);
  const transferred = useRef(false);
  const launch = useRef(onLaunch);
  launch.current = onLaunch;
  const joined = links.filter(({ link }) => link.status === 'connected');
  const config = configure ? configure(baseConfig, joined.length + 1, picks, { ...names, 0: cleanLabel(playerName) }) : baseConfig;
  const token = readyKey(config);
  const receivedToken = guestConfig === null ? '' : readyKey(guestConfig);
  const supported = window.isSecureContext && typeof RTCPeerConnection !== 'undefined';
  const connected = role === 'guest' && links[0]?.link.status === 'connected';
  useEffect(
    () => () => {
      if (transferred.current) return;
      for (const link of owned.current) link.close();
      ownedRoom.current?.close();
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
          const label = cleanLabel(m.name);
          setNames((old) => (old[player] === label ? old : { ...old, [player]: label }));
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
          if (validRoster(m.roster, maxPlayers)) setRoster(m.roster);
        }
        if (role === 'guest' && m.kind === 'lobby-kick') {
          kicked.current = true;
          link.close();
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
    // Both sides repeat their state, so a missed message or a renumbered slot heals itself within a moment.
    const send = () => {
      if (role === 'host') {
        const players: RosterEntry[] = [{ name: cleanLabel(playerName) || 'Spelare 1', state: 'host' }];
        for (const { slot: player, link } of links) {
          const name = names[player] || `Spelare ${player + 1}`;
          if (link.status === 'connected') players.push({ name, state: guestReady[player] === token ? 'ready' : 'waiting' });
          else if (link.status === 'connecting') players.push({ name, state: 'joining' });
        }
        for (const { slot, link } of links) link.send({ kind: 'lobby-settings', config, slot, roster: players });
      }
      if (role === 'guest') links[0]?.link.send({ kind: 'lobby-ready', token: ready, name: cleanLabel(playerName) });
    };
    send();
    const timer = window.setInterval(send, 250);
    return () => {
      for (const remove of removals) remove();
      clearInterval(timer);
    };
  }, [links, role, config, validConfig, validStart, maxPlayers, slot, names, guestReady, token, ready, playerName]);
  useEffect(() => {
    if (role === 'guest' && ready && (!localAvailable || ready !== receivedToken)) {
      setReady('');
      links[0]?.link.send({ kind: 'lobby-ready', token: '' });
    }
  }, [role, ready, localAvailable, receivedToken, links]);
  const reset = () => {
    setJoinSince(null);
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
    setNames({});
    setRoster([]);
    setNotice('');
    ownedRoom.current?.close();
    ownedRoom.current = null;
    setRoom(null);
    setOpening(false);
  };
  // Removing a player renumbers the rest, so player numbers always run 2, 3, 4…; everyone else keeps their name, pick and Redo.
  const removeLink = (target: PeerLink) => {
    target.close();
    owned.current = owned.current.filter((link) => link !== target);
    if (invite === target) setInvite(null);
    const remaining = links.filter(({ link }) => link !== target);
    const renumber = <V,>(old: Record<number, V>) =>
      Object.fromEntries(remaining.flatMap((entry, index) => (entry.slot in old ? [[index + 1, old[entry.slot]]] : []))) as Record<number, V>;
    setLinks(remaining.map((entry, index) => ({ ...entry, slot: index + 1 })));
    setGuestReady(renumber);
    setPicks(renumber);
    setNames(renumber);
  };
  const addGuest = async (open: Room) => {
    setError('');
    try {
      const link = open.link();
      owned.current.push(link);
      setLinks((old) => [...old, { slot: old.length + 1, link }]);
      setInvite(link);
      await link.createOffer();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Koden kunde inte skapas. Försök igen.');
    }
  };
  const startHosting = async () => {
    setRole('host');
    setError('');
    setOpening(true);
    try {
      const open = await Room.open();
      ownedRoom.current = open;
      setRoom(open);
      setOpening(false);
      await addGuest(open);
    } catch (e) {
      setOpening(false);
      setError(`${e instanceof Error ? e.message : 'Spelservern svarar inte.'} Kolla internet och försök igen.`);
    }
  };
  const pending = invite && invite.status !== 'connected' ? invite : null;
  const inviteConnected = invite?.status === 'connected';
  // With a room code, the next place opens as soon as a guest connects, so everyone can type the code at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: addGuest reads the latest room and links on each render
  useEffect(() => {
    if (role === 'host' && room && inviteConnected && links.length + 1 < maxPlayers) void addGuest(room);
  }, [role, room, inviteConnected, links.length, maxPlayers]);
  // A room invitation that failed, for example on a network that blocks direct contact, makes way for a fresh one.
  const failedInvite = role === 'host' && room && invite && (invite.status === 'error' || invite.status === 'closed') ? invite : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per failed invitation with the latest state
  useEffect(() => {
    if (!failedInvite || !room) return;
    const player = (links.find(({ link }) => link === failedInvite)?.slot ?? links.length) + 1;
    setNotice(`Spelare ${player}: ${failedInvite.error || 'anslutningen bröts.'} Rummet är öppet igen.`);
    removeLink(failedInvite);
    void addGuest(room);
  }, [failedInvite]);
  // A guest whose room connection fails goes back to the code, ready to try again.
  const failedJoin = role === 'guest' && invite && (invite.status === 'error' || invite.status === 'closed') ? invite : null;
  useEffect(() => {
    if (!failedJoin) return;
    setNotice(kicked.current ? 'Värden tog bort dig från spelet.' : failedJoin.error || 'Anslutningen till värden bröts.');
    kicked.current = false;
    setJoinSince(null);
    owned.current = [];
    setLinks([]);
    setInvite(null);
    setGuestConfig(null);
    setRoster([]);
    setReady('');
  }, [failedJoin]);
  const players = joined.length + 1;
  const listingTitle = gameTitle(cleanLabel(playerName));
  const info = listing ? listing(config) : '';
  useEffect(() => {
    if (role !== 'host' || !room) return;
    const announce = () => room.announce({ listed, title: listingTitle, info, players, capacity: maxPlayers }).catch(() => {});
    void announce();
    const timer = window.setInterval(announce, 5000);
    return () => clearInterval(timer);
  }, [role, room, listed, listingTitle, info, players, maxPlayers]);
  // The host can send someone away; the message goes first so their screen can say why.
  const removeRef = useRef(removeLink);
  removeRef.current = removeLink;
  const kick = (target: PeerLink) => {
    target.send({ kind: 'lobby-kick' });
    window.setTimeout(() => removeRef.current(target), 300);
  };
  const allReady = joined.length > 0 && joined.every(({ slot, link }) => link.status === 'connected' && guestReady[slot] === token);
  const guestStep = connected ? 3 : invite ? 2 : 1;
  const linkState = (link: PeerLink, player: number) => {
    if (link.status === 'connected') return guestReady[player] === token ? 'Ansluten · Redo ✓' : 'Ansluten · väntar på Redo';
    if (link.status === 'error' || link.status === 'closed') return 'Anslutningen bröts';
    if (link.status === 'connecting') return 'Ansluter…';
    return 'Väntar på att någon går med…';
  };

  return (
    <main className='wifi-shell'>
      <header className='wifi-header'>
        <button type='button' onClick={role ? reset : onBack}>
          ← {role ? 'Byt roll' : 'Tillbaka'}
        </button>
        <p className='eyebrow'>ONLINE · EN ENHET PER SPELARE</p>
        <h1>{title}</h1>
        <p className='hint'>Version {__APP_VERSION__} · alla måste ha samma version för att spela ihop.</p>
      </header>
      {!supported && <p role='alert'>Öppna spelets HTTPS-adress i en webbläsare med WebRTC.</p>}

      {onPlayerName && (
        <label className='lobby-name'>
          Ditt namn
          <input value={playerName} maxLength={16} autoComplete='nickname' placeholder='Valfritt' onChange={(event) => onPlayerName(event.target.value)} />
        </label>
      )}

      {!role && (
        <>
          <div className='wifi-role-options'>
            <button type='button' className='role-card primary' disabled={!supported} onClick={() => void startHosting()}>
              <strong>Jag är värd</strong>
              <span>Du väljer inställningarna. Spelet syns i listan, och kompisar går med därifrån eller med rumskoden.</span>
            </button>
            <button type='button' className='role-card' disabled={!supported} onClick={() => setRole('guest')}>
              <strong>Jag går med</strong>
              <span>Du väljer ett öppet spel i listan, eller skriver värdens rumskod.</span>
            </button>
          </div>
          <p className='hint'>Öppna {name} på varje telefon eller dator. En av er är värd.</p>
        </>
      )}

      {role === 'host' && (
        <>
          <section className='wifi-panel'>
            <h2>Spelare</h2>
            {opening && <p role='status'>Öppnar ett rum…</p>}
            {!room && !opening && (
              <button type='button' className='primary' onClick={() => void startHosting()}>
                Försök igen
              </button>
            )}
            {room && <RoomCodeCard room={room} />}
            {room && (
              <label className='toggle list-toggle'>
                <input type='checkbox' checked={listed} onChange={(event) => setListed(event.target.checked)} />
                <span>
                  Visa i listan över öppna spel
                  <small>Alla som öppnar spelet kan se och gå med. Utan listan går det bara med rumskoden.</small>
                </span>
              </label>
            )}
            <ul className='player-list'>
              <li className='done'>✓ Spelare 1{cleanLabel(playerName) ? ` (${cleanLabel(playerName)})` : ''} – du (värd)</li>
              {links.map(({ slot: player, link }) => (
                <li key={player} className={link.status === 'connected' ? 'done' : undefined}>
                  {link.status === 'connected' ? '✓' : '…'} Spelare {player + 1}
                  {names[player] ? ` (${names[player]})` : ''} – {linkState(link, player)}
                  {link.error && <span role='alert'> {link.error}</span>}
                  {link !== pending && link.status !== 'connected' && (
                    <button type='button' onClick={() => removeLink(link)}>
                      Ta bort
                    </button>
                  )}
                  {link.status === 'connected' && (
                    <button type='button' className='kick' onClick={() => kick(link)}>
                      Sparka
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {notice && <p role='status'>{notice}</p>}
            {room && pending && pending.status !== 'error' && pending.status !== 'closed' ? (
              <>
                <RoomInvite room={room} link={pending} onError={setError} />
                <button type='button' onClick={() => removeLink(pending)}>
                  Stäng den lediga platsen
                </button>
              </>
            ) : (
              room &&
              links.length + 1 < maxPlayers && (
                <button type='button' className={joined.length ? undefined : 'primary'} onClick={() => void addGuest(room)}>
                  Öppna en plats för spelare {links.length + 2}
                </button>
              )
            )}
          </section>
          <section className='wifi-panel'>
            <h2>Inställningar</h2>
            {hostSettings}
          </section>
          <section className='wifi-panel'>
            <h2>Din kontroll</h2>
            {controls}
          </section>
          <section className='wifi-panel wifi-start'>
            {summary(config)}
            <p role='status'>
              {allReady
                ? 'Alla är redo!'
                : joined.length
                  ? 'Väntar på att alla anslutna spelare trycker Redo.'
                  : 'Minst en spelare till behöver gå med för att starta.'}
            </p>
            <button
              type='button'
              className='primary'
              disabled={!allReady || !localAvailable || !validConfig(config)}
              onClick={() => {
                transferred.current = true;
                for (const { link } of links) if (link.status !== 'connected') link.close();
                ownedRoom.current = null;
                onLaunch(joined, config, undefined, room ?? undefined);
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
            {['Välj spel', 'Anslut', 'Redo'].map((label, index) => (
              <li key={label} className={index + 1 < guestStep ? 'done' : index + 1 === guestStep ? 'current' : undefined}>
                <span className='step-number'>{index + 1 < guestStep ? '✓' : index + 1}</span> {label}
              </li>
            ))}
          </ol>
          {guestStep === 1 && joinSince === null && (
            <section className='wifi-step'>
              <h2>Öppna spel</h2>
              <GameList onPick={(code) => setPick({ code, at: Date.now() })} />
            </section>
          )}
          {guestStep === 1 && (
            <section className='wifi-step'>
              <h2>{joinSince === null ? 'Eller skriv värdens rumskod' : 'Går med i rummet'}</h2>
              {joinSince === null && <p>Koden står överst på värdens skärm. Ni kan vara på samma ställe eller långt ifrån varandra.</p>}
              {notice && joinSince === null && <p role='alert'>{notice} Tryck Gå med i rummet för att försöka igen.</p>}
              <RoomJoin
                initialCode={lastCode}
                pick={pick}
                onBusy={setJoinSince}
                onLink={(link, code, since) => {
                  setJoinSince(since);
                  // A pick joins once: when this connection ends (a kick, a dropped line), the form must not rejoin by itself.
                  setPick(undefined);
                  for (const old of owned.current) old.close();
                  owned.current = [link];
                  setLinks([{ slot: 1, link }]);
                  setInvite(link);
                  setLastCode(code);
                  setNotice('');
                }}
              />
            </section>
          )}
          {guestStep === 2 && invite && (
            <section className='wifi-step'>
              <h2>Ansluter till värden</h2>
              {invite.status === 'error' || invite.status === 'closed' ? (
                <p role='alert'>{invite.error || 'Anslutningen bröts.'}</p>
              ) : (
                <JoinProgress step='connecting' since={joinSince ?? Date.now()} />
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
              {roster.length > 0 && (
                <>
                  <h3>I rummet</h3>
                  <ul className='player-list' aria-label='Spelare i rummet'>
                    {roster.map((entry, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: players are identified by their slot
                      <li key={index} className={entry.state === 'joining' ? undefined : 'done'}>
                        {entry.state === 'joining' ? '…' : '✓'} {entry.name}
                        {index === slot ? ' (du)' : ''} – {rosterText[entry.state]}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {guestConfig ? summary(guestConfig) : <p role='status'>Hämtar värdens inställningar…</p>}
              {guestConfig && guestPick?.(guestConfig, slot, (value) => links[0]?.link.send({ kind: 'lobby-pick', value }))}
              <h3>Din kontroll</h3>
              {controls}
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
        <summary>Hur kopplingen fungerar</summary>
        <p>
          Spelservern hjälper enheterna att hitta varandra, oavsett om ni är på samma Wi-Fi eller på olika ställen. Själva tävlingen går direkt mellan
          enheterna. Vissa mobilnät och skolnät blockerar direktkontakt; byt då nät, till exempel från mobildata till Wi-Fi. Om någon lämnar spelet eller tappar
          anslutningen pausas tävlingen för alla.
        </p>
      </details>
    </main>
  );
}

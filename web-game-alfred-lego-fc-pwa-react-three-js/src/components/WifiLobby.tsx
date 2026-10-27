import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchClubs } from '../game/clubs';
import { defaultClubs, getClub, validClub } from '../game/clubs';
import { cupName } from '../game/cups';
import type { InputManager } from '../game/input';
import { validFive } from '../game/lineups';
import type { CupKind, MatchState } from '../game/model';
import { createMatch } from '../game/model';
import { validNetworkMatch } from '../game/network-session';
import type { PeerLink } from '../game/peer-link';
import { type Footballer, footballer } from '../game/players';
import { Room } from '../game/room-server';
import { type TransferSave, withMatchSquads } from '../game/transfers';
import { ControlSetup } from './ControlSetup';
import { FullscreenButton } from './FullscreenButton';
import { FiveEditor, LineupPicker } from './LineupPicker';
import { GameList, JoinProgress, RoomCodeCard, RoomInvite, RoomJoin } from './RoomPairing';
import { SoundToggle } from './SoundControls';
import { MatchTeams } from './TeamBrowser';
import { TeamSelection } from './TeamSelection';
import './wifi.css';

const noSubscribe = () => () => {};
const zero = () => 0;
const statusText = {
  new: 'Förbereder anslutningen…',
  gathering: 'Förbereder inbjudan…',
  waiting: 'Väntar på att enheterna får kontakt…',
  connecting: 'Kopplar ihop enheterna…',
  connected: 'Enheterna är anslutna!',
  closed: 'Anslutningen är stängd.',
  error: 'Anslutningen kunde inte fortsätta.',
};

export function WifiLobby({
  transfers,
  onTransfers,
  input,
  fixture = null,
  onBack,
  onLaunch,
}: {
  transfers: TransferSave;
  onTransfers: (save: TransferSave) => void;
  input: InputManager;
  fixture?: MatchState | null;
  onBack: () => void;
  onLaunch: (link: PeerLink, state: MatchState) => void;
}) {
  const [role, setRole] = useState<'host' | 'guest' | null>(null);
  const [link, setLink] = useState<PeerLink | null>(null);
  const [error, setError] = useState('');
  const [clubs, setClubs] = useState<MatchClubs>(fixture ? [...fixture.clubs] : [...defaultClubs]);
  const [duration, setDuration] = useState(fixture?.duration ?? 180);
  const [cupMatch, setCupMatch] = useState<CupKind | null>(fixture?.cup?.kind ?? null);
  const [leagueMatch, setLeagueMatch] = useState(!!fixture?.league);
  const [guestReady, setGuestReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [guestChoice, setGuestChoice] = useState<{ club: string; five: string[] } | null>(null);
  const [guestPreview, setGuestPreview] = useState<MatchState | null>(null);
  const preview = useMemo(() => {
    const match = withMatchSquads(transfers, fixture ?? createMatch('versus', duration, 'normal', clubs));
    if (
      !match.career &&
      guestChoice?.club === match.clubs[1] &&
      validFive(guestChoice.five, match.squads?.[1].map(footballer).filter((p): p is Footballer => !!p) ?? [])
    ) {
      if (match.lineups) match.lineups[1] = [...guestChoice.five];
      for (const p of match.players) p.athlete = match.lineups?.[p.team][p.role];
    }
    return match;
  }, [transfers, fixture, duration, clubs, guestChoice]);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const owned = useRef<PeerLink | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [listed, setListed] = useState(true);
  const [pick, setPick] = useState<{ code: string; at: number }>();
  // When the guest's current join attempt started; the progress steps count from it until the devices connect.
  const [joinSince, setJoinSince] = useState<number | null>(null);
  // Set when the host sends the guest away, so both screens can say why the connection ended.
  const kicked = useRef(false);
  const ownedRoom = useRef<Room | null>(null);
  // Counts room attempts, so a slow answer from the server after Börja om or leaving the lobby is discarded.
  const attempt = useRef(0);
  const transferred = useRef(false);
  const launch = useRef(onLaunch);
  launch.current = onLaunch;
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  useSyncExternalStore(link?.subscribe || noSubscribe, link?.getSnapshot || zero);
  const connected = link?.status === 'connected';
  const available = input.available(0);
  const supported = window.isSecureContext && typeof RTCPeerConnection !== 'undefined';
  useEffect(
    () => () => {
      // The room is only for pairing; a started match needs no more invitations.
      attempt.current++;
      ownedRoom.current?.close();
      if (!transferred.current) owned.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!link) return;
    return link.onMessage((message) => {
      if (!message || typeof message !== 'object') return;
      const m = message as Record<string, unknown>;
      if (link.role === 'host' && m.kind === 'lobby-ready' && typeof m.ready === 'boolean') setGuestReady(m.ready);
      if (link.role === 'host' && m.kind === 'lobby-lineup' && !previewRef.current.career) {
        const squad = previewRef.current.squads?.[1].map(footballer).filter((p): p is Footballer => !!p) ?? [];
        if (validFive(m.five, squad)) setGuestChoice({ club: previewRef.current.clubs[1], five: [...m.five] });
      }
      if (
        link.role === 'guest' &&
        m.kind === 'settings' &&
        Array.isArray(m.clubs) &&
        m.clubs.length === 2 &&
        m.clubs.every(validClub) &&
        m.clubs[0] !== m.clubs[1] &&
        [60, 180, 300].includes(m.duration as number)
      ) {
        setClubs(m.clubs as MatchClubs);
        setDuration(m.duration as number);
        setLeagueMatch(m.league === true);
        setCupMatch(m.cup === 'alfred' || m.cup === 'masters' || m.cup === 'world' ? m.cup : null);
        if (validNetworkMatch(m.preview)) setGuestPreview(m.preview);
      }
      if (link.role === 'guest' && m.kind === 'lobby-kick') {
        kicked.current = true;
        link.close();
      }
      if (link.role === 'guest' && m.kind === 'start' && m.version === 1 && validNetworkMatch(m.state) && link.status === 'connected') {
        transferred.current = true;
        launch.current(link, m.state);
      }
    });
  }, [link]);
  useEffect(() => {
    if (link?.role === 'host' && connected)
      link.send({ kind: 'settings', clubs, duration, league: !!fixture?.league, cup: fixture?.cup?.kind ?? null, preview });
  }, [link, connected, clubs, duration, fixture, preview]);
  useEffect(() => {
    if (link?.role === 'guest' && connected && ready && !available) {
      setReady(false);
      link.send({ kind: 'lobby-ready', ready: false });
    }
  }, [link, connected, ready, available]);
  // The guest repeats its Redo, so the host's start button never waits on a lost message.
  useEffect(() => {
    if (link?.role !== 'guest' || !connected) return;
    const timer = window.setInterval(() => link.send({ kind: 'lobby-ready', ready }), 1000);
    return () => clearInterval(timer);
  }, [link, connected, ready]);
  // A room join that cannot get through, for example on a network that blocks direct contact, starts over by itself.
  const failed = role && link && (link.status === 'error' || link.status === 'closed') && (role === 'guest' || !!room) ? link : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per failed link with the latest room
  useEffect(() => {
    if (!failed) return;
    setGuestReady(false);
    setReady(false);
    setGuestChoice(null);
    setJoinSince(null);
    const reason = kicked.current ? (role === 'host' ? 'Du tog bort kompisen.' : 'Värden tog bort dig från matchen.') : failed.error || 'Anslutningen bröts.';
    kicked.current = false;
    if (role === 'host' && room) {
      setNotice(`${reason} Rummet är öppet igen.`);
      const next = keep(room.link());
      next.createOffer().catch((e) => setError(e instanceof Error ? e.message : 'Inbjudan kunde inte skapas.'));
    } else {
      setNotice(`${reason} Tryck Gå med i rummet för att försöka igen.`);
      owned.current = null;
      setLink(null);
    }
  }, [failed]);
  const keep = (next: PeerLink) => {
    owned.current?.close();
    owned.current = next;
    setLink(next);
    return next;
  };
  // The host always plays through a room on the game server; without it there is nothing to join.
  const openRoom = async () => {
    const current = ++attempt.current;
    owned.current?.close();
    owned.current = null;
    setLink(null);
    ownedRoom.current?.close();
    ownedRoom.current = null;
    setRoom(null);
    setRoomError('');
    setError('');
    let open: Room;
    try {
      open = await Room.open();
    } catch (e) {
      if (current === attempt.current) setRoomError(e instanceof Error ? e.message : 'Spelservern svarar inte.');
      return;
    }
    if (current !== attempt.current) return open.close();
    ownedRoom.current = open;
    setRoom(open);
    try {
      await keep(open.link()).createOffer();
    } catch (e) {
      if (current === attempt.current) setError(e instanceof Error ? e.message : 'Inbjudan kunde inte skapas.');
    }
  };
  // The host can send the guest away; the message goes first so their screen can say why.
  const kick = () => {
    if (!link) return;
    link.send({ kind: 'lobby-kick' });
    kicked.current = true;
    const target = link;
    window.setTimeout(() => target.close(), 300);
  };
  // While the room waits for a guest it is on the open-match list, unless the host takes it off.
  const listingTitle = fixture?.cup ? cupName(fixture.cup.kind) : fixture?.league ? 'Ligamatch' : 'Onlinematch';
  const listingInfo = `${getClub(clubs[0]).name} – ${getClub(clubs[1]).name} · ${duration / 60} min`;
  const players = connected ? 2 : 1;
  useEffect(() => {
    if (role !== 'host' || !room) return;
    const announce = () => room.announce({ listed, title: listingTitle, info: listingInfo, players, capacity: 2 }).catch(() => {});
    void announce();
    const timer = window.setInterval(announce, 5000);
    return () => clearInterval(timer);
  }, [role, room, listed, listingTitle, listingInfo, players]);
  const reset = () => {
    attempt.current++;
    kicked.current = false;
    setJoinSince(null);
    setPick(undefined);
    owned.current?.close();
    owned.current = null;
    ownedRoom.current?.close();
    ownedRoom.current = null;
    setRoom(null);
    setRoomError('');
    setNotice('');
    setLink(null);
    setRole(null);
    setError('');
    setGuestReady(false);
    setReady(false);
    setGuestChoice(null);
    setGuestPreview(null);
    setLeagueMatch(!!fixture?.league);
    setCupMatch(fixture?.cup?.kind ?? null);
  };
  return (
    <main className='app-shell wifi-shell'>
      <header className='app-header'>
        <button type='button' onClick={onBack}>
          ← {fixture ? 'Till ligan' : 'Startmenyn'}
        </button>
        <div className='header-tools'>
          <SoundToggle />
          <FullscreenButton />
        </div>
      </header>
      <section className={`wifi-intro ${role ? 'wifi-intro-compact' : ''}`}>
        <p className='eyebrow'>TVÅ ENHETER · ONLINE</p>
        {role ? (
          <h1>{cupMatch ? `${cupName(cupMatch)} online.` : leagueMatch ? 'Ligamatch online.' : 'Onlinematch.'}</h1>
        ) : (
          <h1>
            Spela mot
            <br />
            <span>en kompis.</span>
          </h1>
        )}
        <p>
          Öppna Alfred FC på båda enheterna. En skapar matchen, den andra väljer den i listan över öppna matcher eller skriver rumskoden. Sedan spelar ni direkt
          mellan enheterna via internet.
        </p>
        <p className='wifi-version'>Version {__APP_VERSION__} · båda måste ha samma version för att spela ihop.</p>
      </section>
      {cupMatch && (
        <section className='wifi-connection-state' aria-label='Cupmatch'>
          <strong>
            {getClub(clubs[0]).name} – {getClub(clubs[1]).name}
          </strong>
          <p>Spelare 1 styr cuplaget, spelare 2 motståndarna. Resultatet sparas i värdens cup. En avbruten match räknas inte.</p>
        </section>
      )}
      {leagueMatch && (
        <section className='wifi-connection-state' aria-label='Ligamatch'>
          <strong>
            {getClub(clubs[0]).name} – {getClub(clubs[1]).name}
          </strong>
          <p>Spelare 1 styr ligalaget. Spelare 2 styr motståndarlaget. Resultatet sparas i värdens liga när matchen är klar.</p>
          <p>En avbruten match räknas inte. Koppla ihop igen eller spela om från ligan.</p>
        </section>
      )}
      {!supported && (
        <p className='control-warning' role='alert'>
          Onlinespelet behöver WebRTC och HTTPS. Öppna spelets publicerade adress i en modern webbläsare.
        </p>
      )}
      {!role ? (
        <div className='wifi-role-options'>
          <button
            type='button'
            className='primary-button'
            disabled={!supported}
            onClick={() => {
              setRole('host');
              void openRoom();
            }}
          >
            <strong>{fixture?.cup ? 'Skapa cupmatch' : fixture ? 'Skapa ligamatch' : 'Skapa match'}</strong>
            <span>{fixture?.cup ? 'Ditt cuplag · Spelare 1' : fixture ? 'Ditt ligalag · Spelare 1' : 'Du väljer lagen · Spelare 1'}</span>
          </button>
          {!fixture && (
            <button type='button' disabled={!supported} onClick={() => setRole('guest')}>
              <strong>Anslut</strong>
              <span>Välj en öppen match eller skriv rumskoden · Spelare 2</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <section className='wifi-connection-state' aria-label='Anslutning' aria-live='polite'>
            <strong>{role === 'host' ? 'Du är värd · Spelare 1' : 'Du ansluter · Spelare 2'}</strong>
            <p>
              {link
                ? statusText[link.status]
                : role === 'guest'
                  ? 'Välj en öppen match eller skriv värdens rumskod.'
                  : roomError
                    ? 'Inget rum ännu.'
                    : 'Skapar ett rum på spelservern…'}
            </p>
            {connected && (
              <p>
                Du styr {getClub(clubs[role === 'host' ? 0 : 1]).name} · {duration / 60} min
              </p>
            )}
            {link?.error && (
              <p className='control-warning' role='alert'>
                {link.error}
              </p>
            )}
            {role === 'guest' && link && !connected && link.status !== 'error' && link.status !== 'closed' && (
              <JoinProgress step='connecting' since={joinSince ?? Date.now()} />
            )}
            {role === 'host' && connected && (
              <button type='button' onClick={kick}>
                Sparka kompisen
              </button>
            )}
            <button type='button' onClick={reset}>
              Börja om kopplingen
            </button>
          </section>
          {role === 'host' && !fixture && (
            <details className='wifi-settings'>
              <summary>Välj lag och matchlängd · {duration / 60} min</summary>
              <TeamSelection
                selected={clubs}
                mode='versus'
                onChange={(team, id) =>
                  setClubs((previous) => {
                    const next: MatchClubs = [...previous];
                    const other = team === 0 ? 1 : 0;
                    if (next[other] === id) next[other] = previous[team];
                    next[team] = id;
                    return next;
                  })
                }
              />
              <label>
                Matchlängd
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                  <option value={60}>1 minut</option>
                  <option value={180}>3 minuter</option>
                  <option value={300}>5 minuter</option>
                </select>
              </label>
            </details>
          )}
          {role === 'host' && room && !connected && link?.status !== 'error' && link?.status !== 'closed' && (
            <section className='wifi-connection-state' aria-label='Rumskod'>
              <RoomCodeCard room={room} />
              <label className='list-toggle'>
                <input type='checkbox' checked={listed} onChange={(event) => setListed(event.target.checked)} />
                <span>
                  Visa i listan över öppna matcher
                  <small>Alla som öppnar spelet kan se och gå med. Utan listan går det bara med rumskoden.</small>
                </span>
              </label>
              {link && <RoomInvite room={room} link={link} onError={setError} />}
              {link?.status === 'connecting' && <p role='status'>Kompisen ansluter…</p>}
              {notice && <p role='status'>{notice}</p>}
            </section>
          )}
          {role === 'host' && !room && roomError && (
            <section className='wifi-connection-state' aria-label='Rumskod'>
              <strong>Det gick inte att skapa ett rum just nu.</strong>
              <p role='alert'>{roomError}</p>
              <button type='button' className='primary-button' onClick={() => void openRoom()}>
                Försök igen
              </button>
            </section>
          )}
          {role === 'guest' && !link && joinSince === null && (
            <section className='wifi-connection-state' aria-label='Öppna matcher'>
              <h2>Öppna matcher</h2>
              <GameList onPick={(code) => setPick({ code, at: Date.now() })} />
            </section>
          )}
          {role === 'guest' && !link && (
            <section className='wifi-connection-state' aria-label='Rumskod'>
              <strong>{joinSince === null ? 'Eller skriv kompisens rumskod' : 'Går med i matchen'}</strong>
              {joinSince === null && <p>Koden står på värdens skärm. Ni kan vara på samma nätverk eller på olika ställen.</p>}
              {notice && joinSince === null && (
                <p className='control-warning' role='alert'>
                  {notice}
                </p>
              )}
              <RoomJoin
                initialCode={lastCode}
                pick={pick}
                onBusy={setJoinSince}
                onLink={(next, code, since) => {
                  setJoinSince(since);
                  // A pick joins once: when this connection ends (a kick, a dropped line), the form must not rejoin by itself.
                  setPick(undefined);
                  setLastCode(code);
                  setNotice('');
                  keep(next);
                }}
              />
            </section>
          )}
          {(role === 'host' || guestPreview) && <MatchTeams clubs={clubs} match={role === 'host' ? preview : (guestPreview ?? undefined)} />}
          {role === 'host' && <LineupPicker save={transfers} club={clubs[0]} onChange={onTransfers} disabled={!!fixture?.career} />}
          {role === 'guest' && guestPreview?.squads && guestPreview.lineups && (
            <details className='lineup-picker'>
              <summary>Välj startfemma · {getClub(clubs[1]).name}</summary>
              <p>Välj ur värdens trupp. Din femma används i den här matchen. Under matchen gör du byten i pausmenyn.</p>
              <FiveEditor
                squad={guestPreview.squads[1].map(footballer).filter((p): p is Footballer => !!p)}
                five={guestPreview.lineups[1]}
                disabled={!!guestPreview.career}
                onChange={(five) => {
                  link?.send({ kind: 'lobby-lineup', five });
                }}
              />
            </details>
          )}
          <ControlSetup
            input={input}
            mode='solo'
            localTeam={role === 'host' ? 0 : 1}
            clubs={role === 'host' ? clubs : [clubs[1], clubs[0]]}
            playerLabel={role === 'host' ? 'Din kontroll · Spelare 1' : 'Din kontroll · Spelare 2'}
          />
          {connected && (
            <section className='wifi-start' aria-label='Starta onlinematchen'>
              {role === 'host' ? (
                <>
                  <p role='status'>{guestReady ? 'Kompisen är redo. Nu kan du starta!' : 'Vänta tills kompisen har valt kontroll och tryckt Jag är redo.'}</p>
                  <button
                    type='button'
                    className='primary-button'
                    disabled={!guestReady || !input.available(0)}
                    onClick={() => {
                      if (!link) return;
                      transferred.current = true;
                      onLaunch(link, structuredClone(preview));
                    }}
                  >
                    Starta onlinematch
                  </button>
                </>
              ) : (
                <>
                  <p role='status'>{ready ? 'Du är redo! Väntar på att värden startar matchen.' : 'Välj din kontroll och säg till när du är redo.'}</p>
                  <button
                    type='button'
                    className='primary-button'
                    disabled={!input.available(0) || ready}
                    onClick={() => {
                      if (link?.send({ kind: 'lobby-ready', ready: true })) setReady(true);
                    }}
                  >
                    {ready ? 'Redo ✓' : 'Jag är redo'}
                  </button>
                </>
              )}
            </section>
          )}
        </>
      )}
      {error && (
        <p className='control-warning' role='alert'>
          {error}
        </p>
      )}
      <details className='wifi-help'>
        <summary>Om enheterna inte hittar varandra</summary>
        <p>
          Båda enheterna behöver internet. Värden får en rumskod med fyra tecken från spelservern, och kompisen väljer matchen i listan eller skriver in koden.
          Båda behöver samma version av spelet. Servern byter bara anslutningskoderna; själva matchen går sedan direkt mellan enheterna. Ni kan vara på samma
          nätverk eller på olika ställen.
        </p>
        <p>
          Vissa strikta nätverk, till exempel en del skol-, jobb- och gästnätverk, stoppar direktkontakt mellan enheter. Då kan kopplingen misslyckas. Försök
          igen, eller byt nät, till exempel från mobildata till ett vanligt hemmanätverk.
        </p>
        <p>
          Matchen pausas för båda om någon lämnar spelet. Håll båda skärmarna öppna. Vid bruten anslutning eller omladdning behöver ni koppla ihop er för en ny
          match. Pågående onlinematcher sparas inte. Färdigspelade ligamatcher räknas i värdens säsong.
        </p>
      </details>
    </main>
  );
}

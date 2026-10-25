import { type ReactNode, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchClubs } from '../game/clubs';
import { defaultClubs, getClub, validClub } from '../game/clubs';
import { cupName } from '../game/cups';
import type { InputManager } from '../game/input';
import { validFive } from '../game/lineups';
import type { CupKind, MatchState } from '../game/model';
import { createMatch } from '../game/model';
import { validNetworkMatch } from '../game/network-session';
import { decodeSignal, PeerLink } from '../game/peer-link';
import { type Footballer, footballer } from '../game/players';
import { ONLINE_ICE, Room, roomServer } from '../game/room-server';
import { type TransferSave, withMatchSquads } from '../game/transfers';
import { ControlSetup } from './ControlSetup';
import { FullscreenButton } from './FullscreenButton';
import { FiveEditor, LineupPicker } from './LineupPicker';
import { QrExchange } from './QrExchange';
import { RoomCodeCard, RoomInvite, RoomJoin } from './RoomPairing';
import { SoundToggle } from './SoundControls';
import { MatchTeams } from './TeamBrowser';
import { TeamSelection } from './TeamSelection';
import './wifi.css';

const noSubscribe = () => () => {};
const zero = () => 0;
const statusText = {
  new: 'Förbereder anslutningen…',
  gathering: 'Skapar en lokal anslutningskod…',
  waiting: 'Väntar på kopplingen åt båda hållen.',
  connecting: 'Kopplar ihop enheterna…',
  connected: 'Enheterna är anslutna!',
  closed: 'Anslutningen är stängd.',
  error: 'Anslutningen kunde inte fortsätta.',
};

// With a room code, QR pairing is the fallback for devices without internet.
function QrFallback({ folded, children }: { folded: boolean; children: ReactNode }) {
  if (!folded) return children;
  return (
    <details className='wifi-help'>
      <summary>Samma Wi-Fi utan internet? Para ihop med QR-kod</summary>
      {children}
    </details>
  );
}

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
  const [viaRoom, setViaRoom] = useState(false);
  const ownedRoom = useRef<Room | null>(null);
  const online = !!roomServer();
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
  const keep = (next: PeerLink) => {
    owned.current?.close();
    owned.current = next;
    setLink(next);
    return next;
  };
  const reset = () => {
    owned.current?.close();
    owned.current = null;
    ownedRoom.current?.close();
    ownedRoom.current = null;
    setRoom(null);
    setViaRoom(false);
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
        <p className='eyebrow'>TVÅ ENHETER · {online ? 'WI-FI ELLER INTERNET' : 'SAMMA WI-FI'}</p>
        {role ? (
          <h1>{cupMatch ? `${cupName(cupMatch)} via Wi-Fi.` : leagueMatch ? 'Ligamatch via Wi-Fi.' : 'Wi-Fi-match.'}</h1>
        ) : (
          <h1>
            Spela mot
            <br />
            <span>en kompis.</span>
          </h1>
        )}
        <p>
          Öppna Alfred FC på båda enheterna. En skapar matchen, den andra ansluter. Ni byter QR-koder åt båda hållen och spelar sedan direkt mellan enheterna.
        </p>
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
          Wi-Fi-spelet behöver WebRTC och HTTPS. Öppna spelets publicerade adress i en modern webbläsare.
        </p>
      )}
      {!role ? (
        <div className='wifi-role-options'>
          <button
            type='button'
            className='primary-button'
            disabled={!supported}
            onClick={async () => {
              setRole('host');
              setError('');
              let open: Room | null = null;
              let problem = '';
              if (online)
                try {
                  open = await Room.open();
                  ownedRoom.current = open;
                  setRoom(open);
                } catch (e) {
                  problem = `${e instanceof Error ? e.message : 'Spelservern svarar inte.'} Para ihop med QR-koden istället.`;
                }
              try {
                await keep(new PeerLink('host', open ? ONLINE_ICE : [])).createOffer();
                if (problem) setError(problem);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Matchkoden kunde inte skapas.');
              }
            }}
          >
            <strong>{fixture?.cup ? 'Skapa cupmatch' : fixture ? 'Skapa ligamatch' : 'Skapa match'}</strong>
            <span>{fixture?.cup ? 'Ditt cuplag · Spelare 1' : fixture ? 'Ditt ligalag · Spelare 1' : 'Du väljer lagen · Spelare 1'}</span>
          </button>
          {!fixture && (
            <button type='button' disabled={!supported} onClick={() => setRole('guest')}>
              <strong>Anslut</strong>
              <span>{online ? 'Skriv rumskoden eller läs QR-koden · Spelare 2' : 'Läs kompisens kod · Spelare 2'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <section className='wifi-connection-state' aria-label='Anslutning' aria-live='polite'>
            <strong>{role === 'host' ? 'Du är värd · Spelare 1' : 'Du ansluter · Spelare 2'}</strong>
            <p>{link ? statusText[link.status] : 'Be värden skapa en match och visa sin QR-kod.'}</p>
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
              {link && <RoomInvite room={room} link={link} onError={setError} />}
            </section>
          )}
          {role === 'guest' && online && !link && !viaRoom && (
            <section className='wifi-connection-state' aria-label='Rumskod'>
              <strong>Skriv kompisens rumskod</strong>
              <p>Koden står på värdens skärm. Ni kan vara på samma Wi-Fi eller på olika ställen.</p>
              <RoomJoin
                onLink={(next) => {
                  setViaRoom(true);
                  keep(next);
                }}
              />
            </section>
          )}
          {!connected && !viaRoom && link?.status !== 'error' && link?.status !== 'closed' && (
            <QrFallback folded={role === 'host' ? !!room : online && !link}>
              <QrExchange
                role={role}
                code={link?.code || ''}
                onCode={async (value) => {
                  if (role === 'host') {
                    if (!link?.code) throw new Error('Vänta tills din matchkod är klar.');
                    await link.acceptAnswer(value);
                  } else {
                    const signal = await decodeSignal(value);
                    if (signal.type !== 'offer') throw new Error('Börja med att läsa värdens matchkod.');
                    const next = keep(new PeerLink('guest'));
                    try {
                      await next.createAnswer(value);
                    } catch (e) {
                      next.close();
                      setLink(null);
                      throw e;
                    }
                  }
                }}
              />
            </QrFallback>
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
            <section className='wifi-start' aria-label='Starta Wi-Fi-matchen'>
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
                    Starta Wi-Fi-match
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
          Använd samma vanliga Wi-Fi. Gästnätverk kan hindra enheterna från att prata med varandra. Ingen server eller internetanslutning behövs för matchen när
          spelet är laddat på båda enheterna.
        </p>
        <p>
          Utan kamera kan ni kopiera koderna eller läsa in en QR-bild. En kort rumskod räcker inte: först läser gästen matchkoden, sedan läser värden
          svarskoden.
        </p>
        <p>
          Matchen pausas för båda om någon lämnar spelet. Håll båda skärmarna öppna. Vid bruten anslutning eller omladdning behöver ni koppla ihop er för en ny
          match. Pågående Wi-Fi-matcher sparas inte. Färdigspelade ligamatcher räknas i värdens säsong.
        </p>
      </details>
    </main>
  );
}

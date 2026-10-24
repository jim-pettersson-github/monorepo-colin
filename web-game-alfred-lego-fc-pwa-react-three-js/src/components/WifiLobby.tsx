import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MatchClubs } from '../game/clubs';
import { defaultClubs, getClub, validClub } from '../game/clubs';
import { cupName } from '../game/cups';
import type { InputManager } from '../game/input';
import type { CupKind, MatchState } from '../game/model';
import { createMatch } from '../game/model';
import { validNetworkMatch } from '../game/network-session';
import { decodeSignal, PeerLink } from '../game/peer-link';
import { ControlSetup } from './ControlSetup';
import { FullscreenButton } from './FullscreenButton';
import { QrExchange } from './QrExchange';
import { SoundToggle } from './SoundControls';
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

export function WifiLobby({
  input,
  fixture = null,
  onBack,
  onLaunch,
}: {
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
  const owned = useRef<PeerLink | null>(null);
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
      }
      if (link.role === 'guest' && m.kind === 'start' && m.version === 1 && validNetworkMatch(m.state) && link.status === 'connected') {
        transferred.current = true;
        launch.current(link, m.state);
      }
    });
  }, [link]);
  useEffect(() => {
    if (link?.role === 'host' && connected) link.send({ kind: 'settings', clubs, duration, league: !!fixture?.league, cup: fixture?.cup?.kind ?? null });
  }, [link, connected, clubs, duration, fixture]);
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
    setLink(null);
    setRole(null);
    setError('');
    setGuestReady(false);
    setReady(false);
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
        <p className='eyebrow'>TVÅ ENHETER · SAMMA WI-FI</p>
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
              try {
                await keep(new PeerLink('host')).createOffer();
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
              <span>Läs kompisens kod · Spelare 2</span>
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
          {!connected && link?.status !== 'error' && link?.status !== 'closed' && (
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
                      onLaunch(link, fixture ? structuredClone(fixture) : createMatch('versus', duration, 'normal', clubs));
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

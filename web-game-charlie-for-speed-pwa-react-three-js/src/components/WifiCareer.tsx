import { useState, useSyncExternalStore } from 'react';
import { cupById, cups, formatMoney, PLAYER_NAME } from '../game/career';
import type { CareerSession, Identity } from '../game/career-session';
import { carById, carName } from '../game/cars';
import { cupProblems, type Session, type SessionMode, sessionTrack } from '../game/multi-career';
import type { Settings } from '../game/storage';
import { trackById } from '../game/tracks';
import { DealerTab, GarageTab, type Shop } from './CareerHub';
import { InviteSteps } from './QrExchange';
import { RaceView } from './RaceView';
import './career.css';

const modeNames: Record<SessionMode, string> = { fresh: 'Ny start', own: 'Egna bilar' };
const dateFormat = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type StartProps = {
  identity: Identity;
  onIdentity: (identity: Identity) => void;
  sessions: Session[];
  onCreate: (name: string, mode: SessionMode) => void;
  onResume: (session: Session) => void;
  onDelete: (id: string) => void;
  onJoin: () => void;
  onBack: () => void;
};

export function WifiCareerStart({ identity, onIdentity, sessions, onCreate, onResume, onDelete, onJoin, onBack }: StartProps) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<SessionMode>('fresh');
  const [confirmDelete, setConfirmDelete] = useState('');
  return (
    <main className='menu-screen career'>
      <header className='screen-header'>
        <button type='button' onClick={onBack}>
          ◀ Meny
        </button>
        <h2>Wi-Fi-karriär</h2>
      </header>
      <div className='career-body'>
        <section className='panel career-stack'>
          <p>
            En karriär för flera enheter på samma Wi-Fi. Alla har egna pengar, bilar och uppgraderingar i sessionen, och ni kör cuperna tillsammans mot
            datorförarna. Värdens enhet sparar sessionen så att ni kan fortsätta senare. Nya spelare kan gå med när som helst men börjar från början.
          </p>
          <label className='field'>
            Ditt namn
            <input value={identity.name} maxLength={16} placeholder='Skriv ditt namn' onChange={(e) => onIdentity({ ...identity, name: e.target.value })} />
          </label>
        </section>

        <div className='career-columns'>
          <section className='panel'>
            <h3>Starta en ny session</h3>
            <label className='field'>
              Sessionens namn
              <input value={name} maxLength={24} placeholder='Till exempel Fredagsracet' onChange={(e) => setName(e.target.value)} />
            </label>
            <fieldset className='choice'>
              <legend>Bilar</legend>
              {(['fresh', 'own'] as SessionMode[]).map((option) => (
                <button key={option} type='button' aria-pressed={mode === option} onClick={() => setMode(option)}>
                  {modeNames[option]}
                </button>
              ))}
            </fieldset>
            <p className='hint'>
              {mode === 'fresh'
                ? 'Alla börjar med 25 000 kr och ett tomt garage – lika villkor för alla.'
                : 'Alla tar med en kopia av bilarna och uppgraderingarna från sin egen karriär. Den egna karriären ändras inte.'}
            </p>
            <button type='button' className='primary' disabled={!identity.name.trim()} onClick={() => onCreate(name, mode)}>
              Skapa och bjud in
            </button>
          </section>

          <section className='panel'>
            <h3>Gå med</h3>
            <p>Värden skapar eller fortsätter en session och visar en QR-kod. Har du varit med förut känns du igen och får tillbaka dina bilar och pengar.</p>
            <button type='button' className='primary' disabled={!identity.name.trim()} onClick={onJoin}>
              Gå med i en session
            </button>
          </section>
        </div>

        {sessions.length > 0 && (
          <section className='panel'>
            <h3>Sparade sessioner</h3>
            <ul className='session-list'>
              {sessions.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>{session.name}</strong>
                    <span className='hint'>
                      {' '}
                      · {modeNames[session.mode]} · {session.members.map((member) => member.name).join(', ') || 'inga förare än'} ·{' '}
                      {dateFormat.format(session.updated)}
                    </span>
                  </div>
                  <div className='session-actions'>
                    <button type='button' className='primary' disabled={!identity.name.trim()} onClick={() => onResume(session)}>
                      Fortsätt som värd
                    </button>
                    {confirmDelete === session.id ? (
                      <button type='button' onClick={() => onDelete(session.id)}>
                        Ja, ta bort
                      </button>
                    ) : (
                      <button type='button' onClick={() => setConfirmDelete(session.id)}>
                        Ta bort
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

type HubProps = { controller: CareerSession; onExit: () => void };
type Tab = 'cups' | 'garage' | 'dealer';

export function WifiCareerHub({ controller, onExit }: HubProps) {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  const [tab, setTab] = useState<Tab>('cups');
  const { session, me, host } = controller;

  if (controller.ended || !session || !me) {
    return (
      <main className='menu-screen career'>
        <header className='screen-header'>
          <button type='button' onClick={onExit}>
            ◀ Meny
          </button>
          <h2>Wi-Fi-karriär</h2>
        </header>
        <section className='panel career-intro' role='status'>
          {controller.error || (controller.ended ? 'Sessionen är avslutad.' : 'Ansluter till värdens session…')}
        </section>
      </main>
    );
  }

  const shop: Shop = {
    money: me.money,
    garage: me.garage,
    activeCarId: me.activeCarId,
    buy: (carId) => controller.buy(carId),
    upgrade: (carId, part) => controller.upgrade(carId, part),
    select: (carId) => controller.select(carId),
  };
  const run = session.run;
  const cup = run ? cupById(run.cupId) : undefined;
  const trackId = sessionTrack(session);

  return (
    <main className='menu-screen career'>
      <header className='screen-header'>
        <button type='button' onClick={onExit}>
          ◀ {host ? 'Spara och avsluta' : 'Lämna'}
        </button>
        <h2>{session.name}</h2>
        <span className='money' data-testid='money'>
          {formatMoney(me.money)}
        </span>
      </header>
      <nav className='career-tabs' aria-label='Wi-Fi-karriär'>
        {(
          [
            ['cups', 'Turneringar'],
            ['garage', 'Garage'],
            ['dealer', 'Bilhandlare'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} type='button' aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className='career-body'>
        <section className='panel'>
          <h3>Förare i sessionen</h3>
          <table className='career-table'>
            <tbody>
              {session.members.map((member) => {
                const car = member.garage.find((entry) => entry.carId === member.activeCarId);
                const here = controller.present.includes(member.id);
                return (
                  <tr key={member.id} className={member.id === me.id ? 'me' : undefined}>
                    <td>{here ? '● ' : '○ '}</td>
                    <td>
                      {member.name}
                      {member.id === me.id ? ` (${PLAYER_NAME.toLowerCase()})` : ''}
                    </td>
                    <td>{car ? carName(carById(car.carId)) : 'ingen bil'}</td>
                    <td>{formatMoney(member.money)}</td>
                    <td>{member.cupsWon.length} cuper</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className='hint'>● är här nu. Bara de som är anslutna kör nästa race.</p>
          {host && !controller.race && (
            <div className='career-stack'>
              {controller.invite ? (
                <>
                  <InviteSteps
                    code={controller.invite.code}
                    player={controller.present.length + 1}
                    onAnswer={(value) => controller.invite?.acceptAnswer(value) ?? Promise.resolve()}
                  />
                  <button type='button' onClick={() => controller.cancelInvite()}>
                    Avbryt inbjudan
                  </button>
                </>
              ) : (
                <button type='button' onClick={() => void controller.inviteGuest()}>
                  Bjud in en spelare till
                </button>
              )}
            </div>
          )}
        </section>

        {controller.error && <p role='alert'>{controller.error}</p>}

        {tab === 'garage' && <GarageTab shop={shop} onDealer={() => setTab('dealer')} />}
        {tab === 'dealer' && <DealerTab shop={shop} />}
        {tab === 'cups' &&
          (run && cup ? (
            <div className='career-columns'>
              <section className='panel'>
                <h3>{cup.name}</h3>
                <ol className='cup-tracks'>
                  {cup.tracks.map((id, index) => (
                    <li key={id} className={index < run.race ? 'done' : index === run.race ? 'next' : undefined}>
                      {index < run.race ? '✓' : index === run.race ? '▶' : '·'} {trackById(id).name}
                    </li>
                  ))}
                </ol>
                {host ? (
                  <>
                    <button type='button' className='primary' onClick={() => controller.startRace()}>
                      Kör deltävling {run.race + 1}/{cup.tracks.length}: {trackById(trackId ?? cup.tracks[0]).name}
                    </button>
                    <button type='button' onClick={() => controller.abandonCup()}>
                      Avbryt turneringen
                    </button>
                  </>
                ) : (
                  <p role='status'>Väntar på att värden startar deltävling {run.race + 1}.</p>
                )}
              </section>
              <section className='panel'>
                <h3>Ställning</h3>
                <table className='career-table'>
                  <tbody>
                    {Object.entries(run.standings)
                      .sort((a, b) => b[1] - a[1])
                      .map(([name, points], index) => (
                        <tr key={name} className={name === me.name ? 'me' : undefined}>
                          <td>{index + 1}</td>
                          <td>{name}</td>
                          <td>{points} p</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : (
            <div className='career-stack'>
              {session.lastCup && (
                <section className='panel cup-summary'>
                  <h3>
                    {session.lastCup.winner} vann {cupById(session.lastCup.cupId).name}
                  </h3>
                  <ol>
                    {session.lastCup.standings.map((row) => (
                      <li key={row.driverName} className={row.driverName === me.name ? 'me' : undefined}>
                        {row.driverName} – {row.points} p
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {session.news.length > 0 && (
                <ul className='news'>
                  {session.news.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              <div className='cup-grid'>
                {cups.map((entry) => {
                  const problems = cupProblems(session, entry.id, controller.present);
                  return (
                    <section key={entry.id} className='panel cup-card'>
                      <header>
                        <span className={`class-badge class-${entry.carClass}`}>{entry.carClass}</span>
                        <h3>{entry.name}</h3>
                      </header>
                      <p>{entry.description}</p>
                      <p className='hint'>
                        {entry.tracks.map((id) => trackById(id).name).join(' · ')} · {entry.laps} varv
                      </p>
                      <p className='hint'>
                        Vinst per race {formatMoney(entry.prizes[0])} · Cupbonus {formatMoney(entry.bonus)}
                      </p>
                      {host && (
                        <button type='button' className='primary' disabled={problems.length > 0} onClick={() => controller.startCup(entry.id)}>
                          Starta cupen
                        </button>
                      )}
                      {problems.map((problem) => (
                        <p key={problem} className='problem'>
                          {problem}
                        </p>
                      ))}
                    </section>
                  );
                })}
              </div>
              {!host && <p className='hint'>Värden väljer cup. Köp och uppgradera din bil under tiden.</p>}
            </div>
          ))}
      </div>
    </main>
  );
}

type RunProps = { controller: CareerSession; settings: Settings; onSettings: (settings: Settings) => void; onExit: () => void };

// Shows the shared hub, or the race the host has started on this device.
export function WifiCareerRun({ controller, settings, onSettings, onExit }: RunProps) {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  const { race, session, host } = controller;
  const run = session?.run;
  if (race && run) {
    const cup = cupById(run.cupId);
    return (
      <RaceView
        key={race.config.seed}
        network={race}
        settings={{ ...settings, ...race.config.settings }}
        onSettings={onSettings}
        onExit={onExit}
        career={{
          title: `${cup.name} ${run.race + 1}/${cup.tracks.length}`,
          field: [],
          onFinish: (rows) => controller.finishRace(rows),
          onQuit: () => (host ? controller.endRace() : onExit()),
        }}
      />
    );
  }
  return <WifiCareerHub controller={controller} onExit={onExit} />;
}

import { useState } from 'react';
import {
  abandonCup,
  buyCar,
  buyUpgrade,
  type Career,
  cupById,
  cups,
  currentTrack,
  entryProblem,
  formatMoney,
  newCareer,
  ownedCar,
  PLAYER_NAME,
  partNames,
  setActiveCar,
  startCup,
  type UpgradePart,
  upgradeCost,
} from '../game/career';
import { applyUpgrades, type CarClass, type CarSpec, carById, carName, cars, MAX_UPGRADE } from '../game/cars';
import { trackById } from '../game/tracks';
import { Showroom } from './Showroom';
import './career.css';

type Tab = 'cups' | 'garage' | 'dealer' | 'rivals';

type Props = {
  career: Career | undefined;
  onChange: (career: Career | undefined) => void;
  onRace: () => void;
  onBack: () => void;
};

const tabs: [Tab, string][] = [
  ['cups', 'Turneringar'],
  ['garage', 'Garage'],
  ['dealer', 'Bilhandlare'],
  ['rivals', 'Rivaler'],
];

const decimal = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

function Stats({ car }: { car: CarSpec }) {
  return (
    <dl className='stat-list'>
      <dt>Toppfart</dt>
      <dd>{car.topKmh} km/h</dd>
      <dt>0–100</dt>
      <dd>{decimal.format(car.zeroTo100)} s</dd>
      <dt>Grepp</dt>
      <dd>{decimal.format(car.grip)} g</dd>
      <dt>Bromsar</dt>
      <dd>{decimal.format(car.braking)}</dd>
    </dl>
  );
}

function Pips({ level }: { level: number }) {
  return (
    <span className='pips' role='img' aria-label={`Steg ${level} av ${MAX_UPGRADE}`}>
      {Array.from({ length: MAX_UPGRADE }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative pips
        <span key={index} className={index < level ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}

function CupsTab({ career, onChange, onRace }: { career: Career; onChange: Props['onChange']; onRace: () => void }) {
  const run = career.run;
  if (run) {
    const cup = cupById(run.cupId);
    const standings = Object.entries(run.standings).sort((a, b) => b[1] - a[1]);
    const nextTrack = trackById(currentTrack(career) ?? cup.tracks[0]);
    return (
      <div className='career-columns'>
        <section className='panel'>
          <h3>{cup.name}</h3>
          <ol className='cup-tracks'>
            {cup.tracks.map((trackId, index) => (
              <li key={trackId} className={index < run.race ? 'done' : index === run.race ? 'next' : undefined}>
                {index < run.race ? '✓' : index === run.race ? '▶' : '·'} {trackById(trackId).name}
              </li>
            ))}
          </ol>
          <button type='button' className='primary' onClick={onRace}>
            Kör deltävling {run.race + 1}/{cup.tracks.length}: {nextTrack.name}
          </button>
          <button type='button' onClick={() => onChange(abandonCup(career))}>
            Avbryt turneringen
          </button>
        </section>
        <section className='panel'>
          <h3>Ställning</h3>
          <table className='career-table'>
            <tbody>
              {standings.map(([name, points], index) => (
                <tr key={name} className={name === PLAYER_NAME ? 'me' : undefined}>
                  <td>{index + 1}</td>
                  <td>{name}</td>
                  <td>{points} p</td>
                </tr>
              ))}
            </tbody>
          </table>
          {run.lastRace && (
            <p className='hint'>
              Senaste deltävlingen: plats {run.lastRace.find((record) => record.isPlayer)?.position}, prispengar{' '}
              {formatMoney(run.lastRace.find((record) => record.isPlayer)?.prize ?? 0)}.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className='career-stack'>
      {career.lastCup && (
        <section className='panel cup-summary'>
          <h3>
            {career.lastCup.winner === PLAYER_NAME
              ? `Du vann ${cupById(career.lastCup.cupId).name}!`
              : `${career.lastCup.winner} vann ${cupById(career.lastCup.cupId).name}`}
          </h3>
          <ol>
            {career.lastCup.standings.map((row) => (
              <li key={row.driverName} className={row.isPlayer ? 'me' : undefined}>
                {row.driverName} – {row.points} p
              </li>
            ))}
          </ol>
          {career.news.length > 1 && (
            <ul className='news'>
              {career.news.slice(1).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className='cup-grid'>
        {cups.map((cup) => {
          const problem = entryProblem(career, cup);
          return (
            <section key={cup.id} className='panel cup-card'>
              <header>
                <span className={`class-badge class-${cup.carClass}`}>{cup.carClass}</span>
                <h3>{cup.name}</h3>
                {career.cupsWon.includes(cup.id) && <span className='won'>Vunnen ✓</span>}
              </header>
              <p>{cup.description}</p>
              <p className='hint'>
                {cup.tracks.map((trackId) => trackById(trackId).name).join(' · ')} · {cup.laps} varv
              </p>
              <p className='hint'>
                Vinst per race {formatMoney(cup.prizes[0])} · Cupbonus {formatMoney(cup.bonus)}
              </p>
              <button type='button' className='primary' disabled={!!problem} onClick={() => onChange(startCup(career, cup.id))}>
                Anmäl dig
              </button>
              {problem && <p className='problem'>{problem}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function GarageTab({ career, onChange, onDealer }: { career: Career; onChange: Props['onChange']; onDealer: () => void }) {
  const owned = ownedCar(career);
  if (!owned) {
    return (
      <section className='panel'>
        <h3>Garaget är tomt</h3>
        <p>Köp din första bil hos bilhandlaren. Klass C-bilarna räcker till Klubbcupen.</p>
        <button type='button' className='primary' onClick={onDealer}>
          Till bilhandlaren
        </button>
      </section>
    );
  }
  const base = carById(owned.carId);
  const tuned = applyUpgrades(base, owned.upgrades);
  return (
    <div className='career-columns'>
      <section className='panel garage-car'>
        <Showroom carId={owned.carId} className='career-showroom' />
        <h3>{carName(base)}</h3>
        <p className='hint'>Klass {base.carClass}</p>
        <Stats car={tuned} />
        <div className='owned-list'>
          {career.garage.map((car) => (
            <button key={car.carId} type='button' aria-pressed={car.carId === career.activeCarId} onClick={() => onChange(setActiveCar(career, car.carId))}>
              {carName(carById(car.carId))}
            </button>
          ))}
        </div>
      </section>
      <section className='panel'>
        <h3>Verkstad</h3>
        {(Object.keys(partNames) as UpgradePart[]).map((part) => {
          const level = owned.upgrades[part];
          const cost = level < MAX_UPGRADE ? upgradeCost(base.carClass, level + 1) : 0;
          return (
            <div key={part} className='upgrade-row'>
              <span>{partNames[part]}</span>
              <Pips level={level} />
              <button
                type='button'
                disabled={level >= MAX_UPGRADE || career.money < cost}
                onClick={() => onChange(buyUpgrade(career, owned.carId, part))}
                aria-label={`Uppgradera ${partNames[part].toLowerCase()}`}
              >
                {level >= MAX_UPGRADE ? 'Max' : formatMoney(cost)}
              </button>
            </div>
          );
        })}
        <p className='hint'>Motor: +4 % toppfart och snabbare acceleration per steg. Däck: mer grepp. Bromsar: kortare bromssträckor.</p>
      </section>
    </div>
  );
}

function DealerTab({ career, onChange }: { career: Career; onChange: Props['onChange'] }) {
  return (
    <div className='career-stack'>
      {(['C', 'B', 'A'] as CarClass[]).map((carClass) => (
        <section key={carClass}>
          <h3 className='class-heading'>
            <span className={`class-badge class-${carClass}`}>{carClass}</span> Klass {carClass}
          </h3>
          <div className='dealer-grid'>
            {cars
              .filter((car) => car.carClass === carClass)
              .map((car) => {
                const owned = !!ownedCar(career, car.id);
                return (
                  <article key={car.id} className='panel dealer-card'>
                    <h4>{carName(car)}</h4>
                    <Stats car={car} />
                    <button type='button' className='primary' disabled={owned || career.money < car.price} onClick={() => onChange(buyCar(career, car.id))}>
                      {owned ? 'I garaget' : `Köp ${formatMoney(car.price)}`}
                    </button>
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function RivalsTab({ career }: { career: Career }) {
  const level = (upgrades: { engine: number; tyres: number; brakes: number }) => upgrades.engine + upgrades.tyres + upgrades.brakes;
  return (
    <section className='panel'>
      <h3>Rivaler</h3>
      <p className='hint'>Rivalerna tjänar prispengar precis som du och köper uppgraderingar efter varje turnering.</p>
      <table className='career-table rivals'>
        <thead>
          <tr>
            <th>Förare</th>
            <th>Klass C</th>
            <th>Klass B</th>
            <th>Klass A</th>
            <th>Kassa</th>
            <th>Cupsegrar</th>
          </tr>
        </thead>
        <tbody>
          {career.rivals.map((rival) => (
            <tr key={rival.name}>
              <td>{rival.name}</td>
              {(['C', 'B', 'A'] as CarClass[]).map((carClass) => (
                <td key={carClass}>
                  {carById(rival.cars[carClass]).model} <span className='hint'>({level(rival.upgrades[carClass])}/9)</span>
                </td>
              ))}
              <td>{formatMoney(rival.money)}</td>
              <td>{rival.cupsWon}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function CareerHub({ career, onChange, onRace, onBack }: Props) {
  const [tab, setTab] = useState<Tab>(() => (career && !career.garage.length ? 'dealer' : 'cups'));
  const [confirmReset, setConfirmReset] = useState(false);

  if (!career) {
    return (
      <main className='menu-screen career'>
        <header className='screen-header'>
          <button type='button' onClick={onBack}>
            ◀ Meny
          </button>
          <h2>Karriär</h2>
        </header>
        <section className='panel career-intro'>
          <h3>Från klubbcup till Mästarnas mästare</h3>
          <p>
            Du börjar med {formatMoney(25000)}. Köp en bil, kör turneringar, vinn prispengar och uppgradera motor, däck och bromsar. Rivalerna uppgraderar också
            – ju mer de vinner, desto snabbare blir de.
          </p>
          <button
            type='button'
            className='primary'
            onClick={() => {
              onChange(newCareer());
              setTab('dealer');
            }}
          >
            Starta karriären
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className='menu-screen career'>
      <header className='screen-header'>
        <button type='button' onClick={onBack}>
          ◀ Meny
        </button>
        <h2>Karriär</h2>
        <span className='money' data-testid='money'>
          {formatMoney(career.money)}
        </span>
      </header>
      <nav className='career-tabs' aria-label='Karriär'>
        {tabs.map(([id, label]) => (
          <button key={id} type='button' aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className='career-body'>
        {tab === 'cups' && <CupsTab career={career} onChange={onChange} onRace={onRace} />}
        {tab === 'garage' && <GarageTab career={career} onChange={onChange} onDealer={() => setTab('dealer')} />}
        {tab === 'dealer' && <DealerTab career={career} onChange={onChange} />}
        {tab === 'rivals' && <RivalsTab career={career} />}
        <div className='career-reset'>
          {confirmReset ? (
            <>
              <span>All karriärdata försvinner.</span>
              <button
                type='button'
                onClick={() => {
                  onChange(undefined);
                  setConfirmReset(false);
                }}
              >
                Ja, börja om
              </button>
              <button type='button' onClick={() => setConfirmReset(false)}>
                Avbryt
              </button>
            </>
          ) : (
            <button type='button' onClick={() => setConfirmReset(true)}>
              Börja om karriären
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

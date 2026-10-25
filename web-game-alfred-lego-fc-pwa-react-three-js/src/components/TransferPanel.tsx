import { useEffect, useRef, useState } from 'react';
import { type ClubId, clubs, getClub } from '../game/clubs';
import { type Footballer, footballers, playerPrice, startingFive } from '../game/players';
import { starRoleNames, stars } from '../game/stars';
import { buyPlayer, type DomesticClub, domesticClub, sellPlayer, squadFor, type TransferSave } from '../game/transfers';
import './transfers.css';

const coins = (amount: number) => `${amount.toLocaleString('sv-SE')} mynt`;
const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('sv');
export function PlayerStats({ player }: { player: Footballer }) {
  return (
    <dl className='athlete-stats'>
      {(
        [
          ['Fart', player.pace],
          ['Skott', player.shooting],
          ['Pass', player.passing],
          ['Försvar', player.defending],
          ['Målvakt', player.goalkeeping],
        ] as const
      ).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <meter min='0' max='100' value={value} aria-label={`${label}: ${value} av 100`} />
            <span>{value}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
function PlayerPortrait({ player, club }: { player: Footballer; club: ClubId }) {
  const shirt = getClub(club).shirt;
  const hair = ['#604635', '#d8b958', '#302c2c', '#a06641'][Number(player.id.split('-').at(-1)) % 4];
  return (
    <svg className='athlete-portrait' viewBox='0 0 72 88' aria-hidden='true'>
      <rect x='5' y='3' width='62' height='82' rx='14' fill='#233c49' />
      <path d='M15 83V62q21-18 42 0v21' fill={shirt} />
      <path d='M29 54v9q7 7 14 0v-9' fill='#e5b680' />
      <rect x='20' y='14' width='32' height='43' rx='13' fill='#f1c58f' />
      <path d='M19 31V24q0-17 17-17t17 17v8l-7-10-21 3Z' fill={hair} />
      <circle cx='29' cy='36' r='2' fill='#29343b' />
      <circle cx='43' cy='36' r='2' fill='#29343b' />
      <path d='M31 47q5 4 10 0' stroke='#925e47' strokeWidth='2' fill='none' />
      <path d='M31 68h10v15H31Z' fill='#ffffff45' />
    </svg>
  );
}
export function TransferPanel({ save, onChange, locked }: { save: TransferSave; onChange: (save: TransferSave) => void; locked: boolean }) {
  const [view, setView] = useState<'market' | 'squad'>('market');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [band, setBand] = useState('all');
  const [era, setEra] = useState('all');
  const [limit, setLimit] = useState(12);
  const [deal, setDeal] = useState<{ id: string; sell: boolean } | null>(null);
  const [offer, setOffer] = useState('');
  const [buyer, setBuyer] = useState<DomesticClub>('brick');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (deal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deal]);
  const club = save.activeClub;
  const squad = squadFor(save, club);
  const lineup = startingFive(squad);
  const closed = locked || !!save.pending;
  const selected = footballers.find((p) => p.id === deal?.id);
  const swap = squad.find((p) => p.id === offer);
  const price = selected ? (deal?.sell ? Math.floor((playerPrice(selected) * 0.8) / 50) * 50 : playerPrice(selected) - (swap ? playerPrice(swap) : 0)) : 0;
  const filtered = (view === 'squad' ? squad : footballers.filter((p) => domesticClub(p.origin) && save.owners[p.id] !== club))
    .filter(
      (p) =>
        searchText(`${p.name} ${getClub(save.owners[p.id]).name}`).includes(searchText(search)) &&
        (role === 'all' || p.star?.position === role) &&
        (era === 'all' || p.star?.era === era) &&
        (band === 'all' || p.overall >= Number(band)),
    )
    .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name, 'sv'));
  const open = (id: string, sell: boolean) => {
    setDeal({ id, sell });
    setOffer('');
    setError('');
    setBuyer(clubs.find((c) => c.id !== club)?.id ?? 'brick');
  };
  const confirm = () => {
    if (!deal || closed) return;
    const result = deal.sell ? sellPlayer(save, club, deal.id, buyer) : buyPlayer(save, club, deal.id, offer || undefined);
    if (result.error) setError(result.error);
    else {
      onChange(result.save);
      setDeal(null);
    }
  };
  return (
    <section className='transfer-panel' aria-label='Trupp och transfers'>
      <header className='transfer-heading'>
        <div>
          <p className='eyebrow'>
            {stars.length} STJÄRNOR · {clubs.length} KLUBBAR · PRIME
          </p>
          <h1>Bygg ditt drömlag.</h1>
          <p>Moderna världsstjärnor och klassiska legender i sin storhetstid. Köp, sälj och byt mellan matcherna.</p>
        </div>
        <div className='club-balance'>
          <span>Klubbkassa</span>
          <strong>{coins(save.money[club])}</strong>
        </div>
      </header>
      <label className='market-club'>
        Din klubb
        <select
          value={club}
          disabled={closed}
          onChange={(e) => {
            const activeClub = e.target.value;
            if (domesticClub(activeClub)) {
              onChange({ ...save, activeClub });
              setSearch('');
              setLimit(12);
            }
          }}
        >
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <p className={`market-window ${closed ? 'closed' : ''}`} role='status'>
        {closed
          ? 'Transferfönstret är stängt under en sparad eller pågående match. Fortsätt eller avsluta matchen först.'
          : `Transferfönstret är öppet · ${squad.length} spelare i truppen · 5 spelar samtidigt.`}
      </p>
      {save.lastReward?.club === club && (
        <p className='market-reward'>
          Senaste matchen: +{coins(save.lastReward.game)}
          {save.lastReward.prize > 0 ? ` · Prispengar: +${coins(save.lastReward.prize)}` : ''}
        </p>
      )}
      <details className='transfer-help'>
        <summary>Pengar, spelare och regler</summary>
        <p>
          Vinst: 400 mynt · Oavgjort: 300 · Förlust: 200. Ligaguld: 8 000, andraplats: 4 000, tredjeplats: 2 000. Alfredcupen: 6 000, Mästarpokalen: 8 000,
          Världscupen: 10 000 för seger. VM-pengarna går till den här klubben.
        </p>
        <p>
          {stars.length} stjärnor och familjespelare fördelas likadant på varje enhet. Varje klubb börjar med tio spelare: två målvakter, två försvarare, tre
          mittfältare och tre anfallare. En balanserad draft och positionsbyten jämnar ut lagens sammanlagda betyg. Familjespelarna börjar i sina egna klubbar.
          Stjärnor och legender spelar i sin prime; betygen är våra egna spelvärden på skalan 0–100. Högre betyg ger högre pris. Landslagen behåller sina
          separata, fasta trupper.
        </p>
        <p>
          Urvalet bygger på världsstjärnor från 2016–2025 och äldre klassiker, inklusive Pelé, Ronaldinho och Zlatan. Prime-året visar vilken version du spelar
          med; det är inte en officiell ranking eller dagens klubbtillhörighet.
        </p>
        <p>
          <a href='https://www.fifpro.org/en/articles/2023/10/history-mens-world-11' target='_blank' rel='noreferrer'>
            FIFPRO World 11 genom åren ↗
          </a>
          {' · '}
          <a
            href='https://www.uefa.com/ballondor/news/0287-195e642735da-0594342b9554-1000--history-of-the-ballon-d-or-all-the-winners/'
            target='_blank'
            rel='noreferrer'
          >
            Ballon d’Or-historik ↗
          </a>
        </p>
        <p>
          Startfemman väljs automatiskt: en målvakt och de fyra andra med högst betyg. Varje trupp behöver minst en målvakt och fyra utespelare. Försäljningar
          ger 80 % av värdet. Byten använder fullt värde åt båda håll.
        </p>
        <p>
          AI gör bara enstaka köp. Nya värvningar är skyddade i tre färdigspelade matcher. AI kan köpa högst en av dina spelare per fem matcher, till minst
          fullt värde. Landslagens trupper är fasta.
        </p>
      </details>
      <nav className='market-tabs' aria-label='Spelare'>
        <button
          type='button'
          aria-pressed={view === 'market'}
          onClick={() => {
            setView('market');
            setLimit(12);
          }}
        >
          Köp spelare
        </button>
        <button
          type='button'
          aria-pressed={view === 'squad'}
          onClick={() => {
            setView('squad');
            setLimit(14);
          }}
        >
          Din trupp ({squad.length})
        </button>
      </nav>
      <div className='market-filters'>
        <label>
          Sök spelare eller klubb
          <input
            type='search'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(12);
            }}
          />
        </label>
        <label>
          Position
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setLimit(12);
            }}
          >
            <option value='all'>Alla positioner</option>
            {Object.entries(starRoleNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Spelarera
          <select
            value={era}
            onChange={(e) => {
              setEra(e.target.value);
              setLimit(12);
            }}
          >
            <option value='all'>Alla stjärnor</option>
            <option value='modern'>Stjärnor från 2016</option>
            <option value='legend'>Klassiska legender</option>
            <option value='family'>Familjespelare</option>
          </select>
        </label>
        <label>
          Betyg
          <select
            value={band}
            onChange={(e) => {
              setBand(e.target.value);
              setLimit(12);
            }}
          >
            <option value='all'>Alla betyg</option>
            <option value='90'>90 och högre</option>
            <option value='80'>80 och högre</option>
            <option value='70'>70 och högre</option>
          </select>
        </label>
      </div>
      <p className='small-copy'>
        {filtered.length} spelare · Visar {Math.min(limit, filtered.length)}
      </p>
      <div className='athlete-grid'>
        {filtered.slice(0, limit).map((player) => (
          <article className={`athlete-card ${player.overall >= 90 ? 'elite' : ''}`} key={player.id}>
            <header>
              <PlayerPortrait player={player} club={save.owners[player.id]} />
              <div>
                <small>
                  {player.star ? starRoleNames[player.star.position] : player.keeper ? 'Målvakt' : 'Utespelare'} · {getClub(save.owners[player.id]).name}
                </small>
                <h2>{player.name}</h2>
                {player.star && (
                  <p className={`star-prime ${player.star.era}`}>
                    <strong>
                      {player.star.era === 'family' ? 'FAMILJESPELARE' : `${player.star.era === 'legend' ? 'LEGEND' : 'STJÄRNA'} · PRIME ${player.star.prime}`}
                    </strong>
                    <span>{player.star.country}</span>
                  </p>
                )}
                <span>{view === 'squad' ? (lineup.includes(player.id) ? 'Startfemman' : 'Avbytare') : coins(playerPrice(player))}</span>
              </div>
              <strong className='overall-rating' role='img' aria-label={`Totalbetyg ${player.overall} av 100`}>
                {player.overall}
                <small>BETYG</small>
              </strong>
            </header>
            <PlayerStats player={player} />
            {view === 'squad' && (save.protectedUntil[player.id] ?? 0) > save.matches && (
              <p className='protected-player'>Skyddad från AI-köp i {(save.protectedUntil[player.id] ?? 0) - save.matches} matcher</p>
            )}
            <button type='button' disabled={closed} onClick={() => open(player.id, view === 'squad')}>
              {view === 'squad' ? `Sälj ${player.name}` : `Köp eller byt ${player.name}`}
            </button>
          </article>
        ))}
      </div>
      {!filtered.length && <p>Inga spelare matchar ditt filter.</p>}
      {limit < filtered.length && (
        <button type='button' className='market-more' onClick={() => setLimit(limit + 12)}>
          Visa fler spelare
        </button>
      )}
      {save.news.length > 0 && (
        <section className='transfer-news' aria-label='Klubbnyheter'>
          <h2>Senaste nytt</h2>
          <ul>
            {save.news.map((item) => (
              <li key={item.id}>{item.message}</li>
            ))}
          </ul>
        </section>
      )}
      <dialog
        ref={dialog}
        className='match-dialog transfer-dialog'
        aria-labelledby='transfer-title'
        onCancel={(e) => {
          e.preventDefault();
          setDeal(null);
        }}
      >
        {selected && (
          <>
            <p className='eyebrow'>{deal?.sell ? 'FÖRSÄLJNING' : 'NY VÄRVNING'}</p>
            <h2 id='transfer-title'>{selected.name}</h2>
            <p>
              {selected.keeper ? 'Målvakt' : 'Utespelare'} · Betyg {selected.overall} · {getClub(save.owners[selected.id]).name}
            </p>
            {selected.star && (
              <p className={`star-prime ${selected.star.era}`}>
                {selected.star.era === 'family' ? 'Familjespelare' : `Prime ${selected.star.prime}`} · {selected.star.country} ·{' '}
                {starRoleNames[selected.star.position]}
              </p>
            )}
            <PlayerStats player={selected} />
            {deal?.sell ? (
              <label>
                Köpare
                <select
                  value={buyer}
                  onChange={(e) => {
                    if (domesticClub(e.target.value)) setBuyer(e.target.value);
                    setError('');
                  }}
                >
                  {clubs
                    .filter((c) => c.id !== club)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {coins(save.money[c.id])}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label>
                Betala med pengar eller byt en spelare
                <select
                  value={offer}
                  onChange={(e) => {
                    setOffer(e.target.value);
                    setError('');
                  }}
                >
                  <option value=''>Köp för pengar</option>
                  {squad.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.overall} · {coins(playerPrice(p))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className='transfer-total'>
              {deal?.sell || price < 0 ? 'Du får' : 'Du betalar'} <strong>{coins(Math.abs(price))}</strong>
            </p>
            <p>Kvar i klubbkassan: {coins(save.money[club] + (deal?.sell ? price : -price))}</p>
            {!deal?.sell && <p className='small-copy'>Nyförvärvet är skyddat från AI-köp under dina tre nästa matcher.</p>}
            {error && (
              <p role='alert' className='control-warning'>
                {error}
              </p>
            )}
            <button type='button' className='primary-button' disabled={closed || (!deal?.sell && save.money[club] < price)} onClick={confirm}>
              {deal?.sell ? 'Bekräfta försäljning' : offer ? 'Bekräfta byte' : 'Bekräfta köp'}
            </button>
            <button type='button' onClick={() => setDeal(null)}>
              Avbryt
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}

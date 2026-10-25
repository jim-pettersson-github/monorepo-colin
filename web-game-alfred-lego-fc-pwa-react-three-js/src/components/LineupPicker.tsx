import { type ClubId, getClub } from '../game/clubs';
import { familyFive, pickStarter } from '../game/lineups';
import { type Footballer, startingFive } from '../game/players';
import { lineupFor, setLineup, squadFor, type TransferSave } from '../game/transfers';
import './lineups.css';

export function FiveEditor({
  squad,
  five,
  disabled = false,
  onChange,
}: {
  squad: readonly Footballer[];
  five: string[];
  disabled?: boolean;
  onChange: (five: string[]) => void;
}) {
  return (
    <div className='five-editor'>
      {five.map((id, slot) => (
        <label key={slot === 0 ? 'keeper' : `outfield-${slot}`}>
          <span className='lineup-number'>{slot === 0 ? 'MV' : slot + 1}</span>
          <span>
            {slot === 0 ? 'Målvakt' : `Utespelare ${slot}`}
            <select
              aria-label={slot === 0 ? 'Startande målvakt' : `Startande utespelare ${slot}`}
              value={id}
              disabled={disabled}
              onChange={(event) => {
                const next = pickStarter(squad, five, slot, event.target.value);
                if (next) onChange(next);
              }}
            >
              {squad
                .filter((p) => p.keeper === (slot === 0))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.overall}
                    {p.star?.era === 'family' ? ' · Familj' : ''}
                  </option>
                ))}
            </select>
          </span>
        </label>
      ))}
    </div>
  );
}

export function LineupPicker({
  save,
  club,
  onChange,
  disabled = false,
}: {
  save: TransferSave;
  club: ClubId;
  onChange: (save: TransferSave) => void;
  disabled?: boolean;
}) {
  const squad = squadFor(save, club);
  const five = lineupFor(save, club);
  const locked = disabled || !!save.pending;
  return (
    <details className='lineup-picker'>
      <summary>Välj startfemma · {getClub(club).name}</summary>
      <p>
        {save.lineups?.[club]
          ? 'Din sparade startfemma används tills du ändrar den.'
          : squad.some((p) => p.star?.era === 'family')
            ? 'Familjespelarna prioriteras i lagets standardfemma. Välj själv vilka som ska starta.'
            : 'Automatiskt val efter betyg. Välj själv vilka som ska starta.'}{' '}
        En målvakt och fyra utespelare.
      </p>
      {locked && <p className='small-copy'>Startfemman kan ändras mellan matcherna. Gör byten i pausmenyn under en pågående match.</p>}
      {save.form?.[club] && <p className='small-copy'>Listorna visar ordinarie betyg. Laget har segerform: +2 på alla egenskaper, högst 100.</p>}
      <FiveEditor squad={squad} five={five} disabled={locked} onChange={(ids) => onChange(setLineup(save, club, ids))} />
      <div className='lineup-actions'>
        {squad.some((p) => p.star?.era === 'family') && (
          <button type='button' disabled={locked} onClick={() => onChange(setLineup(save, club, familyFive(squad)))}>
            Familjen först
          </button>
        )}
        <button type='button' disabled={locked} onClick={() => onChange(setLineup(save, club, startingFive(squad)))}>
          Välj automatiskt efter betyg
        </button>
        {save.lineups?.[club] && (
          <button type='button' disabled={locked} onClick={() => onChange(setLineup(save, club, null))}>
            Återställ standardfemma
          </button>
        )}
      </div>
      <p className='lineup-bench'>
        Avbytare:{' '}
        {squad
          .filter((p) => !five.includes(p.id))
          .map((p) => `${p.name} (${p.overall})`)
          .join(' · ')}
      </p>
    </details>
  );
}

import { carById, carName } from '../game/cars';
import { type Difficulty, formatTime } from '../game/race';
import { loadRecords, type Settings } from '../game/storage';
import { trackById, trackDefs } from '../game/tracks';
import { TrackMap } from './TrackMap';

type Props = { settings: Settings; onChange: (settings: Settings) => void; onBack: () => void; onStart: () => void };

const kilometres = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const difficulties: [Difficulty, string][] = [
  ['easy', 'Lätt'],
  ['normal', 'Normal'],
  ['hard', 'Svår'],
];

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className='choice'>
      <legend>{label}</legend>
      {options.map(([option, text]) => (
        <button key={String(option)} type='button' aria-pressed={option === value} onClick={() => onChange(option)}>
          {text}
        </button>
      ))}
    </fieldset>
  );
}

export function TrackSelect({ settings, onChange, onBack, onStart }: Props) {
  const records = loadRecords();
  return (
    <main className='menu-screen track-select'>
      <header className='screen-header'>
        <button type='button' onClick={onBack}>
          ◀ Bilar
        </button>
        <h2>Välj bana</h2>
        <span className='counter'>{carName(carById(settings.carId))}</span>
      </header>

      <div className='track-cards'>
        {trackDefs.map((def) => {
          const track = trackById(def.id);
          const record = records[def.id];
          return (
            <button
              key={def.id}
              type='button'
              className={`track-card theme-${def.theme}`}
              aria-pressed={settings.trackId === def.id}
              onClick={() => onChange({ ...settings, trackId: def.id })}
            >
              <TrackMap track={track} size={180} className='track-card-map' />
              <span className='track-card-text'>
                <strong>{def.name}</strong>
                <span className='track-place'>{def.place}</span>
                <span>{def.description}</span>
                <span className='track-facts'>
                  {kilometres.format(track.path.length / 1000)} km · Rekord{' '}
                  {record ? `${formatTime(record.time)} (${carName(carById(record.carId))})` : 'saknas'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className='panel race-options'>
        <Choice
          label='Varv'
          value={settings.laps}
          options={[
            [1, '1'],
            [2, '2'],
            [3, '3'],
            [5, '5'],
          ]}
          onChange={(laps) => onChange({ ...settings, laps })}
        />
        <Choice label='Motståndare' value={settings.difficulty} options={difficulties} onChange={(difficulty) => onChange({ ...settings, difficulty })} />
        <Choice
          label='Växellåda'
          value={settings.transmission}
          options={[
            ['auto', 'Automat'],
            ['manual', 'Manuell'],
          ]}
          onChange={(transmission) => onChange({ ...settings, transmission })}
        />
        <button type='button' className='primary start-button' onClick={onStart}>
          Starta race ▶
        </button>
      </div>
    </main>
  );
}

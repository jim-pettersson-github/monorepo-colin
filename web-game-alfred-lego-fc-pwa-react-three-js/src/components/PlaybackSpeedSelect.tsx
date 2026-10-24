import type { PlaybackSpeed } from '../game/model';

export function PlaybackSpeedSelect({ value, onChange }: { value: PlaybackSpeed; onChange: (speed: PlaybackSpeed) => void }) {
  return (
    <label className='playback-speed'>
      Hastighet
      <select aria-label='Hastighet' value={value} onChange={(event) => onChange(Number(event.target.value) as PlaybackSpeed)}>
        <option value={1}>1× · Normal</option>
        <option value={2}>2× · Dubbelt</option>
        <option value={5}>5× · Fem gånger</option>
      </select>
    </label>
  );
}

import { useId } from 'react';

export function VolumeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <label className='sound-volume' htmlFor={id}>
      <span>
        Ljudvolym <output>{Math.round(value * 100)} %</output>
      </span>
      <input id={id} type='range' min='0' max='100' step='5' value={Math.round(value * 100)} onChange={(event) => onChange(Number(event.target.value) / 100)} />
    </label>
  );
}

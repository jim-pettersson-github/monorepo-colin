import type { PointerEvent } from 'react';
import type { TouchState } from '../game/input';

type Pad = { key: keyof TouchState; label: string; className: string; symbol: string };

const pads: Pad[] = [
  { key: 'left', label: 'Styr vänster', className: 'pad-left', symbol: '◀' },
  { key: 'right', label: 'Styr höger', className: 'pad-right', symbol: '▶' },
  { key: 'handbrake', label: 'Handbroms', className: 'pad-handbrake', symbol: 'HB' },
  { key: 'brake', label: 'Broms', className: 'pad-brake', symbol: '▼' },
  { key: 'throttle', label: 'Gas', className: 'pad-throttle', symbol: '▲' },
];

export function TouchControls({ touch }: { touch: TouchState }) {
  const press = (key: keyof TouchState, down: boolean) => (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (down) event.currentTarget.setPointerCapture(event.pointerId);
    touch[key] = down;
    event.currentTarget.classList.toggle('pressed', down);
  };

  return (
    <div className='touch-controls'>
      {pads.map((pad) => (
        <button
          key={pad.key}
          type='button'
          className={`touch-pad ${pad.className}`}
          aria-label={pad.label}
          onPointerDown={press(pad.key, true)}
          onPointerUp={press(pad.key, false)}
          onPointerCancel={press(pad.key, false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          {pad.symbol}
        </button>
      ))}
    </div>
  );
}

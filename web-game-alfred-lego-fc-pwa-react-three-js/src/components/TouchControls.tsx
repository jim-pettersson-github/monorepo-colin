import type { PointerEvent } from 'react';
import { useRef, useState } from 'react';
import type { InputManager } from '../game/input';
import type { Team } from '../game/model';

export function TouchControls({ input, team }: { input: InputManager; team: Team }) {
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const update = (event: PointerEvent<HTMLFieldSetElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width * 0.33);
    const dy = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height * 0.33);
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    input.setTouch(dx / magnitude, dy / magnitude);
    setKnob({ x: (dx / magnitude) * 32, y: (dy / magnitude) * 32 });
  };
  const release = (event: PointerEvent<HTMLFieldSetElement>) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    input.setTouch(0, 0);
    setKnob({ x: 0, y: 0 });
  };
  return (
    <section className={`touch-controls team-${team}`} aria-label={`Pekkontroller spelare ${team + 1}`}>
      <fieldset
        className='joystick'
        aria-label='Rörelsespak'
        onPointerDown={(event) => {
          if (pointer.current !== null) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          update(event);
        }}
        onPointerMove={(event) => {
          if (pointer.current === event.pointerId) update(event);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span className='joystick-cross' aria-hidden='true'>
          ＋
        </span>
        <span className='joystick-knob' style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        <span className='joystick-label'>SPELARE {team + 1}</span>
      </fieldset>
      <div className='touch-actions'>
        <button
          type='button'
          className='touch-secondary'
          onPointerDown={(event) => {
            event.preventDefault();
            input.touchAction('switch');
          }}
          onClick={(event) => {
            if (event.detail === 0) input.touchAction('switch');
          }}
        >
          Byt
        </button>
        <button
          type='button'
          className='touch-sprint'
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            input.setTouchSprint(true);
          }}
          onPointerUp={() => input.setTouchSprint(false)}
          onPointerCancel={() => input.setTouchSprint(false)}
          onLostPointerCapture={() => input.setTouchSprint(false)}
        >
          Spring
        </button>
        <button
          type='button'
          className='touch-pass'
          onPointerDown={(event) => {
            event.preventDefault();
            input.touchAction('pass');
          }}
          onClick={(event) => {
            if (event.detail === 0) input.touchAction('pass');
          }}
        >
          Passa
        </button>
        <button
          type='button'
          className='touch-shoot'
          onPointerDown={(event) => {
            event.preventDefault();
            input.touchAction('shoot');
          }}
          onClick={(event) => {
            if (event.detail === 0) input.touchAction('shoot');
          }}
        >
          Skjut<small>/ glidtackla</small>
        </button>
      </div>
    </section>
  );
}

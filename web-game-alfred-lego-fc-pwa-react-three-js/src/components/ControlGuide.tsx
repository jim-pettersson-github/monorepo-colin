import type { ReactNode } from 'react';
import type { InputManager, Source } from '../game/input';
import { defaultMapping } from '../game/input';
import type { Team } from '../game/model';
import './control-guide.css';

export function DeviceIcon({ kind }: { kind: 'keyboard' | 'gamepad' | 'touch' }) {
  const label = { keyboard: 'Tangentbord', gamepad: 'Handkontroll', touch: 'Pekskärm' }[kind];
  return (
    <svg
      className='device-icon'
      viewBox='0 0 64 48'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      role='img'
      aria-label={label}
    >
      <title>{label}</title>
      {kind === 'keyboard' ? (
        <>
          <rect x='3' y='8' width='58' height='33' rx='5' />
          <path d='M11 17h3m6 0h3m6 0h3m6 0h3m6 0h5M11 25h3m6 0h3m6 0h3m6 0h3m6 0h5M12 33h5m6 0h18m6 0h5' />
        </>
      ) : kind === 'gamepad' ? (
        <>
          <path d='M19 10h26c8 0 11 9 13 20 2 12-4 15-10 7l-4-5H20l-4 5C10 45 4 42 6 30c2-11 5-20 13-20Z' />
          <path d='M18 16v12m-6-6h12' />
          <circle cx='41' cy='22' r='1.5' />
          <circle cx='48' cy='16' r='1.5' />
          <circle cx='55' cy='22' r='1.5' />
          <circle cx='48' cy='28' r='1.5' />
          <path d='M27 17h3m5 0h3' />
          <circle cx='27' cy='29' r='3' />
          <circle cx='37' cy='29' r='3' />
        </>
      ) : (
        <>
          <rect x='17' y='3' width='30' height='42' rx='5' />
          <path d='M28 9h8m-6 30h4' />
          <circle cx='32' cy='25' r='6' />
          <path d='m32 29 10 8' />
        </>
      )}
    </svg>
  );
}

function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className='key-cap'>{children}</kbd>;
}

function MovementKeys({ arrows }: { arrows: boolean }) {
  return (
    <span className='movement-keys' role='img' aria-label={arrows ? 'Piltangenterna upp, vänster, ned och höger' : 'Tangenterna W, A, S och D'}>
      <span className='movement-key-top' aria-hidden='true'>
        <KeyCap>{arrows ? '↑' : 'W'}</KeyCap>
      </span>
      <span className='movement-key-bottom' aria-hidden='true'>
        <KeyCap>{arrows ? '←' : 'A'}</KeyCap>
        <KeyCap>{arrows ? '↓' : 'S'}</KeyCap>
        <KeyCap>{arrows ? '→' : 'D'}</KeyCap>
      </span>
    </span>
  );
}

function StickIcon({ touch = false }: { touch?: boolean }) {
  return (
    <svg className='stick-glyph' viewBox='0 0 56 56' role='img' aria-label={touch ? 'Rörelsespaken på skärmen' : 'Rörelsespak på handkontrollen'}>
      <title>{touch ? 'Rörelsespak på skärmen' : 'Rörelsespak'}</title>
      <circle cx='28' cy='28' r='17' fill='none' stroke='currentColor' strokeWidth='2' opacity='.4' />
      <path d='m28 2-4 5h8Zm0 52-4-5h8ZM2 28l5-4v8Zm52 0-5-4v8Z' fill='currentColor' />
      <circle cx='28' cy='28' r='10' fill='currentColor' />
    </svg>
  );
}

function PadButton({ index, standard, playstation }: { index: number; standard: boolean; playstation: boolean }) {
  const positions = [
    [30, 46],
    [46, 30],
    [14, 30],
    [30, 14],
  ];
  if (standard && index < 4) {
    const names = ['Nedersta', 'Högra', 'Vänstra', 'Översta'];
    return (
      <svg className='pad-face-glyph' viewBox='0 0 60 60' role='img' aria-label={`${names[index]} knappen på handkontrollen`}>
        <title>{names[index]} knappen</title>
        {positions.map(([x, y], position) => (
          <g key={`${x}-${y}`}>
            <circle
              cx={x}
              cy={y}
              r='9'
              fill={position === index ? 'currentColor' : 'none'}
              stroke='currentColor'
              strokeWidth='1.5'
              opacity={position === index ? 1 : 0.23}
            />
            {position === index && (
              <text x={x} y={y + 4} textAnchor='middle' fill='var(--background)' fontSize='12' fontWeight='800'>
                {playstation ? ['×', '○', '□', '△'][index] : ''}
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  }
  const name = standard
    ? (
        {
          4: playstation ? 'L1' : 'LB',
          5: playstation ? 'R1' : 'RB',
          6: playstation ? 'L2' : 'LT',
          7: playstation ? 'R2' : 'RT',
          8: 'View',
          9: '☰',
          10: 'L3',
          11: 'R3',
        } as Record<number, string>
      )[index]
    : undefined;
  return (
    <span className='pad-button-cap' role='img' aria-label={name ? `Handkontroll ${index === 9 ? 'Start' : name}` : `Handkontroll knapp ${index}`}>
      {name || `#${index}`}
    </span>
  );
}

export function ControlGuide({ source, input, team, compact = false }: { source: Source; input?: InputManager; team?: Team; compact?: boolean }) {
  const keyboard = source === 'keyboard1' || source === 'keyboard2';
  const arrows = source === 'keyboard2';
  const touch = source === 'touch';
  const device = input?.devices.find((candidate) => source === `pad:${candidate.index}`);
  const mapping = device && input ? input.mapping(device.index) : defaultMapping;
  const playstation = !!device && /sony|054c|dualsense|dualshock|playstation/i.test(device.id);
  const kind = keyboard ? 'keyboard' : touch ? 'touch' : 'gamepad';
  const title = keyboard ? (arrows ? 'Piltangenter' : 'Tangentbord') : touch ? 'Pekskärm' : 'Handkontroll';
  const actions = [
    { label: 'Flytta', graphic: keyboard ? <MovementKeys arrows={arrows} /> : <StickIcon touch={touch} /> },
    {
      label: 'Passa',
      graphic: keyboard ? (
        <KeyCap>{arrows ? ',' : 'J'}</KeyCap>
      ) : touch ? (
        <span className='touch-button-glyph'>Passa</span>
      ) : (
        <PadButton index={mapping.pass} standard={device?.standard ?? true} playstation={playstation} />
      ),
    },
    {
      label: 'Skjut / glidtackla',
      graphic: keyboard ? (
        <KeyCap>{arrows ? '.' : 'K'}</KeyCap>
      ) : touch ? (
        <span className='touch-button-glyph'>Skjut</span>
      ) : (
        <PadButton index={mapping.shoot} standard={device?.standard ?? true} playstation={playstation} />
      ),
    },
    {
      label: 'Byt spelare',
      graphic: keyboard ? (
        <KeyCap>{arrows ? '/' : 'L'}</KeyCap>
      ) : touch ? (
        <span className='touch-button-glyph'>Byt</span>
      ) : (
        <PadButton index={mapping.switch} standard={device?.standard ?? true} playstation={playstation} />
      ),
    },
    {
      label: 'Spring',
      graphic: keyboard ? (
        <KeyCap>
          <span>⇧ Shift</span>
          <small>{arrows ? 'höger' : 'vänster'}</small>
        </KeyCap>
      ) : touch ? (
        <span className='touch-button-glyph'>Spring</span>
      ) : (
        <PadButton index={mapping.sprint} standard={device?.standard ?? true} playstation={playstation} />
      ),
    },
    {
      label: 'Paus',
      graphic:
        keyboard || touch ? (
          <KeyCap>{touch ? 'Ⅱ' : 'Esc'}</KeyCap>
        ) : (
          <PadButton index={mapping.pause} standard={device?.standard ?? true} playstation={playstation} />
        ),
    },
  ];
  return (
    <section
      className={`control-guide ${compact ? 'control-guide-compact' : ''} ${team === undefined ? '' : `guide-team-${team}`}`}
      aria-label={`Kontrollguide ${team === undefined ? title : `spelare ${team + 1}`}`}
    >
      <div className='control-guide-heading'>
        <DeviceIcon kind={kind} />
        <span>
          {team === undefined ? title : `P${team + 1}`}
          {!compact && team !== undefined && <small>{title}</small>}
        </span>
      </div>
      <div className='control-bindings'>
        {actions.map(({ label, graphic }) => (
          <div className='control-binding' key={label}>
            <span className='binding-graphic'>{graphic}</span>
            <span className='binding-label'>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

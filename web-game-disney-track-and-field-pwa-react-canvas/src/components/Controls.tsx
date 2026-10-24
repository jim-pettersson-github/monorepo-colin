import { useSyncExternalStore } from 'react';
import type { GameInput, Mapping } from '../game/input';
import { keyboardControls, sourceLabel } from '../game/input';
import type { EventId, Settings, Source } from '../game/model';
import { character, eventInfo, jumpEvent, separateControls } from '../game/model';
import { Key, PadFace } from './Icons';
export function controlsReady(settings: Settings, input: GameInput) {
  return (
    settings.sources.slice(0, settings.players).every((s) => {
      if (!input.available(s)) return false;
      if (!s.startsWith('pad:')) return true;
      const index = Number(s.slice(4));
      const m = input.mapping(index);
      const d = input.devices.find((d) => d.index === index);
      return !!d && [m.left, m.right, m.action].every((n) => n < d.buttons) && new Set([m.left, m.right, m.action]).size === 3;
    }) && separateControls(settings.sources, settings.players)
  );
}
export function ControlLegend({ source, input, player, assist }: { source: Source; input: GameInput; player: number; assist: boolean }) {
  const pad = source.startsWith('pad:');
  const m = pad ? input.mapping(Number(source.slice(4))) : null;
  const touch = source === 'touch';
  const keys = source in keyboardControls ? keyboardControls[source as keyof typeof keyboardControls].labels : keyboardControls.keyboard1.labels;
  return (
    <section className='control-legend' aria-label={`Knappar spelare ${player + 1}`}>
      <span className='control-pair'>
        {pad && m ? (
          <>
            <PadFace index={m.left} />
            <PadFace index={m.right} />
          </>
        ) : touch ? (
          <>
            <span className='touch-key'>L</span>
            <span className='touch-key'>R</span>
          </>
        ) : (
          <>
            <Key>{keys[0]}</Key>
            <Key>{keys[1]}</Key>
          </>
        )}
        <small>{assist ? 'Håll = spring' : 'Växla = spring'}</small>
      </span>
      <span className='control-pair'>
        {pad && m ? <PadFace index={m.action} /> : touch ? <span className='touch-key'>★</span> : <Key>{keys[2]}</Key>}
        <small>Hoppa / kasta</small>
      </span>
    </section>
  );
}
export function ControlSetup({ settings, input, onChange }: { settings: Settings; input: GameInput; onChange: (s: Settings) => void }) {
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  const options: Source[] = ['keyboard1', 'keyboard2', 'keyboard3', 'keyboard4', 'touch', ...input.devices.map((d) => `pad:${d.index}` as const)];
  for (const s of settings.sources) if (!options.includes(s)) options.push(s);
  return (
    <section className='controls-setup' aria-label='Spelkontroller'>
      <div className='section-title'>
        <h3>Dina kontroller</h3>
        <span>{input.devices.length} handkontroller</span>
      </div>
      {Array.from({ length: settings.players }, (_, i) => (
        <div className='controller-row' key={settings.characters[i]}>
          <label>
            Spelare {i + 1} · {character(settings.characters[i]).name}
            <select
              aria-label={`Kontroll spelare ${i + 1}`}
              value={settings.sources[i]}
              onChange={(e) => {
                const sources = [...settings.sources];
                sources[i] = e.target.value as Source;
                onChange({ ...settings, sources });
              }}
            >
              {options.map((s) => (
                <option value={s} key={s}>
                  {sourceLabel(s, input.devices)}
                </option>
              ))}
            </select>
          </label>
          <ControlLegend source={settings.sources[i]} input={input} player={i} assist={settings.assist} />
        </div>
      ))}
      {!controlsReady(settings, input) && (
        <p className='warning' role='status'>
          Välj olika anslutna kontroller eller tangentgrupper för spelarna. Pekskärmen kan delas. Handkontroller behöver tre olika knappar.
        </p>
      )}
      {input.devices.map((d) => (
        <details key={`${d.index}:${d.id}`} className='pad-mapping'>
          <summary>Anpassa handkontroll {d.index + 1}</summary>
          <p className='muted'>{d.id}</p>
          <div className='options-grid'>
            {(['left', 'right', 'action', 'pause'] as const).map((k) => (
              <label key={k}>
                {({ left: 'Vänster steg', right: 'Höger steg', action: 'Hoppa / kasta', pause: 'Paus' } as Record<keyof Mapping, string>)[k]}
                <select
                  aria-label={`Handkontroll ${d.index + 1} ${k}`}
                  value={input.mapping(d.index)[k]}
                  onChange={(e) => input.setMapping(d.index, { [k]: Number(e.target.value) })}
                >
                  {Array.from({ length: Math.max(d.buttons, input.mapping(d.index)[k] + 1) }, (_, i) => i).map((i) => (
                    <option value={i} key={`button-${i}`}>
                      Knapp {i}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      ))}
      <p className='small muted'>Anslut USB eller Bluetooth och tryck på en knapp för att hitta handkontrollen.</p>
      {settings.players > 2 && <p className='small muted'>Vissa tangentbord klarar få samtidiga tryck. Använd gärna handkontroller när ni är flera.</p>}
    </section>
  );
}
export function TouchControls({ input, player, labelPlayer = player, event }: { input: GameInput; player: number; labelPlayer?: number; event: EventId }) {
  return (
    <section className={`touch-controls player-${player}`} aria-label={`Pekkontroller spelare ${labelPlayer + 1}`}>
      <span className='touch-player'>P{labelPlayer + 1}</span>
      {(eventInfo(event).mechanic === 'run' || event === 'raceWalk' ? [0, 1] : [0, 1, 2]).map((button) => (
        <button
          type='button'
          key={button}
          aria-label={`Spelare ${labelPlayer + 1} ${button === 0 ? 'vänster steg' : button === 1 ? 'höger steg' : eventInfo(event).type === 'run' || jumpEvent(event) ? 'hoppa' : 'kasta'}`}
          className={button === 2 ? 'action-touch' : ''}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            input.press(player, button, true);
          }}
          onPointerUp={(e) => {
            input.press(player, button, false);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => input.press(player, button, false)}
          onLostPointerCapture={() => input.press(player, button, false)}
        >
          {button === 2 ? (
            <>
              <span>↑</span>
              <small>{eventInfo(event).type === 'run' || jumpEvent(event) ? 'Hoppa' : 'Kasta'}</small>
            </>
          ) : (
            <>
              <svg viewBox='0 0 40 40' aria-hidden='true'>
                <ellipse cx={button === 0 ? 15 : 25} cy='12' rx='6' ry='10' fill='currentColor' />
                <path d={button === 0 ? 'M11 22q-4 11 2 12h7q5-3-1-11Z' : 'M21 22q-4 11 2 12h7q5-3-1-11Z'} fill='currentColor' />
              </svg>
              <small>{button === 0 ? 'Vänster' : 'Höger'}</small>
            </>
          )}
        </button>
      ))}
    </section>
  );
}

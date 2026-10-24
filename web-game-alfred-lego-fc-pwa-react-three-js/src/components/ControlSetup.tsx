import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MatchClubs } from '../game/clubs';
import { defaultClubs, getClub } from '../game/clubs';
import type { InputManager, PadMapping, Source } from '../game/input';
import { readPad, sourceLabel } from '../game/input';
import type { MatchMode } from '../game/model';
import { ControlGuide } from './ControlGuide';

export function controlsReady(input: InputManager, mode: MatchMode) {
  return input.available(0) && (mode === 'solo' || (input.available(1) && input.sources[0] !== input.sources[1]));
}

function PadTester({ input, index }: { input: InputManager; index: number }) {
  const [text, setText] = useState('Rör spaken eller tryck på en knapp.');
  useEffect(() => {
    const interval = window.setInterval(() => {
      try {
        const pad = navigator.getGamepads?.()[index];
        if (!pad) return setText('Handkontrollen är frånkopplad.');
        const values = readPad(pad, input.mapping(index));
        const buttons = pad.buttons.flatMap((button, i) => (button.pressed ? [i] : []));
        setText(`X ${values.x.toFixed(2)} · Y ${values.y.toFixed(2)} · Knappar: ${buttons.length ? buttons.join(', ') : '–'}`);
      } catch {
        setText('Handkontrollen är inte tillgänglig.');
      }
    }, 100);
    return () => clearInterval(interval);
  }, [input, index]);
  return (
    <output className='pad-test' aria-label='Handkontrolltest'>
      {text}
    </output>
  );
}

export function ControlSetup({ input, mode, clubs = defaultClubs }: { input: InputManager; mode: MatchMode; clubs?: MatchClubs }) {
  useSyncExternalStore(input.subscribe, input.getSnapshot);
  const teams = mode === 'solo' ? ([0] as const) : ([0, 1] as const);
  const sources: Source[] = ['keyboard1', 'keyboard2', 'touch', ...input.devices.map((d) => `pad:${d.index}` as const)];
  for (const source of input.sources) if (!sources.includes(source)) sources.push(source);
  return (
    <section className='control-setup' aria-label='Spelkontroller'>
      <div className='section-caption'>
        <span>KONTROLLER</span>
        <span>{input.devices.length} anslutna handkontroller</span>
      </div>
      {teams.map((team) => (
        <div className='source-entry' key={team}>
          <label className={`source-label team-${team}`}>
            <span>
              Spelare {team + 1} <small>{getClub(clubs[team]).name}</small>
            </span>
            <select value={input.sources[team]} onChange={(event) => input.setSource(team, event.target.value as Source)}>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {sourceLabel(source, input.devices)}
                </option>
              ))}
            </select>
          </label>
          <ControlGuide source={input.sources[team]} input={input} team={team} />
        </div>
      ))}
      {!controlsReady(input, mode) && (
        <p className='control-warning' role='status'>
          Välj en ansluten kontroll per spelare. Två spelare behöver olika kontroller.
        </p>
      )}
      <p className='small-copy'>Anslut USB eller Bluetooth och tryck på en knapp för att hitta handkontrollen.</p>
      {input.devices.map((device) => (
        <details className='mapping' key={`${device.index}-${device.id}`}>
          <summary>
            Handkontroll {device.index + 1} · {device.standard ? 'Standard' : 'Anpassa knappar'}
          </summary>
          <p className='device-name'>{device.id}</p>
          <PadTester input={input} index={device.index} />
          <div className='mapping-grid'>
            {(['x', 'y', 'pass', 'shoot', 'switch', 'sprint', 'pause'] as const).map((key) => {
              const labels = {
                x: 'Spak vågrätt',
                y: 'Spak lodrätt',
                pass: 'Passa',
                shoot: 'Skjut / glidtackla',
                switch: 'Byt spelare',
                sprint: 'Spring',
                pause: 'Pausa',
              };
              const axis = key === 'x' || key === 'y';
              const count = axis ? device.axes : device.buttons;
              return (
                <label key={key}>
                  {labels[key]}
                  <select
                    value={input.mapping(device.index)[key]}
                    onChange={(event) => input.setMapping(device.index, { [key]: Number(event.target.value) } as Partial<PadMapping>)}
                  >
                    {Array.from({ length: Math.max(count, input.mapping(device.index)[key] + 1) }, (_, i) => i).map((i) => (
                      <option key={i} value={i}>
                        {axis ? 'Axel' : 'Knapp'} {i}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            {(['invertX', 'invertY'] as const).map((key) => (
              <label className='check-label' key={key}>
                <input
                  type='checkbox'
                  checked={input.mapping(device.index)[key]}
                  onChange={(event) => input.setMapping(device.index, { [key]: event.target.checked })}
                />
                Vänd {key === 'invertX' ? 'X' : 'Y'}
              </label>
            ))}
          </div>
        </details>
      ))}
      <details className='keyboard-help'>
        <summary>Visa alla knappar</summary>
        <ControlGuide source='keyboard1' />
        <ControlGuide source='keyboard2' />
        <p>
          På siffertangentbordet: <kbd className='key-cap'>1</kbd> passa · <kbd className='key-cap'>2</kbd> skjut · <kbd className='key-cap'>3</kbd> byt.
        </p>
        <ControlGuide source='pad:-1' />
        <p>Den fyllda cirkeln visar vilken knapp på handkontrollen du ska trycka på. Dina egna knappval visas i guiden för din spelare.</p>
        <p>
          Rikta med spaken när du passar eller skjuter. Utan boll glidtacklar du med skottknappen. Träffa bollen för att vinna den och fälla motståndaren. En
          glidtackling utan kontakt ger inget domslut. Bollträff gör tacklingen ren. Vid kontakt utan bollvinst är det lika stor chans för gult kort, frispark
          eller att domaren låter spelet gå (en tredjedel var). Frispark i eget straffområde blir straff. Sikta och tryck Skjut för att slå straffen. Esc
          pausar.
        </p>
      </details>
    </section>
  );
}

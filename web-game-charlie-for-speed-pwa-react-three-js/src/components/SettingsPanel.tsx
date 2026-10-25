import type { Settings } from '../game/storage';
import { FullscreenButton } from './FullscreenButton';
import { GameUpdate } from './GameUpdate';
import { VolumeControl } from './VolumeControl';

type Props = { settings: Settings; onChange: (settings: Settings) => void; onClose: () => void };

const controls = [
  ['Gas / broms', 'Pil upp/ner eller W/S'],
  ['Styra', 'Pil vänster/höger eller A/D'],
  ['Handbroms', 'Mellanslag'],
  ['Växla (manuell)', 'E upp, Q ner'],
  ['Kamera', 'C'],
  ['Tillbaka på banan', 'R'],
  ['Paus', 'Esc eller P'],
  ['Ljud av/på', 'M'],
];

export function SettingsPanel({ settings, onChange, onClose }: Props) {
  return (
    <div className='side-panel-backdrop'>
      <button type='button' className='backdrop-close' aria-label='Stäng inställningar' tabIndex={-1} onClick={onClose} />
      <aside className='side-panel' aria-labelledby='settings-title'>
        <header>
          <h2 id='settings-title'>Inställningar</h2>
          <button type='button' aria-label='Stäng' onClick={onClose}>
            ✕
          </button>
        </header>
        <label className='toggle'>
          <input type='checkbox' checked={settings.retro} onChange={(event) => onChange({ ...settings, retro: event.target.checked })} />
          <span>
            Retrostil
            <small>90-talsgrafik: låg upplösning, kantiga pixlar och platt skuggning.</small>
          </span>
        </label>
        <label className='toggle'>
          <input type='checkbox' checked={settings.sound} onChange={(event) => onChange({ ...settings, sound: event.target.checked })} />
          <span>Ljud</span>
        </label>
        <VolumeControl value={settings.volume} onChange={(volume) => onChange({ ...settings, volume })} />
        <h3>Kontroller</h3>
        <dl className='control-list'>
          {controls.map(([action, keys]) => (
            <div key={action}>
              <dt>{action}</dt>
              <dd>{keys}</dd>
            </div>
          ))}
        </dl>
        <p className='hint'>
          Handkontroll: höger avtryckare gas, vänster broms, A handbroms, Y kamera, B tillbaka på banan. På mobil visas knappar på skärmen.
        </p>
        <FullscreenButton />
        <GameUpdate />
      </aside>
    </div>
  );
}

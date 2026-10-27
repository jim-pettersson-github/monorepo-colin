import { useState } from 'react';

type Props = {
  onName: (name: string) => void;
  onCancel: () => void;
};

// Asked once before the first race alone, so every lap on the scoreboard carries a driver's name.
export function NamePrompt({ onName, onCancel }: Props) {
  const [name, setName] = useState('');
  return (
    <div className='overlay name-prompt'>
      <form
        className='panel pause-panel'
        aria-labelledby='name-prompt-title'
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) onName(name.trim());
        }}
      >
        <h2 id='name-prompt-title'>Vad heter du?</h2>
        <p>Namnet syns på topplistorna och för de du kör mot online. Du kan byta det i Inställningar.</p>
        <label className='settings-name'>
          Ditt namn
          {/* biome-ignore lint/a11y/noAutofocus: the prompt only asks for this one field */}
          <input value={name} maxLength={16} autoComplete='nickname' autoFocus onChange={(event) => setName(event.target.value)} />
        </label>
        <button type='submit' className='primary' disabled={!name.trim()}>
          Kör
        </button>
        <button type='button' onClick={onCancel}>
          Tillbaka
        </button>
      </form>
    </div>
  );
}

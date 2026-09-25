import { useRef } from 'react';
import '../art-study.css';
import '../cafe-study.css';

const imageUrl = `${import.meta.env.BASE_URL}art-studies/cafe-two-floors-v3.webp`;
const imageDescription =
  'Ett modernt kafé sett snett uppifrån med båda våningarna synliga. Glashissen står till vänster och trappan till höger. Barfota Colin står vid anropsknappen på den rymliga övervåningen. Hisskorgen är på våning 1; genom entréplanets stängda glasdörrar syns det tomma schaktet.';

export function CafeStudy() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <main className='art-study cafe-study'>
      <header className='art-study-header cafe-study-header'>
        <a href={import.meta.env.BASE_URL}>← Till spelet</a>
        <span>COLINS HISSÄVENTYR · KAFÉKONCEPT</span>
        <a href={`${import.meta.env.BASE_URL}?view=art`}>Tidigare stilprov ↗</a>
      </header>
      <div className='cafe-study-intro'>
        <div>
          <p className='eyebrow'>ETT KAFÉ · TVÅ VÅNINGAR · EN GLASHISS</p>
          <h1>Se hissen hela vägen.</h1>
        </div>
        <p>Det godkända bildförslaget: en högre, sned vy med mer synligt golv på övervåningen. Kaféet finns nu i spelet, till vänster om hotellet.</p>
      </div>
      <figure className='cafe-study-figure'>
        <button type='button' className='art-study-image cafe-study-image' aria-label='Förstora kafébilden' onClick={() => dialog.current?.showModal()}>
          <img src={imageUrl} alt={imageDescription} width='1536' height='1024' />
          <span aria-hidden='true'>↗</span>
        </button>
        <figcaption>Hissen till vänster, trappan till höger och plats att utforska på båda planen. Tryck på bilden för att förstora.</figcaption>
      </figure>
      <section className='cafe-study-notes' aria-label='Tanken bakom kaféet'>
        <article>
          <h2>Glaset i centrum</h2>
          <p>Genomskinligt schakt, hisskorg och skjutdörrar. Tunna ramar och försiktiga reflexer gör glaset synligt utan att dölja det som finns bakom.</p>
        </article>
        <article>
          <h2>Plats att leka även där uppe</h2>
          <p>Den högre vinkeln visar golvet framför hissdörrarna på våning 1. Trappan förbinder planen så att Colin kan ta den för att möta hissen.</p>
        </article>
        <article>
          <h2>Ett lugnt, modernt kafé</h2>
          <p>Ljust trä, varm metall och mjuka blågröna skuggor i spelets målade stil. Kaféets möbler lämnar plats åt Colin, trappan och hissen.</p>
        </article>
      </section>
      <dialog ref={dialog} className='art-study-dialog cafe-study-dialog' aria-labelledby='cafe-detail-title'>
        <div className='art-study-dialog-heading'>
          <h2 id='cafe-detail-title'>Kaféet · bildförslag</h2>
          <form method='dialog'>
            <button type='submit' aria-label='Stäng bild'>
              Stäng ×
            </button>
          </form>
        </div>
        <img src={imageUrl} alt={imageDescription} width='1536' height='1024' />
      </dialog>
    </main>
  );
}

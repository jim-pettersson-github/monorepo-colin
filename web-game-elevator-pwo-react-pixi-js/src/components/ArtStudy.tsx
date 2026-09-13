import { useRef, useState } from 'react';
import '../art-study.css';

const studies = [
  {
    file: 'painted-adventure',
    title: 'Målat äventyr',
    influence: 'Modern 90-talsnostalgi',
    description: 'Monkey Island-inspirerat måleri. Varma lampor, djupa färger och trä med karaktär.',
  },
  {
    file: 'illustrated-world',
    title: 'En illustrerad värld',
    influence: 'Nästa steg från dagens stil',
    description: 'Rena former, mjuka skuggor och fler små detaljer. Ljust, lugnt och lätt att läsa.',
  },
  {
    file: 'clay-miniature',
    title: 'En värld av lera',
    influence: 'Den oväntade riktningen',
    description: 'En liten handgjord värld. Taktila material, mjukt ljus och Colin som en lerfigur.',
  },
];
const imageUrl = (file: string) => `${import.meta.env.BASE_URL}art-studies/${file}.webp`;

export function ArtStudy() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const study = studies[selected];

  return (
    <main className='art-study'>
      <header className='art-study-header'>
        <a href={import.meta.env.BASE_URL}>← Till spelet</a>
        <a href={`${import.meta.env.BASE_URL}?view=depth`}>Prova ett rum med djup ↗</a>
        <span>COLINS HISSÄVENTYR · STILPROV</span>
      </header>
      <div className='art-study-intro'>
        <p className='eyebrow'>En pojke. En hiss. Tre uttryck.</p>
        <h1>Tre sätt att se Colin.</h1>
        <p>Jämför känslan, detaljerna och hur tydligt dörren och skyltarna syns. Tryck på en bild för att se den större.</p>
        <p className='art-study-note'>
          Stil 01 är vald och används nu i spelet. Här finns de ursprungliga konceptbilderna. På en liten skärm kan du svepa mellan bilderna.
        </p>
      </div>
      <section className='art-study-grid' aria-label='Tre stilar att jämföra'>
        {studies.map((item, index) => (
          <article className='art-study-card' key={item.file}>
            <div className='art-study-card-heading'>
              <span>0{index + 1}</span>
              <p>{item.influence}</p>
            </div>
            <button
              type='button'
              className='art-study-image'
              aria-label={`Förstora ${item.title}`}
              onClick={() => {
                setSelected(index);
                dialog.current?.showModal();
              }}
            >
              <img
                src={imageUrl(item.file)}
                alt={`Barfota Colin med blondbrunt hår bredvid en hiss, en grön utgångsskylt och ett brandlarm. ${item.title}.`}
                width='1254'
                height='1254'
              />
              <span aria-hidden='true'>↗</span>
            </button>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
      <footer className='art-study-footer'>Samma Colin i alla tre: ungefär åtta år, bruna ögon, blondbrunt hår och bara fötter.</footer>
      <dialog ref={dialog} className='art-study-dialog' aria-labelledby='art-detail-title'>
        <div className='art-study-dialog-heading'>
          <h2 id='art-detail-title'>{study.title}</h2>
          <form method='dialog'>
            <button type='submit' aria-label='Stäng bild'>
              Stäng ×
            </button>
          </form>
        </div>
        <img src={imageUrl(study.file)} alt={`Detaljvy: ${study.title}`} width='1254' height='1254' />
      </dialog>
    </main>
  );
}

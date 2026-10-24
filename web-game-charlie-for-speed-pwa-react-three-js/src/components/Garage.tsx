import { carRatings, cars } from '../game/cars';
import { Showroom } from './Showroom';

type Props = { carId: string; onChange: (carId: string) => void; onBack: () => void; onNext: () => void };

const decimal = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function Rating({ label, value, detail }: { label: string; value: number; detail: string }) {
  const clamped = Math.max(0.08, Math.min(1, value));
  return (
    <div className='rating'>
      <span>{label}</span>
      <span className='rating-bar' aria-hidden='true'>
        <span style={{ width: `${clamped * 100}%` }} />
      </span>
      <span className='rating-detail'>{detail}</span>
    </div>
  );
}

export function Garage({ carId, onChange, onBack, onNext }: Props) {
  const index = Math.max(
    0,
    cars.findIndex((car) => car.id === carId),
  );
  const car = cars[index];
  const ratings = carRatings(car);
  const step = (direction: number) => onChange(cars[(index + direction + cars.length) % cars.length].id);

  return (
    <main className='menu-screen garage'>
      <Showroom carId={car.id} />
      <header className='screen-header'>
        <button type='button' onClick={onBack}>
          ◀ Tillbaka
        </button>
        <h2>Välj bil</h2>
        <span className='counter'>
          {index + 1}/{cars.length}
        </span>
      </header>

      <div className='carousel'>
        <button type='button' className='arrow' aria-label='Föregående bil' onClick={() => step(-1)}>
          ◀
        </button>
        <button type='button' className='arrow' aria-label='Nästa bil' onClick={() => step(1)}>
          ▶
        </button>
      </div>

      <section className='panel car-card' aria-live='polite'>
        <p className='car-make'>{car.make}</p>
        <h3>{car.model}</h3>
        <p className='car-origin'>{car.origin}</p>
        <p className='car-blurb'>{car.blurb}</p>
        <Rating label='Toppfart' value={ratings.speed} detail={`${car.topKmh} km/h`} />
        <Rating label='Acceleration' value={ratings.acceleration} detail={`0–100 ${decimal.format(car.zeroTo100)} s`} />
        <Rating label='Väghållning' value={ratings.handling} detail={`${decimal.format(car.grip)} g`} />
        <Rating label='Bromsar' value={ratings.braking} detail={`${Math.round(Math.min(1, ratings.braking) * 10)}/10`} />
        <button type='button' className='primary' onClick={onNext}>
          Välj bana ▶
        </button>
      </section>
    </main>
  );
}

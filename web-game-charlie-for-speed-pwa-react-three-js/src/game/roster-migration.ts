import type { Career, OwnedCar, Rival } from './career';
import { canonicalCarId, cars, legacyCars, noUpgrades } from './cars';
import type { Session } from './multi-career';

function garage(entries: OwnedCar[]) {
  const result = new Map<string, OwnedCar>();
  for (const entry of entries) {
    const carId = canonicalCarId(entry.carId);
    const previous = result.get(carId);
    result.set(carId, {
      carId,
      upgrades: previous
        ? {
            engine: Math.max(previous.upgrades.engine, entry.upgrades.engine),
            tyres: Math.max(previous.upgrades.tyres, entry.upgrades.tyres),
            brakes: Math.max(previous.upgrades.brakes, entry.upgrades.brakes),
          }
        : { ...entry.upgrades },
    });
  }
  // Some old class C cars now sit in B. Keep starter cups accessible without spending saved money.
  if (entries.some((entry) => entry.carId in legacyCars) && ![...result.keys()].some((id) => cars.find((car) => car.id === id)?.carClass === 'C')) {
    result.set('falcon', { carId: 'falcon', upgrades: { ...noUpgrades } });
  }
  return [...result.values()];
}

function rivals(entries: Rival[]) {
  return entries.map((rival, index) => {
    const picks = { ...rival.cars };
    for (const carClass of ['C', 'B', 'A'] as const) {
      const id = canonicalCarId(picks[carClass]);
      const options = cars.filter((car) => car.carClass === carClass);
      picks[carClass] = options.find((car) => car.id === id)?.id ?? options[index % options.length].id;
    }
    return { ...rival, cars: picks };
  });
}

// Wallets, cup rounds, prizes and upgrades stay intact when the old fictional roster is replaced.
export function migrateCareer(career: Career): Career {
  return { ...career, garage: garage(career.garage), activeCarId: canonicalCarId(career.activeCarId), rivals: rivals(career.rivals) };
}

export function migrateSession(session: Session): Session {
  return {
    ...session,
    members: session.members.map((member) => ({ ...member, garage: garage(member.garage), activeCarId: canonicalCarId(member.activeCarId) })),
    rivals: rivals(session.rivals),
  };
}

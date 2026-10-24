import { applyUpgrades, type CarClass, carById, cars, classOrder, MAX_UPGRADE, noUpgrades, type Upgrades } from './cars';
import type { Entrant, ResultRow } from './race';

export type CupDef = {
  id: string;
  name: string;
  description: string;
  carClass: CarClass;
  tracks: string[];
  laps: number;
  prizes: number[];
  bonus: number;
  requires?: string;
};

export type UpgradePart = keyof Upgrades;
export type OwnedCar = { carId: string; upgrades: Upgrades };
export type Rival = { name: string; money: number; skill: number; cupsWon: number; cars: Record<CarClass, string>; upgrades: Record<CarClass, Upgrades> };
export type RaceRecord = { driverName: string; position: number; points: number; prize: number; isPlayer: boolean };
export type CupRun = { cupId: string; race: number; standings: Record<string, number>; lastRace?: RaceRecord[] };
export type CupSummary = { cupId: string; standings: { driverName: string; points: number; isPlayer: boolean }[]; bonus: number; winner: string };

export type Career = {
  version: 1;
  money: number;
  garage: OwnedCar[];
  activeCarId: string;
  rivals: Rival[];
  cupsWon: string[];
  run?: CupRun;
  lastCup?: CupSummary;
  news: string[];
};

export const PLAYER_NAME = 'Du';
export const START_MONEY = 25000;
export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const BASE_PRIZES = [6000, 4000, 2600, 1800, 1200, 800, 500, 300];
const prizes = (factor: number) => BASE_PRIZES.map((prize) => Math.round((prize * factor) / 100) * 100);
const RIVAL_NAMES = ['Sanna', 'Klaus', 'Lotta', 'Henrik', 'Greta', 'Jürgen', 'Maja'];
const RIVAL_SKILLS = [0.97, 0.955, 0.945, 0.935, 0.925, 0.915, 0.905];
const UPGRADE_PRICES = [4000, 8000, 14000];
const CLASS_PRICE_FACTOR: Record<CarClass, number> = { C: 1, B: 1.8, A: 3 };

export const partNames: Record<UpgradePart, string> = { engine: 'Motor', tyres: 'Däck', brakes: 'Bromsar' };

export const cups: readonly CupDef[] = [
  {
    id: 'klubb',
    name: 'Klubbcupen',
    description: 'Instegscupen för klass C: landsväg, bana och stad.',
    carClass: 'C',
    tracks: ['smaland', 'vaxjo', 'stockholm'],
    laps: 2,
    prizes: prizes(1),
    bonus: 8000,
  },
  {
    id: 'stad',
    name: 'Stadsloppet',
    description: 'Två gatlopp för klass C mellan husfasaderna.',
    carClass: 'C',
    tracks: ['stockholm', 'hamburg'],
    laps: 3,
    prizes: prizes(0.9),
    bonus: 6000,
  },
  {
    id: 'sport',
    name: 'Sportbilscupen',
    description: 'Fyra deltävlingar för klass B och snabbare uppgraderade C-bilar.',
    carClass: 'B',
    tracks: ['hamburg', 'rheinland', 'smaland', 'schwarzwald'],
    laps: 2,
    prizes: prizes(2),
    bonus: 20000,
  },
  {
    id: 'landsvag',
    name: 'Landsvägscupen',
    description: 'Klass B ute på landet: raka vägar, krön och bergspass.',
    carClass: 'B',
    tracks: ['smaland', 'schwarzwald', 'vaxjo'],
    laps: 3,
    prizes: prizes(2.2),
    bonus: 18000,
  },
  {
    id: 'super',
    name: 'Supercupen',
    description: 'Klass A och de snabbaste bilarna. Tre varv per bana.',
    carClass: 'A',
    tracks: ['schwarzwald', 'stockholm', 'rheinland', 'vaxjo'],
    laps: 3,
    prizes: prizes(4),
    bonus: 50000,
  },
  {
    id: 'mastare',
    name: 'Mästarnas mästare',
    description: 'Alla sex banor. Öppnas när du har vunnit Supercupen.',
    carClass: 'A',
    tracks: ['vaxjo', 'rheinland', 'stockholm', 'hamburg', 'smaland', 'schwarzwald'],
    laps: 3,
    prizes: prizes(6),
    bonus: 120000,
    requires: 'super',
  },
];

export function cupById(id: string) {
  return cups.find((cup) => cup.id === id) ?? cups[0];
}

export function upgradeCost(carClass: CarClass, nextLevel: number) {
  return UPGRADE_PRICES[nextLevel - 1] * CLASS_PRICE_FACTOR[carClass];
}

export function newCareer(seed = Date.now()): Career {
  let value = seed % 2147483647 || 1;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
  const pick = (carClass: CarClass) => {
    const options = cars.filter((car) => car.carClass === carClass);
    return options[Math.floor(random() * options.length)].id;
  };
  return {
    version: 1,
    money: START_MONEY,
    garage: [],
    activeCarId: '',
    cupsWon: [],
    news: ['Välkommen! Köp din första bil hos bilhandlaren och anmäl dig till Klubbcupen.'],
    rivals: RIVAL_NAMES.map((name, index) => ({
      name,
      money: 0,
      skill: RIVAL_SKILLS[index],
      cupsWon: 0,
      cars: { C: pick('C'), B: pick('B'), A: pick('A') },
      upgrades: { C: { ...noUpgrades }, B: { ...noUpgrades }, A: { ...noUpgrades } },
    })),
  };
}

export function ownedCar(career: Career, carId = career.activeCarId) {
  return career.garage.find((car) => car.carId === carId);
}

export function buyCar(career: Career, carId: string): Career {
  const car = carById(carId);
  if (ownedCar(career, carId) || career.money < car.price) return career;
  return { ...career, money: career.money - car.price, garage: [...career.garage, { carId, upgrades: { ...noUpgrades } }], activeCarId: carId };
}

export function setActiveCar(career: Career, carId: string): Career {
  return ownedCar(career, carId) ? { ...career, activeCarId: carId } : career;
}

export function buyUpgrade(career: Career, carId: string, part: UpgradePart): Career {
  const owned = ownedCar(career, carId);
  if (!owned || owned.upgrades[part] >= MAX_UPGRADE) return career;
  const cost = upgradeCost(carById(carId).carClass, owned.upgrades[part] + 1);
  if (career.money < cost) return career;
  return {
    ...career,
    money: career.money - cost,
    garage: career.garage.map((car) => (car.carId === carId ? { ...car, upgrades: { ...car.upgrades, [part]: car.upgrades[part] + 1 } } : car)),
  };
}

// Why the active car cannot enter a cup, or undefined when it can.
export function entryProblem(career: Career, cup: CupDef) {
  if (cup.requires && !career.cupsWon.includes(cup.requires)) return `Vinn ${cupById(cup.requires).name} först.`;
  const owned = ownedCar(career);
  if (!owned) return 'Köp en bil först.';
  if (classOrder[carById(owned.carId).carClass] > classOrder[cup.carClass]) return `Kräver en bil i klass ${cup.carClass} eller lägre.`;
  return undefined;
}

export function startCup(career: Career, cupId: string): Career {
  const cup = cupById(cupId);
  if (entryProblem(career, cup)) return career;
  const standings = Object.fromEntries([PLAYER_NAME, ...career.rivals.map((rival) => rival.name)].map((name) => [name, 0]));
  return { ...career, run: { cupId, race: 0, standings }, lastCup: undefined };
}

export function abandonCup(career: Career): Career {
  return { ...career, run: undefined };
}

// The grid for the next race: rivals in this cup's class with their own upgrades, the player sixth.
export function cupField(career: Career): Entrant[] {
  const cup = cupById(career.run?.cupId ?? '');
  const owned = ownedCar(career);
  if (!owned) return [];
  const rivals: Entrant[] = career.rivals.map((rival) => ({
    driverName: rival.name,
    spec: applyUpgrades(carById(rival.cars[cup.carClass]), rival.upgrades[cup.carClass]),
    skill: rival.skill,
  }));
  const player: Entrant = { driverName: PLAYER_NAME, spec: applyUpgrades(carById(owned.carId), owned.upgrades), skill: 1, isPlayer: true };
  return [...rivals.slice(0, 5), player, ...rivals.slice(5)];
}

export function currentTrack(career: Career) {
  const run = career.run;
  return run ? cupById(run.cupId).tracks[run.race] : undefined;
}

// Rivals buy the cheapest upgrades they can afford for the class they just raced.
export function rivalShopping(rival: Rival, carClass: CarClass, news: string[]) {
  const upgrades = { ...rival.upgrades[carClass] };
  let money = rival.money;
  for (;;) {
    const options = (Object.keys(upgrades) as UpgradePart[])
      .filter((part) => upgrades[part] < MAX_UPGRADE)
      .map((part) => ({ part, cost: upgradeCost(carClass, upgrades[part] + 1) }))
      .sort((a, b) => a.cost - b.cost);
    const choice = options[0];
    if (!choice || choice.cost > money) break;
    money -= choice.cost;
    upgrades[choice.part]++;
    news.push(`${rival.name} uppgraderade ${partNames[choice.part].toLowerCase()} till steg ${upgrades[choice.part]}.`);
  }
  return { ...rival, money, upgrades: { ...rival.upgrades, [carClass]: upgrades } };
}

function finishCup(career: Career, run: CupRun): Career {
  const cup = cupById(run.cupId);
  const standings = Object.entries(run.standings)
    .map(([driverName, points]) => ({ driverName, points, isPlayer: driverName === PLAYER_NAME }))
    .sort((a, b) => b.points - a.points);
  const winner = standings[0].driverName;
  const playerWon = winner === PLAYER_NAME;
  const news: string[] = [playerWon ? `Du vann ${cup.name} och fick ${formatMoney(cup.bonus)} i bonus!` : `${winner} vann ${cup.name}.`];
  const rivals = career.rivals
    .map((rival) => (rival.name === winner ? { ...rival, money: rival.money + cup.bonus, cupsWon: rival.cupsWon + 1 } : rival))
    .map((rival) => rivalShopping(rival, cup.carClass, news));
  return {
    ...career,
    money: career.money + (playerWon ? cup.bonus : 0),
    cupsWon: playerWon && !career.cupsWon.includes(cup.id) ? [...career.cupsWon, cup.id] : career.cupsWon,
    rivals,
    run: undefined,
    lastCup: { cupId: cup.id, standings, bonus: playerWon ? cup.bonus : 0, winner },
    news,
  };
}

export function recordRace(career: Career, rows: ResultRow[]): Career {
  const run = career.run;
  if (!run) return career;
  const cup = cupById(run.cupId);
  const records: RaceRecord[] = rows.map((row) => ({
    driverName: row.driverName,
    position: row.position,
    points: POINTS[row.position - 1] ?? 0,
    prize: cup.prizes[row.position - 1] ?? 0,
    isPlayer: row.isPlayer,
  }));
  const standings = { ...run.standings };
  for (const record of records) standings[record.driverName] = (standings[record.driverName] ?? 0) + record.points;
  const playerPrize = records.find((record) => record.isPlayer)?.prize ?? 0;
  const rivals = career.rivals.map((rival) => ({ ...rival, money: rival.money + (records.find((record) => record.driverName === rival.name)?.prize ?? 0) }));
  const next: Career = { ...career, money: career.money + playerPrize, rivals, run: { ...run, race: run.race + 1, standings, lastRace: records } };
  return run.race + 1 >= cup.tracks.length ? finishCup(next, { ...run, race: run.race + 1, standings, lastRace: records }) : next;
}

const money = new Intl.NumberFormat('sv-SE');

export function formatMoney(amount: number) {
  return `${money.format(amount)} kr`;
}

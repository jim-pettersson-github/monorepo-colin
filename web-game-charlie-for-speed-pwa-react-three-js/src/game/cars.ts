import { onlineTrims } from './online-trims';

// The 19 PC racer cars from the supplied NFS III reference. Ratings are on its 0–20 scale.
export type CarClass = 'C' | 'B' | 'A';
export type ReferenceRatings = { acceleration: number; speed: number; braking: number; handling: number };
export type EngineCharacter = 'compact' | 'six' | 'muscle' | 'exotic';
export type CarSpec = {
  id: string;
  carClass: CarClass;
  price: number;
  make: string;
  model: string;
  origin: string;
  blurb: string;
  color: string;
  trim: string;
  stripe?: string;
  topKmh: number;
  zeroTo100: number;
  grip: number;
  braking: number;
  length: number;
  width: number;
  ratings: ReferenceRatings;
  engine: EngineCharacter;
  downforce: number;
};

export const rosterSource = 'https://nfs.fandom.com/wiki/Need_for_Speed_III:_Hot_Pursuit/Cars_(PC)';
const definitions: Omit<CarSpec, 'topKmh' | 'zeroTo100' | 'grip' | 'braking' | 'downforce'>[] = [
  {
    id: 'falcon',
    carClass: 'C',
    price: 18000,
    make: 'Ford',
    model: 'Falcon GT',
    origin: 'Australien',
    blurb: 'En stor fyrdörrars GT med tydlig vinge och trygg balans.',
    color: '#8b1832',
    trim: '#202127',
    length: 4.91,
    width: 1.87,
    ratings: { acceleration: 8, speed: 9, braking: 9, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'db7',
    carClass: 'C',
    price: 20000,
    make: 'Aston Martin',
    model: 'DB7',
    origin: 'England',
    blurb: 'Lång motorhuv, mjuka former och ett lågt, ovalt luftintag.',
    color: '#98a5ad',
    trim: '#22282b',
    length: 4.65,
    width: 1.83,
    ratings: { acceleration: 9, speed: 8, braking: 6, handling: 8 },
    engine: 'six',
  },
  {
    id: 'hsvgts',
    carClass: 'C',
    price: 22000,
    make: 'HSV',
    model: 'VT GTS',
    origin: 'Australien',
    blurb: 'En bred australisk V8-sedan med fyra dörrar och stor bakvinge.',
    color: '#752a44',
    trim: '#1b2025',
    length: 4.94,
    width: 1.84,
    ratings: { acceleration: 10, speed: 9, braking: 13, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'xk8',
    carClass: 'C',
    price: 24000,
    make: 'Jaguar',
    model: 'XK8',
    origin: 'England',
    blurb: 'Rundad grön GT med lång huv och sluttande tak.',
    color: '#123f31',
    trim: '#c4c9c6',
    length: 4.76,
    width: 1.83,
    ratings: { acceleration: 9, speed: 12, braking: 11, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'xkr',
    carClass: 'C',
    price: 26000,
    make: 'Jaguar',
    model: 'XKR',
    origin: 'England',
    blurb: 'XK-familjens sportigare coupé, med huvventiler och mörk grill.',
    color: '#9c202c',
    trim: '#24272a',
    length: 4.76,
    width: 1.83,
    ratings: { acceleration: 9, speed: 10, braking: 10, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'sl600',
    carClass: 'C',
    price: 27000,
    make: 'Mercedes-Benz',
    model: 'SL600',
    origin: 'Tyskland',
    blurb: 'En kantig roadster med öppet tak, lång huv och raka sidolinjer.',
    color: '#c2c6c9',
    trim: '#41464d',
    length: 4.5,
    width: 1.81,
    ratings: { acceleration: 10, speed: 11, braking: 13, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'countach',
    carClass: 'C',
    price: 28000,
    make: 'Lamborghini',
    model: 'Countach',
    origin: 'Italien',
    blurb: 'Åttiotalets skarpa kil: luftboxar, saxformade intag och V-vinge.',
    color: '#e5e8ea',
    trim: '#19191d',
    length: 4.14,
    width: 2,
    ratings: { acceleration: 13, speed: 9, braking: 12, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'indy98',
    carClass: 'B',
    price: 52000,
    make: 'Chevrolet',
    model: "'98 Indy 500 Pace Car",
    origin: 'USA',
    blurb: 'Öppen Corvette i lila och gult, med Indy-dekor och gula hjul.',
    color: '#392466',
    trim: '#e9c82b',
    stripe: '#edce26',
    length: 4.56,
    width: 1.87,
    ratings: { acceleration: 12, speed: 11, braking: 12, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'corvette',
    carClass: 'B',
    price: 54000,
    make: 'Chevrolet',
    model: 'Corvette',
    origin: 'USA',
    blurb: 'Låg C5-coupé med uppfällbara framlyktor och fyra runda bakljus.',
    color: '#d11e29',
    trim: '#191c21',
    length: 4.56,
    width: 1.87,
    ratings: { acceleration: 12, speed: 11, braking: 12, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'spectre',
    carClass: 'B',
    price: 56000,
    make: 'Spectre',
    model: 'R42',
    origin: 'England',
    blurb: 'En kompakt mittmotorbil med breda bakskärmar och låg, mjuk nos.',
    color: '#aa1d36',
    trim: '#19191e',
    length: 4.32,
    width: 1.86,
    ratings: { acceleration: 12, speed: 10, braking: 14, handling: 8 },
    engine: 'muscle',
  },
  {
    id: 'f355',
    carClass: 'B',
    price: 60000,
    make: 'Ferrari',
    model: '355 F1 Spider',
    origin: 'Italien',
    blurb: 'En röd, öppen mittmotorbil med två stolar och fyra runda bakljus.',
    color: '#ce1523',
    trim: '#18191d',
    length: 4.25,
    width: 1.9,
    ratings: { acceleration: 13, speed: 12, braking: 12, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'f456',
    carClass: 'B',
    price: 64000,
    make: 'Ferrari',
    model: '456 M GT',
    origin: 'Italien',
    blurb: 'En lång, elegant fyrsitsig GT med dold belysning och mjukt sluttande bakruta.',
    color: '#aab1b8',
    trim: '#1b1c20',
    length: 4.73,
    width: 1.92,
    ratings: { acceleration: 14, speed: 12, braking: 12, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'scighera',
    carClass: 'B',
    price: 72000,
    make: 'Italdesign',
    model: 'Scighera',
    origin: 'Italien',
    blurb: 'Silverfärgad konceptbil med välvd glashuv och skulpterade skuldror.',
    color: '#aeb5bd',
    trim: '#25262b',
    length: 4.32,
    width: 1.98,
    ratings: { acceleration: 15, speed: 13, braking: 15, handling: 8 },
    engine: 'six',
  },
  {
    id: 'elnino',
    carClass: 'A',
    price: 120000,
    make: '',
    model: 'El Niño',
    origin: 'Konceptbil',
    blurb: 'Mörk, extremt låg konceptbil. Snabbast från start, men kort utväxling.',
    color: '#16413f',
    trim: '#171b22',
    length: 4.47,
    width: 2,
    ratings: { acceleration: 20, speed: 8, braking: 17, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'f550',
    carClass: 'A',
    price: 135000,
    make: 'Ferrari',
    model: '550 Maranello',
    origin: 'Italien',
    blurb: 'Lång V12-huv, låg kupé och rund bakdel. En snabb italiensk GT.',
    color: '#aeb4bb',
    trim: '#1b1c21',
    length: 4.55,
    width: 1.94,
    ratings: { acceleration: 16, speed: 15, braking: 15, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'diablo',
    carClass: 'A',
    price: 150000,
    make: 'Lamborghini',
    model: 'Diablo SV',
    origin: 'Italien',
    blurb: 'En bred gul kil med stora sidointag, dubbla luftintag och hög vinge.',
    color: '#ebc42a',
    trim: '#1c1b21',
    length: 4.46,
    width: 2.04,
    ratings: { acceleration: 17, speed: 13, braking: 15, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'xjr15',
    carClass: 'A',
    price: 175000,
    make: 'Jaguar',
    model: 'XJR-15',
    origin: 'England',
    blurb: 'Låg blå långloppsbil med smal kupé, djup front och bred bakvinge.',
    color: '#173776',
    trim: '#1b1e27',
    length: 4.8,
    width: 1.89,
    ratings: { acceleration: 15, speed: 20, braking: 18, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'storm',
    carClass: 'A',
    price: 195000,
    make: 'Lister',
    model: 'Storm',
    origin: 'England',
    blurb: 'En mörk brittisk GT med lång nos, kantiga skuldror och tydlig tävlingsvinge.',
    color: '#183848',
    trim: '#14191f',
    length: 4.6,
    width: 1.98,
    ratings: { acceleration: 17, speed: 17, braking: 20, handling: 8 },
    engine: 'exotic',
  },
  {
    id: 'clkgtr',
    carClass: 'A',
    price: 220000,
    make: 'Mercedes-Benz',
    model: 'CLK-GTR',
    origin: 'Tyskland',
    blurb: 'Silverfärgad långloppsbil med låg mittnos, takintag och stor bakvinge.',
    color: '#c7cbd0',
    trim: '#191c24',
    length: 4.86,
    width: 1.95,
    ratings: { acceleration: 16, speed: 20, braking: 20, handling: 8 },
    engine: 'exotic',
  },
];

// These are arcade values derived from the reference ratings, rather than real-world specifications.
export const cars: readonly CarSpec[] = definitions.map((car) => ({
  ...car,
  topKmh: Math.round(220 + car.ratings.speed * 6.25),
  zeroTo100: 8.4 - car.ratings.acceleration * 0.25,
  grip: 1.3,
  braking: 0.95 + car.ratings.braking * 0.027,
  downforce: { C: 0.06, B: 0.14, A: 0.24 }[car.carClass],
}));

export const legacyCars: Record<string, string> = {
  arrow: 'spectre',
  nxr: 'hsvgts',
  sting: 'corvette',
  xk: 'xk8',
  dbs: 'db7',
  velox: 'xkr',
  volata: 'f355',
  stallion: 'f456',
  corsa: 'f550',
  contaccio: 'countach',
  furia: 'diablo',
  tempest: 'storm',
  clr: 'clkgtr',
  skarv: 'elnino',
};
export const canonicalCarId = (id: string) => legacyCars[id] ?? id;
export function carById(id: string) {
  return cars.find((car) => car.id === canonicalCarId(id)) ?? cars[0];
}
export function carName(car: CarSpec) {
  return `${car.make} ${car.model}`.trim();
}

// One shared online range across C, B and A. Small rating differences keep each car's character.
export const arcadeTrim = onlineTrims;
export function arcadeSpec(car: CarSpec, trims: Record<string, number> = arcadeTrim): CarSpec {
  const mix = (value: number, baseline: number) => baseline + (value - baseline) * 0.1;
  const trim = trims[car.id] ?? 1;
  return {
    ...car,
    topKmh: mix(car.topKmh, 300) * trim,
    zeroTo100: mix(car.zeroTo100, 4.8) / trim,
    grip: mix(car.grip, 1.3),
    braking: mix(car.braking, 1.3),
    downforce: 0.14,
  };
}
export function carRatings(car: CarSpec) {
  return { speed: car.ratings.speed / 20, acceleration: car.ratings.acceleration / 20, handling: car.ratings.handling / 20, braking: car.ratings.braking / 20 };
}
export const classOrder: Record<CarClass, number> = { C: 0, B: 1, A: 2 };
export type Upgrades = { engine: number; tyres: number; brakes: number };
export const noUpgrades: Upgrades = { engine: 0, tyres: 0, brakes: 0 };
export const MAX_UPGRADE = 3;
export function applyUpgrades(car: CarSpec, upgrades: Upgrades): CarSpec {
  return {
    ...car,
    topKmh: Math.round(car.topKmh * (1 + upgrades.engine * 0.04)),
    zeroTo100: car.zeroTo100 * (1 - upgrades.engine * 0.06),
    grip: car.grip + upgrades.tyres * 0.05,
    braking: car.braking + upgrades.brakes * 0.08,
  };
}

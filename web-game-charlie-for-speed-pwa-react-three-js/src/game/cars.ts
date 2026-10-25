// Fictional lookalikes of 1980s and 1990s supercars. Body shapes live in render/car-designs.ts.
export type CarClass = 'C' | 'B' | 'A';

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
  // Lateral grip in g on dry asphalt.
  grip: number;
  braking: number;
  length: number;
  width: number;
};

export const cars: readonly CarSpec[] = [
  {
    id: 'arrow',
    carClass: 'C',
    price: 18000,
    make: 'Lynx',
    model: 'Arrow',
    origin: 'England',
    blurb: 'Lätt och spetsig kil från en liten fabrik. Svänger blixtsnabbt.',
    color: '#2a6fd6',
    trim: '#f2f2f2',
    topKmh: 255,
    zeroTo100: 5.5,
    grip: 1.24,
    braking: 1.15,
    length: 4.37,
    width: 1.86,
  },
  {
    id: 'nxr',
    carClass: 'C',
    price: 21000,
    make: 'Kaida',
    model: 'NX-R',
    origin: 'Japan',
    blurb: 'Mittmotor med svart tak. Inte snabbast, men greppar som om den sitter på räls.',
    color: '#e8eaec',
    trim: '#111214',
    topKmh: 262,
    zeroTo100: 5.4,
    grip: 1.26,
    braking: 1.17,
    length: 4.4,
    width: 1.81,
  },
  {
    id: 'sting',
    carClass: 'C',
    price: 22000,
    make: 'Vanguard',
    model: 'Sting C5',
    origin: 'USA',
    blurb: 'Amerikansk sportbil med uppfällbara strålkastare och mjuk gång. Trygg att börja med.',
    color: '#0f8f8a',
    trim: '#14181c',
    topKmh: 262,
    zeroTo100: 5.4,
    grip: 1.18,
    braking: 1.1,
    length: 4.56,
    width: 1.87,
  },
  {
    id: 'xk',
    carClass: 'C',
    price: 24000,
    make: 'Albion',
    model: 'XK Coupé',
    origin: 'England',
    blurb: 'Rundad brittisk skönhet i racinggrönt. Stabil och följsam i snabba svep.',
    color: '#14532d',
    trim: '#c9b98f',
    topKmh: 258,
    zeroTo100: 5.6,
    grip: 1.14,
    braking: 1.05,
    length: 4.76,
    width: 1.83,
  },
  {
    id: 'dbs',
    carClass: 'C',
    price: 26000,
    make: 'Ashcombe',
    model: 'DB-S',
    origin: 'England',
    blurb: 'Elegant brittisk GT i stålblått. Lång huv, mjuka linjer och fin balans.',
    color: '#4a6d8c',
    trim: '#1a1c20',
    topKmh: 264,
    zeroTo100: 5.3,
    grip: 1.16,
    braking: 1.07,
    length: 4.65,
    width: 1.83,
  },
  {
    id: 'velox',
    carClass: 'B',
    price: 52000,
    make: 'Pardo',
    model: 'Velox Turbo',
    origin: 'Tyskland',
    blurb: 'Bakmotor, runda lampor och valfena. Lätt att kasta in i kurvorna.',
    color: '#dfe3e6',
    trim: '#20242a',
    topKmh: 292,
    zeroTo100: 4.4,
    grip: 1.34,
    braking: 1.25,
    length: 4.25,
    width: 1.8,
  },
  {
    id: 'volata',
    carClass: 'B',
    price: 58000,
    make: 'Ferro',
    model: 'Volata 355',
    origin: 'Italien',
    blurb: 'Rödlackerad mittmotor med uppfällbara lampor. Lätt, kvick och sjunger mot varvtaket.',
    color: '#d4141c',
    trim: '#1a1a1a',
    topKmh: 290,
    zeroTo100: 4.6,
    grip: 1.36,
    braking: 1.24,
    length: 4.25,
    width: 1.9,
  },
  {
    id: 'stallion',
    carClass: 'B',
    price: 62000,
    make: 'Stallion',
    model: 'GTS',
    origin: 'USA',
    blurb: 'Lång motorhuv, V10 och vita ränder. Dubbelbubbla på taket och drar som ett tåg.',
    color: '#1f4fd1',
    trim: '#101418',
    stripe: '#f4f4f4',
    topKmh: 298,
    zeroTo100: 4.3,
    grip: 1.22,
    braking: 1.1,
    length: 4.49,
    width: 1.92,
  },
  {
    id: 'corsa',
    carClass: 'B',
    price: 68000,
    make: 'Ferro',
    model: 'Corsa 550',
    origin: 'Italien',
    blurb: 'Frontmotor, lång huv och tolv cylindrar. En gentleman som springer fort på raksträckorna.',
    color: '#a9afb6',
    trim: '#1a1a1a',
    topKmh: 302,
    zeroTo100: 4.4,
    grip: 1.28,
    braking: 1.2,
    length: 4.55,
    width: 1.94,
  },
  {
    id: 'contaccio',
    carClass: 'A',
    price: 120000,
    make: 'Torrone',
    model: 'Contaccio',
    origin: 'Italien',
    blurb: 'Affischbilen från 80-talet: en knivskarp kil med luftboxar, NACA-intag och V-vinge.',
    color: '#d0141e',
    trim: '#141416',
    topKmh: 306,
    zeroTo100: 4.3,
    grip: 1.42,
    braking: 1.28,
    length: 4.14,
    width: 2.0,
  },
  {
    id: 'furia',
    carClass: 'A',
    price: 165000,
    make: 'Torrone',
    model: 'Furia SV',
    origin: 'Italien',
    blurb: 'Contaccios efterträdare. Gul, bred och brutal med V12 och fyrhjulsdrift i själen.',
    color: '#f2c400',
    trim: '#16161a',
    topKmh: 325,
    zeroTo100: 3.9,
    grip: 1.44,
    braking: 1.3,
    length: 4.46,
    width: 2.04,
  },
  {
    id: 'tempest',
    carClass: 'A',
    price: 185000,
    make: 'Lyster',
    model: 'Tempest GT',
    origin: 'England',
    blurb: 'Brittisk GT-racer med V12, splitter och vinge. Vit och grön som på banan.',
    color: '#f2f2ee',
    trim: '#141414',
    stripe: '#1f8a3c',
    topKmh: 322,
    zeroTo100: 3.9,
    grip: 1.5,
    braking: 1.4,
    length: 4.5,
    width: 1.98,
  },
  {
    id: 'clr',
    carClass: 'A',
    price: 220000,
    make: 'Hessen',
    model: 'CL-R',
    origin: 'Tyskland',
    blurb: 'En silverpil byggd för långlopp, med takintag och stor vinge. Enormt grepp i fart.',
    color: '#c7ccd2',
    trim: '#15171a',
    topKmh: 334,
    zeroTo100: 3.6,
    grip: 1.52,
    braking: 1.42,
    length: 4.86,
    width: 1.95,
  },
  {
    id: 'skarv',
    carClass: 'A',
    price: 240000,
    make: 'Koenig',
    model: 'Skarv',
    origin: 'Sverige',
    blurb: 'Svensk hyperbil i orange. Snabbast av alla, men kräver en lugn hand.',
    color: '#ff6a13',
    trim: '#141414',
    topKmh: 345,
    zeroTo100: 3.4,
    grip: 1.46,
    braking: 1.35,
    length: 4.4,
    width: 2.0,
  },
];

export function carById(id: string) {
  return cars.find((car) => car.id === id) ?? cars[0];
}

export function carName(car: CarSpec) {
  return `${car.make} ${car.model}`;
}

// Online races are arcade-balanced: each car moves most of the way to its class average, keeping a hint of its
// character, and a measured trim on engine power evens out what remains. Career keeps the full spec sheet.
const ARCADE_BLEND = 0.75;
// From a simulated tuning run over all six tracks (same AI driver for every car); re-run it after changing car stats.
export const arcadeTrim: Record<string, number> = {
  arrow: 0.996,
  nxr: 0.987,
  sting: 1,
  xk: 1.016,
  dbs: 1.002,
  velox: 0.993,
  volata: 0.996,
  stallion: 1.01,
  corsa: 1.001,
  contaccio: 1.031,
  furia: 1.012,
  tempest: 0.995,
  clr: 0.978,
  skarv: 0.984,
};

export function arcadeSpec(car: CarSpec, trims: Record<string, number> = arcadeTrim): CarSpec {
  const peers = cars.filter((other) => other.carClass === car.carClass);
  const mix = (key: 'topKmh' | 'zeroTo100' | 'grip' | 'braking') => {
    const mean = peers.reduce((sum, other) => sum + other[key], 0) / peers.length;
    return car[key] + (mean - car[key]) * ARCADE_BLEND;
  };
  const trim = trims[car.id] ?? 1;
  return { ...car, topKmh: Math.round(mix('topKmh') * trim), zeroTo100: mix('zeroTo100') / trim, grip: mix('grip'), braking: mix('braking') };
}

// Normalised 0–1 ratings for the selection screen.
export function carRatings(car: CarSpec) {
  return {
    speed: (car.topKmh - 240) / 110,
    acceleration: (6 - car.zeroTo100) / 2.8,
    handling: Math.min(1, (car.grip - 1.05) / 0.55),
    braking: Math.min(1, (car.braking - 0.95) / 0.55),
  };
}

export const classOrder: Record<CarClass, number> = { C: 0, B: 1, A: 2 };

export type Upgrades = { engine: number; tyres: number; brakes: number };

export const noUpgrades: Upgrades = { engine: 0, tyres: 0, brakes: 0 };

export const MAX_UPGRADE = 3;

// Each engine step adds 4 % top speed and cuts 6 % off 0–100; tyres and brakes add grip and stopping power.
export function applyUpgrades(car: CarSpec, upgrades: Upgrades): CarSpec {
  return {
    ...car,
    topKmh: Math.round(car.topKmh * (1 + upgrades.engine * 0.04)),
    zeroTo100: car.zeroTo100 * (1 - upgrades.engine * 0.06),
    grip: car.grip + upgrades.tyres * 0.05,
    braking: car.braking + upgrades.brakes * 0.08,
  };
}

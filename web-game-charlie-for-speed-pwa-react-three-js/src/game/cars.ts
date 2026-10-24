export type BodyStyle = 'rear' | 'mid' | 'wedge' | 'front' | 'gt1';

export type CarSpec = {
  id: string;
  make: string;
  model: string;
  origin: string;
  blurb: string;
  style: BodyStyle;
  color: string;
  trim: string;
  stripe?: string;
  wing?: boolean;
  popups?: boolean;
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
    id: 'velox',
    make: 'Pardo',
    model: 'Velox RS',
    origin: 'Tyskland',
    blurb: 'Bakmotor, runda lampor och en kaxig bakvinge. Lätt att kasta in i kurvorna.',
    style: 'rear',
    color: '#dfe3e6',
    trim: '#20242a',
    wing: true,
    topKmh: 295,
    zeroTo100: 4.0,
    grip: 1.28,
    braking: 1.15,
    length: 4.3,
    width: 1.85,
  },
  {
    id: 'corsa',
    make: 'Ferro',
    model: 'Corsa 550',
    origin: 'Italien',
    blurb: 'Mittmotor och tolv cylindrar. Klassiskt rött och väldigt snabb på raksträckorna.',
    style: 'mid',
    color: '#d4141c',
    trim: '#1a1a1a',
    topKmh: 320,
    zeroTo100: 3.8,
    grip: 1.24,
    braking: 1.1,
    length: 4.5,
    width: 1.98,
  },
  {
    id: 'furia',
    make: 'Torrone',
    model: 'Furia',
    origin: 'Italien',
    blurb: 'En gul kil med saxdörrar. Brutal fart men lite tung att svänga.',
    style: 'wedge',
    color: '#f2c400',
    trim: '#16161a',
    wing: true,
    popups: true,
    topKmh: 328,
    zeroTo100: 3.9,
    grip: 1.18,
    braking: 1.05,
    length: 4.5,
    width: 2.04,
  },
  {
    id: 'stallion',
    make: 'Stallion',
    model: 'GTS',
    origin: 'USA',
    blurb: 'Lång motorhuv, V10 och vita ränder. Drar som ett tåg ur kurvorna.',
    style: 'front',
    color: '#1f4fd1',
    trim: '#101418',
    stripe: '#f4f4f4',
    topKmh: 305,
    zeroTo100: 3.9,
    grip: 1.15,
    braking: 1.0,
    length: 4.5,
    width: 1.95,
  },
  {
    id: 'sting',
    make: 'Vanguard',
    model: 'Sting',
    origin: 'USA',
    blurb: 'Uppfällbara strålkastare och mjuk gång. En trygg bil att börja med.',
    style: 'front',
    color: '#0f8f8a',
    trim: '#14181c',
    popups: true,
    topKmh: 282,
    zeroTo100: 4.5,
    grip: 1.22,
    braking: 1.1,
    length: 4.5,
    width: 1.9,
  },
  {
    id: 'nxr',
    make: 'Kaida',
    model: 'NX-R',
    origin: 'Japan',
    blurb: 'Mittmotor med svart tak. Inte snabbast, men greppar som om den sitter på räls.',
    style: 'mid',
    color: '#e8eaec',
    trim: '#111214',
    popups: true,
    topKmh: 276,
    zeroTo100: 4.6,
    grip: 1.36,
    braking: 1.2,
    length: 4.4,
    width: 1.81,
  },
  {
    id: 'gt12',
    make: 'Albion',
    model: 'GT12',
    origin: 'England',
    blurb: 'Brittisk grön gentlemannabil med kraft. Stabil i höga farter.',
    style: 'front',
    color: '#14532d',
    trim: '#c9b98f',
    topKmh: 316,
    zeroTo100: 4.2,
    grip: 1.2,
    braking: 1.08,
    length: 4.7,
    width: 1.92,
  },
  {
    id: 'arrow',
    make: 'Lynx',
    model: 'Arrow',
    origin: 'England',
    blurb: 'Lätt och spetsig kil från en liten fabrik. Svänger blixtsnabbt.',
    style: 'wedge',
    color: '#2a6fd6',
    trim: '#f2f2f2',
    popups: true,
    topKmh: 272,
    zeroTo100: 4.7,
    grip: 1.34,
    braking: 1.2,
    length: 4.3,
    width: 1.86,
  },
  {
    id: 'clr',
    make: 'Hessen',
    model: 'CL-R',
    origin: 'Tyskland',
    blurb: 'En silverpil byggd för långlopp. Stor vinge och enormt grepp i fart.',
    style: 'gt1',
    color: '#c7ccd2',
    trim: '#15171a',
    wing: true,
    topKmh: 334,
    zeroTo100: 3.7,
    grip: 1.3,
    braking: 1.2,
    length: 4.8,
    width: 2.0,
  },
  {
    id: 'skarv',
    make: 'Koenig',
    model: 'Skarv',
    origin: 'Sverige',
    blurb: 'Svensk hyperbil i orange. Snabbast av alla, men kräver en lugn hand.',
    style: 'gt1',
    color: '#ff6a13',
    trim: '#141414',
    topKmh: 345,
    zeroTo100: 3.4,
    grip: 1.22,
    braking: 1.15,
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

// Normalised 0–1 ratings for the selection screen.
export function carRatings(car: CarSpec) {
  return {
    speed: (car.topKmh - 250) / 100,
    acceleration: (5.2 - car.zeroTo100) / 2,
    handling: (car.grip - 1.05) / 0.35,
    braking: (car.braking - 0.9) / 0.35,
  };
}

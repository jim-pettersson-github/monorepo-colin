import { buildTrackPath, type ControlPoint, sampleAt, type TrackPath } from './track-path';

export type TrackTheme = 'vaxjo' | 'germany' | 'stockholm' | 'hamburg' | 'smaland' | 'schwarzwald';
export type TrackSetting = 'circuit' | 'city' | 'country';
export type Region = 'sweden' | 'germany';

export type TrackDef = {
  id: string;
  name: string;
  place: string;
  description: string;
  theme: TrackTheme;
  setting: TrackSetting;
  region: Region;
  points: readonly ControlPoint[];
  halfWidth: number;
  // Lateral distance from the centre line to the barriers.
  wall: number;
  tunnelName: string;
  lake?: { x: number; z: number; rx: number; rz: number };
  hills?: { x: number; z: number; radius: number; height: number }[];
};

export type Track = TrackDef & { path: TrackPath; racingLine: Float32Array; tunnel: { start: number; end: number } };

const vaxjoPoints: ControlPoint[] = [
  [0, 0, 0],
  [200, 0, 0],
  [380, 0, 1],
  [500, 40, 3],
  [560, 140, 6],
  [540, 260, 9],
  [450, 330, 11],
  [330, 330, 10],
  [240, 270, 8],
  [140, 300, 7],
  [80, 400, 9],
  [-20, 470, 12],
  [-160, 470, 14],
  [-280, 400, 12],
  [-300, 290, 9],
  [-220, 220, 7],
  [-250, 130, 4],
  [-330, 70, 2],
  [-300, 0, 0],
  [-160, 0, 0],
];

const germanyPoints: ControlPoint[] = [
  [0, 0, 0],
  [300, 0, 0],
  [600, 0, 0],
  [740, 20, 0],
  [790, 110, 1],
  [720, 190, 2],
  [560, 200, 3],
  [450, 260, 4],
  [460, 380, 6],
  [560, 450, 7],
  [560, 560, 8],
  [440, 600, 8],
  [330, 520, 6],
  [200, 470, 5],
  [60, 520, 6],
  [-60, 560, 7],
  [-170, 500, 5],
  [-150, 380, 3],
  [-250, 300, 2],
  [-380, 300, 2],
  [-460, 220, 1],
  [-420, 90, 0],
  [-300, 10, 0],
  [-150, 0, 0],
];

const stockholmPoints: ControlPoint[] = [
  [0, 0, 0],
  [180, 0, 0],
  [330, 0, 0],
  [375, 25, 0],
  [385, 110, 1],
  [385, 210, 2],
  [360, 255, 2],
  [270, 262, 2],
  [170, 268, 2],
  [128, 295, 2],
  [120, 375, 3],
  [90, 418, 3],
  [0, 425, 3],
  [-110, 422, 3],
  [-152, 392, 2],
  [-160, 300, 2],
  [-158, 200, 1],
  [-175, 115, 0],
  [-205, 70, 0],
  [-200, 20, 0],
  [-150, 0, 0],
];

const hamburgPoints: ControlPoint[] = [
  [0, 0, 0],
  [250, 0, 0],
  [480, 0, 0],
  [525, 30, 0],
  [530, 120, 0],
  [500, 160, 0],
  [400, 165, 0],
  [360, 195, 0],
  [355, 290, 0],
  [320, 330, 0],
  [200, 335, 0],
  [80, 340, 0],
  [40, 300, 0],
  [30, 220, 0],
  [-10, 180, 0],
  [-120, 175, 0],
  [-160, 140, 0],
  [-165, 50, 0],
  [-130, 5, 0],
];

const smalandPoints: ControlPoint[] = [
  [0, 0, 0],
  [220, -20, 2],
  [420, 10, 6],
  [560, 100, 10],
  [600, 260, 14],
  [520, 400, 12],
  [380, 470, 8],
  [240, 560, 10],
  [80, 600, 14],
  [-80, 560, 16],
  [-180, 440, 12],
  [-160, 300, 8],
  [-260, 200, 6],
  [-400, 160, 4],
  [-470, 40, 3],
  [-380, -60, 2],
  [-200, -50, 1],
];

const schwarzwaldPoints: ControlPoint[] = [
  [0, 0, 0],
  [200, 30, 6],
  [360, 120, 14],
  [420, 260, 22],
  [330, 340, 28],
  [240, 280, 30],
  [170, 360, 34],
  [250, 470, 40],
  [400, 520, 44],
  [520, 620, 46],
  [440, 740, 44],
  [260, 760, 38],
  [100, 700, 32],
  [-40, 760, 28],
  [-200, 700, 22],
  [-240, 560, 18],
  [-130, 470, 16],
  [-230, 360, 12],
  [-320, 230, 8],
  [-260, 100, 4],
  [-130, 20, 1],
];

const scaled = (points: ControlPoint[], factor: number) => points.map(([x, z, y]) => [x * factor, z * factor, y] as const);

export const trackDefs: readonly TrackDef[] = [
  {
    id: 'vaxjo',
    name: 'Växjö Motorring',
    place: 'Växjö, Sverige',
    description: 'Böljande bana genom småländsk skog, förbi sjön och de röda stugorna. Kvällssol och snabba svep.',
    theme: 'vaxjo',
    setting: 'circuit',
    region: 'sweden',
    points: scaled(vaxjoPoints, 1.2),
    halfWidth: 7,
    wall: 13,
    tunnelName: 'SKOGSTUNNELN',
    lake: { x: 380, z: 175, rx: 120, rz: 78 },
    hills: [{ x: -520, z: 760, radius: 220, height: 40 }],
  },
  {
    id: 'rheinland',
    name: 'Rheinland-Ring',
    place: 'Rheinland, Tyskland',
    description: 'Lång huvudraka, tekniska kurvor och borgen på kullen. Läktare, broar och full fart.',
    theme: 'germany',
    setting: 'circuit',
    region: 'germany',
    points: germanyPoints,
    halfWidth: 7.5,
    wall: 13.5,
    tunnelName: 'BURGTUNNEL',
    hills: [{ x: 180, z: 860, radius: 190, height: 70 }],
  },
  {
    id: 'stockholm',
    name: 'Stockholm City',
    place: 'Stockholm, Sverige',
    description: 'Stadsbana i blå timme: smala gator mellan färgglada fasader, skarpa hörn och kajen längs vattnet.',
    theme: 'stockholm',
    setting: 'city',
    region: 'sweden',
    points: scaled(stockholmPoints, 1.15),
    halfWidth: 6.5,
    wall: 9.5,
    tunnelName: 'CITYTUNNELN',
    lake: { x: 120, z: -190, rx: 420, rz: 100 },
  },
  {
    id: 'hamburg',
    name: 'Hamburg Hafen',
    place: 'Hamburg, Tyskland',
    description: 'Gråmulen hamnbana mellan röda tegelmagasin, containrar och lyftkranar. Tvära kurvor och långa kajer.',
    theme: 'hamburg',
    setting: 'city',
    region: 'germany',
    points: scaled(hamburgPoints, 1.15),
    halfWidth: 7,
    wall: 10,
    tunnelName: 'ELBTUNNEL',
    lake: { x: 200, z: 600, rx: 420, rz: 110 },
  },
  {
    id: 'smaland',
    name: 'Smålandsslingan',
    place: 'Kronoberg, Sverige',
    description: 'Snabb landsväg i sommarsol genom rapsfält, hagar och röda lador. Smal väg och mjuka krön.',
    theme: 'smaland',
    setting: 'country',
    region: 'sweden',
    points: smalandPoints,
    halfWidth: 5.5,
    wall: 12,
    tunnelName: 'BERGSTUNNELN',
    lake: { x: 200, z: 280, rx: 130, rz: 90 },
    hills: [{ x: 900, z: 300, radius: 260, height: 50 }],
  },
  {
    id: 'schwarzwald',
    name: 'Schwarzwaldpass',
    place: 'Schwarzwald, Tyskland',
    description: 'Dimmigt bergspass med hårnålskurvor, täta granskogar och korsvirkesgårdar. Upp och ner hela varvet.',
    theme: 'schwarzwald',
    setting: 'country',
    region: 'germany',
    points: schwarzwaldPoints,
    halfWidth: 5.8,
    wall: 11,
    tunnelName: 'FELSENTUNNEL',
    hills: [
      { x: 80, z: 430, radius: 160, height: 60 },
      { x: 800, z: 300, radius: 280, height: 110 },
    ],
  },
];

const cache = new Map<string, Track>();

export function trackById(id: string): Track {
  const cached = cache.get(id);
  if (cached) return cached;

  const def = trackDefs.find((track) => track.id === id) ?? trackDefs[0];
  const path = buildTrackPath(def.points);
  const track = { ...def, path, racingLine: buildRacingLine(path, def.halfWidth), tunnel: findTunnel(path) };
  cache.set(id, track);
  return track;
}

// The straightest stretch in the back half of the lap gets a tunnel.
function findTunnel(path: TrackPath, length = 140) {
  let best = { start: 0, worst: Number.POSITIVE_INFINITY };
  for (let start = path.length * 0.3; start < path.length * 0.85; start += 10) {
    let worst = 0;
    for (let s = start; s <= start + length; s += path.spacing) worst = Math.max(worst, Math.abs(sampleAt(path, s).curve));
    if (worst < best.worst) best = { start, worst };
  }
  return { start: best.start, end: best.start + length };
}

// A smoothed lateral offset that cuts toward the inside of each bend.
function buildRacingLine(path: TrackPath, halfWidth: number) {
  const { samples } = path;
  const count = samples.length;
  const raw = samples.map((sample) => Math.max(-1, Math.min(1, sample.curve * 120)) * (halfWidth - 2.2));
  const line = new Float32Array(count);
  const window = Math.round(30 / path.spacing);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -window; k <= window; k++) sum += raw[(i + k + count) % count];
    line[i] = sum / (window * 2 + 1);
  }
  return line;
}

import { buildTrackPath, type ControlPoint, sampleAt, type TrackPath } from './track-path';

export type TrackTheme = 'vaxjo' | 'germany';

export type TrackDef = {
  id: string;
  name: string;
  place: string;
  description: string;
  theme: TrackTheme;
  points: readonly ControlPoint[];
  halfWidth: number;
  // Lateral distance from the centre line to the barriers.
  wall: number;
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

export const trackDefs: readonly TrackDef[] = [
  {
    id: 'vaxjo',
    name: 'Växjö Motorring',
    place: 'Växjö, Sverige',
    description: 'Böljande bana genom småländsk skog, förbi sjön och de röda stugorna. Kvällssol och snabba svep.',
    theme: 'vaxjo',
    points: vaxjoPoints.map(([x, z, y]) => [x * 1.2, z * 1.2, y] as const),
    halfWidth: 7,
    wall: 13,
  },
  {
    id: 'rheinland',
    name: 'Rheinland-Ring',
    place: 'Rheinland, Tyskland',
    description: 'Lång huvudraka, tekniska kurvor och borgen på kullen. Läktare, broar och full fart.',
    theme: 'germany',
    points: germanyPoints,
    halfWidth: 7.5,
    wall: 13.5,
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

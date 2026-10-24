export type ControlPoint = readonly [x: number, z: number, y: number];

export type TrackSample = {
  x: number;
  y: number;
  z: number;
  // Unit tangent in the driving direction and the unit normal pointing to the driver's right.
  tx: number;
  tz: number;
  rx: number;
  rz: number;
  s: number;
  // Signed curvature in 1/m; positive bends to the right.
  curve: number;
  slope: number;
};

export type TrackPath = {
  samples: TrackSample[];
  length: number;
  spacing: number;
};

export type TrackLocation = {
  index: number;
  s: number;
  lateral: number;
  sample: TrackSample;
  y: number;
};

const SUBSTEPS = 120;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildTrackPath(points: readonly ControlPoint[], spacing = 2): TrackPath {
  const dense: { x: number; y: number; z: number; d: number }[] = [];
  const count = points.length;
  let distance = 0;

  for (let i = 0; i < count; i++) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];
    for (let step = 0; step < SUBSTEPS; step++) {
      const t = step / SUBSTEPS;
      const x = catmullRom(p0[0], p1[0], p2[0], p3[0], t);
      const z = catmullRom(p0[1], p1[1], p2[1], p3[1], t);
      const y = catmullRom(p0[2], p1[2], p2[2], p3[2], t);
      const previous = dense.at(-1);
      if (previous) distance += Math.hypot(x - previous.x, z - previous.z);
      dense.push({ x, y, z, d: distance });
    }
  }

  const first = dense[0];
  const last = dense[dense.length - 1];
  const length = distance + Math.hypot(first.x - last.x, first.z - last.z);
  dense.push({ ...first, d: length });

  const sampleCount = Math.round(length / spacing);
  const step = length / sampleCount;
  const samples: TrackSample[] = [];
  let cursor = 0;

  for (let i = 0; i < sampleCount; i++) {
    const s = i * step;
    while (dense[cursor + 1].d < s) cursor++;
    const a = dense[cursor];
    const b = dense[cursor + 1];
    const t = (s - a.d) / Math.max(b.d - a.d, 1e-6);
    samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, tx: 0, tz: 1, rx: -1, rz: 0, s, curve: 0, slope: 0 });
  }

  for (let i = 0; i < sampleCount; i++) {
    const previous = samples[(i - 1 + sampleCount) % sampleCount];
    const next = samples[(i + 1) % sampleCount];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const len = Math.hypot(dx, dz);
    const sample = samples[i];
    sample.tx = dx / len;
    sample.tz = dz / len;
    sample.rx = -sample.tz;
    sample.rz = sample.tx;
    sample.slope = (next.y - previous.y) / (2 * step);
  }

  const raw = samples.map((sample, i) => {
    const next = samples[(i + 1) % sampleCount];
    const yawNow = Math.atan2(sample.tx, sample.tz);
    const yawNext = Math.atan2(next.tx, next.tz);
    let delta = yawNext - yawNow;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return -delta / step;
  });

  const window = Math.max(2, Math.round(8 / step));
  for (let i = 0; i < sampleCount; i++) {
    let sum = 0;
    for (let k = -window; k <= window; k++) sum += raw[(i + k + sampleCount) % sampleCount];
    samples[i].curve = sum / (window * 2 + 1);
  }

  return { samples, length, spacing: step };
}

export function wrapDistance(path: TrackPath, s: number) {
  return ((s % path.length) + path.length) % path.length;
}

export function sampleAt(path: TrackPath, s: number) {
  const wrapped = wrapDistance(path, s);
  const index = Math.floor(wrapped / path.spacing) % path.samples.length;
  return path.samples[index];
}

// Searches near the previous index so overlapping parts of a circuit never confuse a car's position.
export function locate(path: TrackPath, x: number, z: number, hint: number, radius = 24): TrackLocation {
  const { samples } = path;
  const count = samples.length;
  let best = hint;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let k = -radius; k <= radius; k++) {
    const index = (hint + k + count) % count;
    const sample = samples[index];
    const distance = (x - sample.x) ** 2 + (z - sample.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }

  const sample = samples[best];
  const next = samples[(best + 1) % count];
  const along = (x - sample.x) * sample.tx + (z - sample.z) * sample.tz;
  const t = Math.max(0, Math.min(1, along / path.spacing));
  const lateral = (x - sample.x) * sample.rx + (z - sample.z) * sample.rz;
  return { index: best, s: wrapDistance(path, sample.s + along), lateral, sample, y: sample.y + (next.y - sample.y) * t };
}

export function locateGlobal(path: TrackPath, x: number, z: number) {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  path.samples.forEach((sample, index) => {
    const distance = (x - sample.x) ** 2 + (z - sample.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return locate(path, x, z, best, 2);
}

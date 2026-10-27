import type { Track } from '../game/tracks';

export function mapProjection(track: Track, size: number, padding = 8) {
  const { samples } = track.path;
  const xs = samples.map((sample) => sample.x);
  const zs = samples.map((sample) => sample.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const scale = (size - padding * 2) / Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ);
  const project = (x: number, z: number) => [padding + (x - minX) * scale, padding + (z - minZ) * scale] as const;
  const points = samples
    .filter((_, index) => index % 6 === 0)
    .map((sample) =>
      project(sample.x, sample.z)
        .map((value) => value.toFixed(1))
        .join(','),
    )
    .join(' ');
  return { project, points };
}

// The start and finish line: a short chequered bar across the road at the track's first sample.
export function FinishMarker({ track, project }: { track: Track; project: (x: number, z: number) => readonly [number, number] }) {
  const { x, z, rx, rz, tx, tz } = track.path.samples[0];
  const [cx, cy] = project(x, z);
  const across = Math.hypot(rx, rz) || 1;
  const along = Math.hypot(tx, tz) || 1;
  const half = 7;
  const row = (offset: number, dash: number) => {
    const ox = (tx / along) * offset;
    const oy = (tz / along) * offset;
    return (
      <line
        x1={cx - (rx / across) * half + ox}
        y1={cy - (rz / across) * half + oy}
        x2={cx + (rx / across) * half + ox}
        y2={cy + (rz / across) * half + oy}
        className='map-finish-row'
        strokeDashoffset={dash}
      />
    );
  };
  return (
    <g className='map-finish' data-testid='map-finish'>
      <line
        x1={cx - (rx / across) * half}
        y1={cy - (rz / across) * half}
        x2={cx + (rx / across) * half}
        y2={cy + (rz / across) * half}
        className='map-finish-base'
      />
      {row(-0.9, 0)}
      {row(0.9, 1.75)}
    </g>
  );
}

export function TrackMap({ track, size = 160, className }: { track: Track; size?: number; className?: string }) {
  const { project, points } = mapProjection(track, size);
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} role='img' aria-label={`Karta över ${track.name}`}>
      <polygon points={points} className='map-road' />
      <polygon points={points} className='map-line' />
      <FinishMarker track={track} project={project} />
    </svg>
  );
}

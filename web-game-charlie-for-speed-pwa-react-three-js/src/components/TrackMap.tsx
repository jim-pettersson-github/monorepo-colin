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

export function TrackMap({ track, size = 160, className }: { track: Track; size?: number; className?: string }) {
  const { project, points } = mapProjection(track, size);
  const [startX, startY] = project(track.path.samples[0].x, track.path.samples[0].z);
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} role='img' aria-label={`Karta över ${track.name}`}>
      <polygon points={points} className='map-road' />
      <polygon points={points} className='map-line' />
      <circle cx={startX} cy={startY} r={4} className='map-start' />
    </svg>
  );
}

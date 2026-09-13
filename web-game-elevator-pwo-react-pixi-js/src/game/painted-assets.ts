import { Assets, type Texture } from 'pixi.js';
import { useEffect, useState } from 'react';

const names = [
  'hotel-wall',
  'mall-wall',
  'house-wall',
  'outside-sky',
  'wood',
  'brass',
  'marble',
  'glass',
  'colin-0',
  'colin-1',
  'colin-2',
  'colin-3',
  'passenger-0',
  'passenger-1',
  'passenger-2',
] as const;
export type PaintedAssets = Record<(typeof names)[number], Texture>;
let pending: Promise<PaintedAssets> | undefined;

export function loadPaintedAssets() {
  pending ??= Promise.all(names.map(async (name) => [name, await Assets.load<Texture>(`${import.meta.env.BASE_URL}painted/${name}.webp`)] as const))
    .then((entries) => Object.fromEntries(entries) as PaintedAssets)
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function usePaintedAssets() {
  const [assets, setAssets] = useState<PaintedAssets | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A retry explicitly repeats the failed asset load.
  useEffect(() => {
    let active = true;
    setError(false);
    loadPaintedAssets().then(
      (loaded) => {
        if (active) setAssets(loaded);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return { assets, error, retry: () => setAttempt((value) => value + 1) };
}

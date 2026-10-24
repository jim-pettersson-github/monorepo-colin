import { useEffect, useRef } from 'react';
import { drawCharacter } from '../game/characters';
import { drawScene } from '../game/drawing';
import type { CharacterId } from '../game/model';
import type { Session } from '../game/session';
export function Portrait({ id }: { id: CharacterId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (c) {
      c.clearRect(0, 0, 128, 128);
      drawCharacter(c, id, 64, 118, 1.05, 0, true);
    }
  }, [id]);
  return <canvas ref={ref} width={128} height={128} className='portrait' tabIndex={-1} aria-hidden='true' />;
}
export function Stadium({ session, cast }: { session?: Session; cast?: CharacterId[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;
    let width = 1,
      height = 1,
      frame = 0,
      last = performance.now(),
      time = 0;
    const resize = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    resize.observe(canvas);
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (session) session.advance(dt);
      if (!document.hidden && !session?.paused) time += dt;
      drawScene(c, width, height, session?.state ?? null, session ? session.state.time : time, cast);
      canvas.dataset.rendered = 'true';
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [session, cast]);
  return (
    <canvas
      ref={ref}
      className={session ? 'stadium game-canvas' : 'stadium preview-canvas'}
      aria-label={session ? 'Friidrottsarenan med fyra löpare' : 'Disney-figurer på löparbanan'}
    />
  );
}

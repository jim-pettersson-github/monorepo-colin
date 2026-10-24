import { useEffect, useRef } from 'react';
import { drawCharacter } from '../game/characters';
import { drawScene } from '../game/drawing';
import { type CharacterId, skillEvent } from '../game/model';
import type { Session } from '../game/session';
export function Portrait({ id, animated = false }: { id: CharacterId; animated?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    let frame = 0;
    let visible = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (time: number) => {
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.clearRect(0, 0, 128, 128);
      c.fillStyle = '#34334d20';
      c.beginPath();
      c.ellipse(64, 120, 24, 4, 0, 0, Math.PI * 2);
      c.fill();
      drawCharacter(c, id, 64, 117, 0.96, animated && !reduced.matches ? time / 145 : 0.7);
    };
    const tick = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      draw(0);
      if (animated && visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    draw(0);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      reduced.removeEventListener('change', update);
    };
  }, [id, animated]);
  return <canvas ref={ref} width={256} height={256} className='portrait' tabIndex={-1} aria-hidden='true' />;
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
      aria-label={
        session ? (skillEvent(session.state.event) ? 'Sportarenan med fyra deltagare' : 'Friidrottsarenan med fyra löpare') : 'Disney-figurer på löparbanan'
      }
    />
  );
}

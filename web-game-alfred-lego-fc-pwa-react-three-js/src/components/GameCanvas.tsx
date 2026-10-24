import { useEffect, useRef, useState } from 'react';
import { createFootballWorld } from '../game/football-world';
import type { MatchSession } from '../game/session';

export function GameCanvas({ session }: { session: MatchSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let world: ReturnType<typeof createFootballWorld>;
    try {
      world = createFootballWorld(canvas);
    } catch {
      session.pause();
      setError('3D-spelet behöver en webbläsare med WebGL 2.');
      return;
    }
    let frame = 0;
    let previous = performance.now();
    let elapsed = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!session.paused) elapsed += dt * (session.state.watching ? session.state.playbackSpeed : 1);
      const portrait = world.draw(session.renderState, elapsed);
      if (session.portrait !== portrait) session.input.clear();
      session.portrait = portrait;
      session.advance(dt);
      frame = requestAnimationFrame(loop);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      session.pause('Grafiken avbröts. Matchen är sparad. Ladda om för att fortsätta.');
      setError('Grafiken avbröts. Matchen är sparad.');
    };
    canvas.addEventListener('webglcontextlost', lost);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', lost);
      world.dispose();
    };
  }, [session]);
  return (
    <>
      <canvas
        className='game-canvas'
        ref={canvasRef}
        aria-label={
          session.state.watching
            ? 'Fotbollsplan med tio spelare. Datorn spelar båda lagen.'
            : 'Fotbollsplan med tio spelare. Använd tangentbord, handkontroll eller pekkontroller för att spela.'
        }
      />
      {error && (
        <p className='render-error' role='alert'>
          {error}
        </p>
      )}
    </>
  );
}

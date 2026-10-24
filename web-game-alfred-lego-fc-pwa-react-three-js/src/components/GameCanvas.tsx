import { useEffect, useRef, useState } from 'react';
import { createFootballWorld } from '../game/football-world';
import type { MatchSession } from '../game/session';
import { gameSound, MatchSoundTracker } from '../game/sound';

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
    let previousState: typeof session.renderState | undefined;
    let previousSize = '';
    let wasPaused = false;
    const sounds = new MatchSoundTracker(session.state);
    const stopPaused = session.subscribe(() => {
      if (session.paused) gameSound.stop();
    });
    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (!session.paused) elapsed += dt * (session.state.watching ? session.state.playbackSpeed : 1);
      const state = session.renderState;
      const size = `${canvas.clientWidth}:${canvas.clientHeight}`;
      if (!session.paused || !wasPaused || state !== previousState || size !== previousSize) {
        const portrait = world.draw(state, elapsed);
        if (session.portrait !== portrait) session.input.clear();
        session.portrait = portrait;
      }
      previousState = state;
      previousSize = size;
      wasPaused = session.paused;
      session.advance(dt);
      gameSound.play(sounds.update(session.state, session.paused));
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
      stopPaused();
      gameSound.stop();
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

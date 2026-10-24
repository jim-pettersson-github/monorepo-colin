import type { MatchClubs } from './clubs';
import { createFootballWorld } from './football-world';
import { createMatch } from './model';

export function createPitchPreview(canvas: HTMLCanvasElement, clubs?: MatchClubs) {
  const world = createFootballWorld(canvas);
  const state = createMatch('versus', 180, 'easy', clubs);
  const render = () => world.draw(state, 0, true);
  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  render();
  return () => {
    observer.disconnect();
    world.dispose();
  };
}

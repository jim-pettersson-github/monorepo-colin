import { Application, extend, useApplication, useTick } from '@pixi/react';
import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { drawBackground, drawDynamic } from '../game/art';
import { worldAction } from '../game/interaction';
import { buildings, currentBuilding, definition, floorY, playerLevel, worldWidth } from '../game/model';
import { type PaintedAssets, usePaintedAssets } from '../game/painted-assets';
import type { GameSession } from '../game/session';
import { worldPalette as p } from '../palette';

extend({ Container, Graphics, Text });
const clear = (graphics: Graphics) => {
  graphics.clear();
};

function World({
  session,
  paused,
  host,
  followRequest,
  onManualChange,
  assets,
}: {
  session: GameSession;
  paused: boolean;
  host: RefObject<HTMLDivElement | null>;
  followRequest: number;
  onManualChange: (manual: boolean) => void;
  assets: PaintedAssets;
}) {
  const { app } = useApplication();
  const world = useRef<Container>(null);
  const moving = useRef<Graphics>(null);
  const numbers = useRef<(Text | null)[]>([]);
  const indicators = useRef<(Text | null)[]>([]);
  const cameraPlace = useRef('');
  const camera = useRef({ manual: false, x: 0, y: 0 });
  const gesture = useRef<{ id: number; startX: number; startY: number; cameraX: number; cameraY: number; dragged: boolean } | null>(null);
  const state = session.state;
  const place = state.player.place;
  const paint = useCallback((g: Graphics) => drawBackground(g, place, assets), [place, assets]);

  const frame = useCallback(
    (delta: number) => {
      session.advance(delta);
      const state = session.state;
      const root = world.current;
      if (!root || !moving.current) return;
      const width = worldWidth(state.player.place);
      const scale = Math.min(Math.max(0.75, Math.min(1.25, app.screen.width / width)), app.screen.height / 350);
      root.scale.set(scale);
      const followX =
        app.screen.width > width * scale
          ? (app.screen.width - width * scale) / 2
          : Math.max(app.screen.width - width * scale, Math.min(0, app.screen.width / 2 - state.player.x * scale));
      const followY = app.screen.height * 0.86 - floorY(playerLevel(state)) * scale;
      const x = camera.current.manual
        ? Math.max(Math.min(0, app.screen.width - width * scale), Math.min(Math.max(0, (app.screen.width - width * scale) / 2), camera.current.x))
        : followX;
      const y = camera.current.manual
        ? Math.max(
            app.screen.height * 0.86 - floorY(0) * scale,
            Math.min(app.screen.height * 0.86 - floorY(state.player.place === 'outside' ? 0 : 2) * scale, camera.current.y),
          )
        : followY;
      const snap = !state.settings.smoothCamera || cameraPlace.current !== state.player.place;
      const ease = snap || camera.current.manual ? 1 : 1 - Math.exp(-12 * Math.max(delta, 1 / 60));
      root.x += (x - root.x) * ease;
      root.y += (y - root.y) * ease;
      if (camera.current.manual) {
        camera.current.x = x;
        camera.current.y = y;
      }
      cameraPlace.current = state.player.place;
      drawDynamic(moving.current, state, assets);
      const building = currentBuilding(state);
      for (let i = 0; i < 3; i++) {
        const text = numbers.current[i];
        const person = building?.people[i];
        if (text) {
          text.visible = !!person && ['idle', 'waiting', 'riding'].includes(person.phase);
          if (person) {
            text.text = String(person.wanted);
            text.position.set(person.x, floorY(person.phase === 'riding' ? (building?.lift.position ?? person.floor) : person.floor) - 178);
          }
        }
        const indicator = indicators.current[i];
        if (indicator && building)
          indicator.text = `${building.lift.destination === null ? '•' : building.lift.destination > building.lift.position ? '↑' : '↓'} ${Math.round(building.lift.position)}`;
      }
    },
    [app, session, assets],
  );

  useTick(useCallback((ticker: Ticker) => frame(ticker.deltaMS / 1000), [frame]));
  useEffect(() => {
    frame(0);
    if (paused) app.stop();
    else app.start();
    app.render();
  }, [app, frame, paused]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    // Pixi's resizeTo only listens for window resizes, not changing control heights.
    const observer = new ResizeObserver(() => {
      if (app.screen.width === element.clientWidth && app.screen.height === element.clientHeight) return;
      app.resize();
      frame(0);
      app.render();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [app, host, frame]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Building changes and the follow button explicitly reset the camera.
  useEffect(() => {
    camera.current.manual = false;
    gesture.current = null;
    onManualChange(false);
  }, [place, followRequest, onManualChange]);

  useEffect(() => {
    const element = host.current;
    if (!element || paused) return;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || session.paused || session.hidden) return;
      if (gesture.current) {
        gesture.current.dragged = true;
        return;
      }
      const root = world.current;
      if (!root) return;
      element.setPointerCapture(event.pointerId);
      gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, cameraX: root.x, cameraY: root.y, dragged: false };
    };
    const move = (event: PointerEvent) => {
      const drag = gesture.current;
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.dragged && Math.hypot(dx, dy) < 8) return;
      drag.dragged = true;
      camera.current = { manual: true, x: drag.cameraX + dx, y: drag.cameraY + dy };
      onManualChange(true);
    };
    const up = (event: PointerEvent) => {
      const drag = gesture.current;
      if (!drag || drag.id !== event.pointerId) return;
      gesture.current = null;
      if (drag.dragged || session.paused || session.hidden) return;
      const bounds = app.canvas.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      const point = world.current?.toLocal({
        x: ((event.clientX - bounds.left) * app.screen.width) / bounds.width,
        y: ((event.clientY - bounds.top) * app.screen.height) / bounds.height,
      });
      const action = point && worldAction(session.state, point);
      if (action) {
        camera.current.manual = false;
        onManualChange(false);
        session.send(action);
      }
    };
    const cancel = () => {
      gesture.current = null;
    };
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || session.paused || session.hidden || !world.current) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? app.screen.height : 1;
      const base = camera.current.manual ? camera.current : world.current;
      camera.current = { manual: true, x: base.x - event.deltaX * unit, y: base.y - event.deltaY * unit };
      onManualChange(true);
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancel();
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      element.removeEventListener('wheel', wheel);
    };
  }, [app, host, session, paused, onManualChange]);

  return (
    <pixiContainer ref={world} eventMode='none'>
      <pixiGraphics draw={paint} eventMode='none' />
      <pixiGraphics ref={moving} draw={clear} eventMode='none' />
      {place === 'outside'
        ? buildings.map((building, index) => (
            <pixiText
              key={building.id}
              text={building.name}
              x={130 + index * 250}
              y={475}
              anchor={0.5}
              style={{ fontFamily: 'Trebuchet MS', fontSize: 24, fill: p.ink, fontWeight: 'bold' }}
            />
          ))
        : [0, 1, 2].map((floor) => (
            <pixiContainer key={floor}>
              <pixiText text='TRAPPA' x={101} y={floorY(floor) - 201} anchor={0.5} style={{ fontFamily: 'Trebuchet MS', fontSize: 11, fill: p.surface }} />
              {floor === 0 && (
                <pixiText
                  text='UT'
                  x={215}
                  y={floorY(floor) - 177}
                  anchor={0.5}
                  style={{ fontFamily: 'Trebuchet MS', fontSize: 15, fill: p.surface, fontWeight: 'bold' }}
                />
              )}
              <pixiText
                text={definition(place).rooms[floor]}
                x={218}
                y={floorY(floor) - 251}
                style={{ fontFamily: 'Georgia', fontSize: 21, fill: p.surface, fontWeight: 'bold' }}
              />
              <pixiText text={`VÅNING ${floor}`} x={215} y={floorY(floor) - 219} style={{ fontFamily: 'Trebuchet MS', fontSize: 13, fill: p.surface }} />
              <pixiText
                text='BRANDLARM'
                x={703}
                y={floorY(floor) - 116}
                anchor={0.5}
                style={{ fontFamily: 'Trebuchet MS', fontSize: 7, fill: p.surface, fontWeight: 'bold' }}
              />
              <pixiText
                ref={(text) => {
                  indicators.current[floor] = text;
                }}
                text='• 0'
                x={936}
                y={floorY(floor) - 261}
                anchor={0.5}
                style={{ fontFamily: 'monospace', fontSize: 23, fill: p.light }}
              />
            </pixiContainer>
          ))}
      {[0, 1, 2].map((index) => (
        <pixiText
          key={index}
          ref={(text) => {
            numbers.current[index] = text;
          }}
          text=''
          anchor={0.5}
          style={{ fontFamily: 'Trebuchet MS', fontSize: 23, fill: p.ink, fontWeight: 'bold' }}
        />
      ))}
    </pixiContainer>
  );
}

export function GameScene({ session, paused }: { session: GameSession; paused: boolean }) {
  const { assets, error, retry } = usePaintedAssets();
  const host = useRef<HTMLDivElement>(null);
  const [manual, setManual] = useState(false);
  const [followRequest, setFollowRequest] = useState(0);
  return (
    <>
      <div
        className='game-scene'
        data-art={assets ? 'painted' : 'loading'}
        aria-busy={!assets}
        data-camera={manual ? 'free' : 'follow'}
        ref={host}
        role='img'
        aria-label='Colins hus. Dra med musen eller ett finger för att se andra våningar. Tryck för att gå eller undersöka något. Samma handlingar finns i knapparna nedanför.'
      >
        {assets && (
          <Application resizeTo={host} resolution={Math.min(window.devicePixelRatio || 1, 2)} autoDensity antialias background={p.paper} preference='webgl'>
            <World session={session} paused={paused} host={host} followRequest={followRequest} onManualChange={setManual} assets={assets} />
          </Application>
        )}
      </div>
      {!assets && (
        <div className='world-loading' role='status'>
          <p>{error ? 'Bilderna kunde inte laddas.' : 'Målar upp Colins värld…'}</p>
          {error && (
            <button type='button' onClick={retry}>
              Försök igen
            </button>
          )}
        </div>
      )}
      {manual && (
        <button type='button' className='camera-follow' onClick={() => setFollowRequest((value) => value + 1)}>
          ◎ Följ Colin
        </button>
      )}
    </>
  );
}

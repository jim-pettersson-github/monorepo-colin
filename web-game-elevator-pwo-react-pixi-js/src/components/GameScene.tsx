import { Application, extend, useApplication, useTick } from '@pixi/react';
import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { buildings, currentBuilding, definition, playerLevel } from '../game/model';
import { type PaintedAssets, usePaintedAssets } from '../game/painted-assets';
import { actorBounds, drawRoom, drawStreet } from '../game/room-art';
import { roomAction } from '../game/room-interaction';
import type { GameSession } from '../game/session';
import { projectPoint, roomSpace } from '../game/spatial';
import { worldPalette as p } from '../palette';

extend({ Container, Graphics, Text });
const clear = (graphics: Graphics) => {
  graphics.clear();
};

function World({
  session,
  paused,
  host,
  assets,
  floor,
  followRequest,
  onFollow,
  onManualChange,
  zoom,
  defaultZoom,
  onZoom,
}: {
  session: GameSession;
  paused: boolean;
  host: RefObject<HTMLDivElement | null>;
  assets: PaintedAssets;
  floor: number;
  followRequest: number;
  onFollow: () => void;
  onManualChange: (manual: boolean) => void;
  zoom: number;
  defaultZoom: number;
  onZoom: (zoom: number) => void;
}) {
  const { app } = useApplication();
  const world = useRef<Container>(null);
  const art = useRef<Graphics>(null);
  const numbers = useRef<(Text | null)[]>([]);
  const indicator = useRef<Text>(null);
  const viewedFloor = useRef(floor);
  viewedFloor.current = floor;
  const camera = useRef({ zoom: 1, manual: false, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'drag'; id: number; startX: number; startY: number; x: number; y: number; dragged: boolean }
    | { kind: 'pinch'; distance: number; zoom: number; centerX: number; centerY: number; x: number; y: number }
    | null
  >(null);
  const place = session.state.player.place;
  const frame = useCallback(
    (delta: number) => {
      session.advance(delta);
      const root = world.current;
      if (!app.renderer || !root || !art.current) return;
      const state = session.state;
      const floor = viewedFloor.current;
      const { width, height } = app.screen;
      const scale = Math.min(width / roomSpace.width, height / roomSpace.height) * camera.current.zoom;
      root.scale.set(scale);
      const center = { x: (width - roomSpace.width * scale) / 2, y: (height - roomSpace.height * scale) / 2 };
      const feet = projectPoint(state.player.place === 'outside' ? { x: 180 + state.player.x * 1.36, depth: state.player.depth } : state.player);
      const limit = (value: number, viewport: number, scene: number) =>
        scene <= viewport ? (viewport - scene) / 2 : Math.max(viewport - scene, Math.min(0, value));
      const targetX = limit(camera.current.manual ? camera.current.x : width / 2 - feet.x * scale, width, roomSpace.width * scale);
      const targetY = limit(camera.current.manual ? camera.current.y : height * 0.75 - feet.y * scale, height, roomSpace.height * scale);
      const ease = !state.settings.smoothCamera || camera.current.manual || delta === 0 ? 1 : 1 - Math.exp(-12 * delta);
      root.x += ((camera.current.zoom === 1 ? center.x : targetX) - root.x) * ease;
      root.y += ((camera.current.zoom === 1 ? center.y : targetY) - root.y) * ease;
      if (state.player.place === 'outside') drawStreet(art.current, state, assets);
      else drawRoom(art.current, state, session.ui, assets, floor);
      const building = currentBuilding(state);
      for (let i = 0; i < 3; i++) {
        const text = numbers.current[i];
        const person = building?.people[i];
        if (!text) continue;
        text.visible =
          !!person &&
          ['idle', 'waiting', 'riding'].includes(person.phase) &&
          (person.phase === 'riding' ? Math.round(building?.lift.position ?? 0) : person.floor) === floor &&
          (person.depth >= 0 || (building?.lift.landing.open ?? 0) > 0.95);
        if (person) {
          const bounds = actorBounds(person);
          text.text = String(person.wanted);
          text.position.set(bounds.x, bounds.y - bounds.height - 22);
        }
      }
      if (indicator.current && building)
        indicator.current.text = `${building.lift.destination === null ? '•' : building.lift.destination > building.lift.position ? '↑' : '↓'} ${Math.round(building.lift.position)}`;
    },
    [app, session, assets],
  );
  useTick(useCallback((ticker: Ticker) => frame(ticker.deltaMS / 1000), [frame]));
  useEffect(() => {
    // Pinches already set their own zoom and focal point; buttons still follow Colin.
    if (camera.current.zoom !== zoom) {
      camera.current.zoom = zoom;
      camera.current.manual = false;
    }
    frame(0);
  }, [zoom, frame]);
  useEffect(() => {
    if (!app.renderer) return;
    frame(0);
    if (paused) app.stop();
    else app.start();
    app.render();
  }, [app, frame, paused]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (!app.renderer || (app.screen.width === element.clientWidth && app.screen.height === element.clientHeight)) return;
      app.resize();
      frame(0);
      app.render();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [app, host, frame]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit view changes reset the camera.
  useEffect(() => {
    camera.current = { zoom: defaultZoom, manual: false, x: 0, y: 0 };
    gesture.current = null;
    pointers.current.clear();
    onManualChange(false);
    onZoom(defaultZoom);
    frame(0);
  }, [place, floor, followRequest, defaultZoom, onManualChange, onZoom, frame]);
  useEffect(() => {
    const element = host.current;
    if (!element || paused) return;
    const point = (event: PointerEvent) => {
      const bounds = app.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) * app.screen.width) / bounds.width,
        y: ((event.clientY - bounds.top) * app.screen.height) / bounds.height,
      };
    };
    const begin = (dragged: boolean) => {
      const root = world.current;
      if (!root) return;
      const entries = [...pointers.current];
      const first = entries[0];
      if (!first) return;
      const second = entries[1];
      gesture.current = second
        ? {
            kind: 'pinch',
            distance: Math.max(1, Math.hypot(second[1].x - first[1].x, second[1].y - first[1].y)),
            zoom: camera.current.zoom,
            centerX: (first[1].x + second[1].x) / 2,
            centerY: (first[1].y + second[1].y) / 2,
            x: root.x,
            y: root.y,
          }
        : { kind: 'drag', id: first[0], startX: first[1].x, startY: first[1].y, x: root.x, y: root.y, dragged };
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || session.paused || session.hidden || !app.renderer) return;
      pointers.current.set(event.pointerId, point(event));
      element.setPointerCapture(event.pointerId);
      begin(pointers.current.size > 1);
    };
    const move = (event: PointerEvent) => {
      const drag = gesture.current;
      if (!drag || !pointers.current.has(event.pointerId)) return;
      const current = point(event);
      pointers.current.set(event.pointerId, current);
      if (drag.kind === 'pinch') {
        const [first, second] = [...pointers.current.values()];
        if (!first || !second) return;
        const nextZoom = Math.max(1, Math.min(2.5, (drag.zoom * Math.hypot(second.x - first.x, second.y - first.y)) / drag.distance));
        const ratio = nextZoom / drag.zoom;
        camera.current = {
          zoom: nextZoom,
          manual: true,
          x: (first.x + second.x) / 2 - (drag.centerX - drag.x) * ratio,
          y: (first.y + second.y) / 2 - (drag.centerY - drag.y) * ratio,
        };
        onZoom(nextZoom);
        onManualChange(true);
        return;
      }
      const dx = current.x - drag.startX,
        dy = current.y - drag.startY;
      if (!drag.dragged && Math.hypot(dx, dy) < 8) return;
      drag.dragged = true;
      camera.current = { ...camera.current, manual: true, x: drag.x + dx, y: drag.y + dy };
      onManualChange(true);
    };
    const finish = (event: PointerEvent, cancelled: boolean) => {
      const drag = gesture.current;
      if (!pointers.current.delete(event.pointerId)) return;
      if (pointers.current.size) {
        frame(0);
        begin(true);
        return;
      }
      gesture.current = null;
      if (cancelled || !drag || drag.kind !== 'drag' || drag.dragged || session.paused || session.hidden || !app.renderer) return;
      const local = world.current?.toLocal(point(event));
      const action = local && roomAction(session.state, local, viewedFloor.current);
      if (action) {
        session.send(action);
        camera.current.manual = false;
        onManualChange(false);
        onFollow();
      }
    };
    const up = (event: PointerEvent) => finish(event, false);
    const cancel = (event: PointerEvent) => finish(event, true);
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || session.paused || session.hidden) return;
      event.preventDefault();
      onZoom(Math.max(1, Math.min(2.5, camera.current.zoom - event.deltaY * 0.002)));
      camera.current.manual = false;
      onManualChange(camera.current.zoom > 1);
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      gesture.current = null;
      pointers.current.clear();
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      element.removeEventListener('wheel', wheel);
    };
  }, [app, host, session, paused, onFollow, onManualChange, onZoom, frame]);
  return (
    <pixiContainer ref={world} eventMode='none'>
      <pixiGraphics ref={art} draw={clear} />
      {place === 'outside' ? (
        buildings.map((building, index) => (
          <pixiText
            key={building.id}
            text={building.name}
            x={290 + index * 430}
            y={220}
            anchor={0.5}
            style={{ fontFamily: 'Georgia', fontSize: 25, fill: p.surface, fontWeight: 'bold' }}
          />
        ))
      ) : (
        <>
          <pixiText ref={indicator} text='• 0' x={890} y={112} anchor={0.5} style={{ fontFamily: 'monospace', fontSize: 27, fill: p.light }} />
          <pixiText
            text={floor === 0 ? 'UT' : `RUM ${floor}`}
            x={1210}
            y={283}
            anchor={0.5}
            style={{ fontFamily: 'Georgia', fontSize: 22, fill: p.surface, fontWeight: 'bold' }}
          />
        </>
      )}
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
  const [preview, setPreview] = useState<{ place: string; floor: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [defaultZoom, setDefaultZoom] = useState(1);
  const [followRequest, setFollowRequest] = useState(0);
  const follow = useCallback(() => setPreview(null), []);
  const state = session.state;
  const building = currentBuilding(state);
  const colinFloor = Math.round(playerLevel(state));
  const inspecting = preview?.place === state.player.place;
  const floor = inspecting ? preview.floor : colinFloor;
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const fit = Math.min(width / roomSpace.width, height / roomSpace.height);
      const fill = Math.max(width / roomSpace.width, height / roomSpace.height);
      setDefaultZoom(matchMedia('(orientation: landscape) and (min-width: 640px)').matches ? Math.min(2.5, fill / fit) : 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const cameraMoved = manual || Math.abs(zoom - defaultZoom) > 0.01;
  return (
    <>
      {building && (
        <nav className='floor-overview' aria-label='Husöversikt'>
          {[2, 1, 0].map((level) => (
            <button
              type='button'
              key={level}
              aria-label={`Titta på våning ${level}`}
              aria-pressed={floor === level}
              disabled={paused}
              onClick={() => setPreview({ place: building.id, floor: level })}
            >
              <b>{level}</b>
              <span>
                {definition(building.id).rooms[level]}
                <small>
                  {colinFloor === level ? 'Colin här' : ' '}
                  {Math.round(building.lift.position) === level ? ' · ↕ Hiss' : ''}
                </small>
              </span>
            </button>
          ))}
        </nav>
      )}
      <div
        className={`game-scene perspective-scene${building ? ' has-overview' : ''}`}
        data-art={assets ? 'painted' : 'loading'}
        data-view-floor={floor}
        aria-busy={!assets}
        data-camera={cameraMoved ? 'free' : 'follow'}
        data-zoom={zoom}
        data-default-zoom={defaultZoom}
        ref={host}
        role='img'
        aria-label='Colins hus i perspektiv. Välj en våning i husöversikten för att titta, tryck sedan i rummet för att gå dit. Dra för att flytta kameran. Nyp med två fingrar för att zooma.'
      >
        {assets && (
          <Application resizeTo={host} resolution={Math.min(window.devicePixelRatio || 1, 2)} autoDensity antialias background={p.paper} preference='webgl'>
            <World
              session={session}
              paused={paused}
              host={host}
              assets={assets}
              floor={floor}
              followRequest={followRequest}
              onFollow={follow}
              onManualChange={setManual}
              zoom={zoom}
              defaultZoom={defaultZoom}
              onZoom={setZoom}
            />
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
      {inspecting && <p className='room-preview-caption'>Våning {floor} · Tryck i rummet för att gå dit</p>}
      {assets && (
        <fieldset className='camera-zoom' aria-label='Kamerazoom'>
          <button type='button' aria-label='Zooma ut' disabled={paused || zoom <= 1} onClick={() => setZoom((v) => Math.max(1, v - 0.5))}>
            −
          </button>
          <button type='button' aria-label='Zooma in' disabled={paused || zoom >= 2.5} onClick={() => setZoom((v) => Math.min(2.5, v + 0.5))}>
            +
          </button>
        </fieldset>
      )}
      {(cameraMoved || inspecting) && (
        <button
          type='button'
          className='camera-follow'
          onClick={() => {
            follow();
            setFollowRequest((v) => v + 1);
          }}
        >
          ◎ Följ Colin
        </button>
      )}
    </>
  );
}

import { Application, extend, useApplication, useTick } from '@pixi/react';
import { Container, Graphics, Text, type Ticker } from 'pixi.js';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { cafePlayerFeet, cafeSpace } from '../game/cafe-spatial';
import { colinIdleFrame } from '../game/colin-idle';
import { characterName, currentBuilding, definition, floorLabel, floors, playerLevel, streetBuildings } from '../game/model';
import { loadCompanionAssets, type PaintedAssets, usePaintedAssets } from '../game/painted-assets';
import { actorBounds, drawRoom, drawStreet } from '../game/room-art';
import { roomAction } from '../game/room-interaction';
import type { GameSession } from '../game/session';
import { othersOnFloor } from '../game/shared';
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
  onZoom: (zoom: number) => void;
}) {
  const { app } = useApplication();
  const world = useRef<Container>(null);
  const art = useRef<Graphics>(null);
  const numbers = useRef<(Text | null)[]>([]);
  const names = useRef<(Text | null)[]>([]);
  const viewedFloor = useRef(floor);
  viewedFloor.current = floor;
  const camera = useRef({ zoom, manual: false, x: 0, y: 0 });
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
      const space = state.player.place === 'cafe' ? cafeSpace : roomSpace;
      const scale = Math.min(width / space.width, height / space.height) * camera.current.zoom;
      root.scale.set(scale);
      const center = { x: (width - space.width * scale) / 2, y: (height - space.height * scale) / 2 };
      const feet =
        state.player.place === 'cafe'
          ? cafePlayerFeet(state)
          : state.player.place === 'outside'
            ? { x: 55 + (state.player.x * 350) / 205, y: roomSpace.sill + state.player.depth * 400 }
            : projectPoint(state.player);
      const limit = (value: number, viewport: number, scene: number) =>
        scene <= viewport ? (viewport - scene) / 2 : Math.max(viewport - scene, Math.min(0, value));
      const targetX = limit(camera.current.manual ? camera.current.x : width / 2 - feet.x * scale, width, space.width * scale);
      const targetY = limit(camera.current.manual ? camera.current.y : height * 0.75 - feet.y * scale, height, space.height * scale);
      const ease = !state.settings.smoothCamera || camera.current.manual || delta === 0 ? 1 : 1 - Math.exp(-12 * delta);
      root.x += ((camera.current.zoom === 1 ? center.x : targetX) - root.x) * ease;
      root.y += ((camera.current.zoom === 1 ? center.y : targetY) - root.y) * ease;
      const tags =
        state.player.place === 'outside' ? drawStreet(art.current, state, assets, session.ui) : drawRoom(art.current, state, session.ui, assets, floor);
      // In shared play, everyone else wears a small name tag.
      for (let i = 0; i < 3; i++) {
        const text = names.current[i];
        const tag = tags[i];
        if (!text) continue;
        text.visible = !!tag;
        if (!tag) continue;
        text.text = characterName(tag.slot);
        text.position.set(tag.x, tag.y);
        art.current
          .roundRect(tag.x - text.width / 2 - 10, tag.y - text.height / 2 - 4, text.width + 20, text.height + 8, 12)
          .fill({ color: p.surface, alpha: 0.92 });
      }
      if (host.current) host.current.dataset.colinPose = colinIdleFrame(session.ui.idle).pose;
      const building = currentBuilding(state);
      for (let i = 0; i < 3; i++) {
        const text = numbers.current[i];
        const person = building?.people[i];
        if (!text) continue;
        text.visible =
          building?.id !== 'cafe' &&
          !!person &&
          ['idle', 'waiting', 'riding'].includes(person.phase) &&
          (person.phase === 'riding' ? Math.round(building?.lift.position ?? 0) : person.floor) === floor &&
          (person.depth >= 0 || (building?.lift.landing.open ?? 0) > 0.95);
        if (person) {
          const bounds = actorBounds(person);
          text.text = floorLabel(person.wanted);
          text.position.set(bounds.x, bounds.y - bounds.height - 22);
        }
      }
    },
    [app, session, assets, host],
  );
  useTick(useCallback((ticker: Ticker) => frame(ticker.deltaMS / 1000), [frame]));
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => session.reducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, [session]);
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
    camera.current = { ...camera.current, manual: false, x: 0, y: 0 };
    gesture.current = null;
    pointers.current.clear();
    onManualChange(false);
    frame(0);
  }, [place, floor, followRequest, onManualChange, frame]);
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
        streetBuildings.map((building, index) => (
          <pixiText
            key={building.id}
            text={building.name}
            x={199 + index * 350}
            y={220}
            anchor={0.5}
            style={{ fontFamily: 'Georgia', fontSize: 25, fill: p.surface, fontWeight: 'bold' }}
          />
        ))
      ) : (
        <pixiText
          text={floor === 0 && place !== 'cafe' ? 'UT' : ''}
          x={1210}
          y={283}
          anchor={0.5}
          style={{ fontFamily: 'Georgia', fontSize: 22, fill: p.surface, fontWeight: 'bold' }}
        />
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
      {[0, 1, 2].map((index) => (
        <pixiText
          key={`name-${index}`}
          ref={(text) => {
            names.current[index] = text;
          }}
          text=''
          visible={false}
          anchor={0.5}
          style={{ fontFamily: 'Trebuchet MS', fontSize: 21, fill: p.ink, fontWeight: 'bold' }}
        />
      ))}
    </pixiContainer>
  );
}

export function GameScene({ session, paused }: { session: GameSession; paused: boolean }) {
  const { assets, error, retry } = usePaintedAssets();
  const host = useRef<HTMLDivElement>(null);
  const overview = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState<{ place: string; floor: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [zoom, setZoom] = useState(session.state.settings.cameraZoom);
  const changeZoom = useCallback(
    (value: number) => {
      session.state.settings.cameraZoom = value;
      setZoom(value);
    },
    [session],
  );
  const [followRequest, setFollowRequest] = useState(0);
  const follow = useCallback(() => setPreview(null), []);
  const state = session.state;
  const building = currentBuilding(state);
  const colinFloor = Math.round(playerLevel(state));
  const inspecting = preview?.place === state.player.place;
  const floor = inspecting ? preview.floor : colinFloor;
  const together = !!state.companions?.length;
  useEffect(() => {
    if (together && assets) void loadCompanionAssets(assets);
  }, [together, assets]);
  useEffect(() => {
    const save = window.setTimeout(() => {
      if (session.state.settings.cameraZoom === zoom) session.save();
    }, 250);
    return () => window.clearTimeout(save);
  }, [session, zoom]);
  useEffect(() => {
    if (building?.id) overview.current?.querySelector(`[data-floor="${floor}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [floor, building?.id]);
  const cameraMoved = manual;
  return (
    <>
      {building && (
        <nav ref={overview} className='floor-overview' aria-label='Husöversikt'>
          {floors(building.id)
            .reverse()
            .map((level) => (
              <button
                type='button'
                key={level}
                data-floor={level}
                aria-label={`Titta på våning ${floorLabel(level)}`}
                aria-pressed={floor === level}
                disabled={paused}
                onClick={() => setPreview({ place: building.id, floor: level })}
              >
                <b>{floorLabel(level)}</b>
                <span>
                  {definition(building.id).rooms[level]}
                  <small>
                    {[...(colinFloor === level ? [`${session.name} här`] : []), ...othersOnFloor(state, building.id, level)].join(' · ') || ' '}
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
        data-lift-floor={building ? floorLabel(Math.round(building.lift.position)) : undefined}
        data-indicator={building?.id}
        data-floor-view={building?.id === 'cafe' ? 'both' : 'single'}
        data-exit={building ? floor === 0 : undefined}
        aria-busy={!assets}
        data-camera={cameraMoved ? 'free' : 'follow'}
        data-zoom={zoom}
        ref={host}
        role='img'
        aria-label={
          building?.id === 'cafe'
            ? 'Kaféet med båda våningarna synliga. Tryck på golvet på valfri våning så går Colin dit via trappan. Dra för att flytta kameran. Nyp med två fingrar för att zooma.'
            : 'Colins hus i perspektiv. Välj en våning i husöversikten för att titta, tryck sedan i rummet för att gå dit. Dra för att flytta kameran. Nyp med två fingrar för att zooma.'
        }
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
              onZoom={changeZoom}
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
      {inspecting && <p className='room-preview-caption'>Våning {floorLabel(floor)} · Tryck i rummet för att gå dit</p>}
      {assets && (
        <fieldset className='camera-zoom' aria-label='Kamerazoom'>
          <button type='button' aria-label='Zooma ut' disabled={paused || zoom <= 1} onClick={() => changeZoom(Math.max(1, zoom - 0.5))}>
            −
          </button>
          <button type='button' aria-label='Zooma in' disabled={paused || zoom >= 2.5} onClick={() => changeZoom(Math.min(2.5, zoom + 0.5))}>
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
          ◎ Följ {session.name}
        </button>
      )}
    </>
  );
}

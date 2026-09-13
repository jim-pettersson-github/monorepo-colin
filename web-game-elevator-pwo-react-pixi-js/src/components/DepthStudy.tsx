import { useEffect, useRef, useState } from 'react';
import { worldPalette as p } from '../palette';
import '../depth-study.css';

// An isolated visual experiment. Coordinates refer to depth-room.webp (1448 × 1086).
const room = { width: 1448, height: 1086, horizon: 724, sill: 640, front: 1040 };
const door = { left: 720, right: 1063, top: 158, bottom: 636 };
const panel = { x: 654, y: 416 };
type Point = { x: number; depth: number };
type Action = 'call' | 'enter' | 'block' | 'close' | 'open' | 'near' | 'leave';
const scaleAt = (depth: number) => 0.7 + depth * 0.6;
const project = (point: Point) => ({ x: room.horizon + (point.x - room.horizon) * scaleAt(point.depth), y: room.sill + point.depth * 400 });
const unproject = (x: number, y: number): Point => {
  const depth = (y - room.sill) / 400;
  return { x: room.horizon + (x - room.horizon) / scaleAt(depth), depth };
};
const entrance = unproject((door.left + door.right) / 2, room.sill);
const besidePanel = unproject(550, 650);
const initial = () => ({
  player: { x: 470, depth: 0.66 } as Point,
  path: [] as Point[],
  intent: '' as '' | 'call',
  facing: 1,
  open: 1,
  doorTarget: 1,
  blocked: false,
  reach: 0,
  light: 0,
  time: 0,
  notice: 'Tryck på golvet. Colin går dit du pekar.',
});
type StudyState = ReturnType<typeof initial>;
type StudyImages = Record<string, HTMLImageElement>;
const inDoorway = (state: StudyState) => Math.abs(state.player.depth) < 0.075 && Math.abs(project(state.player).x - project(entrance).x) < 130;

function route(state: StudyState, target: Point) {
  state.reach = 0;
  state.intent = '';
  state.path = [];
  if (state.player.depth < 0 || target.depth < 0) {
    state.path.push({ ...entrance, depth: 0.12 });
    if (target.depth < 0) state.path.push({ ...entrance, depth: 0 });
  }
  state.path.push(target);
}

function act(state: StudyState, action: Action) {
  if (action === 'close' || action === 'open') {
    state.doorTarget = action === 'open' ? 1 : 0;
    state.blocked = false;
    state.notice = action === 'open' ? 'Dörrarna öppnas.' : 'Dörrarna stängs.';
    return;
  }
  state.blocked = false;
  if (action === 'call') {
    route(state, besidePanel);
    state.intent = 'call';
    state.notice = 'Colin går bredvid knappen och sträcker fram handen.';
  } else if (action === 'enter') {
    route(state, { ...entrance, depth: -0.18 });
    state.notice = 'Gå över tröskeln och in i hisskorgen.';
  } else if (action === 'block') {
    route(state, entrance);
    state.notice = 'Stå på tröskeln. Prova sedan att stänga dörrarna.';
  } else {
    route(state, { x: action === 'near' ? 620 : 780, depth: action === 'near' ? 0.93 : 0.4 });
    state.notice = action === 'near' ? 'Colin kommer närmare.' : 'Colin går ut på golvet.';
  }
}

function advance(state: StudyState, dt: number) {
  state.time += dt;
  state.light = Math.max(0, state.light - dt);
  if (state.reach > 0) {
    state.reach = Math.max(0, state.reach - dt);
    if (state.reach < 1.6) {
      state.light = 1.5;
      state.doorTarget = 1;
      state.notice = 'Knappen lyser. Hissen öppnar.';
    }
  }
  const next = state.path[0];
  if (next) {
    const dx = next.x - state.player.x;
    const dz = (next.depth - state.player.depth) * 650;
    const distance = Math.hypot(dx, dz);
    const fraction = Math.min(1, (220 * dt) / Math.max(0.001, distance));
    const candidate = { x: state.player.x + dx * fraction, depth: state.player.depth + (next.depth - state.player.depth) * fraction };
    const crossing = (state.player.depth >= 0 && candidate.depth < 0.035) || (state.player.depth < 0 && candidate.depth > -0.035);
    const atDoor = project(candidate).x > door.left - 10 && project(candidate).x < door.right + 10;
    if (crossing && atDoor && state.open < 0.94) {
      state.notice = 'Öppna dörrarna innan Colin går över tröskeln.';
    } else {
      if (Math.abs(dx) > 0.1) state.facing = dx > 0 ? 1 : -1;
      state.player = candidate;
      if (fraction === 1) {
        state.path.shift();
        if (!state.path.length && state.intent === 'call') {
          state.intent = '';
          state.facing = 1;
          state.reach = 2.2;
        }
      }
    }
  }
  if (state.doorTarget === 0 && inDoorway(state)) {
    state.doorTarget = 1;
    state.blocked = true;
    state.notice = 'Colin står i dörröppningen. Dörrarna öppnas igen.';
  }
  state.open += Math.sign(state.doorTarget - state.open) * Math.min(Math.abs(state.doorTarget - state.open), dt / 1.8);
}

function draw(ctx: CanvasRenderingContext2D, images: StudyImages, state: StudyState, guides: boolean) {
  ctx.clearRect(0, 0, room.width, room.height);
  ctx.drawImage(images.room, 0, 0, room.width, room.height);
  const feet = project(state.player);
  const size = scaleAt(state.player.depth);
  const reaching = state.reach > 0;
  const walking = state.path.length > 0;
  const sprite = images[reaching ? 'reach' : `colin-${walking ? [1, 2, 3, 2][Math.floor(state.time * 7) % 4] : 0}`];
  const height = 400 * size;
  const width = (height * sprite.naturalWidth) / sprite.naturalHeight;
  const drawColin = () => {
    ctx.save();
    ctx.fillStyle = p.ink;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(feet.x, feet.y + 3, 35 * size, 9 * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(feet.x, feet.y);
    ctx.scale(state.facing, 1);
    ctx.drawImage(sprite, -width * (reaching ? 0.35 : 0.5), -height, width, height);
    ctx.restore();
  };
  // A rider is behind the sliding leaves; someone on the sill is in front of them.
  if (state.player.depth < -0.035) drawColin();
  ctx.save();
  ctx.beginPath();
  ctx.rect(door.left, door.top, door.right - door.left, door.bottom - door.top);
  ctx.clip();
  const half = (door.right - door.left) / 2;
  for (const side of [-1, 1]) {
    const x = side === -1 ? door.left - half * state.open : door.left + half + half * state.open;
    ctx.drawImage(images.brass, x, door.top, half, door.bottom - door.top);
    const shade = ctx.createLinearGradient(x, 0, x + half, 0);
    shade.addColorStop(0, `${p.ink}70`);
    shade.addColorStop(0.2, `${p.light}20`);
    shade.addColorStop(0.8, `${p.ink}10`);
    shade.addColorStop(1, `${p.ink}b0`);
    ctx.fillStyle = shade;
    ctx.fillRect(x, door.top, half, door.bottom - door.top);
    ctx.strokeStyle = p.frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, door.top + 16, half - 20, door.bottom - door.top - 30);
  }
  ctx.restore();
  if (state.player.depth >= -0.035) drawColin();
  if (state.light > 0) {
    ctx.save();
    ctx.shadowColor = p.light;
    ctx.shadowBlur = 22;
    ctx.fillStyle = p.light;
    ctx.beginPath();
    ctx.ellipse(panel.x, panel.y, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (guides || inDoorway(state)) {
    ctx.strokeStyle = state.blocked ? p.light : p.surface;
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.strokeRect(door.left + 12, room.sill - 6, door.right - door.left - 24, 15);
    ctx.setLineDash([]);
  }
  const target = state.path.at(-1);
  if (target) {
    const point = project(target);
    ctx.strokeStyle = p.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, 13, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (guides) {
    ctx.strokeStyle = `${p.surface}70`;
    ctx.lineWidth = 1;
    for (const depth of [0.1, 0.4, 0.7, 1]) {
      ctx.beginPath();
      ctx.moveTo(140, room.sill + depth * 400);
      ctx.lineTo(1280, room.sill + depth * 400);
      ctx.stroke();
    }
  }
}

export function DepthStudy() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef(initial());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [guides, setGuides] = useState(false);
  const guideRef = useRef(false);
  guideRef.current = guides;
  const [status, setStatus] = useState({ notice: state.current.notice, position: 'I rummet', door: 'Öppen', scale: 110, pose: 'standing', lit: false });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads the same local assets.
  useEffect(() => {
    let active = true;
    let frame = 0;
    setError(false);
    const sources = {
      room: 'depth-study/room.webp',
      reach: 'depth-study/reach.webp',
      brass: 'painted/brass.webp',
      ...Object.fromEntries([0, 1, 2, 3].map((i) => [`colin-${i}`, `painted/colin-${i}.webp`])),
    };
    Promise.all(
      Object.entries(sources).map(async ([key, file]) => {
        const image = new Image();
        image.src = `${import.meta.env.BASE_URL}${file}`;
        await image.decode();
        return [key, image] as const;
      }),
    )
      .then((entries) => {
        if (!active) return;
        const images = Object.fromEntries(entries);
        const ctx = canvas.current?.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        setLoaded(true);
        let previous = performance.now();
        let published = 0;
        const tick = (now: number) => {
          const dt = document.hidden ? 0 : Math.min(0.05, (now - previous) / 1000);
          previous = now;
          advance(state.current, dt);
          draw(ctx, images, state.current, guideRef.current);
          if (now - published > 100) {
            const s = state.current;
            setStatus({
              notice: s.notice,
              position: inDoorway(s) ? 'På tröskeln' : s.player.depth < 0 ? 'Inne i hissen' : 'I rummet',
              door: s.blocked ? 'Öppnas igen' : s.open === 1 ? 'Öppen' : s.open === 0 ? 'Stängd' : s.doorTarget ? 'Öppnar' : 'Stänger',
              scale: Math.round(scaleAt(s.player.depth) * 100),
              pose: s.reach > 0 ? 'reaching' : s.path.length ? 'walking' : 'standing',
              lit: s.light > 0,
            });
            published = now;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [attempt]);

  return (
    <main className='depth-study'>
      <header className='depth-header'>
        <a href={import.meta.env.BASE_URL}>← Till spelet</a>
        <span>COLINS HISSÄVENTYR · RUMSPROV</span>
        <a href={`${import.meta.env.BASE_URL}?view=art`}>Konststil 01 ↗</a>
      </header>
      <div className='depth-intro'>
        <p className='eyebrow'>Ett rum att kliva in i</p>
        <h1>Närmare. Längre bort. In i hissen.</h1>
        <p>Tryck på golvet för att gå. Tryck på mässingsknappen bredvid hissen för att kalla på den.</p>
      </div>
      <div className='depth-layout'>
        <section
          className='depth-stage'
          aria-label='Ett målat rum med djup'
          data-position={status.position}
          data-door={status.door}
          data-pose={status.pose}
          data-lit={status.lit}
          data-scale={status.scale}
        >
          <canvas
            ref={canvas}
            width={room.width}
            height={room.height}
            aria-label='Tryck på golvet, hissknappen eller den öppna hisskorgen. Knapparna bredvid ger samma handlingar.'
            onPointerUp={(event) => {
              if (!loaded || event.button !== 0) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - bounds.left) * room.width) / bounds.width;
              const y = ((event.clientY - bounds.top) * room.height) / bounds.height;
              if (Math.abs(x - panel.x) < 35 && y > 380 && y < 480) act(state.current, 'call');
              else if (x > door.left && x < door.right && y > door.top && y < room.sill - 20) act(state.current, 'enter');
              else if (x > door.left && x < door.right && Math.abs(y - room.sill) < 24) act(state.current, 'block');
              else if (y > room.sill + 20 && y < room.front && x > 130 && x < 1280) {
                route(state.current, unproject(x, y));
                state.current.notice = 'Colin går dit du pekar.';
              }
            }}
          />
          {!loaded && (
            <div className='depth-loading' role='status'>
              {error ? (
                <>
                  <p>Bilderna kunde inte laddas.</p>
                  <button type='button' onClick={() => setAttempt((a) => a + 1)}>
                    Försök igen
                  </button>
                </>
              ) : (
                'Målar upp rummet…'
              )}
            </div>
          )}
          <div className='depth-caption'>
            <span>{status.position}</span>
            <span>Hissdörr · {status.door.toLowerCase()}</span>
          </div>
        </section>
        <aside className='depth-controls'>
          <p className='eyebrow'>Prova i din egen takt</p>
          <div className='depth-actions'>
            {(
              [
                ['call', 'Tryck på hissknappen'],
                ['enter', 'Gå in i hissen'],
                ['block', 'Stå i dörröppningen'],
                ['close', 'Stäng dörrarna'],
                ['open', 'Öppna dörrarna'],
                ['leave', 'Gå ut på golvet'],
                ['near', 'Kom närmare'],
              ] as const
            ).map(([action, label]) => (
              <button
                type='button'
                key={action}
                disabled={!loaded}
                aria-pressed={action === 'call' ? status.lit : undefined}
                onClick={() => act(state.current, action)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className='depth-notice' role='status'>
            {status.notice}
          </p>
          <label className='depth-guide'>
            <input type='checkbox' checked={guides} onChange={(event) => setGuides(event.target.checked)} /> Visa djup och tröskel
          </label>
          <p className='depth-review-note'>Ett separat rörelseprov. Dina sparade äventyr påverkas inte.</p>
          <button
            type='button'
            className='depth-reset'
            onClick={() => {
              state.current = initial();
            }}
          >
            Börja om provet ↺
          </button>
        </aside>
      </div>
    </main>
  );
}

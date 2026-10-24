import { useEffect, useRef, useState } from 'react';
import { RaceAudio } from '../game/audio';
import { carName } from '../game/cars';
import { DriverInput, type InputAction, type TouchState } from '../game/input';
import { shift } from '../game/physics';
import { createRace, formatTime, type Race, type ResultRow, raceResults, resetRacer, STEP, stepRace } from '../game/race';
import { type Settings, saveLapRecord } from '../game/storage';
import { cameraModes, RaceRenderer } from '../render/race-renderer';
import { Hud, type HudController } from './Hud';
import { TouchControls } from './TouchControls';

type Props = {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onExit: (screen: 'title' | 'garage') => void;
};

type Outcome = { rows: ResultRow[]; bestLap: number; record: boolean };

const cameraNames = { chase: 'Jakt', far: 'Lång jakt', bumper: 'Stötfångare' };

export function RaceView({ settings, onSettings, onExit }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [race, setRace] = useState<Race>(() => createRace(settings));
  const [paused, setPaused] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const [renderError, setRenderError] = useState(false);
  const [touchMode, setTouchMode] = useState(() => matchMedia('(pointer: coarse)').matches);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HudController>(null);
  const pausedRef = useRef(false);
  const settingsRef = useRef(settings);
  const rendererRef = useRef<RaceRenderer>(undefined);
  const audioRef = useRef<RaceAudio>(undefined);
  const inputRef = useRef<DriverInput>(undefined);
  const touch = useRef<TouchState>({ left: false, right: false, throttle: false, brake: false, handbrake: false });
  const actionRef = useRef<(action: InputAction) => void>(() => {});
  settingsRef.current = settings;

  const setPausedState = (value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
    inputRef.current?.clear();
    if (value) audioRef.current?.suspend();
    else audioRef.current?.start();
  };

  actionRef.current = (action) => {
    const renderer = rendererRef.current;
    if (action === 'pause') {
      if (!outcome) setPausedState(!pausedRef.current);
      return;
    }
    if (pausedRef.current) return;
    if (action === 'camera' && renderer) {
      const next = cameraModes[(cameraModes.indexOf(renderer.mode) + 1) % cameraModes.length];
      renderer.mode = next;
      onSettings({ ...settingsRef.current, camera: next });
    }
    if (action === 'reset' && race.phase === 'racing') resetRacer(race, race.player);
    if (action === 'mute') {
      const sound = !settingsRef.current.sound;
      audioRef.current?.setMuted(!sound);
      onSettings({ ...settingsRef.current, sound });
    }
    if (settings.transmission === 'manual' && (action === 'shiftUp' || action === 'shiftDown')) shift(race.player.state, action === 'shiftUp' ? 1 : -1);
  };

  // setPausedState only touches refs and stable setters, so the loop restarts only for a new race.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: RaceRenderer;
    try {
      renderer = new RaceRenderer(canvas, race, settingsRef.current.retro);
    } catch (error) {
      console.error(error);
      setRenderError(true);
      return;
    }
    renderer.mode = settingsRef.current.camera;
    rendererRef.current = renderer;
    if (import.meta.env.DEV) Object.assign(window, { charlieRace: race });
    const audio = new RaceAudio();
    audio.muted = !settingsRef.current.sound;
    audio.start();
    audioRef.current = audio;
    const input = new DriverInput((action) => actionRef.current(action), touch.current);
    inputRef.current = input;

    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    let last = performance.now();
    let accumulator = 0;
    let lastBeep = 4;
    let finishSeen = false;

    const loop = (now: number) => {
      const delta = Math.min(0.1, (now - last) / 1000);
      last = now;
      const controls = input.read();

      if (!pausedRef.current) {
        accumulator += delta;
        while (accumulator >= STEP) {
          stepRace(race, controls);
          accumulator -= STEP;
        }
        const beep = Math.ceil(race.countdown);
        if (race.phase === 'countdown' && beep < lastBeep && beep <= 3) {
          lastBeep = beep;
          audio.beep(false);
        }
        if (race.phase === 'racing' && lastBeep > 0) {
          lastBeep = 0;
          audio.beep(true);
        }
        audio.update(race.player.state, race.player.finishTime ? 0.3 : controls.throttle);
        renderer.render(delta);
        hud.current?.update(race);
        canvas.dataset.rendered = 'true';
      }

      if (race.phase === 'finished' && !finishSeen) {
        finishSeen = true;
        const bestLap = race.player.bestLap;
        const record = saveLapRecord(race.track.id, bestLap, race.player.spec.id);
        window.setTimeout(() => setOutcome({ rows: raceResults(race), bestLap, record }), 3500);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const pauseWhenHidden = () => {
      if (document.hidden && !pausedRef.current && race.phase !== 'finished') setPausedState(true);
    };
    const noticeTouch = () => setTouchMode(true);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('touchstart', noticeTouch, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('touchstart', noticeTouch);
      input.dispose();
      audio.dispose();
      renderer.dispose();
      rendererRef.current = undefined;
    };
  }, [race]);

  const restart = () => {
    setOutcome(undefined);
    setPausedState(false);
    setAttempt((value) => value + 1);
    setRace(createRace(settingsRef.current));
  };

  const player = race.player;

  return (
    <main className='race-view' data-attempt={attempt}>
      <canvas ref={canvasRef} className={settings.retro ? 'race-canvas retro' : 'race-canvas'} aria-label={`Race på ${race.track.name}`} />
      {renderError && <p className='render-error'>Kunde inte starta 3D-grafiken i den här webbläsaren.</p>}
      <Hud race={race} controller={hud} />

      <div className='race-buttons'>
        <button type='button' className='round-button' aria-label='Pausa' onClick={() => setPausedState(true)}>
          ❚❚
        </button>
        {touchMode && (
          <>
            <button type='button' className='round-button' aria-label='Byt kamera' onClick={() => actionRef.current('camera')}>
              🎥
            </button>
            <button type='button' className='round-button' aria-label='Tillbaka på banan' onClick={() => actionRef.current('reset')}>
              ↺
            </button>
          </>
        )}
      </div>

      {touchMode && !paused && !outcome && <TouchControls touch={touch.current} />}

      {paused && (
        <div className='overlay'>
          <section className='panel pause-panel' aria-labelledby='pause-title'>
            <h2 id='pause-title'>Paus</h2>
            <p>
              {carName(player.spec)} · {race.track.name} · Varv {Math.max(1, player.lap + 1)}/{race.settings.laps}
            </p>
            <button type='button' className='primary' onClick={() => setPausedState(false)}>
              Fortsätt
            </button>
            <button type='button' onClick={restart}>
              Starta om
            </button>
            <button
              type='button'
              onClick={() => {
                const next = cameraModes[(cameraModes.indexOf(settings.camera) + 1) % cameraModes.length];
                if (rendererRef.current) rendererRef.current.mode = next;
                onSettings({ ...settings, camera: next });
              }}
            >
              Kamera: {cameraNames[settings.camera]}
            </button>
            <button
              type='button'
              aria-pressed={settings.sound}
              onClick={() => {
                audioRef.current?.setMuted(settings.sound);
                onSettings({ ...settings, sound: !settings.sound });
              }}
            >
              Ljud: {settings.sound ? 'På' : 'Av'}
            </button>
            <button type='button' onClick={() => onExit('title')}>
              Avsluta racet
            </button>
          </section>
        </div>
      )}

      {outcome && (
        <div className='overlay'>
          <section className='panel results-panel' aria-labelledby='results-title'>
            <h2 id='results-title'>{outcome.rows.find((row) => row.isPlayer)?.position === 1 ? 'Seger!' : 'Resultat'}</h2>
            <p className='results-sub'>
              {race.track.name} · {race.settings.laps} varv
              {outcome.record && <strong className='record'> · Nytt banrekord {formatTime(outcome.bestLap)}!</strong>}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Förare</th>
                  <th>Bil</th>
                  <th>Tid</th>
                  <th>Bästa varv</th>
                </tr>
              </thead>
              <tbody>
                {outcome.rows.map((row) => (
                  <tr key={row.driverName + row.car.id} className={row.isPlayer ? 'me' : undefined}>
                    <td>{row.position}</td>
                    <td>{row.driverName}</td>
                    <td>{carName(row.car)}</td>
                    <td>
                      {row.estimated ? '≈ ' : ''}
                      {formatTime(row.time)}
                    </td>
                    <td>{formatTime(row.bestLap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className='panel-actions'>
              <button type='button' className='primary' onClick={restart}>
                Kör igen
              </button>
              <button type='button' onClick={() => onExit('garage')}>
                Byt bil
              </button>
              <button type='button' onClick={() => onExit('title')}>
                Huvudmeny
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

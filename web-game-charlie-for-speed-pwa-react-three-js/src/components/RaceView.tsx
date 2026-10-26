import { useEffect, useRef, useState } from 'react';
import { RaceAudio } from '../game/audio';
import { POINTS } from '../game/career';
import { carName } from '../game/cars';
import { DriverInput, type InputAction, type TouchState } from '../game/input';
import type { NetworkRace } from '../game/network-race';
import { forwardSpeed, shift } from '../game/physics';
import { createRace, type Entrant, formatTime, type Race, type ResultRow, raceResults, resetRacer, STEP, stepRace } from '../game/race';
import { reportStats } from '../game/room-server';
import { type Settings, saveLapRecord } from '../game/storage';
import { cameraModes, RaceRenderer } from '../render/race-renderer';
import { FullscreenButton } from './FullscreenButton';
import { Hud, type HudController } from './Hud';
import { TouchControls } from './TouchControls';
import { VolumeControl } from './VolumeControl';

type Props = {
  network?: NetworkRace;
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onExit: (screen: 'title' | 'garage') => void;
  // Career races use a prepared field and hand the results back instead of offering a rematch.
  career?: { title: string; field: Entrant[]; onFinish: (rows: ResultRow[]) => void; onQuit: () => void };
};

type Outcome = { rows: ResultRow[]; bestLap: number; record: boolean };

const cameraNames = { chase: 'Jakt', far: 'Lång jakt', bumper: 'Stötfångare' };

export function RaceView({ settings, onSettings, onExit, career, network }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [race, setRace] = useState<Race>(() => network?.race ?? createRace(settings, undefined, career?.field));
  const [paused, setPaused] = useState(false);
  const [, refreshNetwork] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>();
  const [renderError, setRenderError] = useState(false);
  const [touchMode, setTouchMode] = useState(() => matchMedia('(pointer: coarse)').matches);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HudController>(null);
  const pausedRef = useRef(false);
  const settingsRef = useRef(settings);
  const rendererRef = useRef<RaceRenderer>(undefined);
  const networkDisposal = useRef<ReturnType<typeof setTimeout>>(undefined);
  const audioRef = useRef<RaceAudio>(undefined);
  const inputRef = useRef<DriverInput>(undefined);
  const touch = useRef<TouchState>({ left: false, right: false, throttle: false, brake: false, handbrake: false });
  const actionRef = useRef<(action: InputAction) => void>(() => {});
  settingsRef.current = settings;

  const applyPausedState = (value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
    inputRef.current?.clear();
    if (value) audioRef.current?.suspend();
    else audioRef.current?.start();
  };

  const setPausedState = (value: boolean) => {
    if (network) {
      if (value) network.wire.pause();
      else network.wire.resume();
    } else applyPausedState(value);
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
    if (network && ['reset', 'shiftUp', 'shiftDown'].includes(action)) {
      network.action(action as 'reset' | 'shiftUp' | 'shiftDown');
      return;
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
    clearTimeout(networkDisposal.current);
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: RaceRenderer;
    try {
      renderer = new RaceRenderer(canvas, race);
    } catch (error) {
      console.error(error);
      setRenderError(true);
      return;
    }
    renderer.mode = settingsRef.current.camera;
    rendererRef.current = renderer;
    if (import.meta.env.DEV) Object.assign(window, { charlieRace: race, charlieRenderer: renderer, charlieNetwork: network });
    const audio = new RaceAudio(race.player.spec);
    audio.muted = !settingsRef.current.sound;
    audio.volume = settingsRef.current.volume;
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
    // A host whose drawing is slow (a weak phone) draws every other frame. The frames in between still run the race
    // and send updates, so guests get about twice as many while the host's own picture keeps its frame rate.
    let renderCost = 0;
    let undrawn = 0;
    const draw = (delta: number) => {
      const slowHost = network?.localSlot === 0 && renderCost > 0.03;
      undrawn += delta;
      if (slowHost && undrawn === delta) return;
      const started = performance.now();
      renderer.render(Math.min(0.1, undrawn));
      renderCost += ((performance.now() - started) / 1000 - renderCost) * 0.1;
      undrawn = 0;
      report.frames++;
      hud.current?.update(race);
      canvas.dataset.rendered = 'true';
    };
    let finishTimer: ReturnType<typeof setTimeout> | undefined;

    // Performance report for online races: frames drawn and race updates moved, every 10 s.
    let report = { at: performance.now(), frames: 0, updates: 0 };
    const sendReport = (now: number) => {
      if (!network || now - report.at < 10_000) return;
      const seconds = (now - report.at) / 1000;
      const host = network.localSlot === 0;
      const updates = host ? network.wire.framesSent : network.wire.framesReceived;
      if (race.phase === 'racing' && !pausedRef.current)
        reportStats({
          role: host ? 'host' : 'guest',
          fps: Math.round((report.frames / seconds) * 10) / 10,
          updates: Math.round(((updates - report.updates) / seconds) * 10) / 10,
          players: race.racers.filter((racer) => racer.isPlayer).length,
          resolution: Math.round(renderer.resolution * 100) / 100,
          speed: Math.round(Math.abs(forwardSpeed(race.player.state)) * 3.6),
        });
      report = { at: now, frames: 0, updates };
    };

    const loop = (now: number) => {
      const raw = (now - last) / 1000;
      const delta = Math.min(0.1, raw);
      last = now;
      const controls = input.read();
      sendReport(now);

      // The online race keeps real time on a slow device; drawing and sound still take capped steps.
      if (network) network.advance(Math.min(0.25, raw), controls, input.available);
      if (!pausedRef.current) {
        if (!network) accumulator += delta;
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
        const inside = Math.min(race.player.state.s - race.track.tunnel.start, race.track.tunnel.end - race.player.state.s);
        audio.update(race.player.state, race.player.finishTime ? 0.3 : controls.throttle, Math.max(0, Math.min(1, inside / 16)));
        draw(delta);
      }

      if (race.phase === 'finished' && !finishSeen) {
        finishSeen = true;
        const bestLap = race.player.bestLap;
        const record = !network && saveLapRecord(race.track.id, bestLap, race.player.spec.id);
        finishTimer = setTimeout(
          () =>
            setOutcome({
              rows: raceResults(race).map((row) => (network ? { ...row, isPlayer: row.driverName === race.player.driverName } : row)),
              bestLap,
              record,
            }),
          3500,
        );
      }
      if (network && pausedRef.current) draw(delta);
      frame = requestAnimationFrame(loop);
    };
    let epoch = network?.wire.epoch;
    if (network)
      network.onChange = () => {
        refreshNetwork((revision) => revision + 1);
        if (epoch !== network.wire.epoch) {
          clearTimeout(finishTimer);
          epoch = network.wire.epoch;
          finishSeen = false;
          lastBeep = 4;
          setOutcome(undefined);
        }
        if (pausedRef.current !== network.wire.paused) applyPausedState(network.wire.paused);
        else setPaused(network.wire.paused);
      };
    network?.onChange?.();
    frame = requestAnimationFrame(loop);

    const pauseWhenHidden = () => {
      if (document.hidden) audio.suspend();
      if (network) {
        network.wire.setForeground(!document.hidden);
        return;
      }
      if (document.hidden && !pausedRef.current && race.phase !== 'finished') setPausedState(true);
    };
    const blur = () => network?.wire.setForeground(false);
    const focus = () => {
      if (!document.hidden) network?.wire.setForeground(true);
    };
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', blur);
    const noticeTouch = () => setTouchMode(true);
    // Retry audio unlock from a real gesture when a browser suspended the initial context.
    const unlockAudio = () => {
      if (!pausedRef.current && !document.hidden) audio.start();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('touchstart', noticeTouch, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(finishTimer);
      if (network) {
        network.onChange = undefined;
        networkDisposal.current = setTimeout(() => network.dispose(), 0);
      }
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', blur);
      observer.disconnect();
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('touchstart', noticeTouch);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      input.dispose();
      audio.dispose();
      renderer.dispose();
      rendererRef.current = undefined;
    };
  }, [race]);

  const restart = () => {
    if (network) {
      network.restart();
      return;
    }
    setOutcome(undefined);
    setPausedState(false);
    setAttempt((value) => value + 1);
    setRace(createRace(settingsRef.current, undefined, career?.field));
  };

  const player = race.player;

  return (
    <main className='race-view' data-attempt={attempt}>
      <canvas ref={canvasRef} className='race-canvas' aria-label={`Race på ${race.track.name}`} />
      {renderError && <p className='render-error'>Kunde inte starta 3D-grafiken i den här webbläsaren.</p>}
      <Hud race={race} controller={hud} />
      <div className='race-fullscreen'>
        <FullscreenButton compact />
      </div>
      {network && <span className='network-race-label'>ONLINE · DU ÄR P{network.localSlot + 1}</span>}

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
            {network && <p role='status'>{network.wire.reason}</p>}
            <button type='button' className='primary' disabled={network && !network.wire.canResume} onClick={() => setPausedState(false)}>
              Fortsätt
            </button>
            {(!network || network.localSlot === 0) && !career && (
              <button type='button' disabled={network && !network.wire.canResume} onClick={restart}>
                Starta om
              </button>
            )}
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
            <VolumeControl
              value={settings.volume}
              onChange={(volume) => {
                audioRef.current?.setVolume(volume);
                onSettings({ ...settingsRef.current, volume });
              }}
            />
            <button type='button' onClick={() => (career ? career.onQuit() : onExit('title'))}>
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
              {career ? `${career.title} · ` : ''}
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
                  {career && <th>Poäng</th>}
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
                    {career && <td>{POINTS[row.position - 1] ?? 0}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {career ? (
              <div className='panel-actions'>
                {!network || network.localSlot === 0 ? (
                  <button type='button' className='primary' onClick={() => career.onFinish(outcome.rows)}>
                    Fortsätt
                  </button>
                ) : (
                  <p>Väntar på värden.</p>
                )}
              </div>
            ) : (
              <div className='panel-actions'>
                {!network || network.localSlot === 0 ? (
                  <button type='button' className='primary' disabled={network && !network.wire.canResume} onClick={restart}>
                    Kör igen
                  </button>
                ) : (
                  <p>Väntar på värden.</p>
                )}
                {!network && (
                  <button type='button' onClick={() => onExit('garage')}>
                    Byt bil
                  </button>
                )}
                <button type='button' onClick={() => onExit('title')}>
                  Huvudmeny
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

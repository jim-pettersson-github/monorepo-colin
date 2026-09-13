import { GameAudio } from './audio';
import { type Command, createGame, currentBuilding, type GameState, liftPhase, type Settings } from './model';
import { command, createUI, step } from './simulation';
import { loadGame, type Storage, saveGame } from './storage';

export class GameSession {
  state: GameState;
  ui = createUI();
  audio = new GameAudio();
  paused = false;
  hidden = false;
  storageMessage = '';
  listeners = new Set<() => void>();
  revision = 0;
  accumulator = 0;
  saveElapsed = 0;
  signature = '';

  constructor(public storage: Storage) {
    const saved = loadGame(storage);
    this.state = saved.state ?? createGame();
    this.storageMessage = saved.message;
    if (!saved.state && typeof matchMedia !== 'undefined') this.state.settings.smoothCamera = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.revision;
  notify() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  send(action: Command) {
    if (this.paused || this.hidden) return;
    this.audio.unlock();
    command(this.state, this.ui, action);
    this.flush();
    this.save();
    this.notify();
  }

  advance(seconds: number) {
    if (this.paused || this.hidden) return;
    this.accumulator += Math.min(Math.max(seconds, 0), 0.1);
    while (this.accumulator >= 1 / 60) {
      step(this.state, this.ui, 1 / 60);
      this.accumulator -= 1 / 60;
      this.saveElapsed += 1 / 60;
    }
    this.flush();
    const building = currentBuilding(this.state);
    const player = this.state.player;
    const signature = JSON.stringify([
      player.place,
      player.floor,
      player.riding,
      !!player.stairs,
      player.targetX === null,
      this.ui.panel,
      this.ui.notice,
      this.ui.alarmRemaining > 0,
      building && [
        liftPhase(building.lift),
        Math.round(building.lift.position),
        building.lift.destination,
        building.lift.queue,
        building.lift.landing.target,
        building.lift.gate.target,
        building.lights,
        building.roomDoors,
        building.people.map((person) => [person.phase, person.floor, person.wanted]),
      ],
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.save();
      this.notify();
    }
    if (this.saveElapsed >= 1) {
      this.save();
      this.saveElapsed = 0;
    }
  }

  flush() {
    this.audio.sync(this.state, this.paused || this.hidden, this.ui.alarmRemaining);
    for (const event of this.ui.sounds.splice(0)) {
      if (this.state.player.place === event.building && !this.state.settings.muted && !this.paused && !this.hidden) this.audio.play(event);
    }
  }

  save() {
    if (!this.state.started) return;
    if (!saveGame(this.storage, this.state)) {
      if (!this.storageMessage) {
        this.storageMessage = 'Spelet kan inte spara just nu. Fortsätt gärna spela.';
        this.notify();
      }
    }
  }

  pause(paused: boolean, hidden = this.hidden) {
    this.paused = paused;
    this.hidden = hidden;
    this.accumulator = 0;
    if (paused || hidden) {
      this.ui.alarmRemaining = 0;
      this.audio.pause();
      this.save();
    } else if (this.audio.context) this.audio.unlock();
    this.notify();
  }

  settings(update: Partial<Settings>) {
    this.state.settings = { ...this.state.settings, ...update };
    this.flush();
    this.save();
    this.notify();
  }

  restart() {
    const settings = this.state.settings;
    this.state = createGame();
    this.state.started = true;
    this.state.settings = settings;
    this.ui = createUI();
    this.save();
    this.notify();
  }
}

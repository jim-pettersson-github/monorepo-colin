import { GameAudio } from './audio';
import { resetColinIdle } from './colin-idle';
import { type Command, characterName, createGame, currentBuilding, type GameState, liftPhase, type Settings } from './model';
import { createCompanion, type SharedSound } from './shared';
import { command, createUI, step } from './simulation';
import { loadGame, type Storage, saveGame } from './storage';

// Shared play attaches to the host's session without changing single play.
export interface SessionLink {
  tick(seconds: number): void;
  sounds(events: SharedSound[]): void;
  paused(): void;
}

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
  link: SessionLink | null = null;

  constructor(public storage: Storage) {
    const saved = loadGame(storage);
    this.state = saved.state ?? createGame();
    this.storageMessage = saved.message;
    if (typeof matchMedia !== 'undefined') {
      this.ui.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!saved.state) this.state.settings.smoothCamera = !this.ui.reducedMotion;
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.revision;
  get name() {
    return characterName(this.state.slot);
  }
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
    this.link?.tick(seconds);
    this.refresh();
    if (this.saveElapsed >= 1) {
      this.save();
      this.saveElapsed = 0;
    }
  }

  // Re-render the HTML controls only when something they show has changed.
  refresh() {
    const building = currentBuilding(this.state);
    const player = this.state.player;
    const signature = JSON.stringify([
      this.state.companions?.map((companion) => [companion.slot, companion.player.place, companion.player.floor, companion.player.riding]),
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
        building.people.map((person) => [person.phase, person.floor, person.wanted]),
      ],
    ]);
    if (signature !== this.signature) {
      this.signature = signature;
      this.save();
      this.notify();
    }
  }

  flush() {
    this.audio.sync(this.state, this.paused || this.hidden, this.ui.alarmRemaining);
    const own = this.state.slot ?? 0;
    const events: SharedSound[] = [
      ...this.ui.sounds.splice(0).map((event) => ({ slot: own, event })),
      ...(this.state.companions ?? []).flatMap((companion) => companion.ui.sounds.splice(0).map((event) => ({ slot: companion.slot, event }))),
    ];
    for (const { slot, event } of events) {
      // Other players' alarm samples stay on their own devices.
      if (slot !== own && event.type === 'alarm') continue;
      if (this.state.player.place === event.building && !this.state.settings.muted && !this.paused && !this.hidden) this.audio.play(event);
    }
    if (events.length) this.link?.sounds(events);
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
    this.link?.paused();
    this.notify();
  }

  settings(update: Partial<Settings>) {
    this.state.settings = { ...this.state.settings, ...update };
    this.flush();
    this.save();
    this.notify();
  }

  reducedMotion(reduce: boolean) {
    this.ui.reducedMotion = reduce;
    if (reduce) resetColinIdle(this.ui.idle);
  }

  restart() {
    const settings = this.state.settings;
    const reducedMotion = this.ui.reducedMotion;
    const companions = this.state.companions;
    this.state = createGame();
    this.state.started = true;
    this.state.settings = settings;
    // Companions playing along start over beside Colin.
    if (companions) this.state.companions = companions.map((companion) => createCompanion(this.state, companion.slot));
    this.ui = createUI();
    this.ui.reducedMotion = reducedMotion;
    this.save();
    this.notify();
  }
}

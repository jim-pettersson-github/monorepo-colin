import { gameAudio } from './audio';
import type { GameInput } from './input';
import type { GameState } from './model';
import { nextAttempt, nextEvent } from './model';
import { STEP, step } from './simulation';
import { recordResults, saveGame } from './storage';
export class Session {
  paused = false;
  foreground = true;
  reason = '';
  private accumulator = 0;
  private notifyTime = 0;
  private saveTime = 0;
  private footTime = 0;
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(
    public state: GameState,
    public input: GameInput,
  ) {
    this.input.start(state.settings.sources, state.settings.players);
    this.save();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  private publish() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  get canResume() {
    return this.foreground && this.state.settings.sources.slice(0, this.state.settings.players).every((s) => this.input.available(s));
  }
  pause = (reason = 'Loppet väntar på dig.') => {
    this.paused = true;
    this.reason = reason;
    this.accumulator = 0;
    this.input.stop();
    gameAudio.stop();
    this.save();
    this.publish();
  };
  resume = () => {
    if (!this.canResume) return;
    this.paused = false;
    this.accumulator = 0;
    this.input.start(this.state.settings.sources, this.state.settings.players);
    this.publish();
  };
  setForeground(value: boolean) {
    this.foreground = value;
    if (!value) this.pause('Spelet pausades när du lämnade det.');
    else this.publish();
  }
  advance(elapsed: number) {
    if (this.paused || !['playing', 'countdown'].includes(this.state.phase)) return;
    this.accumulator += Math.min(0.1, Math.max(0, elapsed));
    while (this.accumulator >= STEP) {
      const phase = this.state.phase;
      const countdown = Math.ceil(this.state.countdown);
      const commands = this.input.consume();
      if (commands.some((c) => c.action)) gameAudio.play('jump');
      step(this.state, commands);
      this.accumulator -= STEP;
      if (phase === 'countdown' && Math.ceil(this.state.countdown) !== countdown) gameAudio.play(this.state.phase === 'playing' ? 'go' : 'count');
      if (phase !== this.state.phase) {
        this.save();
        this.publish();
      }
      if (this.state.phase === 'attempt-result' || this.state.phase === 'results') {
        gameAudio.play('finish');
        this.input.stop();
        this.accumulator = 0;
        break;
      }
    }
    this.notifyTime += elapsed;
    this.saveTime += elapsed;
    this.footTime += elapsed;
    if (this.footTime > 0.28 && this.state.runners[0].speed > 3 && !this.state.runners[0].done) {
      this.footTime = 0;
      gameAudio.play('step');
    }
    if (this.notifyTime > 0.08) {
      this.notifyTime = 0;
      this.publish();
    }
    if (this.saveTime > 2) {
      this.saveTime = 0;
      this.save();
    }
  }
  next = () => {
    if (this.state.phase === 'attempt-result') nextAttempt(this.state);
    else nextEvent(this.state);
    this.accumulator = 0;
    this.input.start(this.state.settings.sources, this.state.settings.players);
    this.save();
    this.publish();
  };
  save = () => {
    recordResults(this.state);
    saveGame(this.state);
  };
  dispose() {
    this.input.stop();
    gameAudio.stop();
  }
}

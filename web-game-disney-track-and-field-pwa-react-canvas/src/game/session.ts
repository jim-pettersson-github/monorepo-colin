import { gameAudio } from './audio';
import type { GameInput } from './input';
import type { Commands, GameState, Source } from './model';
import { nextAttempt, nextEvent } from './model';
import { STEP, step } from './simulation';
import { recordResults, saveGame } from './storage';
export class Session {
  networkRole: 'host' | 'guest' | null = null;
  localSlot = 0;
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
    protected options: { source?: Source; persistent?: boolean } = {},
  ) {
    this.startInput();
    this.save();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  protected publish() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  get canResume() {
    return this.foreground && this.localPlayers.every((player) => this.input.available(this.controlSource(player)));
  }
  get localPlayers() {
    return this.options.source ? [this.localSlot] : Array.from({ length: this.state.settings.players }, (_, i) => i);
  }
  controlSource(player: number) {
    return this.options.source ?? this.state.settings.sources[player];
  }
  inputPlayer(player: number) {
    return this.options.source ? 0 : player;
  }
  protected startInput() {
    this.input.start(this.options.source ? [this.options.source] : this.state.settings.sources, this.options.source ? 1 : this.state.settings.players);
  }
  protected commands(): Commands[] {
    return this.input.consume();
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
    this.startInput();
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
      const commands = this.commands();
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
    this.startInput();
    this.save();
    this.publish();
  };
  save = () => {
    if (this.options.persistent === false) return;
    recordResults(this.state);
    saveGame(this.state);
  };
  dispose() {
    this.input.stop();
    gameAudio.stop();
  }
}

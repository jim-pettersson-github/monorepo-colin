import type { InputManager } from './input';
import type { MatchState, PlaybackSpeed } from './model';
import { neutralControls, STEP } from './model';
import { stepMatch } from './simulation';
import { clearMatch, saveMatch } from './storage';

export class MatchSession {
  paused = false;
  pauseReason = '';
  portrait = false;
  private accumulator = 0;
  private notificationTime = 0;
  private saveTime = 0;
  private revision = 0;
  private listeners = new Set<() => void>();

  constructor(
    public state: MatchState,
    public input: InputManager,
    private onFinished?: (state: MatchState) => void,
  ) {}

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

  pause(reason = 'Ta en paus. Matchen väntar på dig.') {
    if (this.state.phase === 'finished') return;
    this.paused = true;
    this.pauseReason = reason;
    this.accumulator = 0;
    this.input.clear();
    this.save();
    this.publish();
  }

  resume() {
    this.paused = false;
    this.accumulator = 0;
    this.input.begin();
    this.publish();
  }

  setPlaybackSpeed(speed: PlaybackSpeed) {
    if (!this.state.watching || ![1, 2, 5].includes(speed)) return;
    this.state.playbackSpeed = speed;
    this.save();
    this.publish();
  }

  advance(elapsed: number) {
    if (this.paused || this.state.phase === 'finished') return;
    this.accumulator += Math.min(elapsed, 0.1) * (this.state.watching ? this.state.playbackSpeed : 1);
    while (this.accumulator >= STEP) {
      const phase: MatchState['phase'] = this.state.phase;
      stepMatch(
        this.state,
        this.state.watching
          ? [neutralControls(), neutralControls()]
          : [this.input.consume(0, this.portrait), this.state.mode === 'versus' ? this.input.consume(1, this.portrait) : neutralControls()],
        STEP,
      );
      this.accumulator -= STEP;
      if (phase !== this.state.phase) {
        this.save();
        this.publish();
      }
      if ((this.state.phase as MatchState['phase']) === 'finished') {
        this.accumulator = 0;
        break;
      }
    }
    this.notificationTime += elapsed;
    this.saveTime += elapsed;
    if (this.notificationTime > 0.1) {
      this.notificationTime = 0;
      this.publish();
    }
    if (this.saveTime > 3) {
      this.saveTime = 0;
      this.save();
    }
  }

  save = () => {
    if (this.state.phase === 'finished') {
      this.onFinished?.(this.state);
      clearMatch();
    } else saveMatch(this.state);
  };
}

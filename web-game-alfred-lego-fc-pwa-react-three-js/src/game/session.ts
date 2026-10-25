import type { InputManager } from './input';
import { applySubstitution } from './lineups';
import type { Controls, MatchState, PlaybackSpeed, Team } from './model';
import { neutralControls, STEP } from './model';
import { stepMatch } from './simulation';
import { clearMatch, saveMatch } from './storage';

export class MatchSession {
  readonly networkRole: 'host' | 'guest' | null = null;
  readonly localTeam: Team | null = null;
  paused = false;
  pauseReason = '';
  portrait = false;
  substitutionNotice = '';
  substitutionPending = false;
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
  protected publish() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  get canResume() {
    return true;
  }
  get renderState() {
    return this.state;
  }
  canManageTeam(team: Team) {
    return team === 0 || (this.state.mode === 'versus' && !this.state.watching);
  }
  substitute(team: Team, slot: number, id: string) {
    const error = !this.paused
      ? 'Pausa matchen före bytet.'
      : !this.canManageTeam(team)
        ? 'Du kan bara byta spelare i ditt eget lag.'
        : applySubstitution(this.state, team, slot, id);
    this.substitutionNotice = error ?? 'Bytet är klart. Startfemman inför nästa match ändras inte.';
    if (!error) this.save();
    this.publish();
    return error === null;
  }
  setForeground(available: boolean) {
    if (!available) this.pause('Matchen pausades när du lämnade spelet.');
  }
  protected controls(): [Controls, Controls] {
    return this.state.watching
      ? [neutralControls(), neutralControls()]
      : [this.input.consume(0, this.portrait), this.state.mode === 'versus' ? this.input.consume(1, this.portrait) : neutralControls()];
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
      stepMatch(this.state, this.controls(), STEP);
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

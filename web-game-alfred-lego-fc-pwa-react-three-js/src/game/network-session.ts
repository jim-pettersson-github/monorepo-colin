import type { InputManager } from './input';
import type { Controls, MatchState, Team } from './model';
import { createMatch, neutralControls } from './model';
import type { PeerLink, PeerRole } from './peer-link';
import { MatchSession } from './session';
import { validMatch } from './storage';

export function validNetworkMatch(value: unknown): value is MatchState {
  return validMatch(value) && value.mode === 'versus' && !value.watching && value.league === null;
}
function validControls(value: unknown): value is Controls {
  if (!value || typeof value !== 'object') return false;
  const c = value as Controls;
  return (
    [c.x, c.z].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1) &&
    [c.pass, c.shoot, c.switch, c.sprint].every((b) => typeof b === 'boolean')
  );
}

export class NetworkSession extends MatchSession {
  override readonly networkRole: PeerRole;
  override readonly localTeam: Team;
  private remote = neutralControls();
  private foreground = true;
  private localReady = true;
  private remoteReady = true;
  private lastMessage = performance.now();
  private stalled = false;
  private sendTime = 0;
  private round = 0;
  private display: MatchState;
  private removeMessage: () => void;
  private removeStatus: () => void;

  constructor(
    state: MatchState,
    input: InputManager,
    public readonly link: PeerLink,
  ) {
    super(state, input);
    this.networkRole = link.role;
    this.localTeam = link.role === 'host' ? 0 : 1;
    this.display = structuredClone(state);
    this.removeMessage = link.onMessage(this.receive);
    this.removeStatus = link.subscribe(() => {
      if (link.status !== 'connected') {
        super.pause(link.error || 'Anslutningen är stängd. Gå till startmenyn och koppla ihop enheterna igen.');
        this.remote = neutralControls();
        this.publish();
      }
    });
    if (link.role === 'host') {
      link.send({ kind: 'start', version: 1, state });
      this.snapshot();
    }
  }
  override get canResume() {
    return this.link.status === 'connected' && this.localReady && this.remoteReady && !this.stalled;
  }
  override get renderState() {
    return this.networkRole === 'guest' ? this.display : this.state;
  }
  override save = () => {
    /* A live peer match never replaces a local match or league save. */
  };

  private snapshot() {
    if (this.networkRole === 'host')
      this.link.send({
        kind: 'frame',
        state: this.state,
        paused: this.paused,
        reason: this.pauseReason,
        ready: this.localReady,
        round: this.round,
      });
  }
  override setForeground(available: boolean) {
    this.foreground = available;
    this.checkReady();
    if (!available) this.pause('Matchen pausades när en spelare lämnade spelet.');
  }
  private checkReady() {
    const ready = this.foreground && this.input.available(0);
    if (ready === this.localReady) return;
    this.localReady = ready;
    this.link.send({ kind: 'ready', ready });
    if (!ready) this.pause('En spelare är inte redo. Återvänd till spelet och anslut kontrollen.');
    this.publish();
  }
  override pause(reason = 'En spelare pausade. Matchen väntar på er båda.') {
    super.pause(reason);
    this.remote = neutralControls();
    if (this.networkRole === 'host') this.snapshot();
    else this.link.send({ kind: 'pause', reason, round: this.round });
  }
  override resume() {
    if (!this.canResume || this.state.phase === 'finished') return;
    if (this.networkRole === 'guest') {
      this.link.send({ kind: 'resume', round: this.round });
    } else {
      this.remote = neutralControls();
      super.resume();
      this.snapshot();
    }
  }
  rematch() {
    if (this.networkRole !== 'host' || !this.canResume) return;
    this.round++;
    this.state = createMatch('versus', this.state.duration, this.state.difficulty, this.state.clubs);
    this.remote = neutralControls();
    super.resume();
    this.snapshot();
  }
  private receive = (value: unknown) => {
    if (!value || typeof value !== 'object' || !('kind' in value)) return;
    const m = value as Record<string, unknown>;
    if (m.kind === 'ready' && typeof m.ready === 'boolean') {
      this.remoteReady = m.ready;
      this.lastMessage = performance.now();
      if (!m.ready) super.pause('Den andra spelaren har lämnat spelet eller saknar en ansluten kontroll.');
      this.publish();
    }
    if (this.networkRole === 'host') {
      if (m.round !== this.round) return;
      if (m.kind === 'input' && validControls(m.controls) && typeof m.ready === 'boolean') {
        this.lastMessage = performance.now();
        this.remoteReady = m.ready;
        if (!this.paused && m.ready)
          this.remote = {
            ...m.controls,
            pass: this.remote.pass || m.controls.pass,
            shoot: this.remote.shoot || m.controls.shoot,
            switch: this.remote.switch || m.controls.switch,
          };
      } else if (m.kind === 'pause' && typeof m.reason === 'string' && m.reason.length <= 180) {
        super.pause(m.reason);
        this.remote = neutralControls();
        this.snapshot();
      } else if (m.kind === 'resume') this.resume();
    } else if (
      m.kind === 'frame' &&
      validNetworkMatch(m.state) &&
      typeof m.paused === 'boolean' &&
      typeof m.ready === 'boolean' &&
      typeof m.reason === 'string' &&
      m.reason.length <= 180 &&
      Number.isInteger(m.round) &&
      (m.round === this.round || m.round === this.round + 1)
    ) {
      const previous = this.display;
      const newRound = m.round !== this.round;
      this.state = m.state;
      this.display = structuredClone(m.state);
      if (!newRound) {
        for (const player of this.display.players) {
          const old = previous.players[player.id];
          if (Math.hypot(old.x - player.x, old.z - player.z) < 8) {
            player.x = old.x;
            player.z = old.z;
          }
        }
        if (Math.hypot(previous.ball.x - this.display.ball.x, previous.ball.z - this.display.ball.z) < 8) {
          this.display.ball.x = previous.ball.x;
          this.display.ball.z = previous.ball.z;
        }
      }
      this.round = m.round as number;
      this.remoteReady = m.ready;
      this.lastMessage = performance.now();
      if (this.paused !== m.paused || newRound) this.input.clear();
      this.paused = m.paused || !this.localReady || this.stalled;
      this.pauseReason = m.reason;
      this.publish();
    }
  };
  protected override controls(): [Controls, Controls] {
    const remote = { ...this.remote };
    this.remote.pass = this.remote.shoot = this.remote.switch = false;
    return [this.input.consume(0, this.portrait), remote];
  }
  override advance(elapsed: number) {
    this.checkReady();
    const stalled = performance.now() - this.lastMessage > 2000;
    if (stalled !== this.stalled) {
      this.stalled = stalled;
      if (stalled) this.pause('Väntar på den andra enheten. Matchen står still tills anslutningen svarar.');
      this.publish();
    }
    if (this.networkRole === 'host') {
      if (!this.stalled && this.link.status === 'connected') super.advance(elapsed);
    } else {
      const controls = this.paused ? neutralControls() : this.input.consume(0, this.portrait);
      this.link.send({ kind: 'input', controls, ready: this.localReady, round: this.round });
      const blend = 1 - Math.exp(-25 * Math.min(elapsed, 0.1));
      for (const point of [...this.display.players, this.display.ball]) {
        const target = 'id' in point ? this.state.players[point.id] : this.state.ball;
        point.x += (target.x - point.x) * blend;
        point.z += (target.z - point.z) * blend;
      }
    }
    this.sendTime += elapsed;
    if (this.sendTime >= 0.05) {
      this.sendTime = 0;
      this.snapshot();
    }
  }
  dispose() {
    this.removeMessage();
    this.removeStatus();
    this.link.close();
  }
}

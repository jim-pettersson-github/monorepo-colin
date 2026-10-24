import type { GameInput } from './input';
import { type Commands, createGame, type GameState, neutral, type Settings, type Source } from './model';
import { type Connection, NetworkPlay } from './network-play';
import { Session } from './session';
import { validGame, validSettings } from './storage';

export function validNetworkSettings(value: unknown): value is Settings {
  return validSettings(value) && value.players >= 2;
}
export function validNetworkState(value: unknown): value is GameState {
  return validGame(value) && validNetworkSettings(value.settings);
}
const merge = (a: Commands, b: Commands): Commands => ({
  steer: b.steer,
  hold: b.hold,
  action: a.action || b.action,
  feet: [...a.feet, ...b.feet].slice(0, 8),
});
function validCommands(value: unknown): value is Commands {
  if (!value || typeof value !== 'object') return false;
  const c = value as Commands;
  return (
    (c.steer === undefined || [-1, 0, 1].includes(c.steer)) &&
    typeof c.hold === 'boolean' &&
    typeof c.action === 'boolean' &&
    Array.isArray(c.feet) &&
    c.feet.length <= 8 &&
    c.feet.every((f) => f === 0 || f === 1)
  );
}
export class NetworkSession extends Session {
  readonly wire: NetworkPlay<GameState, Commands>;
  constructor(state: GameState, input: GameInput, source: Source, connections: Connection[], slot: number) {
    super(state, input, { source, persistent: false });
    this.localSlot = slot;
    this.networkRole = slot === 0 ? 'host' : 'guest';
    this.wire = new NetworkPlay({
      connections,
      localSlot: slot,
      snapshot: () => this.state,
      validState: validNetworkState,
      validCommand: validCommands,
      neutral,
      merge,
      afterConsume: (c) => ({ ...neutral(), hold: c.hold, steer: c.steer }),
      apply: (state) => {
        this.state = state;
      },
      clear: () => this.input.clear(),
      changed: () => {
        const wasPaused = this.paused;
        this.paused = this.wire.paused;
        this.reason = this.wire.reason;
        if (this.paused) this.input.stop();
        else if (wasPaused) this.startInput();
        this.publish();
      },
    });
    this.pause = (reason) => this.wire.pause(reason);
    this.resume = () => this.wire.resume();
    const next = this.next;
    this.next = () => {
      if (this.networkRole !== 'host' || !this.wire.canResume) return;
      next();
      this.wire.nextRound();
    };
    if (slot === 0) for (const { slot: guest, link } of connections) link.send({ kind: 'start', version: 1, config: state.settings, state, slot: guest });
  }
  override get canResume() {
    return this.wire?.canResume ?? false;
  }
  protected override commands() {
    const local = this.input.consume()[0];
    return Array.from({ length: this.state.settings.players }, (_, i) => (i === 0 ? local : this.wire.consume(i)));
  }
  override advance(elapsed: number) {
    this.wire.tick(elapsed, this.networkRole === 'guest' ? this.input.consume()[0] : neutral(), this.input.available(this.controlSource(this.localSlot)));
    if (this.networkRole === 'host') super.advance(elapsed);
  }
  override setForeground(value: boolean) {
    this.foreground = value;
    this.wire.setForeground(value);
  }
  rematch() {
    if (this.networkRole !== 'host' || !this.wire.canResume) return;
    this.state = createGame(this.state.settings);
    this.wire.nextRound();
    this.startInput();
  }
  override dispose() {
    this.wire.close();
    super.dispose();
  }
}

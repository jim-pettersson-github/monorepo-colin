import { type Command, definition, type GameState } from './model';
import type { PeerLink } from './peer-link';
import { GameSession } from './session';
import { followWorld, type GuestWorld, readWorld } from './shared';
import type { Storage } from './storage';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
// A guest reads its own settings but never writes: its single-player save stays exactly as it was.
const readOnly = (storage: Storage): Storage => ({ getItem: (key) => storage.getItem(key), setItem: () => {} });

// A guest device draws the host's world and sends its own taps and buttons to the host.
export class GuestSession extends GameSession {
  target: GameState;
  hostPaused = false;
  ended = '';
  onEnd: ((message: string) => void) | null = null;
  private quiet = 0;
  private leaving = false;
  private stops: Array<() => void> = [];

  constructor(
    readonly peer: PeerLink,
    readonly slot: number,
    first: GuestWorld,
    storage: Storage,
  ) {
    super(readOnly(storage));
    this.storageMessage = '';
    this.target = first.state;
    this.state = structuredClone(first.state);
    this.apply(first);
    this.stops.push(
      peer.onMessage((message) => {
        const world = readWorld(message, slot, this.state.settings);
        if (world) this.apply(world);
      }),
      peer.subscribe(() => {
        if (peer.status === 'connected') return;
        this.end(this.leaving ? 'Du lämnade Colins värld. Nu spelar du själv igen.' : 'Kontakten med Colins värld bröts. Nu spelar du själv igen.');
      }),
    );
  }

  private apply(world: GuestWorld) {
    this.target = world.state;
    this.quiet = 0;
    this.hostPaused = world.paused;
    this.ui.notice = world.paused ? 'Colin har pausat. Världen väntar en stund.' : world.you.notice;
    this.ui.alarmRemaining = world.you.alarm;
    this.ui.reach = world.reach;
    if (world.you.panel) this.ui.panel = world.you.panel;
    this.ui.sounds.push(...world.sounds);
    if (world.you.panel) this.notify();
  }

  send(action: Command) {
    if (this.paused || this.hidden || this.ended) return;
    this.audio.unlock();
    // The floor panel closes at once on this screen, as it does in single play.
    const building = this.state.player.place === 'outside' ? null : definition(this.state.player.place);
    if (action.type === 'floor' && building && !building.manual) this.ui.panel = null;
    this.peer.send({ t: 'do', action });
    this.notify();
  }

  advance(seconds: number) {
    if (this.paused || this.hidden) return;
    const dt = Math.min(Math.max(seconds, 0), 0.1);
    followWorld(this.state, this.target, dt);
    this.quiet += dt;
    if (this.quiet > 5 && !this.hostPaused && !this.ended) this.ui.notice = 'Väntar på Colins värld…';
    this.flush();
    this.refresh();
  }

  save() {}

  restart() {}

  leave() {
    this.leaving = true;
    this.peer.close();
  }

  private end(message: string) {
    if (this.ended) return;
    this.ended = message;
    for (const stop of this.stops) stop();
    this.audio.pause();
    this.peer.close();
    this.onEnd?.(message);
  }
}

// Waits for the host's welcome and first world, then returns the session to play in.
export function joinWorld(link: PeerLink, storage: Storage, cancelled: () => boolean) {
  const settings = new GameSession(readOnly(storage)).state.settings;
  return new Promise<GuestSession>((resolve, reject) => {
    let slot: number | null = null;
    const finish = (error?: Error, session?: GuestSession) => {
      stopMessages();
      stopStatus();
      clearInterval(poll);
      if (session) resolve(session);
      else reject(error);
    };
    const stopMessages = link.onMessage((message) => {
      if (!record(message)) return;
      if (message.t === 'hello' && message.v === 1 && Number.isInteger(message.slot) && Number(message.slot) >= 1 && Number(message.slot) <= 3)
        slot = Number(message.slot);
      if (message.t !== 'world' || slot === null) return;
      const world = readWorld(message, slot, settings);
      if (world) finish(undefined, new GuestSession(link, slot, world, storage));
    });
    const stopStatus = link.subscribe(() => {
      if (link.status === 'error' || link.status === 'closed') finish(new Error(link.error || 'Kontakten bröts. Försök igen med rumskoden.'));
    });
    const poll = setInterval(() => {
      if (cancelled()) {
        link.close();
        finish(new Error('Avbrutet.'));
      }
    }, 250);
  });
}

import { characterName, maxPlayers } from './model';
import { PeerLink } from './peer-link';
import { ONLINE_ICE, Room } from './room-server';
import type { GameSession, SessionLink } from './session';
import { companionCommand, createCompanion, guestMessage, readCommand, type SharedSound, sharedWorld, worldRate } from './shared';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function settled(link: PeerLink) {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (link.status !== 'connected' && link.status !== 'error' && link.status !== 'closed') return;
      stop();
      resolve();
    };
    const stop = link.subscribe(check);
    check();
  });
}

interface Guest {
  slot: number;
  link: PeerLink;
  stop: () => void;
}

// Colin's device: opens a room, invites one guest at a time (also during play) and streams the shared world.
export class SharedHost implements SessionLink {
  status: 'opening' | 'open' | 'error' | 'closed' = 'opening';
  error = '';
  room: Room | null = null;
  guests: Guest[] = [];
  private pending: PeerLink | null = null;
  private elapsed = 0;
  private outbox: SharedSound[] = [];
  private listeners = new Set<() => void>();
  private revision = 0;

  constructor(readonly session: GameSession) {}

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

  async start() {
    try {
      const room = await Room.open();
      if (this.status === 'closed') return room.close();
      this.room = room;
      this.status = 'open';
      this.session.link = this;
      this.publish();
      void this.invite(room);
    } catch (error) {
      if (this.status === 'closed') return;
      this.status = 'error';
      this.error = error instanceof Error ? error.message : 'Spelservern svarar inte.';
      this.publish();
    }
  }

  // One open invitation at a time; the next one opens as soon as a guest is connected.
  private async invite(room: Room) {
    while (this.status === 'open') {
      if (this.guests.length >= maxPlayers - 1) {
        await wait(1000);
        continue;
      }
      const link = new PeerLink('host', ONLINE_ICE);
      this.pending = link;
      try {
        await link.createOffer();
        await room.invite(link, () => this.status !== 'open');
        if (this.status !== 'open') return link.close();
        await settled(link);
        if (link.status === 'connected' && this.status === 'open') this.welcome(link);
        else link.close();
        if (this.error) {
          this.error = '';
          this.publish();
        }
      } catch (error) {
        link.close();
        if (this.status !== 'open') return;
        this.error = `${error instanceof Error ? error.message : 'Inbjudan slutade fungera.'} Försöker igen snart.`;
        this.publish();
        await wait(4000);
      } finally {
        if (this.pending === link) this.pending = null;
      }
    }
  }

  private welcome(link: PeerLink) {
    const state = this.session.state;
    const slot = [1, 2, 3].find((free) => !this.guests.some((guest) => guest.slot === free));
    if (slot === undefined) return link.close();
    state.companions = [...(state.companions ?? []), createCompanion(state, slot)];
    const stopMessages = link.onMessage((message) => this.receive(slot, message));
    const stopStatus = link.subscribe(() => {
      if (link.status !== 'connected') this.drop(slot);
    });
    this.guests.push({
      slot,
      link,
      stop: () => {
        stopMessages();
        stopStatus();
      },
    });
    link.send({ t: 'hello', v: 1, slot });
    this.session.ui.notice = `${characterName(slot)} är med och spelar!`;
    this.broadcast();
    this.session.notify();
    this.publish();
  }

  // A guest who leaves just disappears from the world; everyone else keeps playing.
  private drop(slot: number, notice = true) {
    const guest = this.guests.find((entry) => entry.slot === slot);
    if (!guest) return;
    guest.stop();
    guest.link.close();
    this.guests = this.guests.filter((entry) => entry !== guest);
    const state = this.session.state;
    state.companions = state.companions?.filter((companion) => companion.slot !== slot);
    if (notice) this.session.ui.notice = `${characterName(slot)} har gått hem. Du kan fortsätta spela.`;
    this.session.notify();
    this.publish();
  }

  private receive(slot: number, message: unknown) {
    if (!record(message) || message.t !== 'do' || this.session.paused || this.session.hidden) return;
    const action = readCommand(message.action);
    const companion = this.session.state.companions?.find((entry) => entry.slot === slot);
    if (!action || !companion) return;
    companionCommand(this.session.state, companion, action);
    this.session.flush();
    this.broadcast();
    this.session.notify();
  }

  tick(seconds: number) {
    this.elapsed += seconds;
    if (this.elapsed < 1 / worldRate) return;
    this.elapsed = 0;
    this.broadcast();
  }

  sounds(events: SharedSound[]) {
    if (this.guests.length) this.outbox = [...this.outbox, ...events].slice(-40);
  }

  paused() {
    this.broadcast();
  }

  broadcast() {
    if (!this.guests.length) return;
    const state = this.session.state;
    const world = sharedWorld(state, this.session.ui);
    const paused = this.session.paused || this.session.hidden;
    for (const guest of this.guests) {
      const companion = state.companions?.find((entry) => entry.slot === guest.slot);
      if (!companion) continue;
      // Panel openings are one-off events for that guest's own screen.
      if (guest.link.send(guestMessage(world, companion, paused, this.outbox))) companion.ui.panel = null;
    }
    this.outbox = [];
  }

  stop() {
    if (this.status === 'closed') return;
    this.status = 'closed';
    this.room?.close();
    this.pending?.close();
    for (const guest of [...this.guests]) this.drop(guest.slot, false);
    if (this.session.link === this) this.session.link = null;
    this.session.state.companions = undefined;
    this.session.notify();
    this.publish();
  }
}

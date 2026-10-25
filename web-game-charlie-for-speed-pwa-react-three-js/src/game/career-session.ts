import { cupById, type OwnedCar, type UpgradePart } from './career';
import {
  abandonSessionCup,
  cleanName,
  joinSession,
  memberBuy,
  memberSelect,
  memberUpgrade,
  recordSessionRace,
  type Session,
  type SessionMode,
  sessionField,
  sessionTrack,
  startSessionCup,
  validGarage,
  validSession,
} from './multi-career';
import type { Connection } from './network-play';
import { NetworkRace, type RaceConfig, validRaceConfig } from './network-race';
import type { PeerLink } from './peer-link';
import type { ResultRow } from './race';
import type { Room } from './room-server';

export type Identity = { id: string; name: string };
export type OwnGarage = { garage: OwnedCar[]; activeCarId: string };

// What the online lobby agrees on before the hub opens.
export type CareerLobbyConfig = { kind: 'career'; session: string; mode: SessionMode };

export function validLobbyConfig(value: unknown): value is CareerLobbyConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as CareerLobbyConfig;
  return config.kind === 'career' && typeof config.session === 'string' && config.session.length <= 24 && (config.mode === 'fresh' || config.mode === 'own');
}

type Guest = { slot: number; link: PeerLink; memberId?: string; remove: (() => void)[] };

type Options = {
  identity: Identity;
  own?: OwnGarage;
  transmission: RaceConfig['settings']['transmission'];
  save: (session: Session) => void;
  // The lobby's room code stays open on the host so more players can join between races.
  room?: Room;
};

/**
 * One device's view of an online career. The host keeps the authoritative session, applies everyone's shop actions and runs
 * each race; guests send requests and mirror what the host broadcasts.
 */
export class CareerSession {
  session: Session | undefined;
  present: string[] = [];
  race: NetworkRace | undefined;
  invite: PeerLink | undefined;
  error = '';
  ended = false;
  version = 0;
  private guests: Guest[] = [];
  private link: PeerLink | undefined;
  private listeners = new Set<() => void>();
  private timers: number[] = [];
  private nextSlot = 1;

  private constructor(
    readonly host: boolean,
    private options: Options,
    private lobby: CareerLobbyConfig,
  ) {}

  static hostSession(session: Session, connections: Connection[], lobby: CareerLobbyConfig, options: Options) {
    const controller = new CareerSession(true, options, lobby);
    controller.session = joinSession(session, options.identity.id, options.identity.name, options.own);
    for (const { slot, link } of connections) controller.addGuest(slot, link, false);
    controller.nextSlot = Math.max(1, ...connections.map((connection) => connection.slot + 1));
    controller.broadcast();
    return controller;
  }

  static joinSession(connection: Connection, lobby: CareerLobbyConfig, options: Options) {
    const controller = new CareerSession(false, options, lobby);
    const { link } = connection;
    controller.link = link;
    const removeMessages = link.onMessage((message) => controller.guestReceive(message));
    const removeStatus = link.subscribe(() => {
      if (link.status !== 'connected' && !controller.ended) {
        controller.ended = true;
        controller.error = 'Anslutningen till värden bröts.';
        controller.changed();
      }
    });
    const hello = () => {
      if (!controller.session) link.send({ kind: 'cs-hello', id: options.identity.id, name: options.identity.name, own: options.own });
    };
    hello();
    controller.timers.push(window.setInterval(hello, 1000));
    controller.cleanup = () => {
      removeMessages();
      removeStatus();
    };
    return controller;
  }

  private cleanup = () => {};

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  private changed() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  get me() {
    return this.session?.members.find((member) => member.id === this.options.identity.id);
  }

  // Host: keep the slot's link, map it to a member on hello and drop it from the race when it disconnects.
  private addGuest(slot: number, link: PeerLink, late: boolean) {
    const guest: Guest = { slot, link, remove: [] };
    guest.remove.push(
      link.onMessage((message) => this.hostReceive(guest, message)),
      link.subscribe(() => {
        if (link.status !== 'connected') this.broadcast();
      }),
    );
    this.guests.push(guest);
    if (late) {
      // A late guest is still in its lobby: tell it its slot, then start its hub once it has caught up.
      const welcome = () => {
        if (guest.memberId || link.status !== 'connected') return;
        link.send({ kind: 'lobby-settings', config: this.lobby, slot });
        window.setTimeout(() => link.send({ kind: 'start', version: 1, config: this.lobby, state: this.lobby, slot }), 400);
      };
      welcome();
      this.timers.push(window.setInterval(welcome, 1200));
    } else link.send({ kind: 'start', version: 1, config: this.lobby, state: this.lobby, slot });
  }

  private hostReceive(guest: Guest, value: unknown) {
    if (!value || typeof value !== 'object' || !this.session) return;
    const m = value as Record<string, unknown>;
    if (m.kind === 'cs-hello' && typeof m.id === 'string' && m.id.length <= 40) {
      if (guest.memberId) return this.broadcast();
      const own = m.own as OwnGarage | undefined;
      const valid = own && validGarage(own.garage) && typeof own.activeCarId === 'string' ? own : undefined;
      this.session = joinSession(this.session, m.id, cleanName(m.name), valid);
      guest.memberId = m.id;
      return this.broadcast();
    }
    const id = guest.memberId;
    if (!id || this.race) return;
    if (m.kind === 'cs-buy' && typeof m.carId === 'string') this.session = memberBuy(this.session, id, m.carId);
    else if (m.kind === 'cs-select' && typeof m.carId === 'string') this.session = memberSelect(this.session, id, m.carId);
    else if (m.kind === 'cs-upgrade' && typeof m.carId === 'string' && ['engine', 'tyres', 'brakes'].includes(m.part as string))
      this.session = memberUpgrade(this.session, id, m.carId, m.part as UpgradePart);
    else return;
    this.broadcast();
  }

  private guestReceive(value: unknown) {
    if (!value || typeof value !== 'object') return;
    const m = value as Record<string, unknown>;
    if (m.kind === 'cs-state' && validSession(m.session) && Array.isArray(m.present) && m.present.every((id) => typeof id === 'string')) {
      this.session = m.session;
      this.present = m.present as string[];
      this.options.save(m.session);
      if (!m.racing && this.race) {
        this.race.dispose();
        this.race = undefined;
      }
      this.changed();
    } else if (m.kind === 'start' && validRaceConfig(m.config) && m.config.entrants && Number.isInteger(m.slot) && this.link) {
      this.race?.dispose();
      this.race = new NetworkRace(m.config, [{ slot: Number(m.slot), link: this.link }], Number(m.slot), { keepLinks: true });
      this.changed();
    }
  }

  private connectedGuests() {
    return this.guests.filter((guest) => guest.link.status === 'connected' && guest.memberId);
  }

  // Host: save, then send every guest the session and who is here.
  private broadcast() {
    if (!this.session) return;
    this.present = [this.options.identity.id, ...this.connectedGuests().map((guest) => guest.memberId as string)];
    this.options.save(this.session);
    for (const guest of this.guests) guest.link.send({ kind: 'cs-state', session: this.session, present: this.present, racing: !!this.race });
    this.changed();
  }

  private request(kind: string, payload: Record<string, unknown>, apply: (session: Session, id: string) => Session) {
    if (this.host && this.session) {
      this.session = apply(this.session, this.options.identity.id);
      this.broadcast();
    } else this.link?.send({ kind, ...payload });
  }

  buy(carId: string) {
    this.request('cs-buy', { carId }, (session, id) => memberBuy(session, id, carId));
  }

  upgrade(carId: string, part: UpgradePart) {
    this.request('cs-upgrade', { carId, part }, (session, id) => memberUpgrade(session, id, carId, part));
  }

  select(carId: string) {
    this.request('cs-select', { carId }, (session, id) => memberSelect(session, id, carId));
  }

  startCup(cupId: string) {
    if (!this.host || !this.session || this.race) return;
    this.session = startSessionCup(this.session, cupId, this.present);
    this.broadcast();
  }

  abandonCup() {
    if (!this.host || !this.session || this.race) return;
    this.session = abandonSessionCup(this.session);
    this.broadcast();
  }

  // Host: race everyone who is here now; guests get their player number in the start message.
  startRace() {
    const session = this.session;
    const trackId = session ? sessionTrack(session) : undefined;
    if (!this.host || !session?.run || !trackId || this.race) return;
    const guests = this.connectedGuests();
    const present = [this.options.identity.id, ...guests.map((guest) => guest.memberId as string)];
    const entrants = sessionField(session, present);
    const carFor = (player: number) => entrants.find((entrant) => entrant.player === player)?.carId ?? '';
    const config: RaceConfig = {
      settings: { trackId, carId: carFor(0), laps: cupById(session.run.cupId).laps, difficulty: 'normal', transmission: this.options.transmission },
      cars: present.map((_, player) => carFor(player)),
      seed: Date.now() % 2147483647,
      entrants,
    };
    if (!validRaceConfig(config)) {
      this.error = 'Racet kunde inte startas. Kontrollera att alla har en bil.';
      return this.changed();
    }
    this.error = '';
    const connections = guests.map((guest, index) => ({ slot: index + 1, link: guest.link }));
    this.race = new NetworkRace(config, connections, 0, { keepLinks: true });
    this.broadcast();
  }

  // Host: score the finished race and bring everyone back to the hub.
  finishRace(rows: ResultRow[]) {
    if (!this.host || !this.session || !this.race) return;
    this.session = recordSessionRace(this.session, rows);
    this.endRace();
  }

  endRace() {
    if (!this.host) return;
    this.race?.dispose();
    this.race = undefined;
    this.broadcast();
  }

  get room() {
    return this.options.room;
  }

  // Host: open the room for one more device between races.
  async inviteGuest() {
    if (!this.host || this.invite) return;
    const room = this.options.room;
    if (!room) return;
    const link = room.link();
    this.invite = link;
    const slot = this.nextSlot++;
    const unsubscribe = link.subscribe(() => {
      if (link.status === 'connected') {
        unsubscribe();
        this.invite = undefined;
        this.error = '';
        this.addGuest(slot, link, true);
        this.broadcast();
      } else if ((link.status === 'error' || link.status === 'closed') && this.invite === link) {
        // A join that cannot get through frees its place; with a room code the next invitation opens by itself.
        unsubscribe();
        this.invite = undefined;
        if (this.nextSlot === slot + 1) this.nextSlot = slot;
        this.error = `${link.error || 'Inbjudan bröts.'}${this.options.room ? ' Rummet är öppet igen.' : ''}`;
        this.changed();
        if (this.options.room && !this.ended) void this.inviteGuest();
      } else this.changed();
    });
    this.changed();
    try {
      await link.createOffer();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Inbjudan kunde inte skapas.';
      this.invite = undefined;
      link.close();
    }
    this.changed();
  }

  cancelInvite() {
    const invite = this.invite;
    this.invite = undefined;
    invite?.close();
    this.changed();
  }

  close() {
    this.ended = true;
    for (const timer of this.timers) if (timer >= 0) clearInterval(timer);
    this.race?.dispose();
    this.race = undefined;
    this.invite?.close();
    this.options.room?.close();
    this.cleanup();
    for (const guest of this.guests) {
      for (const remove of guest.remove) remove();
      guest.link.close();
    }
    this.link?.close();
    this.listeners.clear();
  }
}

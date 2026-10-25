import type { PeerLink } from './peer-link';
export interface Connection {
  slot: number;
  link: PeerLink;
}
interface Options<S, C> {
  connections: Connection[];
  waitForViews?: boolean;
  // Leave the links open when the race ends, so an online career can run the next race on them.
  keepLinks?: boolean;
  localSlot: number;
  snapshot: () => S;
  // ack: the guest's latest input the host has seen and how many simulation steps it has run on it, for prediction.
  apply: (state: S, ack?: InputAck) => void;
  validState: (value: unknown) => value is S;
  validCommand: (value: unknown) => value is C;
  neutral: () => C;
  merge: (previous: C, next: C) => C;
  afterConsume: (command: C) => C;
  clear: () => void;
  changed: () => void;
}
export type InputAck = { seq: number; steps: number };

const validAck = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every((n) => Number.isInteger(n) && n >= 0 && n < 1e9);

// How long a device may go quiet before the others wait for it; phones on mobile data can pause for a few seconds.
const SILENCE_LIMIT = 6000;

export class NetworkPlay<S, C> {
  paused = false;
  reason = '';
  readonly host: boolean;
  epoch = 0;
  private foreground = true;
  private available = true;
  private otherReady = new Map<number, boolean>();
  private seen = new Map<number, number>();
  private remote = new Map<number, C>();
  private pending: C;
  private sendTime = 0;
  private inputTime = 0;
  // Guest: numbers each input. Host: the latest input number per guest and the steps run on it since it arrived.
  sentSeq = 0;
  private acks = new Map<number, InputAck>();
  private frameSeq = 0;
  private lastFrame = 0;
  private listeners: (() => void)[] = [];
  private pendingPause = false;
  private disposed = false;
  private loading = false;
  private viewReady = false;
  private remoteViews = new Set<number>();
  constructor(private options: Options<S, C>) {
    this.host = options.localSlot === 0;
    this.loading = options.waitForViews === true;
    if (this.loading) {
      this.paused = true;
      this.reason = 'Väntar på att alla enheter laddar banan…';
    }
    this.pending = options.neutral();
    for (const { slot, link } of options.connections) {
      this.otherReady.set(slot, true);
      this.seen.set(slot, performance.now());
      this.listeners.push(
        link.onMessage((value) => this.receive(slot, value)),
        link.subscribe(() => {
          if (link.status !== 'connected') this.pause(link.error || 'Anslutningen är stängd. Koppla ihop enheterna igen.');
          options.changed();
        }),
      );
    }
  }
  get canResume() {
    return (
      this.foreground &&
      (!this.options.waitForViews || (this.viewReady && this.options.connections.every(({ slot }) => this.remoteViews.has(slot)))) &&
      this.available &&
      this.options.connections.every(
        ({ slot, link }) => link.status === 'connected' && this.otherReady.get(slot) === true && performance.now() - (this.seen.get(slot) ?? 0) < SILENCE_LIMIT,
      )
    );
  }
  get localReady() {
    return this.foreground && this.available;
  }
  private send(value: unknown) {
    for (const { link } of this.options.connections) link.send(value);
  }
  private sendFast(value: unknown) {
    for (const { link } of this.options.connections) link.sendFast(value);
  }
  private clear() {
    this.remote.clear();
    this.pending = this.options.neutral();
    this.options.clear();
  }
  private frame() {
    if (!this.host) return;
    const acks = Object.fromEntries([...this.acks].map(([slot, ack]) => [slot, [ack.seq, ack.steps]]));
    this.frameSeq++;
    this.sendFast({
      kind: 'frame',
      seq: this.frameSeq,
      epoch: this.epoch,
      state: this.options.snapshot(),
      paused: this.paused,
      reason: this.reason,
      ready: this.canResume,
      acks,
    });
  }
  pause(reason = 'En spelare pausade. Tävlingen väntar på er.') {
    this.loading = false;
    this.paused = true;
    this.reason = reason;
    this.clear();
    if (this.host) this.frame();
    else {
      this.pendingPause = true;
      this.send({ kind: 'pause', epoch: this.epoch });
    }
    this.options.changed();
  }
  resume() {
    if (!this.canResume) return;
    if (!this.host) {
      this.send({ kind: 'resume', epoch: this.epoch });
      return;
    }
    this.paused = false;
    this.reason = '';
    this.clear();
    this.frame();
    this.options.changed();
  }
  setForeground(value: boolean) {
    this.foreground = value;
    this.presence();
  }
  private presence() {
    this.send({ kind: 'presence', ready: this.localReady });
    if (!this.localReady) this.pause('En spelare har lämnat spelet eller saknar sin kontroll.');
    this.options.changed();
  }
  consume(slot: number) {
    const ack = this.acks.get(slot);
    if (ack) ack.steps++;
    const command = this.remote.get(slot) ?? this.options.neutral();
    this.remote.set(slot, this.options.afterConsume(command));
    return command;
  }
  nextRound() {
    if (!this.host || !this.canResume) return false;
    this.epoch++;
    this.paused = false;
    this.reason = '';
    this.clear();
    this.frame();
    this.options.changed();
    return true;
  }
  tick(elapsed: number, command: C, available: boolean) {
    if (this.disposed) return;
    this.viewReady = true;
    if (available !== this.available) {
      this.available = available;
      this.presence();
    }
    if (!this.paused) this.pending = this.options.merge(this.pending, command);
    if (this.loading && this.host && this.canResume) {
      this.loading = false;
      this.paused = false;
      this.reason = '';
      this.clear();
      this.options.changed();
    }
    if (!this.canResume && !this.paused) this.pause('Väntar på alla enheter. Återvänd till spelet eller koppla ihop igen.');
    // Guests send their input every frame, so the host acts on it as soon as possible.
    this.inputTime += Math.min(elapsed, 0.1);
    if (!this.host && this.inputTime >= 1 / 90) {
      this.inputTime = 0;
      this.sentSeq++;
      this.send({ kind: 'input', seq: this.sentSeq, epoch: this.epoch, command: this.paused ? this.options.neutral() : this.pending, ready: this.localReady });
      this.pending = this.options.afterConsume(this.pending);
    }
    this.sendTime += Math.min(elapsed, 0.1);
    if (this.sendTime < 0.04) return;
    this.sendTime = 0;
    if (this.options.waitForViews) this.send({ kind: 'view-ready', ready: this.localReady });
    if (this.host) this.frame();
  }
  private receive(slot: number, value: unknown) {
    if (!value || typeof value !== 'object' || this.disposed) return;
    const m = value as Record<string, unknown>;
    if (m.kind === 'view-ready' && typeof m.ready === 'boolean') {
      this.remoteViews.add(slot);
      this.seen.set(slot, performance.now());
      this.otherReady.set(slot, m.ready);
      return;
    }
    if (m.kind === 'presence' && typeof m.ready === 'boolean') {
      this.seen.set(slot, performance.now());
      this.otherReady.set(slot, m.ready);
      if (!m.ready) this.pause('En spelare har lämnat spelet eller saknar sin kontroll.');
      this.options.changed();
      return;
    }
    if (this.host) {
      if (m.epoch !== this.epoch) return;
      if (m.kind === 'input' && typeof m.ready === 'boolean' && this.options.validCommand(m.command)) {
        if (Number.isInteger(m.seq) && Number(m.seq) > (this.acks.get(slot)?.seq ?? 0)) this.acks.set(slot, { seq: Number(m.seq), steps: 0 });
        this.seen.set(slot, performance.now());
        this.otherReady.set(slot, m.ready);
        if (!m.ready && !this.paused) this.pause('En spelare är inte redo.');
        if (!this.paused && m.ready) this.remote.set(slot, this.options.merge(this.remote.get(slot) ?? this.options.neutral(), m.command));
      } else if (m.kind === 'pause') this.pause();
      else if (m.kind === 'resume') this.resume();
    } else if (
      m.kind === 'frame' &&
      Number.isInteger(m.epoch) &&
      Number(m.epoch) >= this.epoch &&
      Number(m.epoch) <= this.epoch + 1 &&
      typeof m.paused === 'boolean' &&
      typeof m.ready === 'boolean' &&
      typeof m.reason === 'string' &&
      m.reason.length <= 180 &&
      this.options.validState(m.state)
    ) {
      const newRound = m.epoch !== this.epoch;
      // Snapshots may arrive out of order on the fast channel; an older one is simply dropped.
      const seq = Number.isInteger(m.seq) ? Number(m.seq) : 0;
      if (!newRound && seq && seq <= this.lastFrame) return;
      this.lastFrame = seq;
      if (newRound || m.paused !== this.paused) this.clear();
      this.epoch = Number(m.epoch);
      this.seen.set(slot, performance.now());
      this.otherReady.set(slot, m.ready);
      if (m.paused || newRound) this.pendingPause = false;
      if (!m.paused) this.loading = false;
      this.paused = m.paused || this.pendingPause || !this.localReady;
      this.reason = m.reason;
      const own = (m.acks as Record<string, unknown> | undefined)?.[this.options.localSlot];
      this.options.apply(m.state, validAck(own) ? { seq: own[0], steps: own[1] } : undefined);
      this.options.changed();
    }
  }
  close() {
    this.disposed = true;
    for (const remove of this.listeners) remove();
    if (!this.options.keepLinks) for (const { link } of this.options.connections) link.close();
    this.clear();
  }
}

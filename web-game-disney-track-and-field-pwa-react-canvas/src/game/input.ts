import type { Commands, Source } from './model';
import { neutral } from './model';
export interface Mapping {
  left: number;
  right: number;
  action: number;
  pause: number;
}
export const defaultMapping: Mapping = { left: 0, right: 2, action: 1, pause: 9 };
export interface Device {
  index: number;
  id: string;
  buttons: number;
}
export class GameInput {
  devices: Device[] = [];
  active = false;
  sources: [Source, Source] = ['keyboard1', 'keyboard2'];
  players = 1;
  onPause: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  private held = [new Set<number>(), new Set<number>()];
  private queued: [Commands, Commands] = [neutral(), neutral()];
  private previous = new Map<number, boolean[]>();
  private assigned = new Map<number, string>();
  private pads: (Gamepad | null)[] = [];
  private listeners = new Set<() => void>();
  private revision = 0;
  private mappings: Record<string, Mapping> = {};
  constructor() {
    try {
      const values = JSON.parse(localStorage.getItem('sagospelen-pads-v1') || '{}');
      for (const [id, value] of Object.entries(values)) {
        const m = value as Mapping;
        if (
          m &&
          ['left', 'right', 'action', 'pause'].every(
            (key) => Number.isInteger(m[key as keyof Mapping]) && m[key as keyof Mapping] >= 0 && m[key as keyof Mapping] < 64,
          )
        )
          this.mappings[id] = m;
      }
    } catch {
      /* Settings are optional. */
    }
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
  mapping(index: number) {
    const id = this.devices.find((d) => d.index === index)?.id;
    return id ? (this.mappings[id] ?? defaultMapping) : defaultMapping;
  }
  setMapping(index: number, patch: Partial<Mapping>) {
    const id = this.devices.find((d) => d.index === index)?.id;
    if (!id) return;
    this.mappings[id] = { ...this.mapping(index), ...patch };
    try {
      localStorage.setItem('sagospelen-pads-v1', JSON.stringify(this.mappings));
    } catch {
      /* Keep playing. */
    }
    this.clear();
    this.publish();
  }
  available(source: Source) {
    return !source.startsWith('pad:') || this.devices.some((d) => source === `pad:${d.index}`);
  }
  start(sources: [Source, Source], players: number) {
    this.sources = [...sources];
    this.players = players;
    this.active = true;
    this.clear();
    this.assigned.clear();
    for (let i = 0; i < players; i++) {
      const d = this.devices.find((d) => sources[i] === `pad:${d.index}`);
      if (d) this.assigned.set(i, d.id);
    }
  }
  stop() {
    this.active = false;
    this.clear();
  }
  clear() {
    for (const h of this.held) h.clear();
    this.queued = [neutral(), neutral()];
  }
  press(player: number, button: number, down: boolean) {
    if (!this.active || player >= this.players) return;
    if (down && !this.held[player].has(button)) {
      if (button === 2) this.queued[player].action = true;
      else if (this.queued[player].feet.length < 8) this.queued[player].feet.push(button as 0 | 1);
    }
    if (down) this.held[player].add(button);
    else this.held[player].delete(button);
  }
  keyDown = (event: KeyboardEvent) => {
    if (!this.active || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) this.onPause?.();
      return;
    }
    const bindings: Record<string, [Source, number]> = {
      KeyA: ['keyboard1', 0],
      KeyD: ['keyboard1', 1],
      Space: ['keyboard1', 2],
      ArrowLeft: ['keyboard2', 0],
      ArrowRight: ['keyboard2', 1],
      Enter: ['keyboard2', 2],
    };
    const binding = bindings[event.code];
    if (!binding) return;
    event.preventDefault();
    if (event.repeat) return;
    for (let i = 0; i < this.players; i++) if (this.sources[i] === binding[0]) this.press(i, binding[1], true);
  };
  keyUp = (event: KeyboardEvent) => {
    const bindings: Record<string, [Source, number]> = {
      KeyA: ['keyboard1', 0],
      KeyD: ['keyboard1', 1],
      Space: ['keyboard1', 2],
      ArrowLeft: ['keyboard2', 0],
      ArrowRight: ['keyboard2', 1],
      Enter: ['keyboard2', 2],
    };
    const binding = bindings[event.code];
    if (!binding) return;
    for (let i = 0; i < this.players; i++) if (this.sources[i] === binding[0]) this.press(i, binding[1], false);
  };
  poll() {
    try {
      this.pads = Array.from(navigator.getGamepads?.() || []);
    } catch {
      this.pads = [];
    }
    const next = this.pads.filter((p): p is Gamepad => !!p?.connected).map((p) => ({ index: p.index, id: p.id, buttons: p.buttons.length }));
    if (JSON.stringify(next) !== JSON.stringify(this.devices)) {
      this.devices = next;
      this.publish();
    }
    for (let i = 0; i < this.players; i++) {
      if (!this.active) break;
      const source = this.sources[i];
      if (!source.startsWith('pad:')) continue;
      const index = Number(source.slice(4));
      const pad = this.pads[index];
      const expected = this.assigned.get(i);
      if (expected && (!pad?.connected || pad.id !== expected)) {
        this.assigned.delete(i);
        this.clear();
        this.onDisconnect?.();
        continue;
      }
      if (!pad?.connected) continue;
      const m = this.mapping(index);
      const values = pad.buttons.map((b) => b.pressed);
      const old = this.previous.get(index) || [];
      for (const [button, physical] of [m.left, m.right, m.action].entries()) this.press(i, button, values[physical] ?? false);
      if (values[m.pause] && !old[m.pause]) this.onPause?.();
    }
    for (const p of this.pads)
      if (p?.connected)
        this.previous.set(
          p.index,
          p.buttons.map((b) => b.pressed),
        );
    for (const key of this.previous.keys()) if (!this.pads[key]?.connected) this.previous.delete(key);
  }
  consume(): [Commands, Commands] {
    const result = this.queued;
    for (let i = 0; i < 2; i++) result[i].hold = this.held[i].has(0) || this.held[i].has(1);
    this.queued = [neutral(), neutral()];
    return result;
  }
}
export function sourceLabel(source: Source, devices: Device[]) {
  if (source === 'keyboard1') return 'Tangentbord · A / D';
  if (source === 'keyboard2') return 'Tangentbord · ← / →';
  if (source === 'touch') return 'Pekskärm';
  const d = devices.find((d) => source === `pad:${d.index}`);
  return d ? `Handkontroll ${d.index + 1}` : 'Frånkopplad handkontroll';
}

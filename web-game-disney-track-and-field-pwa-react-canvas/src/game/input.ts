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
export const keyboardControls = {
  keyboard1: { codes: ['KeyA', 'KeyD', 'Space'], labels: ['A', 'D', 'Space'] },
  keyboard2: { codes: ['ArrowLeft', 'ArrowRight', 'Enter'], labels: ['←', '→', 'Enter'] },
  keyboard3: { codes: ['KeyJ', 'KeyL', 'KeyI'], labels: ['J', 'L', 'I'] },
  keyboard4: { codes: ['KeyV', 'KeyN', 'KeyB'], labels: ['V', 'N', 'B'] },
} as const;
function keyBinding(code: string): [Source, number] | null {
  for (const [source, keys] of Object.entries(keyboardControls)) {
    const button = (keys.codes as readonly string[]).indexOf(code);
    if (button >= 0) return [source as Source, button];
  }
  return null;
}
export class GameInput {
  devices: Device[] = [];
  active = false;
  sources: Source[] = ['keyboard1', 'keyboard2', 'keyboard3', 'keyboard4'];
  players = 1;
  onPause: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  private held = Array.from({ length: 4 }, () => new Set<number>());
  private queued: Commands[] = Array.from({ length: 4 }, neutral);
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
  start(sources: Source[], players: number) {
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
    this.queued = Array.from({ length: 4 }, neutral);
  }
  press(player: number, button: number, down: boolean) {
    if (!this.active || !Number.isInteger(player) || player < 0 || player >= this.players) return;
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
    const binding = keyBinding(event.code);
    if (!binding) return;
    event.preventDefault();
    if (event.repeat) return;
    for (let i = 0; i < this.players; i++) if (this.sources[i] === binding[0]) this.press(i, binding[1], true);
  };
  keyUp = (event: KeyboardEvent) => {
    const binding = keyBinding(event.code);
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
  consume(): Commands[] {
    const result = this.queued;
    for (let i = 0; i < 4; i++) {
      result[i].hold = this.held[i].has(0) || this.held[i].has(1);
      result[i].steer = ((this.held[i].has(1) ? 1 : 0) - (this.held[i].has(0) ? 1 : 0)) as -1 | 0 | 1;
    }
    this.queued = Array.from({ length: 4 }, neutral);
    return result;
  }
}
export function sourceLabel(source: Source, devices: Device[]) {
  if (source in keyboardControls) {
    const keys = keyboardControls[source as keyof typeof keyboardControls].labels;
    return `Tangentbord · ${keys[0]} / ${keys[1]}`;
  }
  if (source === 'touch') return 'Pekskärm';
  const d = devices.find((d) => source === `pad:${d.index}`);
  return d ? `Handkontroll ${d.index + 1}` : 'Frånkopplad handkontroll';
}

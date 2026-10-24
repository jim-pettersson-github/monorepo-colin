import type { Controls, Team } from './model';
import { neutralControls, screenToWorld } from './model';

export type Source = 'keyboard1' | 'keyboard2' | 'touch' | `pad:${number}`;
export type Action = 'pass' | 'shoot' | 'switch';
export interface PadMapping {
  x: number;
  y: number;
  invertX: boolean;
  invertY: boolean;
  pass: number;
  shoot: number;
  switch: number;
  sprint: number;
  pause: number;
}
export interface Device {
  index: number;
  id: string;
  standard: boolean;
  axes: number;
  buttons: number;
}
export const defaultMapping: PadMapping = { x: 0, y: 1, invertX: false, invertY: false, pass: 0, shoot: 1, switch: 2, sprint: 5, pause: 9 };
const mappingKey = 'alfred-fc-controller-mappings-v1';

export function stickValue(value: number, deadZone = 0.2) {
  return Math.abs(value) <= deadZone ? 0 : (Math.sign(value) * (Math.abs(value) - deadZone)) / (1 - deadZone);
}

export function readPad(pad: Pick<Gamepad, 'axes' | 'buttons' | 'mapping'>, mapping: PadMapping) {
  const pressed = (index: number) => pad.buttons[index]?.pressed ?? false;
  let x = stickValue(pad.axes[mapping.x] ?? 0) * (mapping.invertX ? -1 : 1);
  let y = stickValue(pad.axes[mapping.y] ?? 0) * (mapping.invertY ? -1 : 1);
  if (pad.mapping === 'standard') {
    x = pressed(15) ? 1 : pressed(14) ? -1 : x;
    y = pressed(13) ? 1 : pressed(12) ? -1 : y;
  }
  return {
    x,
    y,
    pass: pressed(mapping.pass),
    shoot: pressed(mapping.shoot),
    switch: pressed(mapping.switch),
    sprint: pressed(mapping.sprint),
    pause: pressed(mapping.pause),
  };
}

export class InputManager {
  sources: [Source, Source] = [matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard1', 'keyboard2'];
  devices: Device[] = [];
  onPause: (() => void) | null = null;
  onDisconnect: ((team: Team) => void) | null = null;
  private keys = new Set<string>();
  private pending: [Set<Action>, Set<Action>] = [new Set(), new Set()];
  private touch = { x: 0, y: 0, sprint: false };
  private pads: (Gamepad | null)[] = [];
  private previous = new Map<number, ReturnType<typeof readPad>>();
  private assignments = new Map<Team, string>();
  private mappings: Record<string, PadMapping> = {};
  private listeners = new Set<() => void>();
  private revision = 0;
  private running = false;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(mappingKey) || '{}');
      for (const [id, value] of Object.entries(saved)) {
        if (typeof value !== 'object' || !value) continue;
        const mapping = value as PadMapping;
        const indices = ['x', 'y', 'pass', 'shoot', 'switch', 'sprint', 'pause'] as const;
        if (indices.every((key) => Number.isInteger(mapping[key]) && mapping[key] >= 0 && mapping[key] < 64))
          this.mappings[id] = { ...defaultMapping, ...mapping };
      }
    } catch {
      /* Storage is optional. */
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

  setSource(team: Team, source: Source) {
    this.sources[team] = source;
    this.assignments.delete(team);
    this.clear();
    this.publish();
  }

  mapping(index: number) {
    const device = this.devices.find((d) => d.index === index);
    return device ? this.mappings[device.id] || defaultMapping : defaultMapping;
  }

  setMapping(index: number, patch: Partial<PadMapping>) {
    const device = this.devices.find((d) => d.index === index);
    if (!device) return;
    this.mappings[device.id] = { ...this.mapping(index), ...patch };
    try {
      localStorage.setItem(mappingKey, JSON.stringify(this.mappings));
    } catch {
      /* Storage is optional. */
    }
    this.clear();
    this.publish();
  }

  begin() {
    this.clear();
    this.running = true;
    for (const team of [0, 1] as const) {
      const source = this.sources[team];
      const pad = source.startsWith('pad:') ? this.pads[Number(source.slice(4))] : null;
      if (pad) this.assignments.set(team, pad.id);
    }
  }

  end() {
    this.running = false;
    this.clear();
  }
  clear() {
    this.keys.clear();
    this.pending[0].clear();
    this.pending[1].clear();
    this.touch = { x: 0, y: 0, sprint: false };
  }
  setTouch(x: number, y: number) {
    this.touch.x = x;
    this.touch.y = y;
  }
  setTouchSprint(value: boolean) {
    this.touch.sprint = value;
  }
  touchAction(action: Action) {
    for (const team of [0, 1] as const) if (this.sources[team] === 'touch') this.pending[team].add(action);
  }

  keyDown = (event: KeyboardEvent) => {
    if (!this.running || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    const keys = [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyJ',
      'KeyK',
      'KeyL',
      'ShiftLeft',
      'ArrowUp',
      'ArrowLeft',
      'ArrowDown',
      'ArrowRight',
      'Comma',
      'Period',
      'Slash',
      'ShiftRight',
      'Numpad1',
      'Numpad2',
      'Numpad3',
    ];
    if (!keys.includes(event.code)) return;
    event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    const bindings: Record<string, [Source, Action]> = {
      KeyJ: ['keyboard1', 'pass'],
      KeyK: ['keyboard1', 'shoot'],
      KeyL: ['keyboard1', 'switch'],
      Comma: ['keyboard2', 'pass'],
      Period: ['keyboard2', 'shoot'],
      Slash: ['keyboard2', 'switch'],
      Numpad1: ['keyboard2', 'pass'],
      Numpad2: ['keyboard2', 'shoot'],
      Numpad3: ['keyboard2', 'switch'],
    };
    const binding = bindings[event.code];
    if (binding) for (const team of [0, 1] as const) if (this.sources[team] === binding[0]) this.pending[team].add(binding[1]);
  };
  keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  poll() {
    try {
      this.pads = Array.from(navigator.getGamepads?.() || []);
    } catch {
      this.pads = [];
    }
    const devices = this.pads
      .filter((p): p is Gamepad => !!p?.connected)
      .map((p) => ({ index: p.index, id: p.id, standard: p.mapping === 'standard', axes: p.axes.length, buttons: p.buttons.length }));
    if (JSON.stringify(devices) !== JSON.stringify(this.devices)) {
      this.devices = devices;
      this.publish();
    }
    for (const team of [0, 1] as const) {
      const source = this.sources[team];
      if (!this.running || !source.startsWith('pad:')) continue;
      const pad = this.pads[Number(source.slice(4))];
      const expected = this.assignments.get(team);
      if (expected && (!pad?.connected || pad.id !== expected)) {
        this.assignments.delete(team);
        this.onDisconnect?.(team);
      }
    }
    for (const pad of this.pads) {
      if (!pad?.connected) continue;
      const values = readPad(pad, this.mapping(pad.index));
      const previous = this.previous.get(pad.index);
      for (const team of [0, 1] as const) {
        if (this.sources[team] !== `pad:${pad.index}`) continue;
        for (const action of ['pass', 'shoot', 'switch'] as const) if (values[action] && !previous?.[action]) this.pending[team].add(action);
        if (values.pause && !previous?.pause) this.onPause?.();
      }
      this.previous.set(pad.index, values);
    }
    for (const index of this.previous.keys()) if (!this.pads[index]?.connected) this.previous.delete(index);
  }

  available(team: Team) {
    const source = this.sources[team];
    return !source.startsWith('pad:') || this.devices.some((d) => d.index === Number(source.slice(4)));
  }

  consume(team: Team, portrait: boolean): Controls {
    const source = this.sources[team];
    let x = 0;
    let y = 0;
    let sprint = false;
    if (source === 'touch') {
      ({ x, y, sprint } = this.touch);
    } else if (source.startsWith('pad:')) {
      const pad = this.pads[Number(source.slice(4))];
      if (pad?.connected) ({ x, y, sprint } = readPad(pad, this.mapping(pad.index)));
    } else {
      const first = source === 'keyboard1';
      x = Number(this.keys.has(first ? 'KeyD' : 'ArrowRight')) - Number(this.keys.has(first ? 'KeyA' : 'ArrowLeft'));
      y = Number(this.keys.has(first ? 'KeyS' : 'ArrowDown')) - Number(this.keys.has(first ? 'KeyW' : 'ArrowUp'));
      sprint = this.keys.has(first ? 'ShiftLeft' : 'ShiftRight');
    }
    const actions = this.pending[team];
    const control = {
      ...neutralControls(),
      ...screenToWorld(x, y, portrait),
      sprint,
      pass: actions.has('pass'),
      shoot: actions.has('shoot'),
      switch: actions.has('switch'),
    };
    actions.clear();
    return control;
  }
}

export function sourceLabel(source: Source, devices: Device[]) {
  if (source === 'touch') return 'Pekskärm';
  if (source === 'keyboard1') return 'Tangentbord · WASD';
  if (source === 'keyboard2') return 'Tangentbord · Piltangenter';
  const index = Number(source.slice(4));
  const device = devices.find((d) => d.index === index);
  return device ? `Handkontroll ${index + 1} · ${device.id}` : `Handkontroll ${index + 1} · frånkopplad`;
}

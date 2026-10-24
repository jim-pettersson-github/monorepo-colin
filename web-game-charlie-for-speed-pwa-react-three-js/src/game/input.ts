import type { Controls } from './physics';

export type InputAction = 'camera' | 'reset' | 'pause' | 'shiftUp' | 'shiftDown' | 'mute';

export type TouchState = { left: boolean; right: boolean; throttle: boolean; brake: boolean; handbrake: boolean };

const keyActions: Record<string, InputAction> = {
  KeyC: 'camera',
  KeyR: 'reset',
  Escape: 'pause',
  KeyP: 'pause',
  KeyE: 'shiftUp',
  PageUp: 'shiftUp',
  KeyQ: 'shiftDown',
  PageDown: 'shiftDown',
  KeyM: 'mute',
};

const gameKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', ...Object.keys(keyActions)]);

// Standard gamepad layout: A handbrake, B reset, Y camera, bumpers shift, Start pause.
const padActions: [number, InputAction][] = [
  [1, 'reset'],
  [3, 'camera'],
  [4, 'shiftDown'],
  [5, 'shiftUp'],
  [9, 'pause'],
];

export class DriverInput {
  private keys = new Set<string>();
  private padPressed = new Set<number>();
  private onAction: (action: InputAction) => void;
  private touch: TouchState;
  private assignedPad?: { index: number; id: string };
  private disconnected = false;

  constructor(onAction: (action: InputAction) => void, touch: TouchState) {
    this.onAction = onAction;
    this.touch = touch;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.clear);
  }

  private keyDown = (event: KeyboardEvent) => {
    if (!gameKeys.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat && keyActions[event.code]) this.onAction(keyActions[event.code]);
    this.keys.add(event.code);
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  clear = () => {
    this.keys.clear();
    Object.assign(this.touch, { left: false, right: false, throttle: false, brake: false, handbrake: false });
  };

  read(): Controls {
    const key = (...codes: string[]) => codes.some((code) => this.keys.has(code));
    let steer = (key('ArrowRight', 'KeyD') || this.touch.right ? 1 : 0) - (key('ArrowLeft', 'KeyA') || this.touch.left ? 1 : 0);
    let throttle = key('ArrowUp', 'KeyW') || this.touch.throttle ? 1 : 0;
    let brake = key('ArrowDown', 'KeyS') || this.touch.brake ? 1 : 0;
    let handbrake = key('Space') || this.touch.handbrake;

    const pads = navigator.getGamepads?.() ?? [];
    const pad = this.assignedPad ? pads[this.assignedPad.index] : pads.find((candidate) => candidate?.connected);
    if (pad?.connected && !this.assignedPad) this.assignedPad = { index: pad.index, id: pad.id };
    if (!this.available && !this.disconnected) {
      this.disconnected = true;
      this.clear();
      this.onAction('pause');
    }
    if (this.available) this.disconnected = false;
    if (pad?.connected && this.available) {
      const stick = pad.axes[0] ?? 0;
      if (Math.abs(stick) > 0.15) steer = Math.sign(stick) * ((Math.abs(stick) - 0.15) / 0.85);
      if (pad.buttons[14]?.pressed) steer = -1;
      if (pad.buttons[15]?.pressed) steer = 1;
      throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0, pad.buttons[12]?.pressed ? 1 : 0);
      brake = Math.max(brake, pad.buttons[6]?.value ?? 0, pad.buttons[13]?.pressed ? 1 : 0);
      handbrake ||= !!pad.buttons[0]?.pressed;
      for (const [index, action] of padActions) {
        const pressed = !!pad.buttons[index]?.pressed;
        if (pressed && !this.padPressed.has(index)) this.onAction(action);
        if (pressed) this.padPressed.add(index);
        else this.padPressed.delete(index);
      }
    }

    return { steer, throttle, brake, handbrake };
  }

  dispose() {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.clear);
  }
  get available() {
    if (!this.assignedPad) return true;
    const pad = navigator.getGamepads?.()[this.assignedPad.index];
    return !!pad?.connected && pad.id === this.assignedPad.id;
  }
}

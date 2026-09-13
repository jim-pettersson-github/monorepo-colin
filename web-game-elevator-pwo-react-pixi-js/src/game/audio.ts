import { currentBuilding, definition, type GameState, type SoundEvent } from './model';

export class GameAudio {
  context: AudioContext | null = null;
  liftGain: GainNode | null = null;
  alarmGain: GainNode | null = null;
  motor: OscillatorNode | null = null;
  samples = new Set<OscillatorNode>();
  alarms = new Set<OscillatorNode>();

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.liftGain = this.context.createGain();
        this.alarmGain = this.context.createGain();
        this.liftGain.connect(this.context.destination);
        this.alarmGain.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch {
      /* Silent play remains available when audio is unavailable. */
    }
  }

  tone(frequency: number, duration: number, gain: GainNode, delay = 0, alarm = false, kind: OscillatorType = 'sine') {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const start = context.currentTime + delay;
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.18, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope).connect(gain);
    const group = alarm ? this.alarms : this.samples;
    group.add(oscillator);
    oscillator.onended = () => {
      group.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  play(event: SoundEvent) {
    if (!this.context || !this.liftGain || !this.alarmGain) return;
    const base = definition(event.building).tone;
    if (event.type === 'alarm') {
      this.stopAlarm();
      for (let i = 0; i < 10; i++) this.tone(i % 2 ? 740 : 560, 0.25, this.alarmGain, i * 0.28, true);
    } else if (event.type === 'arrival') {
      this.tone(base, 0.6, this.liftGain);
      this.tone(base * 0.75, 0.6, this.liftGain, 0.3);
    } else if (event.type === 'door') {
      for (let i = 0; i < 5; i++) this.tone(base / 4 + i * 14, 0.16, this.liftGain, i * 0.13, false, 'triangle');
    } else this.tone(base * 1.4, 0.07, this.liftGain);
  }

  sync(state: GameState, paused: boolean, alarmRemaining: number) {
    if (!this.context || !this.liftGain || !this.alarmGain) return;
    const settings = state.settings;
    this.liftGain.gain.value = settings.muted || paused ? 0 : settings.liftVolume;
    this.alarmGain.gain.value = settings.muted || paused ? 0 : settings.alarmVolume;
    if (!alarmRemaining || paused || settings.muted) this.stopAlarm();
    const building = currentBuilding(state);
    const moving = !paused && !settings.muted && building?.lift.destination !== null && building !== undefined;
    if (moving && !this.motor) {
      this.motor = this.context.createOscillator();
      const quiet = this.context.createGain();
      quiet.gain.value = 0.04;
      this.motor.type = 'triangle';
      this.motor.frequency.value = definition(building.id).tone / 8;
      this.motor.connect(quiet).connect(this.liftGain);
      this.motor.onended = () => quiet.disconnect();
      this.motor.start();
    } else if (!moving && this.motor) {
      this.motor.stop();
      this.motor.disconnect();
      this.motor = null;
    }
    if (moving && this.motor) this.motor.frequency.value = definition(building.id).tone / 8;
  }

  stopAlarm() {
    for (const oscillator of this.alarms) oscillator.stop();
    this.alarms.clear();
  }

  pause() {
    this.stopAlarm();
    for (const oscillator of this.samples) oscillator.stop();
    this.samples.clear();
    if (this.motor) {
      this.motor.stop();
      this.motor.disconnect();
      this.motor = null;
    }
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }
}

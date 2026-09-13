import { currentBuilding, definition, type GameState, type SoundEvent } from './model';

export class GameAudio {
  context: AudioContext | null = null;
  liftGain: GainNode | null = null;
  alarmGain: GainNode | null = null;
  motor: { oscillators: OscillatorNode[]; envelope: GainNode; building: string } | null = null;
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
    if (this.motor && (!moving || this.motor.building !== building?.id)) this.stopMotor();
    if (moving && !this.motor) {
      const context = this.context;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, context.currentTime);
      envelope.gain.linearRampToValueAtTime(0.08, context.currentTime + 0.25);
      envelope.connect(this.liftGain);
      const oscillators = [1, 4].map((harmonic) => {
        const oscillator = context.createOscillator();
        const voice = context.createGain();
        voice.gain.value = harmonic === 1 ? 1 : 0.3;
        oscillator.type = harmonic === 1 ? 'triangle' : 'sine';
        oscillator.frequency.value = (definition(building.id).tone / 8) * harmonic;
        oscillator.connect(voice).connect(envelope);
        oscillator.onended = () => {
          oscillator.disconnect();
          voice.disconnect();
        };
        oscillator.start();
        return oscillator;
      });
      this.motor = { oscillators, envelope, building: building.id };
    }
  }

  stopMotor(immediate = false) {
    if (!this.motor || !this.context) return;
    const { oscillators, envelope } = this.motor;
    const now = this.context.currentTime;
    envelope.gain.cancelAndHoldAtTime(now);
    envelope.gain.linearRampToValueAtTime(0, now + (immediate ? 0 : 0.18));
    const last = oscillators[oscillators.length - 1];
    const cleanup = last.onended;
    last.onended = (event) => {
      cleanup?.call(last, event);
      envelope.disconnect();
    };
    for (const oscillator of oscillators) oscillator.stop(now + (immediate ? 0 : 0.2));
    this.motor = null;
  }

  stopAlarm() {
    for (const oscillator of this.alarms) oscillator.stop();
    this.alarms.clear();
  }

  pause() {
    this.stopAlarm();
    for (const oscillator of this.samples) oscillator.stop();
    this.samples.clear();
    this.stopMotor(true);
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined);
  }
}

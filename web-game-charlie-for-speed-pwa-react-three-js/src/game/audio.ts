import type { CarState } from './physics';

// Synthesised engine, tyre squeal and impact sounds; no audio files to download.
export class RaceAudio {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private engineLow: OscillatorNode | undefined;
  private engineHigh: OscillatorNode | undefined;
  private engineFilter: BiquadFilterNode | undefined;
  private engineGain: GainNode | undefined;
  private skidGain: GainNode | undefined;
  private noise: AudioBuffer | undefined;
  private lastImpact = 0;
  muted = false;

  start() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.5;
    master.connect(context.destination);

    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.Q.value = 4;
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineFilter.connect(engineGain).connect(master);

    const engineLow = context.createOscillator();
    engineLow.type = 'sawtooth';
    const engineHigh = context.createOscillator();
    engineHigh.type = 'square';
    const highGain = context.createGain();
    highGain.gain.value = 0.35;
    engineLow.connect(engineFilter);
    engineHigh.connect(highGain).connect(engineFilter);
    engineLow.start();
    engineHigh.start();

    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const skid = context.createBufferSource();
    skid.buffer = noise;
    skid.loop = true;
    const skidFilter = context.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1500;
    skidFilter.Q.value = 6;
    const skidGain = context.createGain();
    skidGain.gain.value = 0;
    skid.connect(skidFilter).connect(skidGain).connect(master);
    skid.start();

    Object.assign(this, { context, master, engineLow, engineHigh, engineFilter, engineGain, skidGain, noise });
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.05);
  }

  update(car: CarState, throttle: number) {
    const { context, engineLow, engineHigh, engineFilter, engineGain, skidGain } = this;
    if (!context || !engineLow || !engineHigh || !engineFilter || !engineGain || !skidGain) return;
    const now = context.currentTime;
    const frequency = 38 + car.rpm * 150;
    engineLow.frequency.setTargetAtTime(frequency, now, 0.03);
    engineHigh.frequency.setTargetAtTime(frequency * 2.01, now, 0.03);
    engineFilter.frequency.setTargetAtTime(500 + throttle * 1500 + car.rpm * 900, now, 0.05);
    engineGain.gain.setTargetAtTime(0.1 + throttle * 0.1, now, 0.05);

    const sliding = car.surface === 'grass' ? 0 : Math.min(1, Math.max(0, (car.slip - 3) / 8));
    skidGain.gain.setTargetAtTime(sliding * 0.22 + (car.surface === 'grass' ? 0.05 : 0), now, 0.05);

    if (car.impact > 4 && now - this.lastImpact > 0.25) {
      this.lastImpact = now;
      this.thump(Math.min(1, car.impact / 20));
    }
  }

  private thump(strength: number) {
    const { context, master, noise } = this;
    if (!context || !master || !noise) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.6 * strength + 0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    source.connect(filter).connect(gain).connect(master);
    source.start();
    source.stop(context.currentTime + 0.4);
  }

  beep(high: boolean) {
    const { context, master } = this;
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = high ? 880 : 440;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (high ? 0.6 : 0.25));
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.7);
  }

  suspend() {
    void this.context?.suspend();
  }

  dispose() {
    void this.context?.close();
    this.context = undefined;
  }
}

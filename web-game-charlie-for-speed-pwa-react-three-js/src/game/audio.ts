import type { CarSpec } from './cars';
import type { CarState } from './physics';

const profiles = {
  compact: { idle: 27, range: 210, harmonics: [1, 0.55, 0.28, 0.18, 0.12, 0.08], brightness: 1.1 },
  six: { idle: 34, range: 225, harmonics: [1, 0.22, 0.4, 0.12, 0.15, 0.06], brightness: 0.95 },
  muscle: { idle: 23, range: 165, harmonics: [1, 0.65, 0.18, 0.34, 0.1, 0.16], brightness: 0.8 },
  exotic: { idle: 42, range: 270, harmonics: [1, 0.28, 0.16, 0.11, 0.07, 0.04], brightness: 1.2 },
};

export function engineProfile(car: CarSpec) {
  if (car.id === 'arrow') return profiles.compact;
  if (['nxr', 'velox'].includes(car.id)) return profiles.six;
  if (['sting', 'xk', 'dbs', 'stallion'].includes(car.id)) return profiles.muscle;
  return profiles.exotic;
}

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));

// One bounded graph per race; offline audio checks render this same mix.
export function createRaceSound(context: BaseAudioContext, car: CarSpec) {
  const profile = engineProfile(car);
  const continuous: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [];
  const shots = new Set<() => void>();
  const keep = <T extends AudioNode>(node: T) => {
    nodes.push(node);
    return node;
  };
  const gain = (value = 0) => {
    const node = keep(context.createGain());
    node.gain.value = value;
    return node;
  };
  const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
    const node = keep(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  const mix = gain(1);
  const compressor = keep(context.createDynamicsCompressor());
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.16;
  const output = gain();
  mix.connect(compressor).connect(output).connect(context.destination);

  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 71;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  const oscillator = (type: OscillatorType, destination: AudioNode) => {
    const source = keep(context.createOscillator());
    source.type = type;
    source.connect(destination);
    source.start();
    continuous.push(source);
    return source;
  };
  const noiseLayer = (type: BiquadFilterType, frequency: number, q = 0.7) => {
    const source = keep(context.createBufferSource());
    source.buffer = noise;
    source.loop = true;
    const tone = filter(type, frequency, q);
    const level = gain();
    source.connect(tone).connect(level).connect(mix);
    source.start();
    continuous.push(source);
    return { tone, level };
  };
  const exhaust = filter('lowpass', 900);
  const engineLevel = gain();
  exhaust.connect(engineLevel).connect(mix);
  const engine = oscillator('sine', exhaust);
  engine.setPeriodicWave(context.createPeriodicWave(new Float32Array(7), new Float32Array([0, ...profile.harmonics])));
  const harmonicLevel = gain();
  harmonicLevel.connect(exhaust);
  const harmonic = oscillator('triangle', harmonicLevel);
  const intake = noiseLayer('bandpass', 500, 0.5);
  const road = noiseLayer('lowpass', 280);
  const wind = noiseLayer('bandpass', 1100, 0.4);
  const skid = noiseLayer('bandpass', 1600, 1.3);
  const squealLevel = gain();
  squealLevel.connect(mix);
  const squeal = oscillator('sine', squealLevel);
  const scrape = noiseLayer('bandpass', 2400, 0.8);
  const tunnel = gain();
  tunnel.connect(mix);
  for (const [seconds, level] of [
    [0.085, 0.22],
    [0.145, 0.12],
  ]) {
    const delay = keep(context.createDelay(0.2));
    delay.delayTime.value = seconds;
    const echoTone = filter('lowpass', 1800);
    const echo = gain(level);
    engineLevel.connect(delay);
    road.level.connect(delay);
    delay.connect(echoTone).connect(echo).connect(tunnel);
  }
  const target = (param: AudioParam, value: number, at: number, smoothing = 0.045) => param.setTargetAtTime(value, at, smoothing);
  function transient(frequency: number, strength: number, duration: number, at: number, noisy: boolean) {
    const source = noisy ? context.createBufferSource() : context.createOscillator();
    if ('buffer' in source) source.buffer = noise;
    else {
      source.type = 'sine';
      source.frequency.setValueAtTime(frequency, at);
      source.frequency.exponentialRampToValueAtTime(frequency * 0.7, at + duration);
    }
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = frequency;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(strength, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(tone).connect(envelope).connect(mix);
    const cleanup = () => {
      source.disconnect();
      tone.disconnect();
      envelope.disconnect();
      shots.delete(stop);
    };
    const stop = () => {
      source.stop();
      cleanup();
    };
    shots.add(stop);
    source.onended = cleanup;
    source.start(at);
    source.stop(at + duration + 0.01);
  }
  let lastGear: number | undefined;
  let lastImpact = -1;
  let disposed = false;
  return {
    output,
    setLevel(volume: number, muted: boolean, at = context.currentTime) {
      if (!disposed) target(output.gain, muted ? 0 : clamp(volume) * 0.75, at);
    },
    update(state: CarState, throttle: number, tunnelAmount = 0, at = context.currentTime) {
      if (disposed) return;
      const rpm = clamp(state.rpm, 0.14, 1.08);
      const load = clamp(throttle);
      const speed = Math.hypot(state.vx, state.vz);
      const rolling = clamp(speed / 65);
      const frequency = profile.idle + rpm * profile.range;
      target(engine.frequency, frequency, at, 0.025);
      target(harmonic.frequency, frequency * 2.005, at, 0.035);
      target(harmonicLevel.gain, 0.12 + rpm * 0.1, at);
      target(exhaust.frequency, (480 + rpm * 1300 + load * 1000) * profile.brightness, at);
      target(engineLevel.gain, (0.1 + load * 0.16) * (state.shiftTimer > 0 ? 0.32 : 1), at, 0.025);
      target(intake.level.gain, load * rpm * 0.045, at);
      target(intake.tone.frequency, 380 + rpm * 1400, at);
      target(road.tone.frequency, state.surface === 'grass' ? 700 : state.surface === 'curb' ? 450 : 280, at);
      const rumble = state.surface === 'curb' ? 0.07 * (0.65 + Math.sin(state.wheelSpin * 5) * 0.35) : state.surface === 'grass' ? 0.13 : 0.045;
      target(road.level.gain, rolling * rumble, at);
      target(wind.level.gain, rolling ** 2 * 0.06, at, 0.12);
      const sliding = state.surface === 'road' ? clamp((state.slip - 2.5) / 9) * clamp(speed / 12) : 0;
      target(skid.level.gain, sliding * 0.09, at);
      target(squealLevel.gain, sliding * 0.018, at);
      target(squeal.frequency, 950 + clamp(state.slip, 0, 20) * 35, at, 0.08);
      target(scrape.level.gain, state.scraping ? rolling * 0.09 : 0, at);
      target(tunnel.gain, clamp(tunnelAmount), at, 0.18);
      if (lastGear !== undefined && state.gear !== lastGear) transient(480, 0.045 * clamp(speed / 10), 0.09, at, true);
      lastGear = state.gear;
      if (state.impact > 4 && at - lastImpact > 0.3) {
        lastImpact = at;
        const strength = clamp(state.impact / 24);
        transient(550, 0.2 * strength, 0.22, at, true);
        transient(85, 0.16 * strength, 0.18, at, false);
      }
    },
    beep(high: boolean, at = context.currentTime) {
      if (!disposed) transient(high ? 1040 : 660, 0.22, high ? 0.45 : 0.18, at, false);
    },
    stopEvents() {
      for (const stop of shots) stop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const stop of shots) stop();
      for (const source of continuous) source.stop();
      for (const node of nodes) node.disconnect();
    },
  };
}

export class RaceAudio {
  private context: AudioContext | undefined;
  private sound: ReturnType<typeof createRaceSound> | undefined;
  muted = false;
  volume = 0.7;

  constructor(private car: CarSpec) {}

  start() {
    if (!this.context) {
      if (!window.AudioContext) return;
      this.context = new AudioContext();
      this.sound = createRaceSound(this.context, this.car);
    }
    this.sound?.setLevel(this.volume, this.muted);
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.sound?.setLevel(this.volume, muted);
  }
  setVolume(volume: number) {
    this.volume = clamp(volume);
    this.sound?.setLevel(this.volume, this.muted);
  }
  update(car: CarState, throttle: number, tunnel = 0) {
    if (this.context?.state === 'running') this.sound?.update(car, throttle, tunnel);
  }
  beep(high: boolean) {
    if (this.context?.state === 'running') this.sound?.beep(high);
  }
  suspend() {
    this.sound?.stopEvents();
    void this.context?.suspend().catch(() => {});
  }
  dispose() {
    this.sound?.dispose();
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.sound = undefined;
  }
}

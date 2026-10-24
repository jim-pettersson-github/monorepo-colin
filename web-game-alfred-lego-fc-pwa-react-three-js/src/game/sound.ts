import type { MatchState } from './model';
import { FIELD } from './model';

export type SoundEffect = 'pass' | 'shot' | 'slide' | 'tackle' | 'save' | 'bounce' | 'whistle' | 'goal' | 'full-time';
const foulPhases = ['yellow-card', 'free-kick', 'penalty'];
function soundSnapshot(state: MatchState) {
  return {
    phase: state.phase,
    score: state.score[0] + state.score[1],
    owner: state.ball.owner,
    vx: state.ball.vx,
    vz: state.ball.vz,
    players: state.players.map((p) => ({ kick: p.kick, slide: p.slide, fallen: p.fallen })),
  };
}

// Observe authoritative state on either device without adding audio to simulation, saves or peer messages.
export class MatchSoundTracker {
  private previous: ReturnType<typeof soundSnapshot>;
  constructor(state: MatchState) {
    this.previous = soundSnapshot(state);
  }
  update(state: MatchState, paused: boolean): SoundEffect[] {
    const before = this.previous;
    const next = soundSnapshot(state);
    this.previous = next;
    if (paused || next.score < before.score) return [];
    if (next.score > before.score) return ['goal'];
    if (next.phase === 'finished' && before.phase !== 'finished') return ['full-time'];
    const effects = new Set<SoundEffect>();
    if ((before.phase === 'kickoff' && next.phase === 'playing') || (foulPhases.includes(next.phase) && !foulPhases.includes(before.phase)))
      effects.add('whistle');
    if (next.phase === 'finished' || next.phase === 'goal' || next.phase === 'kickoff') return [...effects];
    for (const [id, player] of state.players.entries()) {
      const old = before.players[id];
      if (player.kick > old.kick + 0.03) effects.add(state.message === 'Passning' ? 'pass' : 'shot');
      if (player.slide > old.slide + 0.03) effects.add('slide');
      if (player.fallen > old.fallen + 0.03) effects.add('tackle');
    }
    if (next.owner !== null && next.owner !== before.owner && state.players[next.owner].role === 0) effects.add('save');
    if (
      next.owner === null &&
      before.owner === null &&
      ((Math.abs(state.ball.x) > FIELD.halfLength - 2 && next.vx * before.vx < -4) ||
        (Math.abs(state.ball.z) > FIELD.halfWidth - 2 && next.vz * before.vz < -4))
    )
      effects.add('bounce');
    return [...effects];
  }
}

const settingsKey = 'alfred-fc-sound-v1';
const intervals: Record<SoundEffect, number> = {
  pass: 0.08,
  shot: 0.08,
  slide: 0.12,
  tackle: 0.12,
  save: 0.12,
  bounce: 0.12,
  whistle: 0.35,
  goal: 1,
  'full-time': 1,
};

export class GameSound {
  enabled = true;
  volume = 35;
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private voices = new Set<AudioScheduledSourceNode>();
  private lastPlayed = new Map<SoundEffect, number>();
  private listeners = new Set<() => void>();
  private revision = 0;
  private foreground = true;
  constructor() {
    try {
      const value = JSON.parse(localStorage.getItem(settingsKey) || 'null');
      if (typeof value?.enabled === 'boolean') this.enabled = value.enabled;
      if (typeof value?.volume === 'number' && Number.isFinite(value.volume)) this.volume = Math.max(0, Math.min(100, value.volume));
    } catch {
      /* Sound preferences are optional. */
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
    try {
      localStorage.setItem(settingsKey, JSON.stringify({ enabled: this.enabled, volume: this.volume }));
    } catch {
      /* The controls still work without storage. */
    }
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
    else void this.unlock();
    this.publish();
  }
  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(100, volume));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume / 100, this.context.currentTime, 0.02);
    if (!this.volume) this.stop();
    this.publish();
  }
  setForeground(available: boolean) {
    this.foreground = available;
    if (!available) this.stop();
  }
  // Called directly from a user gesture; sounds missed before unlocking are never queued.
  unlock = () => {
    if (!this.enabled || typeof AudioContext === 'undefined') return;
    try {
      if (!this.context || this.context.state === 'closed') {
        const context = new AudioContext();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = this.volume / 100;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -16;
        limiter.ratio.value = 8;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.12;
        this.master.connect(limiter);
        limiter.connect(context.destination);
        this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const samples = this.noise.getChannelData(0);
        let seed = 423;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = (seed / 0x100000000) * 2 - 1;
        }
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* Unsupported or blocked audio must never interrupt a match. */
    }
  };
  private voice(source: AudioScheduledSourceNode, gain: number, at: number, duration: number, filter?: BiquadFilterNode) {
    const context = this.context;
    if (!context || !this.master || this.voices.size >= 16) {
      source.disconnect();
      return;
    }
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    if (filter) {
      source.connect(filter);
      filter.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(this.master);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      envelope.disconnect();
      filter?.disconnect();
    };
    source.start(at);
    source.stop(at + duration + 0.02);
  }
  private tone(frequency: number, end: number, gain: number, at: number, duration: number, type: OscillatorType = 'sine') {
    const oscillator = this.context?.createOscillator();
    if (!oscillator) return;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    this.voice(oscillator, gain, at, duration);
  }
  private rustle(frequency: number, gain: number, at: number, duration: number) {
    if (!this.context || !this.noise) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    this.voice(source, gain, at, duration, filter);
  }
  play(effects: readonly SoundEffect[]) {
    if (!this.enabled || !this.volume || !this.foreground || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    for (const effect of effects) {
      if (now - (this.lastPlayed.get(effect) ?? -Infinity) < intervals[effect]) continue;
      this.lastPlayed.set(effect, now);
      if (effect === 'goal') {
        this.stop();
        for (const [i, frequency] of [523, 659, 784, 1046].entries()) this.tone(frequency, frequency, 0.14, now + i * 0.12, 0.26, 'triangle');
        this.rustle(1100, 0.12, now, 0.7);
      } else if (effect === 'whistle' || effect === 'full-time') {
        if (effect === 'full-time') this.stop();
        for (let i = 0; i < (effect === 'full-time' ? 3 : 1); i++) {
          this.tone(1750, 1650, 0.1, now + i * 0.24, i === 2 ? 0.36 : 0.19);
          this.tone(2250, 2050, 0.025, now + i * 0.24, i === 2 ? 0.36 : 0.19);
        }
      } else if (effect === 'slide') this.rustle(1800, 0.12, now, 0.22);
      else if (effect === 'tackle') {
        this.tone(90, 45, 0.2, now, 0.12, 'triangle');
        this.rustle(750, 0.12, now, 0.09);
      } else {
        const shot = effect === 'shot';
        this.tone(shot ? 145 : 180, 55, shot ? 0.22 : 0.15, now, shot ? 0.14 : 0.09);
        this.rustle(effect === 'bounce' ? 2300 : 1300, shot ? 0.09 : 0.05, now, 0.04);
      }
    }
  }
  stop = () => {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* A voice may have already ended. */
      }
    }
    this.voices.clear();
  };
  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.master = undefined;
    this.noise = undefined;
    this.lastPlayed.clear();
  }
}

export const gameSound = new GameSound();

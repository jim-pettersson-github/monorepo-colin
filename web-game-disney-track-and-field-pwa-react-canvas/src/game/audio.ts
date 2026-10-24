type Cue = 'step' | 'jump' | 'count' | 'go' | 'finish';
export class GameAudio {
  enabled = true;
  private context: AudioContext | null = null;
  private nodes = new Set<OscillatorNode>();
  private last = 0;
  constructor() {
    try {
      this.enabled = localStorage.getItem('sagospelen-sound-v1') !== 'off';
    } catch {
      /* Defaults apply. */
    }
  }
  unlock = () => {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      /* Audio is optional. */
    }
  };
  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('sagospelen-sound-v1', this.enabled ? 'on' : 'off');
    } catch {
      /* Keep playing. */
    }
    if (!this.enabled) this.stop();
    else this.unlock();
  }
  play(cue: Cue) {
    const c = this.context;
    if (!this.enabled || !c || c.state !== 'running') return;
    if (cue === 'step' && c.currentTime - this.last < 0.16) return;
    this.last = c.currentTime;
    const notes = cue === 'finish' ? [523, 659, 784, 1046] : [cue === 'go' ? 880 : cue === 'count' ? 440 : cue === 'jump' ? 610 : 150];
    for (const [i, f] of notes.entries()) {
      const o = c.createOscillator(),
        g = c.createGain(),
        now = c.currentTime + i * 0.12;
      o.type = cue === 'step' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(cue === 'jump' ? f * 1.5 : Math.max(60, f * 0.8), now + 0.1);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(cue === 'step' ? 0.035 : 0.075, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      o.connect(g);
      g.connect(c.destination);
      o.start(now);
      o.stop(now + 0.2);
      this.nodes.add(o);
      o.onended = () => {
        this.nodes.delete(o);
        o.disconnect();
        g.disconnect();
      };
    }
  }
  stop() {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Already stopped. */
      }
    }
    this.nodes.clear();
  }
}
export const gameAudio = new GameAudio();

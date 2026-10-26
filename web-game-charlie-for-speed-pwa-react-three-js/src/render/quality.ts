// Graphics quality steps, best first. A slow device walks down until it draws about 30 frames a second and climbs
// back when there is room. Resolution goes first because it saves the most; the rest trims what costs on weak phones.
export type QualityLevel = {
  // Render resolution as device pixels per CSS pixel, capped by the screen.
  ratio: number;
  // The sun shadow (computers only; phones never draw it).
  shadows: boolean;
  // Share of tyre smoke, dust and sparks.
  effects: number;
  // Share of the normal fog distance; anything past the fog is not drawn.
  view: number;
  // Share of the distance where other cars switch to their simple model.
  detail: number;
};

const ladder: QualityLevel[] = [
  { ratio: 1.5, shadows: true, effects: 1, view: 1, detail: 1 },
  { ratio: 1.25, shadows: true, effects: 1, view: 1, detail: 1 },
  { ratio: 1, shadows: true, effects: 1, view: 1, detail: 1 },
  { ratio: 1, shadows: false, effects: 0.6, view: 0.85, detail: 0.8 },
  { ratio: 0.85, shadows: false, effects: 0.4, view: 0.75, detail: 0.6 },
  { ratio: 0.7, shadows: false, effects: 0.25, view: 0.65, detail: 0.5 },
  { ratio: 0.6, shadows: false, effects: 0, view: 0.55, detail: 0.4 },
  { ratio: 0.5, shadows: false, effects: 0, view: 0.5, detail: 0.3 },
];

const LOW_FPS = 30;
const HIGH_FPS = 50;
const WINDOW = 1;
// After a change, wait this long so shader compiles and the new resolution settle before judging again.
const SETTLE = 1.5;
const CLIMB_AFTER = 3;
// A step up that has to be undone soon after is not tried again for a while, so quality does not see-saw.
const BOUNCE = 6;
const BAN = 60;

// The steps this device can tell apart: levels that differ only by a resolution above the screen's are merged.
export function qualityLadder(maxRatio: number, shadows: boolean) {
  const levels: QualityLevel[] = [];
  for (const level of ladder) {
    const real = { ...level, ratio: Math.min(maxRatio, level.ratio), shadows: shadows && level.shadows };
    const previous = levels.at(-1);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(real)) levels.push(real);
  }
  return levels;
}

export class QualityGovernor {
  readonly levels: QualityLevel[];
  index: number;
  private frames: number[] = [];
  private time = 0;
  private settle = SETTLE;
  private fastFor = 0;
  private climbedAt = Number.NEGATIVE_INFINITY;
  private clock = 0;
  private ceiling = 0;
  private ceilingUntil = 0;

  constructor(levels: QualityLevel[], start: number) {
    this.levels = levels;
    this.index = Math.max(0, Math.min(levels.length - 1, start));
  }

  get level() {
    return this.levels[this.index];
  }

  // Feeds the time since the last drawn frame. Returns true when the level changed.
  frame(seconds: number) {
    // A pause-length gap (hidden tab, pause menu) says nothing about drawing speed.
    if (seconds <= 0 || seconds > 0.5) {
      this.frames = [];
      this.time = 0;
      return false;
    }
    this.clock += seconds;
    if (this.settle > 0) {
      this.settle -= seconds;
      return false;
    }
    this.frames.push(seconds);
    this.time += seconds;
    if (this.time < WINDOW) return false;
    // The typical frame, so one stutter (a shader compiling, a garbage collection) does not cost a step.
    const fps = 1 / this.frames.sort((a, b) => a - b)[this.frames.length >> 1];
    const span = this.time;
    this.frames = [];
    this.time = 0;

    if (fps < LOW_FPS) {
      this.fastFor = 0;
      if (this.clock - this.climbedAt < BOUNCE) {
        this.ceiling = this.index + 1;
        this.ceilingUntil = this.clock + BAN;
      }
      // Far below the target, skip a step so a 5 fps phone is playable within seconds.
      return this.move(fps < LOW_FPS / 2 ? 2 : 1);
    }
    if (fps > HIGH_FPS) {
      this.fastFor += span;
      const lowest = this.clock < this.ceilingUntil ? this.ceiling : 0;
      if (this.fastFor >= CLIMB_AFTER && this.index > lowest) {
        this.fastFor = 0;
        this.climbedAt = this.clock;
        return this.move(-1);
      }
      return false;
    }
    this.fastFor = 0;
    return false;
  }

  private move(steps: number) {
    const next = Math.max(0, Math.min(this.levels.length - 1, this.index + steps));
    if (next === this.index) return false;
    this.index = next;
    this.settle = SETTLE;
    return true;
  }
}

import type { Race, Racer } from './race';

// Gaps at the line: each time the player completes a lap, how far behind the car ahead they crossed (+) and, once
// it crosses too, how far ahead of the car behind (−). Read from the racers' laps and lap start times, so it works
// the same in a local race and on an online guest, whose race comes from the host's snapshots.

export type Split = {
  lap: number;
  at: number;
  ahead?: { name: string; gap: number };
  behind?: { id: number; name: string; gap?: number };
};

// How long the gaps stay on screen, and how long to wait for the car behind before giving up on it.
export const SPLIT_SHOW = 6;
export const SPLIT_WAIT = 10;

export class LapSplits {
  current?: Split;
  private laps = new Map<number, number>();
  private crossings = new Map<number, number[]>();
  private time = 0;

  observe(race: Race) {
    // A restarted race starts the clock again.
    if (race.time < this.time) this.reset();
    this.time = race.time;
    for (const racer of race.racers) {
      const seen = this.laps.get(racer.id);
      this.laps.set(racer.id, racer.lap);
      if (seen === undefined || racer.lap <= seen || racer.lap < 1) continue;
      const times = this.crossings.get(racer.id) ?? [];
      times[racer.lap] = racer.lapStart;
      this.crossings.set(racer.id, times);
      this.crossed(race, racer);
    }
  }

  // Whether the gaps are worth showing at this race time: a while after the line, longer while the car behind is
  // still on its way, and a few seconds after it arrives.
  visible(time: number) {
    const split = this.current;
    if (!split) return false;
    const age = time - split.at;
    if (!split.behind) return age < SPLIT_SHOW;
    if (split.behind.gap === undefined) return age < SPLIT_WAIT;
    return age < Math.max(SPLIT_SHOW, split.behind.gap + 3);
  }

  private crossed(race: Race, racer: Racer) {
    const { player } = race;
    if (racer === player) {
      const lap = racer.lap;
      const ahead = race.racers.find((other) => other.position === player.position - 1);
      const behind = race.racers.find((other) => other.position === player.position + 1);
      const aheadAt = ahead && this.crossings.get(ahead.id)?.[lap];
      this.current = {
        lap,
        at: racer.lapStart,
        ahead: ahead && aheadAt !== undefined ? { name: ahead.driverName, gap: racer.lapStart - aheadAt } : undefined,
        behind: behind ? { id: behind.id, name: behind.driverName } : undefined,
      };
      return;
    }
    const behind = this.current?.behind;
    if (behind && racer.id === behind.id && racer.lap === this.current?.lap && behind.gap === undefined)
      behind.gap = racer.lapStart - (this.current?.at ?? racer.lapStart);
  }

  private reset() {
    this.current = undefined;
    this.laps.clear();
    this.crossings.clear();
  }
}

export const formatGap = (seconds: number, sign: '+' | '−') => `${sign}${Math.abs(seconds).toFixed(2)}`;

import type { ClubId, MatchClubs } from './clubs';
import { applyFormResult, boostedStat } from './form';
import { footballer } from './players';
import { createTransfers, lineupFor, type TransferSave } from './transfers';

// The context carries form through successive background rounds without mutating the input save.
export interface ResultContext {
  save: TransferSave;
}
export const resultContext = (save = createTransfers()): ResultContext => ({ save });
export function teamStrength(save: TransferSave, club: ClubId) {
  const form = save.form?.[club];
  return (
    lineupFor(save, club).reduce((sum, id, slot) => {
      const p = footballer(id);
      if (!p) return sum;
      const stat = (key: 'overall' | 'pace' | 'shooting' | 'passing' | 'defending' | 'goalkeeping') => boostedStat(p[key], form);
      return (
        sum +
        (slot === 0
          ? 0.25 * stat('overall') + 0.75 * stat('goalkeeping')
          : 0.2 * stat('overall') + 0.2 * stat('pace') + 0.25 * stat('shooting') + 0.2 * stat('passing') + 0.15 * stat('defending'))
      );
    }, 0) / 5
  );
}
export function simulateScore(home: number, away: number, roll: () => number, knockout = false) {
  const gap = home - away;
  // Close teams have a small edge; the curve grows with the gap and still allows upsets.
  const edge = Math.max(-0.18, Math.min(0.18, gap * 0.0015 + gap * Math.abs(gap) * 0.00009));
  const goals = (chance: number) => Array.from({ length: 8 }, () => Number(roll() < chance)).reduce((sum, goal) => sum + goal, 0);
  const score: [number, number] = [goals(0.27 + edge), goals(0.27 - edge)];
  const extraTime = knockout && score[0] === score[1];
  if (extraTime) score[roll() < 0.5 + Math.max(-0.3, Math.min(0.3, gap * 0.005)) ? 0 : 1]++;
  return { score, extraTime };
}
export function simulateResult(context: ResultContext, pair: MatchClubs, roll: () => number, id: string, knockout = false) {
  const result = simulateScore(teamStrength(context.save, pair[0]), teamStrength(context.save, pair[1]), roll, knockout);
  context.save = applyFormResult(context.save, pair, result.score, id);
  return result;
}

import { type MatchClubs, validClub } from './clubs';
import type { MatchState, Player } from './model';
import { type Footballer, footballer } from './players';
import type { TransferSave } from './transfers';

export interface TeamForm {
  bonus: 2;
  remaining: number;
}
export const validForm = (value: unknown): value is TeamForm =>
  !!value &&
  typeof value === 'object' &&
  (value as TeamForm).bonus === 2 &&
  Number.isInteger((value as TeamForm).remaining) &&
  (value as TeamForm).remaining >= 1 &&
  (value as TeamForm).remaining <= 3;
export const boostedStat = (value: number, form?: TeamForm | null) => Math.min(100, value + (form?.bonus ?? 0));
export function matchSkill(state: MatchState, player: Player, skill: keyof Pick<Footballer, 'pace' | 'shooting' | 'passing' | 'defending' | 'goalkeeping'>) {
  return boostedStat(footballer(player.athlete)?.[skill] ?? 70, state.form?.[player.team]);
}
export function formResultId(match: MatchState) {
  return match.league
    ? `league:${match.league.seasonId}:${match.league.fixtureId}`
    : match.cup
      ? `cup:${match.cup.runId}:${match.cup.fixtureId}`
      : `match:${match.career?.id}`;
}
export function applyFormResult(save: TransferSave, pair: MatchClubs, score: readonly number[], id: string): TransferSave {
  if (save.formResults?.includes(id)) return save;
  const next = structuredClone(save);
  next.form ??= {};
  next.formResults ??= [];
  next.formResults.push(id);
  const hash = [...id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
  for (let side = 0; side < 2; side++) {
    const club = pair[side];
    const active = next.form[club];
    if (active) {
      // Even a win in the last boosted match cannot refresh an already active bonus.
      if (--active.remaining === 0) delete next.form[club];
    } else if (score[side] > score[1 - side]) next.form[club] = { bonus: 2, remaining: 1 + (hash % 3) };
  }
  return next;
}
export function validForms(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.entries(value).every(([club, form]) => validClub(club) && validForm(form));
}

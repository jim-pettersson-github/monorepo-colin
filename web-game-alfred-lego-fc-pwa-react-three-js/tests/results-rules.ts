import { expect, test } from '@playwright/test';
import { createCup, createCupMatch, finishCupMatch, validCup } from '../src/game/cups';
import { applyFormResult, boostedStat, formResultId, matchSkill } from '../src/game/form';
import { createLeagueMatch, createSeason, finishLeagueMatch, validSeason } from '../src/game/league';
import { applySubstitution, pickStarter } from '../src/game/lineups';
import { createMatch, neutralControls, STEP } from '../src/game/model';
import { validNetworkMatch } from '../src/game/network-session';
import { playerPrice } from '../src/game/players';
import { resultContext, simulateScore, teamStrength } from '../src/game/result-simulation';
import { performAction, stepMatch } from '../src/game/simulation';
import { validMatch } from '../src/game/storage';
import { createTransfers, lineupFor, prepareTransferMatch, setLineup, settleTransfers, squadFor, validTransfers, withMatchSquads } from '../src/game/transfers';

const required = <T>(value: T | undefined | null): T => {
  if (value == null) throw new Error('Missing result test fixture');
  return value;
};
const seededRoll = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

test('rating gaps increase win rates gently at first and more with large gaps, while draws and upsets remain', () => {
  const sample = (gap: number) => {
    const roll = seededRoll(1256);
    let wins = 0,
      losses = 0,
      draws = 0;
    for (let i = 0; i < 16000; i++) {
      const { score } = simulateScore(75 + gap / 2, 75 - gap / 2, roll);
      wins += Number(score[0] > score[1]);
      losses += Number(score[0] < score[1]);
      draws += Number(score[0] === score[1]);
    }
    return { win: wins / 16000, loss: losses / 16000, draw: draws / 16000 };
  };
  const equal = sample(0),
    close = sample(5),
    medium = sample(15),
    wide = sample(35);
  expect(Math.abs(equal.win - equal.loss)).toBeLessThan(0.02);
  expect(close.win).toBeGreaterThan(equal.win);
  expect(close.win - equal.win).toBeLessThan(0.06);
  expect(medium.win).toBeGreaterThan(close.win);
  expect(wide.win - medium.win).toBeGreaterThan(close.win - equal.win);
  expect(wide.win).toBeGreaterThan(0.7);
  expect(wide.loss).toBeGreaterThan(0.005);
  expect(wide.draw).toBeGreaterThan(0.01);
  const roll = seededRoll(55);
  for (let i = 0; i < 200; i++) {
    const score = simulateScore(75, 75, roll, true).score;
    expect(score[0]).not.toBe(score[1]);
  }
});

test('background strength uses the selected five and temporary form without changing base players or prices', () => {
  let save = createTransfers();
  const before = teamStrength(save, 'katona');
  const squad = squadFor(save, 'katona');
  const geza = required(squad.find((p) => p.name === 'Geza Katona'));
  save = setLineup(save, 'katona', required(pickStarter(squad, lineupFor(save, 'katona'), 1, geza.id)));
  expect(teamStrength(save, 'katona')).toBeLessThan(before);
  const withoutForm = teamStrength(save, 'katona');
  const base = JSON.stringify(squad),
    price = playerPrice(geza);
  save.form = { katona: { bonus: 2, remaining: 3 } };
  expect(teamStrength(save, 'katona')).toBeGreaterThan(withoutForm + 1);
  expect(teamStrength(save, 'katona')).toBeLessThanOrEqual(withoutForm + 2.001);
  expect(JSON.stringify(squad)).toBe(base);
  expect(playerPrice(geza)).toBe(price);
  expect(boostedStat(100, save.form.katona)).toBe(100);
});

test('a win awards 1-3 matches of form, active form cannot stack or refresh, and each completed match consumes it once', () => {
  const durations = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const initial = createTransfers();
    let save = applyFormResult(initial, ['alfred', 'brick'], [2, 0], `first-${i}`);
    const duration = required(save.form?.alfred).remaining;
    durations.add(duration);
    expect(save.form?.alfred?.bonus).toBe(2);
    expect(initial.form).toBeUndefined();
    expect(applyFormResult(save, ['alfred', 'brick'], [2, 0], `first-${i}`)).toBe(save);
    for (let game = 0; game < duration; game++) {
      save = applyFormResult(save, ['alfred', 'brick'], [2, 0], `active-${i}-${game}`);
      expect(save.form?.alfred?.remaining ?? 0).toBe(duration - game - 1);
    }
    expect(save.form?.alfred).toBeUndefined();
    save = applyFormResult(save, ['alfred', 'brick'], [3, 0], `next-${i}`);
    expect(save.form?.alfred?.bonus).toBe(2);
    expect(validTransfers(save)).toBe(true);
  }
  expect([...durations].sort()).toEqual([1, 2, 3]);
  const save = createTransfers();
  save.form = { alfred: { bonus: 2, remaining: 2 } };
  const drawn = applyFormResult(save, ['alfred', 'brick'], [1, 1], 'draw');
  expect(drawn.form?.alfred?.remaining).toBe(1);
  expect(drawn.form?.brick).toBeUndefined();
  const lost = applyFormResult(drawn, ['alfred', 'brick'], [0, 1], 'loss');
  expect(lost.form?.alfred).toBeUndefined();
  expect(lost.form?.brick?.bonus).toBe(2);
});

test('form snapshots affect real play and substitutes, survive serialization and reject invalid peer/save bonuses', () => {
  const save = createTransfers();
  save.form = { katona: { bonus: 2, remaining: 3 } };
  const state = prepareTransferMatch(save, createMatch('versus', 60, 'normal', ['katona', 'petterssons'])).state;
  delete save.form.katona;
  expect(state.form?.[0]?.remaining).toBe(3);
  expect(withMatchSquads(save, state).form).toEqual(state.form);
  expect(validMatch(JSON.parse(JSON.stringify(state)))).toBe(true);
  expect(validNetworkMatch(state)).toBe(true);
  const bench = required(squadFor(save, 'katona').find((p) => !p.keeper && !state.lineups?.[0].includes(p.id)));
  expect(applySubstitution(state, 0, 4, bench.id)).toBeNull();
  for (const skill of ['pace', 'shooting', 'passing', 'defending', 'goalkeeping'] as const)
    expect(matchSkill(state, state.players[4], skill)).toBe(Math.min(100, bench[skill] + 2));
  state.phase = 'playing';
  state.ball.owner = 4;
  const plain = structuredClone(state);
  plain.form = [null, null];
  stepMatch(state, [{ ...neutralControls(), x: 1 }, neutralControls()], STEP);
  stepMatch(plain, [{ ...neutralControls(), x: 1 }, neutralControls()], STEP);
  expect(state.players[4].vx).toBeGreaterThan(plain.players[4].vx);
  state.ball.owner = plain.ball.owner = 4;
  performAction(state, state.players[4], { ...neutralControls(), shoot: true });
  performAction(plain, plain.players[4], { ...neutralControls(), shoot: true });
  expect(Math.hypot(state.ball.vx, state.ball.vz)).toBeGreaterThan(Math.hypot(plain.ball.vx, plain.ball.vz));
  const bad = structuredClone(state);
  if (bad.form?.[0]) bad.form[0].remaining = 4;
  expect(validMatch(bad)).toBe(false);
  expect(validNetworkMatch(bad)).toBe(false);
  const invalid = createTransfers();
  invalid.form = { katona: { bonus: 2, remaining: 0 } };
  expect(validTransfers(invalid)).toBe(false);
  invalid.form = { katona: { bonus: 2, remaining: 3 } };
  invalid.formResults = ['duplicate', 'duplicate'];
  expect(validTransfers(invalid)).toBe(false);
});

test('league rounds use roster-aware background results, record all forms once and preserve rewards/ownership', () => {
  const season = createSeason('alfred', 'easy', 60);
  const initial = createTransfers();
  const match = required(createLeagueMatch(season));
  initial.form = { [match.clubs[1]]: { bonus: 2, remaining: 3 } };
  const prepared = prepareTransferMatch(initial, match);
  prepared.state.phase = 'finished';
  prepared.state.remaining = 0;
  prepared.state.score = [2, 0];
  const context = resultContext(prepared.save);
  const updated = finishLeagueMatch(season, prepared.state, context);
  expect(validSeason(updated)).toBe(true);
  expect(updated.fixtures.filter((f) => f.score)).toHaveLength(10);
  expect(context.save.formResults).toHaveLength(10);
  expect(context.save.form?.[match.clubs[1]]?.remaining).toBe(2);
  expect(context.save.form?.alfred?.bonus).toBe(2);
  const paid = settleTransfers(context.save, prepared.state);
  expect(paid.form).toEqual(context.save.form);
  expect(paid.formResults).toEqual(context.save.formResults);
  expect(paid.owners).toEqual(initial.owners);
  expect(paid.lastReward?.game).toBe(400);
  expect(validTransfers(paid)).toBe(true);
  const before = structuredClone(context.save);
  expect(finishLeagueMatch(updated, prepared.state, context)).toBe(updated);
  expect(context.save).toEqual(before);
  expect(settleTransfers(paid, prepared.state)).toBe(paid);
  expect(paid.formResults).toContain(formResultId(prepared.state));
});

test('cup byes do not consume form and elimination completes stat-based rounds with one form record per match', () => {
  const save = createTransfers();
  save.form = { alfred: { bonus: 2, remaining: 3 } };
  const context = resultContext(save);
  const cup = createCup('alfred', 'alfred', 'easy', 60, 5, context);
  expect(context.save.form?.alfred?.remaining).toBe(3);
  const match = required(createCupMatch(cup));
  match.phase = 'finished';
  match.remaining = 0;
  match.score = [0, 2];
  const updated = finishCupMatch(cup, match, context);
  expect(validCup(updated)).toBe(true);
  expect(updated.fixtures.every((f) => f.score)).toBe(true);
  expect(context.save.formResults).toHaveLength(19);
  expect(context.save.form?.alfred?.remaining).toBe(2);
  expect(validTransfers(context.save)).toBe(true);
  const before = structuredClone(context.save);
  expect(finishCupMatch(updated, match, context)).toBe(updated);
  expect(context.save).toEqual(before);
  const national = applyFormResult(createTransfers(), ['swe', 'nor'], [2, 0], 'national-win');
  expect(national.form?.swe?.bonus).toBe(2);
  expect(validTransfers(national)).toBe(true);
});

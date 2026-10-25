import type { ClubId, FootballTeam } from './clubs';
import { clubs, getClub, originalClubs, validClub } from './clubs';
import type { Fixture } from './league';
import { standings } from './league';
import { type CupKind, createMatch, type Difficulty, type MatchState } from './model';
import { nations } from './nations';

export const cupTypes = [
  {
    id: 'alfred',
    name: 'Alfredcupen',
    label: 'DIREKT UTSLAGNING',
    description: '20 klubbar från båda divisionerna. Tolv lottade lag går direkt till åttondelsfinal. Vinn och gå vidare till pokalen.',
  },
  {
    id: 'masters',
    name: 'Mästarpokalen',
    label: 'GRUPPSPEL & SLUTSPEL',
    description: 'Två grupper med tio lag. Alla möts en gång. De två bästa i varje grupp går till semifinal.',
  },
  {
    id: 'world',
    name: 'Världscupen',
    label: '24 LANDSLAG · HELA VÄRLDEN',
    description: 'Sex grupper med fyra länder. Gruppettor, grupptvåor och de fyra bästa treorna går till åttondelsfinal.',
  },
] as const;
export const cupTeams = (kind: CupKind): readonly FootballTeam[] => (kind === 'world' ? nations : clubs);
export const cupGroupRounds = (kind: CupKind, count: number = clubs.length) => (kind === 'alfred' ? 0 : kind === 'world' ? 3 : count / 2 - 1);
export const cupFinalRound = (kind: CupKind, count: number = clubs.length) =>
  kind === 'alfred' ? Math.ceil(Math.log2(count)) - 1 : kind === 'world' ? 6 : cupGroupRounds(kind, count) + 1;
const byeCount = (count: number) => 2 ** Math.ceil(Math.log2(count)) - count;
export const cupName = (kind: CupKind) => cupTypes.find((c) => c.id === kind)?.name ?? cupTypes[0].name;
export interface CupFixture extends Fixture {
  stage: 'group' | 'knockout';
  extraTime: boolean;
}
export interface Cup {
  version: 1;
  id: string;
  kind: CupKind;
  club: ClubId;
  difficulty: Difficulty;
  duration: number;
  seed: number;
  randomState: number;
  draw: ClubId[];
  fixtures: CupFixture[];
}
const roll = (cup: Pick<Cup, 'randomState'>) => {
  cup.randomState = (Math.imul(cup.randomState, 1664525) + 1013904223) >>> 0;
  return cup.randomState / 0x100000000;
};
function append(fixtures: CupFixture[], round: number, stage: CupFixture['stage'], pairs: [ClubId, ClubId][]) {
  for (const [home, away] of pairs) fixtures.push({ id: fixtures.length, round, stage, home, away, score: null, extraTime: false });
}
function opening(kind: CupKind, draw: ClubId[]) {
  const fixtures: CupFixture[] = [];
  if (kind === 'alfred')
    append(
      fixtures,
      0,
      'knockout',
      Array.from({ length: (draw.length - byeCount(draw.length)) / 2 }, (_, i) => [
        draw[byeCount(draw.length) + i * 2],
        draw[byeCount(draw.length) + 1 + i * 2],
      ]),
    );
  else {
    const size = kind === 'world' ? 4 : draw.length / 2;
    const groups = Array.from({ length: draw.length / size }, (_, i) => draw.slice(i * size, (i + 1) * size));
    for (let round = 0; round < size - 1; round++) {
      for (const group of groups) {
        append(
          fixtures,
          round,
          'group',
          Array.from({ length: size / 2 }, (_, i) => (round % 2 ? [group[size - 1 - i], group[i]] : [group[i], group[size - 1 - i]])),
        );
        group.splice(1, 0, group.pop() as ClubId);
      }
    }
  }
  return fixtures;
}
export const cupRoundName = (cup: Cup, round: number) =>
  cup.kind === 'alfred'
    ? { 0: 'Final', 1: 'Semifinal', 2: 'Kvartsfinal', 3: cup.draw.length === 12 ? 'Första omgången' : 'Åttondelsfinal', 4: 'Första omgången' }[
        cupFinalRound(cup.kind, cup.draw.length) - round
      ]
    : round < cupGroupRounds(cup.kind, cup.draw.length)
      ? `Gruppomgång ${round + 1}`
      : cup.kind === 'masters'
        ? round === cupGroupRounds(cup.kind, cup.draw.length)
          ? 'Semifinal'
          : 'Final'
        : { 3: 'Åttondelsfinal', 4: 'Kvartsfinal', 5: 'Semifinal', 6: 'Final' }[round];
export const cupChampion = (cup: Cup): ClubId | null => {
  const final = cup.fixtures.find((f) => f.round === cupFinalRound(cup.kind, cup.draw.length));
  return final?.score ? (final.score[0] > final.score[1] ? final.home : final.away) : null;
};
export const nextCupFixture = (cup: Cup) => cup.fixtures.find((f) => !f.score && (f.home === cup.club || f.away === cup.club));
export const cupOpponent = (cup: Cup, fixture: CupFixture) => (fixture.home === cup.club ? fixture.away : fixture.home);
export function cupGroups(cup: Pick<Cup, 'draw' | 'fixtures'>) {
  const size = cup.draw.length === 24 ? 4 : cup.draw.length / 2;
  return Array.from({ length: cup.draw.length / size }, (_, i) => cup.draw.slice(i * size, (i + 1) * size)).map((group) =>
    standings({ fixtures: cup.fixtures.filter((f) => f.stage === 'group') }, cup.draw)
      .filter((row) => group.includes(row.club))
      .sort(compareRows),
  );
}
type Standing = ReturnType<typeof standings>[number];
const compareRows = (a: Standing, b: Standing) =>
  b.points - a.points ||
  b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
  b.goalsFor - a.goalsFor ||
  getClub(a.club).name.localeCompare(getClub(b.club).name, 'sv');
export const cupThirdPlaces = (cup: Pick<Cup, 'draw' | 'fixtures'>) =>
  cupGroups(cup)
    .map((rows, group) => ({ ...rows[2], group }))
    .sort(compareRows);
function worldKnockout(cup: Pick<Cup, 'draw' | 'fixtures'>): [ClubId, ClubId][] {
  const groups = cupGroups(cup);
  const winners = groups.map((rows, group) => ({ ...rows[0], group }));
  const runnersUp = groups.map((rows, group) => ({ ...rows[1], group })).sort(compareRows);
  const seeds = [...winners, ...runnersUp.slice(0, 2)];
  const opponents = [...cupThirdPlaces(cup).slice(0, 4), ...runnersUp.slice(2)];
  // Seed the six group winners and best two runners-up; avoid group rematches.
  const pair = (index: number, remaining: typeof opponents): [ClubId, ClubId][] | null => {
    if (index === seeds.length) return [];
    for (const opponent of remaining) {
      if (opponent.group === seeds[index].group) continue;
      const rest = pair(
        index + 1,
        remaining.filter((row) => row.club !== opponent.club),
      );
      if (rest) return [[seeds[index].club, opponent.club], ...rest];
    }
    return null;
  };
  const pairs = pair(0, opponents);
  if (!pairs) throw new Error('No cross-group knockout draw');
  return pairs;
}
function appendNext(cup: Pick<Cup, 'kind' | 'draw' | 'fixtures'>, round: number) {
  if (round < cupGroupRounds(cup.kind, cup.draw.length) - 1 || round === cupFinalRound(cup.kind, cup.draw.length)) return;
  if (cup.kind === 'world' && round === 2) {
    append(cup.fixtures, 3, 'knockout', worldKnockout(cup));
    return;
  }
  let qualified: ClubId[];
  if (cup.kind === 'masters' && round === cupGroupRounds(cup.kind, cup.draw.length) - 1) {
    const [a, b] = cupGroups(cup);
    qualified = [a[0].club, b[1].club, b[0].club, a[1].club];
  } else {
    const winners = cup.fixtures
      .filter((f) => f.round === round)
      .map((f) => ((f.score as [number, number])[0] > (f.score as [number, number])[1] ? f.home : f.away));
    qualified =
      cup.kind === 'alfred' && byeCount(cup.draw.length) > 0 && round === 0
        ? cup.draw.slice(0, byeCount(cup.draw.length)).flatMap((club, i) => (i < winners.length ? [club, winners[i]] : [club]))
        : winners;
  }
  append(
    cup.fixtures,
    round + 1,
    'knockout',
    Array.from({ length: qualified.length / 2 }, (_, i) => [qualified[i * 2], qualified[i * 2 + 1]]),
  );
}
function simulateFixture(cup: Cup, fixture: CupFixture) {
  const goals = () => Array.from({ length: 8 }, () => (roll(cup) < 0.27 ? 1 : 0)).reduce<number>((a, b) => a + b, 0);
  fixture.score = [goals(), goals()];
  if (fixture.stage === 'knockout' && fixture.score[0] === fixture.score[1]) {
    fixture.extraTime = true;
    fixture.score[roll(cup) < 0.5 ? 0 : 1]++;
  }
}
function settle(cup: Cup) {
  // Complete rounds without the chosen club (a bye or elimination), never skip its next match.
  for (let guard = 0; guard < 12; guard++) {
    const round = cup.fixtures.find((f) => !f.score)?.round;
    if (round === undefined) return;
    const pending = cup.fixtures.filter((f) => f.round === round && !f.score);
    if (pending.some((f) => f.home === cup.club || f.away === cup.club)) return;
    for (const f of pending) simulateFixture(cup, f);
    appendNext(cup, round);
  }
}
export function createCup(kind: CupKind, club: ClubId, difficulty: Difficulty, duration: number, seed = Math.floor(Math.random() * 0x100000000)): Cup {
  const cup: Cup = {
    version: 1,
    id: crypto.randomUUID(),
    kind,
    club,
    difficulty,
    duration,
    seed,
    randomState: seed,
    draw: cupTeams(kind).map((c) => c.id),
    fixtures: [],
  };
  for (let i = cup.draw.length - 1; i > 0; i--) {
    const j = Math.floor(roll(cup) * (i + 1));
    [cup.draw[i], cup.draw[j]] = [cup.draw[j], cup.draw[i]];
  }
  cup.fixtures = opening(kind, cup.draw);
  settle(cup);
  return cup;
}
export function createCupMatch(cup: Cup): MatchState | null {
  const fixture = nextCupFixture(cup);
  if (!fixture) return null;
  const state = createMatch('solo', cup.duration, cup.difficulty, [cup.club, cupOpponent(cup, fixture)]);
  state.cup = { kind: cup.kind, runId: cup.id, fixtureId: fixture.id, knockout: fixture.stage === 'knockout', extraTime: false, extraElapsed: 0 };
  state.randomState = (cup.seed ^ Math.imul(fixture.id + 1, 2654435761)) >>> 0;
  return state;
}
export function finishCupMatch(cup: Cup, match: MatchState): Cup {
  const fixture = nextCupFixture(cup);
  if (
    match.phase !== 'finished' ||
    match.duration !== cup.duration ||
    match.difficulty !== cup.difficulty ||
    (match.cup?.extraTime && (!match.cup.knockout || Math.abs(match.score[0] - match.score[1]) !== 1)) ||
    !fixture ||
    match.cup?.runId !== cup.id ||
    match.cup.kind !== cup.kind ||
    match.cup.fixtureId !== fixture.id ||
    match.clubs[0] !== cup.club ||
    match.clubs[1] !== cupOpponent(cup, fixture) ||
    match.cup.knockout !== (fixture.stage === 'knockout') ||
    (fixture.stage === 'knockout' && match.score[0] === match.score[1])
  )
    return cup;
  const next = structuredClone(cup),
    game = next.fixtures[fixture.id];
  game.score = fixture.home === cup.club ? [...match.score] : [match.score[1], match.score[0]];
  game.extraTime = match.cup.extraTime;
  for (const other of next.fixtures.filter((f) => f.round === fixture.round && !f.score)) simulateFixture(next, other);
  appendNext(next, fixture.round);
  settle(next);
  return next;
}
export function validCup(value: unknown): value is Cup {
  if (!value || typeof value !== 'object') return false;
  const s = value as Cup;
  if (
    s.version !== 1 ||
    typeof s.id !== 'string' ||
    !s.id.length ||
    s.id.length > 100 ||
    !['alfred', 'masters', 'world'].includes(s.kind) ||
    !validClub(s.club) ||
    !cupTeams(s.kind).some((team) => team.id === s.club) ||
    !['easy', 'normal', 'hard'].includes(s.difficulty) ||
    ![60, 180, 300].includes(s.duration) ||
    ![s.seed, s.randomState].every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
    !Array.isArray(s.draw) ||
    !(s.kind === 'world' ? s.draw.length === 24 : [12, 16, 20].includes(s.draw.length)) ||
    new Set(s.draw).size !== s.draw.length ||
    !s.draw.includes(s.club) ||
    !s.draw.every((id) =>
      (s.kind === 'world' ? nations : s.draw.length === 12 ? originalClubs : clubs.slice(0, s.draw.length)).some((team) => team.id === id),
    ) ||
    !Array.isArray(s.fixtures) ||
    s.fixtures.length > (s.kind === 'world' ? 51 : s.kind === 'masters' ? 93 : 19)
  )
    return false;
  const expected = opening(s.kind, s.draw);
  for (let round = 0; round <= cupFinalRound(s.kind, s.draw.length); round++) {
    const games = expected.filter((f) => f.round === round);
    if (!games.length) break;
    for (const f of games) {
      const actual = s.fixtures[f.id];
      if (
        !actual ||
        actual.id !== f.id ||
        actual.round !== f.round ||
        actual.stage !== f.stage ||
        actual.home !== f.home ||
        actual.away !== f.away ||
        typeof actual.extraTime !== 'boolean'
      )
        return false;
      if (
        actual.score !== null &&
        (!Array.isArray(actual.score) ||
          actual.score.length !== 2 ||
          !actual.score.every((n) => Number.isInteger(n) && n >= 0 && n < 1000) ||
          (f.stage === 'knockout' && actual.score[0] === actual.score[1]))
      )
        return false;
      if (actual.extraTime && (f.stage !== 'knockout' || !actual.score || Math.abs(actual.score[0] - actual.score[1]) !== 1)) return false;
      f.score = actual.score;
      f.extraTime = actual.extraTime;
    }
    const played = games.filter((f) => f.score).length;
    if (played !== 0 && played !== games.length) return false;
    if (!played) break;
    appendNext({ kind: s.kind, draw: s.draw, fixtures: expected }, round);
  }
  return (
    expected.length === s.fixtures.length &&
    expected.every((f, i) => {
      const a = s.fixtures[i];
      return (
        !!a &&
        a.id === f.id &&
        a.round === f.round &&
        a.stage === f.stage &&
        a.home === f.home &&
        a.away === f.away &&
        a.extraTime === f.extraTime &&
        (f.score === null ? a.score === null : !!a.score && a.score[0] === f.score[0] && a.score[1] === f.score[1])
      );
    }) &&
    (!!cupChampion(s) || !!nextCupFixture(s))
  );
}
const cupKey = (kind: CupKind) => `alfred-fc-cup-${kind}-v1`;
export function loadCup(kind: CupKind): Cup | null {
  for (const key of [cupKey(kind), `${cupKey(kind)}-backup`])
    try {
      const s = JSON.parse(localStorage.getItem(key) || 'null');
      if (validCup(s) && s.kind === kind) return s;
    } catch {
      /* Try backup. */
    }
  return null;
}
export function saveCup(cup: Cup) {
  try {
    if (!validCup(cup)) return;
    const key = cupKey(cup.kind),
      old = localStorage.getItem(key);
    if (old)
      try {
        if (validCup(JSON.parse(old))) localStorage.setItem(`${key}-backup`, old);
      } catch {
        /* Keep valid backup. */
      }
    localStorage.setItem(key, JSON.stringify(cup));
  } catch {
    /* Keep playing in memory. */
  }
}

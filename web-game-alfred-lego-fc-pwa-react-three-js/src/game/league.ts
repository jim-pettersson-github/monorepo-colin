import type { ClubId } from './clubs';
import { clubs, originalClubs, validClub } from './clubs';
import { applyFormResult, formResultId } from './form';
import type { Difficulty, MatchState } from './model';
import { createMatch, neutralControls, STEP } from './model';
import { type ResultContext, resultContext, simulateResult } from './result-simulation';
import { stepMatch } from './simulation';

export type LeagueAction = 'play' | 'local' | 'wifi' | 'watch' | 'simulate';

export interface Fixture {
  id: number;
  round: number;
  home: ClubId;
  away: ClubId;
  score: [number, number] | null;
}

export interface Season {
  version: 1;
  id: string;
  club: ClubId;
  difficulty: Difficulty;
  duration: number;
  randomState: number;
  fixtures: Fixture[];
  divisions?: ClubId[][];
  year?: number;
}

export const initialDivisions = (): ClubId[][] => [clubs.filter((_, i) => i % 2 === 0).map((c) => c.id), clubs.filter((_, i) => i % 2 === 1).map((c) => c.id)];
export const seasonDivisions = (season: Pick<Season, 'divisions'>) => season.divisions ?? [originalClubs.map((c) => c.id)];
export const divisionIndex = (season: Pick<Season, 'club' | 'divisions'>) => seasonDivisions(season).findIndex((group) => group.includes(season.club));
export const seasonRounds = (season: Pick<Season, 'divisions'>) => (seasonDivisions(season)[0].length - 1) * 2;
export function seasonSchedule(divisions: readonly (readonly ClubId[])[] = initialDivisions()): Fixture[] {
  const fixtures: Fixture[] = [];
  const rotations = divisions.map((group) => [...group]);
  const firstHalf = rotations[0].length - 1;
  for (let round = 0; round < firstHalf; round++) {
    for (const rotation of rotations) {
      for (let pair = 0; pair < rotation.length / 2; pair++) {
        const a = rotation[pair];
        const b = rotation[rotation.length - 1 - pair];
        const swap = (round + pair) % 2 === 1;
        fixtures.push({ id: fixtures.length, round, home: swap ? b : a, away: swap ? a : b, score: null });
      }
      rotation.splice(1, 0, rotation.pop() as ClubId);
    }
  }
  for (const fixture of [...fixtures]) {
    fixtures.push({ id: fixtures.length, round: fixture.round + firstHalf, home: fixture.away, away: fixture.home, score: null });
  }
  return fixtures;
}

export function nextDivisions(season: Season): ClubId[][] {
  if (!season.divisions || season.fixtures.some((f) => !f.score)) return season.divisions ? structuredClone(season.divisions) : initialDivisions();
  const [upper, lower] = season.divisions.map((group) => standings(season, group).map((r) => r.club));
  const cut = upper.length - 2;
  const groups = [upper.slice(0, cut).concat(lower.slice(0, 2)), lower.slice(2).concat(upper.slice(cut))];
  clubs
    .filter((c) => !groups.flat().includes(c.id))
    .forEach((c, i) => {
      groups[i % 2].push(c.id);
    });
  return groups;
}
export function createSeason(club: ClubId, difficulty: Difficulty, duration: number, previous?: Season): Season {
  const divisions = previous?.club === club ? nextDivisions(previous) : initialDivisions();
  return {
    version: 1,
    id: crypto.randomUUID(),
    club,
    difficulty,
    duration,
    randomState: Math.floor(Math.random() * 0x100000000),
    fixtures: seasonSchedule(divisions),
    divisions,
    year: previous?.club === club ? (previous.year ?? 1) + 1 : 1,
  };
}

export const nextFixture = (season: Season) =>
  season.fixtures.find((fixture) => !fixture.score && (fixture.home === season.club || fixture.away === season.club));
export const opponentClub = (season: Season, fixture: Fixture) => (fixture.home === season.club ? fixture.away : fixture.home);

export function createLeagueMatch(season: Season): MatchState | null {
  const fixture = nextFixture(season);
  if (!fixture) return null;
  const match = createMatch('solo', season.duration, season.difficulty, [season.club, opponentClub(season, fixture)]);
  match.league = { seasonId: season.id, fixtureId: fixture.id };
  match.randomState = (season.randomState ^ Math.imul(fixture.id + 1, 2654435761)) >>> 0;
  return match;
}

// Use the same AI and fixed steps as the visible match, yielding between batches.
export async function simulateLeagueMatch(initial: MatchState, onProgress?: (match: MatchState) => void): Promise<MatchState> {
  if ((!initial.league && !initial.cup) || initial.mode !== 'solo') throw new Error('Simulation requires a competition fixture');
  const match = structuredClone(initial);
  match.watching = true;
  match.playbackSpeed = 1;
  const inputs = [neutralControls(), neutralControls()] as const;
  let steps = 0;
  const finished = () => match.phase === 'finished';
  while (!finished()) {
    for (let i = 0; i < 600 && !finished(); i++) {
      stepMatch(match, [...inputs], STEP);
      if (++steps > 120_000) throw new Error('Match simulation did not finish');
    }
    if (!finished()) onProgress?.(match);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return match;
}

export function standings(season: Pick<Season, 'fixtures'> & Partial<Pick<Season, 'club' | 'divisions'>>, participants?: readonly ClubId[]) {
  participants ??= season.divisions?.find((group) => season.club && group.includes(season.club)) ?? [
    ...new Set(season.fixtures.flatMap((f) => [f.home, f.away])),
  ];
  const rows = participants.map((club) => ({ club, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }));
  for (const fixture of season.fixtures) {
    if (!fixture.score) continue;
    const home = rows.find((row) => row.club === fixture.home);
    const away = rows.find((row) => row.club === fixture.away);
    if (!home || !away) continue;
    const [h, a] = fixture.score;
    home.played++;
    away.played++;
    home.goalsFor += h;
    home.goalsAgainst += a;
    away.goalsFor += a;
    away.goalsAgainst += h;
    if (h === a) {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    } else {
      const winner = h > a ? home : away;
      const loser = h > a ? away : home;
      winner.won++;
      winner.points += 3;
      loser.lost++;
    }
  }
  return rows.sort(
    (a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.club.localeCompare(b.club),
  );
}

export function finishLeagueMatch(season: Season, match: MatchState, results: ResultContext = resultContext()): Season {
  const fixture = nextFixture(season);
  if (
    match.phase !== 'finished' ||
    !fixture ||
    match.league?.seasonId !== season.id ||
    match.league.fixtureId !== fixture.id ||
    match.clubs[0] !== season.club ||
    match.clubs[1] !== opponentClub(season, fixture)
  )
    return season;
  const next = structuredClone(season);
  results.save = applyFormResult(results.save, match.clubs, match.score, formResultId(match));
  next.fixtures[fixture.id].score = fixture.home === season.club ? [...match.score] : [match.score[1], match.score[0]];
  const roll = () => {
    next.randomState = (Math.imul(next.randomState, 1664525) + 1013904223) >>> 0;
    return next.randomState / 0x100000000;
  };
  for (const game of next.fixtures.filter((game) => game.round === fixture.round && !game.score)) {
    game.score = simulateResult(results, [game.home, game.away], roll, `league:${season.id}:${game.id}`).score;
  }
  return next;
}

export function validSeason(value: unknown): value is Season {
  if (!value || typeof value !== 'object') return false;
  const s = value as Season;
  if (
    s.version !== 1 ||
    typeof s.id !== 'string' ||
    !s.id.length ||
    s.id.length > 100 ||
    !validClub(s.club) ||
    !clubs.some((club) => club.id === s.club) ||
    !['easy', 'normal', 'hard'].includes(s.difficulty) ||
    ![60, 180, 300].includes(s.duration)
  )
    return false;
  if (!Number.isInteger(s.randomState) || s.randomState < 0 || s.randomState > 0xffffffff || !Array.isArray(s.fixtures)) return false;
  if (
    s.divisions !== undefined &&
    (!Array.isArray(s.divisions) ||
      s.divisions.length !== 2 ||
      !s.divisions.every(
        (group) =>
          Array.isArray(group) &&
          [8, 10].includes(group.length) &&
          group.length === s.divisions?.[0].length &&
          group.every((id) => clubs.slice(0, group.length * 2).some((c) => c.id === id)),
      ) ||
      new Set(s.divisions.flat()).size !== s.divisions[0].length * 2 ||
      !Number.isSafeInteger(s.year) ||
      (s.year ?? 0) < 1)
  )
    return false;
  if (!s.divisions && !originalClubs.some((c) => c.id === s.club)) return false;
  const schedule = seasonSchedule(seasonDivisions(s));
  if (s.fixtures.length !== schedule.length) return false;
  for (let i = 0; i < schedule.length; i++) {
    const f = s.fixtures[i];
    const expected = schedule[i];
    if (!f || f.id !== expected.id || f.round !== expected.round || f.home !== expected.home || f.away !== expected.away) return false;
    if (f.score !== null && (!Array.isArray(f.score) || f.score.length !== 2 || !f.score.every((goal) => Number.isInteger(goal) && goal >= 0 && goal < 1000)))
      return false;
  }
  let pending = false;
  const gamesPerRound = seasonDivisions(s).flat().length / 2;
  for (let round = 0; round < seasonRounds(s); round++) {
    const played = s.fixtures.slice(round * gamesPerRound, (round + 1) * gamesPerRound).filter((f) => f.score !== null).length;
    if (played !== 0 && (played !== gamesPerRound || pending)) return false;
    if (!played) pending = true;
  }
  return true;
}

const seasonKey = 'alfred-fc-season-v1';
export function loadSeason(): Season | null {
  for (const key of [seasonKey, `${seasonKey}-backup`]) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (validSeason(value)) return value;
    } catch {
      /* Try the backup. */
    }
  }
  return null;
}

export function saveSeason(season: Season) {
  try {
    if (!validSeason(season)) return;
    const old = localStorage.getItem(seasonKey);
    if (old) {
      try {
        if (validSeason(JSON.parse(old))) localStorage.setItem(`${seasonKey}-backup`, old);
      } catch {
        /* Preserve a valid backup. */
      }
    }
    localStorage.setItem(seasonKey, JSON.stringify(season));
  } catch {
    /* Keep playing in memory when storage is unavailable. */
  }
}

import type { ClubId } from './clubs';
import { clubs, validClub } from './clubs';
import type { Difficulty, MatchState } from './model';
import { createMatch, neutralControls, STEP } from './model';
import { stepMatch } from './simulation';

export type LeagueAction = 'play' | 'watch' | 'simulate';

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
}

export function seasonSchedule(): Fixture[] {
  const rotation = clubs.map((club) => club.id);
  const fixtures: Fixture[] = [];
  for (let round = 0; round < rotation.length - 1; round++) {
    for (let pair = 0; pair < rotation.length / 2; pair++) {
      const a = rotation[pair];
      const b = rotation[rotation.length - 1 - pair];
      const swap = (round + pair) % 2 === 1;
      fixtures.push({ id: fixtures.length, round, home: swap ? b : a, away: swap ? a : b, score: null });
    }
    rotation.splice(1, 0, rotation.pop() as ClubId);
  }
  for (const fixture of [...fixtures]) {
    fixtures.push({ id: fixtures.length, round: fixture.round + 11, home: fixture.away, away: fixture.home, score: null });
  }
  return fixtures;
}

export function createSeason(club: ClubId, difficulty: Difficulty, duration: number): Season {
  return { version: 1, id: crypto.randomUUID(), club, difficulty, duration, randomState: Math.floor(Math.random() * 0x100000000), fixtures: seasonSchedule() };
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
  if (!initial.league || initial.mode !== 'solo') throw new Error('Simulation requires a league fixture');
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

export function standings(season: Season) {
  const rows = clubs.map((club) => ({ club: club.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }));
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

export function finishLeagueMatch(season: Season, match: MatchState): Season {
  const fixture = nextFixture(season);
  if (
    match.phase !== 'finished' ||
    !fixture ||
    match.league?.seasonId !== season.id ||
    match.league.fixtureId !== fixture.id ||
    match.mode !== 'solo' ||
    match.clubs[0] !== season.club ||
    match.clubs[1] !== opponentClub(season, fixture)
  )
    return season;
  const next = structuredClone(season);
  next.fixtures[fixture.id].score = fixture.home === season.club ? [...match.score] : [match.score[1], match.score[0]];
  const roll = () => {
    next.randomState = (Math.imul(next.randomState, 1664525) + 1013904223) >>> 0;
    return next.randomState / 0x100000000;
  };
  for (const game of next.fixtures.filter((game) => game.round === fixture.round && !game.score)) {
    const goals = (chance: number) => Array.from({ length: 8 }, () => (roll() < chance ? 1 : 0)).reduce<number>((sum, goal) => sum + goal, 0);
    game.score = [goals(0.28), goals(0.25)];
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
    !['easy', 'normal', 'hard'].includes(s.difficulty) ||
    ![60, 180, 300].includes(s.duration)
  )
    return false;
  if (!Number.isInteger(s.randomState) || s.randomState < 0 || s.randomState > 0xffffffff || !Array.isArray(s.fixtures) || s.fixtures.length !== 132)
    return false;
  const schedule = seasonSchedule();
  for (let i = 0; i < schedule.length; i++) {
    const f = s.fixtures[i];
    const expected = schedule[i];
    if (!f || f.id !== expected.id || f.round !== expected.round || f.home !== expected.home || f.away !== expected.away) return false;
    if (f.score !== null && (!Array.isArray(f.score) || f.score.length !== 2 || !f.score.every((goal) => Number.isInteger(goal) && goal >= 0 && goal < 1000)))
      return false;
  }
  let pending = false;
  for (let round = 0; round < 22; round++) {
    const played = s.fixtures.slice(round * 6, round * 6 + 6).filter((f) => f.score !== null).length;
    if (played !== 0 && (played !== 6 || pending)) return false;
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

import type { ClubId, MatchClubs } from './clubs';
import { defaultClubs } from './clubs';

export type Team = 0 | 1;
export type CupKind = 'alfred' | 'masters' | 'world';
export type MatchMode = 'solo' | 'versus';
export type PlaybackSpeed = 1 | 2 | 5;
export type Difficulty = 'easy' | 'normal' | 'hard';
export const difficultyNames: Record<Difficulty, string> = { easy: 'Lätt', normal: 'Vanlig', hard: 'Svår' };
export const difficultySettings = {
  easy: { speed: 0.52, keeperSpeed: 0.65, reaction: 1.4, tackle: false, shotDistance: 16, shotSpeed: 19, shotError: 5 },
  normal: { speed: 0.8, keeperSpeed: 0.9, reaction: 0.6, tackle: true, shotDistance: 21, shotSpeed: 24, shotError: 2 },
  hard: { speed: 1.04, keeperSpeed: 1, reaction: 0.15, tackle: true, shotDistance: 27, shotSpeed: 29, shotError: 0.4 },
} as const;
export const FIELD = { scale: 2, halfLength: 48, halfWidth: 30, goalHalfWidth: 8.2, penaltyAreaStart: 34, penaltyAreaHalfWidth: 14, penaltySpot: 36 };
export const STEP = 1 / 60;
export const SLIDE_DURATION = 0.5;
export const FALL_DURATION = 1.15;

export interface Controls {
  x: number;
  z: number;
  pass: boolean;
  shoot: boolean;
  switch: boolean;
  sprint: boolean;
}

export const neutralControls = (): Controls => ({ x: 0, z: 0, pass: false, shoot: false, switch: false, sprint: false });

export interface Player {
  athlete?: string;
  id: number;
  team: Team;
  role: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facingX: number;
  facingZ: number;
  cooldown: number;
  kick: number;
  slide: number;
  slideX: number;
  slideZ: number;
  slideHit: boolean;
  slideContact: number | null;
  fallen: number;
  yellowCards: number;
  stuck: number;
}

export interface MatchState {
  career?: { id: string; club: ClubId };
  lineups?: [string[], string[]];
  cup?: { kind: CupKind; runId: string; fixtureId: number; knockout: boolean; extraTime: boolean; extraElapsed?: number } | null;
  watching: boolean;
  playbackSpeed: PlaybackSpeed;
  league: { seasonId: string; fixtureId: number } | null;
  pitchScale: number;
  clubs: MatchClubs;
  mode: MatchMode;
  difficulty: Difficulty;
  duration: number;
  remaining: number;
  phase: 'kickoff' | 'playing' | 'goal' | 'finished' | 'yellow-card' | 'free-kick' | 'penalty' | 'penalty-ready';
  phaseTime: number;
  kickoffTeam: Team;
  lastGoal: Team | null;
  score: [number, number];
  selected: [number, number];
  switchWait: [number, number];
  players: Player[];
  ball: { x: number; z: number; vx: number; vz: number; owner: number | null; blocked: number | null; lock: number };
  message: string;
  randomState: number;
  restartProtection: number;
  foul: { offender: number; team: Team; taker: number | null } | null;
}

export const attackDirection = (team: Team) => (team === 0 ? 1 : -1);
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function createMatch(mode: MatchMode, duration = 180, difficulty: Difficulty = 'easy', clubs: MatchClubs = defaultClubs): MatchState {
  const state: MatchState = {
    watching: false,
    playbackSpeed: 1,
    league: null,
    cup: null,
    pitchScale: FIELD.scale,
    clubs: [...clubs],
    mode,
    difficulty,
    duration,
    remaining: duration,
    phase: 'kickoff',
    phaseTime: 2,
    kickoffTeam: 0,
    lastGoal: null,
    score: [0, 0],
    selected: [4, 9],
    switchWait: [0, 0],
    players: [],
    ball: { x: 0, z: 0, vx: 0, vz: 0, owner: null, blocked: null, lock: 0 },
    message: 'Avspark!',
    randomState: Math.floor(Math.random() * 0x100000000),
    restartProtection: 0,
    foul: null,
  };
  resetPositions(state);
  return state;
}

export function resetPositions(state: MatchState) {
  const cards = state.players.map((player) => player.yellowCards || 0);
  state.players = [];
  state.foul = null;
  state.restartProtection = 0;
  const formation = [
    [-21, 0],
    [-12, 0],
    [-6, -9],
    [-6, 9],
    [-2, 0],
  ];
  for (const team of [0, 1] as const) {
    for (let role = 0; role < 5; role++) {
      const [x, z] = formation[role];
      state.players.push({
        athlete: state.lineups?.[team][role],
        id: team * 5 + role,
        team,
        role,
        x: x * FIELD.scale * attackDirection(team),
        z: z * FIELD.scale,
        vx: 0,
        vz: 0,
        facingX: attackDirection(team),
        facingZ: 0,
        cooldown: 0,
        kick: 0,
        slide: 0,
        slideX: 0,
        slideZ: 0,
        slideHit: false,
        slideContact: null,
        fallen: 0,
        yellowCards: cards[team * 5 + role] || 0,
        stuck: 0,
      });
    }
  }
  const taker = state.players[state.kickoffTeam * 5 + 4];
  taker.x = -attackDirection(state.kickoffTeam) * 0.8;
  const opposingStriker = state.players[(state.kickoffTeam === 0 ? 1 : 0) * 5 + 4];
  opposingStriker.x = attackDirection(state.kickoffTeam) * 6 * FIELD.scale;
  state.selected = [4, 9];
  state.ball = { x: 0, z: 0, vx: 0, vz: 0, owner: taker.id, blocked: null, lock: 0 };
}

export function screenToWorld(x: number, y: number, portrait: boolean) {
  return portrait ? { x: -y, z: x } : { x, z: y };
}

// Upgrade existing saves and already-open sessions without changing their match progress.
export function ensureMatchRules(state: MatchState) {
  if (state.watching === undefined) state.watching = false;
  if (state.playbackSpeed === undefined) state.playbackSpeed = 1;
  if (state.league === undefined) state.league = null;
  if (state.pitchScale === undefined) {
    for (const point of [...state.players, state.ball]) {
      if (!point || typeof point !== 'object') continue;
      point.x *= FIELD.scale;
      point.z *= FIELD.scale;
    }
    state.pitchScale = FIELD.scale;
    // Keep a restart's ball on the spot and within reach of its taker after migration.
    if ((state.phase === 'penalty' || state.phase === 'penalty-ready' || state.phase === 'free-kick') && state.foul?.taker != null) {
      const taker = state.players[state.foul.taker];
      if (taker) taker.x = state.ball.x - attackDirection(taker.team) * 0.8;
    }
  }
  if (state.randomState === undefined) state.randomState = 0x12345678;
  if (state.restartProtection === undefined) state.restartProtection = 0;
  if (state.foul === undefined) state.foul = null;
  for (const player of state.players) {
    if (!player || typeof player !== 'object') continue;
    if (player.slide === undefined) player.slide = 0;
    if (player.slideX === undefined) player.slideX = 0;
    if (player.slideZ === undefined) player.slideZ = 0;
    if (player.slideHit === undefined) player.slideHit = false;
    if (player.slideContact === undefined) player.slideContact = null;
    if (player.fallen === undefined) player.fallen = 0;
    if (player.yellowCards === undefined) player.yellowCards = 0;
    if (player.stuck === undefined) player.stuck = 0;
  }
}

import { defaultClubs, validClub } from './clubs';
import type { MatchState } from './model';
import { ensureMatchRules, FALL_DURATION, FIELD, SLIDE_DURATION } from './model';
import { footballer } from './players';

const key = 'alfred-fc-match-v1';
const finite = (value: unknown, limit = 10_000): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

export function validMatch(value: unknown): value is MatchState {
  if (!value || typeof value !== 'object') return false;
  const s = value as MatchState;
  if (s.career !== undefined && (!s.career || typeof s.career.id !== 'string' || !s.career.id.length || s.career.id.length > 100 || !validClub(s.career.club)))
    return false;
  if (
    s.lineups !== undefined &&
    (!Array.isArray(s.lineups) ||
      s.lineups.length !== 2 ||
      !s.lineups.every((team) => Array.isArray(team) && team.length === 5 && team.every((id) => !!footballer(id)) && footballer(team[0])?.keeper) ||
      new Set(s.lineups.flat()).size !== 10)
  )
    return false;
  if (s.pitchScale !== FIELD.scale) return false;
  if (
    typeof s.watching !== 'boolean' ||
    ![1, 2, 5].includes(s.playbackSpeed) ||
    (s.watching ? (!s.league && !s.cup) || s.mode !== 'solo' : s.playbackSpeed !== 1)
  )
    return false;
  if (
    s.cup != null &&
    (s.league !== null ||
      !['alfred', 'masters', 'world'].includes(s.cup.kind) ||
      typeof s.cup.runId !== 'string' ||
      !s.cup.runId.length ||
      s.cup.runId.length > 100 ||
      !Number.isInteger(s.cup.fixtureId) ||
      s.cup.fixtureId < 0 ||
      s.cup.fixtureId >= (s.cup.kind === 'world' ? 51 : s.cup.kind === 'masters' ? 93 : 19) ||
      typeof s.cup.knockout !== 'boolean' ||
      typeof s.cup.extraTime !== 'boolean' ||
      (s.cup.extraElapsed !== undefined &&
        (!finite(s.cup.extraElapsed, Number.MAX_SAFE_INTEGER) || s.cup.extraElapsed < 0 || (!s.cup.extraTime && s.cup.extraElapsed !== 0))) ||
      (s.cup.extraTime && (!s.cup.knockout || s.remaining !== 0)))
  )
    return false;
  if (!Array.isArray(s.clubs) || s.clubs.length !== 2 || !s.clubs.every(validClub) || s.clubs[0] === s.clubs[1]) return false;
  if (!['solo', 'versus'].includes(s.mode) || !['easy', 'normal', 'hard'].includes(s.difficulty)) return false;
  if (
    s.league !== null &&
    (!s.league ||
      typeof s.league.seasonId !== 'string' ||
      s.league.seasonId.length > 100 ||
      !Number.isInteger(s.league.fixtureId) ||
      s.league.fixtureId < 0 ||
      s.league.fixtureId >= 180)
  )
    return false;
  if (![60, 180, 300].includes(s.duration) || !finite(s.remaining) || s.remaining < 0 || s.remaining > s.duration) return false;
  if (!['kickoff', 'playing', 'goal', 'finished', 'yellow-card', 'free-kick', 'penalty', 'penalty-ready'].includes(s.phase) || !finite(s.phaseTime, 4))
    return false;
  if (!Number.isInteger(s.randomState) || s.randomState < 0 || s.randomState > 0xffffffff || !finite(s.restartProtection, 1) || s.restartProtection < 0)
    return false;
  const playerId = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 10;
  if (s.foul !== null && (!s.foul || !playerId(s.foul.offender) || ![0, 1].includes(s.foul.team) || (s.foul.taker !== null && !playerId(s.foul.taker))))
    return false;
  const penalty = s.phase === 'penalty' || s.phase === 'penalty-ready';
  if ((s.phase === 'free-kick' || s.phase === 'yellow-card' || penalty) && !s.foul) return false;
  if (
    (s.phase === 'free-kick' || penalty) &&
    (s.foul?.taker === null || (s.foul?.taker ?? -1) % 5 === 0 || Math.floor((s.foul?.taker ?? -1) / 5) !== s.foul?.team)
  )
    return false;
  if (penalty && (s.ball?.owner !== s.foul?.taker || Math.floor((s.foul?.offender ?? -1) / 5) === s.foul?.team)) return false;
  if (![0, 1].includes(s.kickoffTeam) || ![null, 0, 1].includes(s.lastGoal) || typeof s.message !== 'string' || s.message.length > 100) return false;
  if (!Array.isArray(s.score) || s.score.length !== 2 || !s.score.every((n) => Number.isInteger(n) && n >= 0 && n < 1000)) return false;
  if (!Array.isArray(s.selected) || s.selected.length !== 2 || !s.selected.every((id, team) => Number.isInteger(id) && id > team * 5 && id < team * 5 + 5))
    return false;
  if (!Array.isArray(s.switchWait) || s.switchWait.length !== 2 || !s.switchWait.every((n) => finite(n))) return false;
  if (!Array.isArray(s.players) || s.players.length !== 10) return false;
  for (let i = 0; i < 10; i++) {
    const p = s.players[i];
    if (!p || p.id !== i || p.team !== Math.floor(i / 5) || p.role !== i % 5) return false;
    if ((p.athlete !== undefined && !footballer(p.athlete)) || p.athlete !== s.lineups?.[p.team][p.role]) return false;
    if (
      !finite(p.x, FIELD.halfLength + 1) ||
      !finite(p.z, FIELD.halfWidth + 1) ||
      !finite(p.vx, 30) ||
      !finite(p.vz, 30) ||
      !finite(p.facingX, 1) ||
      !finite(p.facingZ, 1) ||
      !finite(p.cooldown, 2) ||
      !finite(p.kick, 1)
    )
      return false;
    if (!finite(p.slide, SLIDE_DURATION) || p.slide < 0 || !finite(p.slideX, 1) || !finite(p.slideZ, 1) || typeof p.slideHit !== 'boolean') return false;
    if (p.slideContact !== null && (!playerId(p.slideContact) || Math.floor(p.slideContact / 5) === p.team)) return false;
    if (
      !finite(p.fallen, FALL_DURATION) ||
      p.fallen < 0 ||
      !finite(p.stuck, 2) ||
      p.stuck < 0 ||
      !Number.isInteger(p.yellowCards) ||
      p.yellowCards < 0 ||
      p.yellowCards > 1000
    )
      return false;
  }
  const b = s.ball;
  return (
    !!b &&
    finite(b.x, FIELD.halfLength + 2) &&
    finite(b.z, FIELD.halfWidth + 1) &&
    finite(b.vx, 40) &&
    finite(b.vz, 40) &&
    (b.owner === null || playerId(b.owner)) &&
    (b.blocked === null || playerId(b.blocked)) &&
    finite(b.lock, 1)
  );
}

export function saveMatch(state: MatchState) {
  try {
    if (!state.clubs) state.clubs = [...defaultClubs];
    ensureMatchRules(state);
    if (!validMatch(state)) return;
    const previous = localStorage.getItem(key);
    if (previous) {
      try {
        if (validMatch(upgradeSave(JSON.parse(previous)))) localStorage.setItem(`${key}-backup`, previous);
      } catch {
        /* Preserve an existing valid backup. */
      }
    }
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* A match remains playable when storage is unavailable. */
  }
}

function upgradeSave(value: unknown) {
  if (value && typeof value === 'object') {
    const upgraded = { ...value, clubs: 'clubs' in value ? value.clubs : [...defaultClubs] } as MatchState;
    if (Array.isArray(upgraded.players)) ensureMatchRules(upgraded);
    return upgraded;
  }
  return value;
}

export function loadMatch(): MatchState | null {
  for (const candidate of [key, `${key}-backup`]) {
    try {
      const value = upgradeSave(JSON.parse(localStorage.getItem(candidate) || 'null'));
      if (validMatch(value) && value.phase !== 'finished') return value;
    } catch {
      /* Try the backup. */
    }
  }
  return null;
}

export function clearMatch() {
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}-backup`);
  } catch {
    /* Storage is optional. */
  }
}

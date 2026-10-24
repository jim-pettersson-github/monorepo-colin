import { expect, test } from '@playwright/test';
import { matchCameraFrame } from '../src/game/camera';
import { clubs } from '../src/game/clubs';
import { defaultMapping, InputManager, readPad, stickValue } from '../src/game/input';
import {
  createLeagueMatch,
  createSeason,
  finishLeagueMatch,
  loadSeason,
  nextFixture,
  opponentClub,
  saveSeason,
  seasonSchedule,
  simulateLeagueMatch,
  standings,
  validSeason,
} from '../src/game/league';
import { attackDirection, createMatch, ensureMatchRules, FIELD, neutralControls, resetPositions, STEP, screenToWorld, type Team } from '../src/game/model';
import { NetworkSession, validNetworkMatch } from '../src/game/network-session';
import { decodeSignal, encodeSignal, type PeerLink } from '../src/game/peer-link';
import { MatchSession } from '../src/game/session';
import { performAction, stepMatch } from '../src/game/simulation';
import { validMatch } from '../src/game/storage';

test('Wi-Fi codes round-trip compact local SDP and reject foreign, truncated and oversized payloads', async () => {
  const signal = { v: 1 as const, id: '12345678-1234-1234-1234-123456789abc', type: 'offer' as const, sdp: 'v=0\r\na=ice-ufrag:local\r\n' };
  const code = await encodeSignal(signal);
  expect(await decodeSignal(code)).toEqual(signal);
  for (const invalid of ['', 'https://example.com/', 'AFC2.Z.abc', `${code.slice(0, -8)}x`, `AFC1.P.${'a'.repeat(6000)}`]) {
    await expect(decodeSignal(invalid)).rejects.toThrow();
  }
  await expect(decodeSignal(await encodeSignal({ ...signal, sdp: 'bad SDP' }))).rejects.toThrow();
});

function fakePeer(role: 'host' | 'guest') {
  const messages: unknown[] = [];
  const listeners = new Set<(value: unknown) => void>();
  const link = {
    role,
    status: 'connected',
    error: '',
    send(value: unknown) {
      messages.push(structuredClone(value));
      return true;
    },
    onMessage(listener: (value: unknown) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribe() {
      return () => {};
    },
    close() {},
  } as unknown as PeerLink;
  const input = { available: () => true, clear() {}, begin() {}, consume: () => neutralControls() } as unknown as InputManager;
  return {
    link,
    input,
    messages,
    receive(value: unknown) {
      for (const listener of listeners) listener(value);
    },
  };
}

test('the host rejects forged scores and invalid controls, synchronizes decisions and restarts the same peer match', () => {
  const host = fakePeer('host');
  const state = createMatch('versus', 60);
  state.phase = 'playing';
  const session = new NetworkSession(state, host.input, host.link);
  const forged = structuredClone(state);
  forged.score = [99, 99];
  host.receive({ kind: 'frame', state: forged, paused: false, ready: true, reason: '', round: 0 });
  host.receive({ kind: 'input', controls: { ...neutralControls(), x: Infinity }, ready: true, round: 0 });
  host.receive({ kind: 'input', controls: { ...neutralControls(), x: -1 }, ready: true, round: 0 });
  const x = state.players[9].x;
  session.advance(0.1);
  expect(state.players[9].x).toBeLessThan(x);
  expect(state.score).toEqual([0, 0]);
  expect(validNetworkMatch(state)).toBe(true);
  session.setForeground(false);
  host.receive({ kind: 'resume', round: 0 });
  expect(session.paused).toBe(true);
  session.setForeground(true);
  host.receive({ kind: 'ready', ready: false });
  session.resume();
  expect(session.paused).toBe(true);
  host.receive({ kind: 'ready', ready: true });
  session.resume();
  expect(session.paused).toBe(false);
  const guest = fakePeer('guest');
  const mirror = new NetworkSession(structuredClone(state), guest.input, guest.link);
  state.phase = 'finished';
  state.remaining = 0;
  state.score = [3, 1];
  state.message = 'Alfred FF vinner!';
  session.advance(0.1);
  guest.receive(host.messages.at(-1));
  expect(mirror.state.score).toEqual([3, 1]);
  expect(mirror.state.phase).toBe('finished');
  const finished = structuredClone(mirror.state);
  mirror.advance(5);
  mirror.rematch();
  expect(mirror.state).toEqual(finished);
  session.rematch();
  guest.receive(host.messages.at(-1));
  expect(mirror.state.score).toEqual([0, 0]);
  expect(mirror.state.phase).toBe('kickoff');
  expect(mirror.state.clubs).toEqual(state.clubs);
  expect(mirror.paused).toBe(false);
  // Network snapshots do not use localStorage, including at full time or during a rematch.
  session.save();
  mirror.save();
  session.dispose();
  mirror.dispose();
});

test('a close slide past a standing opponent never counts as contact across the visible gap', () => {
  for (const gap of [0.7, 0.8, 0.95, 1.1, 2]) {
    const state = createMatch('versus');
    state.phase = 'playing';
    state.randomState = 0;
    state.switchWait = [2, 2];
    state.players[4].x = -10;
    state.players[4].z = -10;
    state.players[9].x = -8;
    state.players[9].z = -10 + gap;
    state.players[6].x = 15;
    state.players[6].z = 10;
    state.ball = { x: 14.2, z: 10, vx: 0, vz: 0, owner: 6, blocked: null, lock: 0 };
    performAction(state, state.players[4], { ...neutralControls(), x: 1, shoot: true });
    for (let i = 0; i < 32; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
    expect(state.players[4].slideContact, `Gap ${gap}`).toBeNull();
    expect(state.players[9].fallen).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.foul).toBeNull();
    expect(state.randomState).toBe(0);
  }
});

test('instant and watched league matches run identical fixed-step AI and resolve penalties automatically', async () => {
  const season = createSeason('alfred', 'normal', 60);
  season.randomState = 1200;
  const initial = createLeagueMatch(season);
  if (!initial) throw new Error('Missing match');
  const visible = structuredClone(initial);
  visible.watching = true;
  for (let i = 0; i < 60_000 && visible.phase !== 'finished'; i++) stepMatch(visible, [neutralControls(), neutralControls()], STEP);
  expect(visible.phase).toBe('finished');
  const simulated = await simulateLeagueMatch(initial);
  expect(simulated).toEqual(visible);
  expect(initial.phase).toBe('kickoff');
  expect(validMatch(simulated)).toBe(true);
  expect(finishLeagueMatch(season, simulated).fixtures.filter((f) => f.score)).toHaveLength(6);
  const penalty = missedSlide(1000, FIELD.penaltySpot, 0, 1);
  penalty.league = initial.league;
  penalty.mode = 'solo';
  penalty.watching = true;
  for (let i = 0; i < 220; i++) stepMatch(penalty, [neutralControls(), neutralControls()], STEP);
  expect(penalty.phase).not.toBe('penalty-ready');
  expect(penalty.score[0]).toBe(1);
});

test('watch speeds advance simulation time at 1x, 2x and 5x and respect pause', () => {
  for (const speed of [1, 2, 5] as const) {
    const state = createLeagueMatch(createSeason('alfred', 'easy', 60));
    if (!state) throw new Error('Missing fixture');
    state.watching = true;
    state.phase = 'playing';
    const input = {
      clear() {},
      begin() {},
      consume() {
        throw new Error('A spectator must not control players');
      },
    } as unknown as InputManager;
    const session = new MatchSession(state, input);
    session.setPlaybackSpeed(speed);
    expect(validMatch(state)).toBe(true);
    for (let i = 0; i < 10; i++) session.advance(0.1);
    expect(state.remaining).toBeCloseTo(60 - speed, 1);
    session.pause();
    const paused = JSON.stringify(state);
    session.advance(30);
    expect(JSON.stringify(state)).toBe(paused);
    session.resume();
    session.advance(0.1);
    expect(state.remaining).toBeLessThan(60 - speed);
  }
  const quick = createMatch('solo');
  quick.watching = true;
  expect(validMatch(quick)).toBe(false);
});

test('the league schedules home and away meetings for all twelve clubs and completes an entire season once', () => {
  const fixtures = seasonSchedule();
  expect(fixtures).toHaveLength(132);
  for (let round = 0; round < 22; round++) {
    const games = fixtures.filter((f) => f.round === round);
    expect(games).toHaveLength(6);
    expect(new Set(games.flatMap((f) => [f.home, f.away])).size).toBe(12);
  }
  for (const club of clubs) {
    expect(fixtures.filter((f) => f.home === club.id)).toHaveLength(11);
    expect(fixtures.filter((f) => f.away === club.id)).toHaveLength(11);
    for (const other of clubs.filter((c) => c.id !== club.id)) expect(fixtures.filter((f) => f.home === club.id && f.away === other.id)).toHaveLength(1);
  }
  let season = createSeason('skogsby', 'easy', 60);
  for (let round = 0; round < 22; round++) {
    const fixture = nextFixture(season);
    if (!fixture) throw new Error('Missing fixture');
    expect(fixture.round).toBe(round);
    const match = createMatch('solo', 60, 'easy', [season.club, opponentClub(season, fixture)]);
    match.league = { seasonId: season.id, fixtureId: fixture.id };
    match.score = [2, 1];
    expect(finishLeagueMatch(season, match)).toBe(season);
    match.phase = 'finished';
    season = finishLeagueMatch(season, match);
    expect(season.fixtures[fixture.id].score).toEqual(fixture.home === season.club ? [2, 1] : [1, 2]);
    expect(season.fixtures.filter((f) => f.score)).toHaveLength((round + 1) * 6);
    expect(validSeason(season)).toBe(true);
    expect(finishLeagueMatch(season, match)).toBe(season);
  }
  expect(nextFixture(season)).toBeUndefined();
  expect(standings(season).every((row) => row.played === 22)).toBe(true);
  expect(standings(season).find((row) => row.club === season.club)).toMatchObject({ won: 22, points: 66, goalsFor: 44, goalsAgainst: 22 });
});

test('league saves recover their backup and reject altered schedules or partial rounds', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => entries.get(key) || null, setItem: (key: string, value: string) => entries.set(key, value) },
  });
  try {
    const season = createSeason('alfred', 'hard', 60);
    saveSeason(season);
    saveSeason(season);
    expect(loadSeason()).toEqual(season);
    entries.set('alfred-fc-season-v1', '{bad json');
    expect(loadSeason()).toEqual(season);
    const broken = structuredClone(season);
    broken.fixtures[0].score = [1, 0];
    expect(validSeason(broken)).toBe(false);
    broken.fixtures[0].score = null;
    broken.fixtures[1].home = broken.fixtures[1].away;
    expect(validSeason(broken)).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('empty slides have no whistle and clean ball-first slides remain legal', () => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.randomState = 1000;
  state.players[4].x = -10;
  state.players[4].z = -10;
  state.players[9].x = 15;
  state.players[9].z = 10;
  state.ball = { x: 14.2, z: 10, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  performAction(state, state.players[4], { ...neutralControls(), x: -1, shoot: true });
  for (let i = 0; i < 40; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.phase).toBe('playing');
  expect(state.foul).toBeNull();
  expect(state.randomState).toBe(1000);
  expect(state.players.every((p) => p.fallen === 0 && p.yellowCards === 0)).toBe(true);
});

test('easy opponents move slower, avoid slide tackles and shoot more gently than hard opponents', () => {
  const speeds: number[] = [];
  const slides: boolean[] = [];
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    const state = createMatch('solo', 180, difficulty);
    state.phase = 'playing';
    stepMatch(state, [neutralControls(), neutralControls()], STEP);
    speeds.push(Math.hypot(state.players[9].vx, state.players[9].vz));
    state.players[9].x = 1.6;
    state.players[9].z = 0;
    let slid = false;
    for (let i = 0; i < 40; i++) {
      stepMatch(state, [neutralControls(), neutralControls()], STEP);
      if (state.players[9].slide > 0) slid = true;
    }
    slides.push(slid);
    const shot = createMatch('solo', 180, difficulty);
    shot.ball.owner = 9;
    performAction(shot, shot.players[9], { ...neutralControls(), shoot: true });
    expect(Math.hypot(shot.ball.vx, shot.ball.vz)).toBeCloseTo(difficulty === 'easy' ? 19 : difficulty === 'normal' ? 24 : 29);
  }
  expect(speeds[0]).toBeLessThan(speeds[1]);
  expect(speeds[1]).toBeLessThan(speeds[2]);
  expect(slides[0]).toBe(false);
  expect(slides[2]).toBe(true);
});

test('touching the ball during a slide clears earlier body contact without a whistle', () => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.randomState = 1000;
  state.switchWait = [2, 2];
  state.players[4].x = -2;
  state.players[4].z = 0;
  state.players[9].x = 1;
  state.players[9].z = 0;
  state.players[9].facingX = 1;
  state.ball = { x: 1.8, z: 0, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  performAction(state, state.players[4], { ...neutralControls(), x: 1, shoot: true });
  let fell = false;
  for (let i = 0; i < 32; i++) {
    stepMatch(state, [neutralControls(), neutralControls()], STEP);
    if (state.players[9].fallen > 0) fell = true;
  }
  expect(fell).toBe(true);
  expect(state.players[4].slideHit).toBe(true);
  expect(state.players[4].slideContact).toBeNull();
  expect(state.phase).toBe('playing');
  expect(state.foul).toBeNull();
  expect(state.randomState).toBe(1000);
});

test('the doubled pitch keeps playable boundaries and migrates old positions only once', () => {
  expect([FIELD.halfLength * 2, FIELD.halfWidth * 2]).toEqual([96, 60]);
  const state = createMatch('versus');
  state.score = [2, 1];
  state.remaining = 73;
  const positions = [...state.players, state.ball].map((point) => [point.x, point.z]);
  const old = JSON.parse(JSON.stringify(state));
  delete old.pitchScale;
  for (const point of [...old.players, old.ball]) {
    point.x /= 2;
    point.z /= 2;
  }
  ensureMatchRules(old);
  expect([...old.players, old.ball].map((point) => [point.x, point.z])).toEqual(positions);
  expect(old.score).toEqual([2, 1]);
  expect(old.remaining).toBe(73);
  ensureMatchRules(old);
  expect([...old.players, old.ball].map((point) => [point.x, point.z])).toEqual(positions);
  expect(validMatch(old)).toBe(true);
  state.phase = 'playing';
  state.players[4].x = FIELD.halfLength - 1;
  state.players[4].z = FIELD.halfWidth - 1;
  state.ball.owner = 4;
  for (let i = 0; i < 60; i++) stepMatch(state, [{ ...neutralControls(), x: 1, z: 1 }, neutralControls()], STEP);
  expect(state.players[4].x).toBeLessThan(FIELD.halfLength);
  expect(state.players[4].z).toBeLessThan(FIELD.halfWidth);
  expect(state.players[4].x).toBeGreaterThan(24);
  expect(state.players[4].z).toBeGreaterThan(15);
});

test('the camera follows play in both orientations and frames the penalty goal', () => {
  const state = createMatch('versus');
  state.phase = 'playing';
  for (const portrait of [false, true]) {
    const aspect = portrait ? 0.6 : 1.8;
    const center = matchCameraFrame(state, aspect, portrait);
    state.ball.x = 42;
    state.ball.z = 24;
    const far = matchCameraFrame(state, aspect, portrait);
    expect(far.x).toBeGreaterThan(center.x + 8);
    expect(far.z).toBeGreaterThan(5);
    expect(far.halfHeight).toBeLessThan(48);
    state.phase = 'penalty-ready';
    state.foul = { offender: 9, team: 0, taker: 4 };
    state.ball.x = FIELD.penaltySpot;
    state.ball.z = 0;
    const penalty = matchCameraFrame(state, aspect, portrait);
    expect(penalty.x).toBeGreaterThan(15);
    expect(penalty.z).toBe(0);
    const halfGroundX = portrait ? penalty.halfHeight / (65 / Math.hypot(65, 50)) : penalty.halfHeight * aspect;
    expect(Math.abs(FIELD.halfLength - penalty.x)).toBeLessThan(halfGroundX);
    state.phase = 'playing';
    state.ball.x = 0;
    state.ball.z = 0;
  }
  expect(matchCameraFrame(state, 1.8, false, true)).toEqual({ x: 0, z: 0, halfHeight: 52 });
});

test('five per side, two human players move independently, and AI keeps its formation active', () => {
  const state = createMatch('versus');
  expect(state.players.filter((p) => p.team === 0)).toHaveLength(5);
  expect(state.players.filter((p) => p.role === 0)).toHaveLength(2);
  state.phase = 'playing';
  const home = state.players[4].x;
  const away = state.players[9].z;
  const aiStart = state.players[2].x;
  for (let i = 0; i < 30; i++)
    stepMatch(
      state,
      [
        { ...neutralControls(), x: 1 },
        { ...neutralControls(), z: 1 },
      ],
      STEP,
    );
  expect(state.players[4].x).toBeGreaterThan(home + 1);
  expect(state.players[9].z).toBeGreaterThan(away + 1);
  expect(state.players[2].x).not.toBe(aiStart);
  expect(validMatch(state)).toBe(true);
});

test('passes release the ball, shots travel faster, and a tackle changes possession with a cooldown', () => {
  const state = createMatch('versus');
  const passer = state.players[4];
  performAction(state, passer, { ...neutralControls(), pass: true, z: 1 });
  expect(state.ball.owner).toBeNull();
  expect(Math.hypot(state.ball.vx, state.ball.vz)).toBeCloseTo(19);
  expect(state.ball.blocked).toBe(passer.id);
  passer.cooldown = 0;
  state.ball.owner = passer.id;
  performAction(state, passer, { ...neutralControls(), shoot: true });
  expect(Math.hypot(state.ball.vx, state.ball.vz)).toBeCloseTo(27);
  const tackler = state.players[9];
  tackler.x = passer.x + 1.8;
  tackler.z = passer.z;
  state.ball.owner = passer.id;
  state.phase = 'playing';
  performAction(state, tackler, { ...neutralControls(), shoot: true });
  expect(tackler.slide).toBeGreaterThan(0);
  stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.ball.owner).toBe(tackler.id);
  expect(passer.fallen).toBeGreaterThan(0.9);
  expect(tackler.cooldown).toBeGreaterThan(0);
});

function missedSlide(seed: number, x = -10, z = -10, team: Team = 0) {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.randomState = seed;
  const tackler = state.players[team * 5 + 4];
  const owner = state.players[team === 0 ? 9 : 4];
  tackler.x = x;
  tackler.z = z;
  const victim = state.players[team === 0 ? 6 : 1];
  state.selected[victim.team] = victim.id;
  state.switchWait = [2, 2];
  victim.x = x - attackDirection(team) * 2;
  victim.z = z;
  owner.x = attackDirection(team) * 15;
  owner.z = 10;
  state.ball = { x: owner.x - attackDirection(team) * 0.8, z: 10, vx: 0, vz: 0, owner: owner.id, blocked: null, lock: 0 };
  performAction(state, tackler, { ...neutralControls(), shoot: true, x: -attackDirection(team) });
  for (let i = 0; i < 32; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  return state;
}

test('a missed slide gives a yellow card or a protected free kick and recovers cleanly', () => {
  const yellow = missedSlide(0);
  expect(yellow.phase).toBe('yellow-card');
  expect(yellow.players[4].yellowCards).toBe(1);
  expect(yellow.foul?.offender).toBe(4);
  expect(validMatch(yellow)).toBe(true);
  for (let i = 0; i < 100; i++) stepMatch(yellow, [neutralControls(), neutralControls()], STEP);
  expect(yellow.phase).toBe('playing');
  resetPositions(yellow);
  expect(yellow.players[4].yellowCards).toBe(1);

  const freeKick = missedSlide(1000);
  expect(freeKick.phase).toBe('free-kick');
  expect(freeKick.players[4].yellowCards).toBe(0);
  const taker = freeKick.foul?.taker;
  expect(taker).not.toBeNull();
  expect(freeKick.ball.owner).toBe(taker);
  expect(freeKick.foul?.team).toBe(1);
  expect(validMatch(freeKick)).toBe(true);
  for (const opponent of freeKick.players.filter((p) => p.team === 0))
    expect(Math.hypot(opponent.x - freeKick.ball.x, opponent.z - freeKick.ball.z)).toBeGreaterThan(4.8);
  const remaining = freeKick.remaining;
  for (let i = 0; i < 100; i++) stepMatch(freeKick, [neutralControls(), neutralControls()], STEP);
  expect(freeKick.remaining).toBe(remaining);
  for (let i = 0; i < 10; i++) stepMatch(freeKick, [neutralControls(), neutralControls()], STEP);
  expect(freeKick.phase).toBe('playing');
  expect(freeKick.restartProtection).toBeGreaterThan(0);
});

test('contact without the ball has equal chances of a card, free kick or play-on', () => {
  let seed = 0;
  const counts = { 'yellow-card': 0, 'free-kick': 0, playing: 0 };
  for (let i = 0; i < 600; i++) {
    const state = missedSlide(seed);
    expect(Object.keys(counts)).toContain(state.phase);
    counts[state.phase as keyof typeof counts]++;
    seed = state.randomState;
  }
  for (const count of Object.values(counts)) {
    expect(count).toBeGreaterThan(160);
    expect(count).toBeLessThan(240);
  }
  const playOn = missedSlide(1200);
  expect(playOn.phase).toBe('playing');
  expect(playOn.foul).toBeNull();
  expect(playOn.players[4].yellowCards).toBe(0);
  expect(playOn.remaining).toBeLessThan(playOn.duration - 0.5);
});

test('free-kick decisions in either defending penalty area become penalties with everyone else outside', () => {
  for (const team of [0, 1] as const) {
    const state = missedSlide(1000, -attackDirection(team) * FIELD.penaltySpot, 0, team);
    expect(state.phase).toBe('penalty');
    expect(state.foul?.team).toBe(1 - team);
    const taker = state.foul?.taker;
    expect(state.ball.owner).toBe(taker);
    expect(Math.abs(state.ball.x)).toBe(FIELD.penaltySpot);
    expect(state.ball.z).toBe(0);
    for (const player of state.players.filter((p) => p.role !== 0 && p.id !== taker)) expect(Math.abs(player.x)).toBeLessThan(FIELD.penaltyAreaStart);
    expect(validMatch(state)).toBe(true);
    const broken = structuredClone(state);
    broken.ball.owner = null;
    expect(validMatch(broken)).toBe(false);
  }
  expect(missedSlide(1000, -FIELD.penaltySpot, FIELD.penaltyAreaHalfWidth + 0.1).phase).toBe('free-kick');
  expect(missedSlide(1000, FIELD.penaltySpot, 0).phase).toBe('free-kick');
  expect(missedSlide(1000, -10, 0).phase).toBe('free-kick');
  expect(missedSlide(0, -FIELD.penaltySpot, 0).phase).toBe('yellow-card');
});

test('a human penalty waits with the clock stopped, allows aiming, survives a snapshot and scores', () => {
  const state = missedSlide(1000, -FIELD.penaltySpot, 0);
  const remaining = state.remaining;
  for (let i = 0; i < 120; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.phase).toBe('penalty-ready');
  const positions = state.players.map((p) => [p.x, p.z]);
  for (let i = 0; i < 600; i++) stepMatch(state, [neutralControls(), { ...neutralControls(), x: -1, pass: true, switch: true }], STEP);
  expect(state.remaining).toBe(remaining);
  expect(state.players.map((p) => [p.x, p.z])).toEqual(positions);
  for (let i = 0; i < 24; i++) stepMatch(state, [neutralControls(), { ...neutralControls(), z: 1 }], STEP);
  const restored = JSON.parse(JSON.stringify(state));
  expect(validMatch(restored)).toBe(true);
  stepMatch(restored, [neutralControls(), { ...neutralControls(), shoot: true }], STEP);
  expect(restored.phase).toBe('playing');
  expect(restored.ball.owner).toBeNull();
  expect(restored.ball.vx).toBeLessThan(0);
  expect(restored.ball.vz).toBeGreaterThan(0);
  expect(restored.ball.x).toBe(-FIELD.penaltySpot);
  for (let i = 0; i < 40; i++) stepMatch(restored, [neutralControls(), neutralControls()], STEP);
  expect(restored.score).toEqual([0, 1]);
  expect(restored.phase).toBe('goal');
});

test('the AI takes its penalty automatically while a central human shot can be saved', () => {
  const ai = missedSlide(1000, -FIELD.penaltySpot, 0);
  ai.mode = 'solo';
  for (let i = 0; i < 230; i++) stepMatch(ai, [neutralControls(), neutralControls()], STEP);
  expect(ai.score[1]).toBe(1);
  const human = missedSlide(1000, FIELD.penaltySpot, 0, 1);
  for (let i = 0; i < 120; i++) stepMatch(human, [neutralControls(), neutralControls()], STEP);
  stepMatch(human, [{ ...neutralControls(), shoot: true }, neutralControls()], STEP);
  let keeperSaved = false;
  for (let i = 0; i < 50; i++) {
    stepMatch(human, [neutralControls(), neutralControls()], STEP);
    if (human.ball.owner === 5) keeperSaved = true;
  }
  expect(human.score).toEqual([0, 0]);
  expect(keeperSaved).toBe(true);
  expect(human.phase).toBe('playing');
});

test('a clean slide wins the loose ball without a foul and a knocked-down opponent gets up', () => {
  const state = createMatch('versus');
  state.phase = 'playing';
  const tackler = state.players[4];
  tackler.x = -6;
  tackler.z = 0;
  state.ball = { x: -4.8, z: 0, vx: 0, vz: 0, owner: null, blocked: null, lock: 0 };
  performAction(state, tackler, { ...neutralControls(), shoot: true, x: 1 });
  for (let i = 0; i < 31; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(tackler.slideHit).toBe(true);
  expect(state.phase).toBe('playing');
  expect(tackler.yellowCards).toBe(0);
  state.players[9].fallen = 1.15;
  for (let i = 0; i < 72; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.players[9].fallen).toBe(0);
});

test('AI scores from a crowded goalmouth instead of forming a stationary pile', () => {
  const state = createMatch('solo', 180, 'hard');
  state.randomState = 0;
  state.phase = 'playing';
  state.players[9].x = -FIELD.halfLength + 5;
  state.players[9].z = 0;
  state.players[6].x = -FIELD.halfLength + 5;
  state.players[6].z = 0;
  state.ball = { x: -FIELD.halfLength + 4.2, z: 0, vx: 0, vz: 0, owner: 9, blocked: null, lock: 0 };
  for (let i = 0; i < 180; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.score[1]).toBeGreaterThan(0);
  expect(validMatch(state)).toBe(true);
});

test('goalkeepers stay in their own area and overlapping supporting attackers separate', () => {
  const state = createMatch('versus');
  state.phase = 'playing';
  state.players[0].x = FIELD.halfLength - 2;
  state.players[5].x = -FIELD.halfLength + 2;
  state.players[6].x = -FIELD.halfLength + 2;
  state.players[6].z = 1;
  state.players[8].x = -FIELD.halfLength + 2;
  state.players[8].z = 1;
  state.players[4].x = 5;
  state.ball.owner = 4;
  for (let i = 0; i < 160; i++) {
    stepMatch(state, [neutralControls(), neutralControls()], STEP);
    expect(state.players[0].x).toBeLessThanOrEqual(-FIELD.penaltyAreaStart);
    expect(state.players[5].x).toBeGreaterThanOrEqual(FIELD.penaltyAreaStart);
  }
  expect(Math.hypot(state.players[6].x - state.players[8].x, state.players[6].z - state.players[8].z)).toBeGreaterThan(1);
  expect(state.players[6].x).toBeGreaterThan(-FIELD.halfLength + 4);
  expect(state.players[8].x).toBeGreaterThan(-FIELD.halfLength + 4);
});

test('goals count once, restart for the conceding side, and shots outside the posts rebound', () => {
  const state = createMatch('solo');
  state.phase = 'playing';
  state.ball = { x: FIELD.halfLength - 0.1, z: FIELD.goalHalfWidth - 0.6, vx: 27, vz: 0, owner: null, blocked: null, lock: 0 };
  stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.score).toEqual([1, 0]);
  expect(state.phase).toBe('goal');
  for (let i = 0; i < 160; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.score).toEqual([1, 0]);
  expect(state.phase).toBe('kickoff');
  expect(state.kickoffTeam).toBe(1);
  expect(state.ball.owner).toBe(9);
  state.phase = 'playing';
  state.ball = { x: -FIELD.halfLength + 0.1, z: FIELD.goalHalfWidth + 3, vx: -27, vz: 0, owner: null, blocked: null, lock: 0 };
  stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.score).toEqual([1, 0]);
  expect(state.ball.vx).toBeGreaterThan(0);
});

test('a full match stays finite and finishes without overtime catch-up', () => {
  const state = createMatch('solo', 60);
  state.phase = 'playing';
  for (let i = 0; i < 14000; i++) stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.phase, `Remaining ${state.remaining}, score ${state.score}`).toBe('finished');
  expect(state.remaining).toBe(0);
  expect(validMatch(state)).toBe(true);
  const result = JSON.stringify(state);
  stepMatch(state, [neutralControls(), neutralControls()], 60);
  expect(JSON.stringify(state)).toBe(result);
});

test('camera-relative movement and custom controller mappings preserve direction and dead zones', () => {
  expect(screenToWorld(1, 0, false)).toEqual({ x: 1, z: 0 });
  expect(screenToWorld(0, -1, true)).toEqual({ x: 1, z: 0 });
  expect(stickValue(0.15)).toBe(0);
  expect(stickValue(-1)).toBe(-1);
  const pad = {
    axes: [0.8, -1, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 3, value: i === 3 ? 1 : 0, touched: false })),
    mapping: '' as GamepadMappingType,
  };
  const input = readPad(pad, { ...defaultMapping, pass: 3, invertY: true });
  expect(input.pass).toBe(true);
  expect(input.shoot).toBe(false);
  expect(input.y).toBe(1);
});

test('invalid saves reject corrupt coordinates, player IDs, scores and versions of state', () => {
  const state = createMatch('solo');
  expect(validMatch(state)).toBe(true);
  expect(validMatch({ ...state, selected: [-1, 9] })).toBe(false);
  expect(validMatch({ ...state, score: [-1, 0] })).toBe(false);
  expect(validMatch({ ...state, ball: { ...state.ball, x: Infinity } })).toBe(false);
  expect(validMatch({ ...state, players: state.players.slice(1) })).toBe(false);
  expect(validMatch({ ...state, clubs: ['missing', 'brick'] })).toBe(false);
  expect(validMatch({ ...state, clubs: ['alfred', 'alfred'] })).toBe(false);
});

test('twelve clubs have distinct kits and the selected names follow goals and results', () => {
  expect(clubs).toHaveLength(12);
  expect(new Set(clubs.map((club) => club.id)).size).toBe(12);
  expect(new Set(clubs.map((club) => club.shirt)).size).toBe(12);
  const state = createMatch('solo', 60, 'easy', ['solstad', 'draken']);
  expect(validMatch(state)).toBe(true);
  state.phase = 'playing';
  state.ball = { x: FIELD.halfLength - 0.1, z: FIELD.goalHalfWidth - 0.6, vx: 27, vz: 0, owner: null, blocked: null, lock: 0 };
  stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.message).toBe('MÅL! Norrköping FC');
  expect(state.clubs).toEqual(['solstad', 'draken']);
  state.phase = 'playing';
  state.remaining = STEP;
  stepMatch(state, [neutralControls(), neutralControls()], STEP);
  expect(state.message).toBe('Norrköping FC vinner!');
});

test('held gamepad actions fire once, and disconnecting a slot does not shift the other player', () => {
  const mediaDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  const padDescriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
  const pads: (Gamepad | null)[] = [0, 1].map(
    (index) =>
      ({
        index,
        id: `Pad ${index}`,
        connected: true,
        mapping: 'standard',
        axes: [0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      }) as unknown as Gamepad,
  );
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => pads });
  try {
    const input = new InputManager();
    input.poll();
    input.setSource(0, 'pad:0');
    input.setSource(1, 'pad:1');
    input.begin();
    if (!pads[0]) throw new Error('Missing pad fixture');
    (pads[0].buttons[0] as { pressed: boolean }).pressed = true;
    input.poll();
    expect(input.consume(0, false).pass).toBe(true);
    input.poll();
    expect(input.consume(0, false).pass).toBe(false);
    let disconnected = -1;
    input.onDisconnect = (team) => {
      disconnected = team;
    };
    pads[0] = null;
    input.poll();
    expect(disconnected).toBe(0);
    expect(input.sources).toEqual(['pad:0', 'pad:1']);
    expect(input.available(1)).toBe(true);
    // A peer device only has one active local input, even if an old two-player setup used the same pad in slot 2.
    input.setSource(0, 'pad:1');
    input.begin([0]);
    let pauses = 0;
    input.onPause = () => {
      pauses++;
    };
    if (!pads[1]) throw new Error('Missing pad fixture');
    (pads[1].buttons[9] as { pressed: boolean }).pressed = true;
    (pads[1].buttons[0] as { pressed: boolean }).pressed = true;
    input.poll();
    expect(pauses).toBe(1);
    expect(input.consume(0, false).pass).toBe(true);
    expect(input.consume(1, false).pass).toBe(false);
  } finally {
    if (mediaDescriptor) Object.defineProperty(globalThis, 'matchMedia', mediaDescriptor);
    else Reflect.deleteProperty(globalThis, 'matchMedia');
    if (padDescriptor) Object.defineProperty(navigator, 'getGamepads', padDescriptor);
    else Reflect.deleteProperty(navigator, 'getGamepads');
  }
});

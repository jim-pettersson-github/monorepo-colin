import { getMatchClubs } from './clubs';
import type { Controls, MatchState, Player, Team } from './model';
import {
  attackDirection,
  clamp,
  difficultySettings,
  distance,
  ensureMatchRules,
  FALL_DURATION,
  FIELD,
  neutralControls,
  resetPositions,
  SLIDE_DURATION,
} from './model';
import { footballer, skillScale } from './players';

function randomRoll(state: MatchState) {
  state.randomState = (Math.imul(state.randomState, 1664525) + 1013904223) >>> 0;
  return state.randomState / 0x100000000;
}

function nearestOutfielder(state: MatchState, team: Team, exclude = -1) {
  const players = state.players.filter((p) => p.team === team && p.role !== 0 && p.id !== exclude);
  const standing = players.filter((p) => p.fallen <= 0 && p.slide <= 0);
  return (standing.length ? standing : players).sort((a, b) => distance(a, state.ball) - distance(b, state.ball))[0];
}

function selectPlayer(state: MatchState, team: Team, manual = false) {
  const owner = state.ball.owner === null ? null : state.players[state.ball.owner];
  if (owner?.team === team && owner.role !== 0 && !manual && state.switchWait[team] <= 0) {
    state.selected[team] = owner.id;
    return;
  }
  const current = state.players[state.selected[team]];
  if (current.slide > 0 && !manual) return;
  const nearest = nearestOutfielder(state, team, manual ? current.id : -1);
  if (manual || current.fallen > 0 || (state.switchWait[team] <= 0 && distance(current, state.ball) > distance(nearest, state.ball) + 4)) {
    state.selected[team] = nearest.id;
    state.switchWait[team] = manual ? 1 : 0.7;
  }
}

function ballPosition(state: MatchState) {
  const owner = state.ball.owner === null ? null : state.players[state.ball.owner];
  return owner ? { x: owner.x + owner.facingX * 0.8, z: clamp(owner.z + owner.facingZ * 0.8, -FIELD.halfWidth + 0.35, FIELD.halfWidth - 0.35) } : state.ball;
}

function segmentDistance(point: { x: number; z: number }, start: { x: number; z: number }, end: { x: number; z: number }) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(point.x - start.x - t * dx, point.z - start.z - t * dz);
}

function kickBall(state: MatchState, player: Player, x: number, z: number, speed: number) {
  const magnitude = Math.hypot(x, z) || 1;
  state.ball.owner = null;
  state.ball.x = player.x + (x / magnitude) * 1.1;
  state.ball.z = clamp(player.z + (z / magnitude) * 1.1, -FIELD.halfWidth + 0.35, FIELD.halfWidth - 0.35);
  state.ball.vx = (x / magnitude) * speed;
  state.ball.vz = (z / magnitude) * speed;
  state.ball.blocked = player.id;
  state.ball.lock = 0.28;
  state.restartProtection = 0;
  player.cooldown = 0.4;
  player.kick = 0.25;
}

export function performAction(state: MatchState, player: Player, input: Controls) {
  if (player.cooldown > 0 || player.fallen > 0 || player.slide > 0) return;
  const ball = state.ball;
  if (ball.owner === player.id) {
    if (input.shoot) {
      const direction = attackDirection(player.team);
      const keeper = state.players[player.team === 0 ? 5 : 0];
      // Aim away from the keeper rather than repeatedly shooting straight into them.
      const openCorner =
        Math.abs(keeper.z) > 0.3
          ? -Math.sign(keeper.z) * (FIELD.goalHalfWidth - 0.75)
          : player.z >= 0
            ? -(FIELD.goalHalfWidth - 0.75)
            : FIELD.goalHalfWidth - 0.75;
      let targetZ =
        Math.abs(input.z) > 0.25 ? clamp(player.z + input.z * FIELD.penaltyAreaHalfWidth, -FIELD.goalHalfWidth + 0.6, FIELD.goalHalfWidth - 0.6) : openCorner;
      const opponent = state.mode === 'solo' && (state.watching || player.team === 1);
      const settings = difficultySettings[state.difficulty];
      if (opponent) targetZ += (randomRoll(state) * 2 - 1) * settings.shotError;
      const skills = footballer(player.athlete);
      if (skills) targetZ += (randomRoll(state) * 2 - 1) * (100 - skills.shooting) * 0.025;
      kickBall(state, player, direction * FIELD.halfLength - player.x, targetZ - player.z, (opponent ? settings.shotSpeed : 27) * skillScale(skills?.shooting));
      state.message = 'Skott!';
    } else if (input.pass) {
      const aiming = Math.hypot(input.x, input.z) > 0.2;
      const teammates = state.players.filter((p) => p.team === player.team && p.id !== player.id && p.role !== 0 && p.fallen <= 0 && p.slide <= 0);
      if (!teammates.length) return;
      const rating = (p: Player) => {
        const d = distance(p, player) || 1;
        const alignment = aiming ? ((p.x - player.x) * input.x + (p.z - player.z) * input.z) / d : ((p.x - player.x) * attackDirection(player.team)) / d;
        const blocked = state.players.some((opponent) => opponent.team !== player.team && segmentDistance(opponent, player, p) < 1.3);
        return alignment * 15 - d * 0.3 - (blocked ? 12 : 0);
      };
      teammates.sort((a, b) => rating(b) - rating(a));
      const target = teammates[0];
      kickBall(
        state,
        player,
        target.x + target.vx * 0.25 - player.x,
        target.z + target.vz * 0.25 - player.z,
        19 * skillScale(footballer(player.athlete)?.passing),
      );
      state.message = 'Passning';
    }
  } else if (input.shoot && player.role !== 0) {
    if (state.restartProtection > 0 && state.foul?.team !== player.team) return;
    const target = ballPosition(state);
    let dx = input.x;
    let dz = input.z;
    if (Math.hypot(dx, dz) < 0.2) {
      dx = target.x - player.x;
      dz = target.z - player.z;
    }
    const magnitude = Math.hypot(dx, dz);
    player.slideX = magnitude > 0.01 ? dx / magnitude : player.facingX;
    player.slideZ = magnitude > 0.01 ? dz / magnitude : player.facingZ;
    player.facingX = player.slideX;
    player.facingZ = player.slideZ;
    player.slide = SLIDE_DURATION;
    player.slideHit = false;
    player.slideContact = null;
    player.cooldown = 1.25 / skillScale(footballer(player.athlete)?.defending);
    state.message = 'Glidtackling!';
  }
}

function awardMissedTackle(state: MatchState, offender: Player, victim: Player) {
  const team: Team = offender.team === 0 ? 1 : 0;
  const decision = randomRoll(state);
  if (decision >= 2 / 3) {
    state.foul = null;
    state.message = 'Spela vidare!';
    return;
  }
  const yellow = decision < 1 / 3;
  state.foul = { offender: offender.id, team, taker: null };
  for (const player of state.players) {
    player.slide = 0;
    player.vx = 0;
    player.vz = 0;
  }
  if (yellow) {
    offender.yellowCards++;
    state.phase = 'yellow-card';
    state.phaseTime = 1.6;
    state.message = `Gult kort · ${getMatchClubs(state)[offender.team].name} #${offender.role + 1}`;
    return;
  }
  if (victim.x * attackDirection(offender.team) <= -FIELD.penaltyAreaStart && Math.abs(victim.z) <= FIELD.penaltyAreaHalfWidth) {
    preparePenalty(state, team);
    return;
  }
  const spot = { x: clamp(victim.x, -FIELD.halfLength + 5, FIELD.halfLength - 5), z: clamp(victim.z, -FIELD.halfWidth + 3.5, FIELD.halfWidth - 3.5) };
  const taker = nearestOutfielder(state, team);
  const direction = attackDirection(team);
  taker.x = spot.x - direction * 0.8;
  taker.z = spot.z;
  taker.facingX = direction;
  taker.facingZ = 0;
  taker.cooldown = 0;
  for (const player of state.players) {
    player.fallen = 0;
    if (player.id === taker.id) continue;
    if (player.role === 0) {
      player.x = -attackDirection(player.team) * (FIELD.halfLength - 2);
      player.z = clamp(spot.z * 0.7, -FIELD.goalHalfWidth + 0.9, FIELD.goalHalfWidth - 0.9);
      continue;
    }
    const clearance = player.team === team ? 2.5 : 5;
    let dx = player.x - spot.x;
    let dz = player.z - spot.z;
    const d = Math.hypot(dx, dz);
    if (d >= clearance) continue;
    if (d < 0.01) {
      dx = -direction;
      dz = player.id % 2 ? 1 : -1;
    }
    const magnitude = Math.hypot(dx, dz);
    player.x = clamp(spot.x + (dx / magnitude) * clearance, -FIELD.halfLength + 0.6, FIELD.halfLength - 0.6);
    player.z = clamp(spot.z + (dz / magnitude) * clearance, -FIELD.halfWidth + 0.6, FIELD.halfWidth - 0.6);
    if (distance(player, spot) < clearance - 0.1)
      player.z = clamp(spot.z + (spot.z > 0 ? -clearance : clearance), -FIELD.halfWidth + 0.6, FIELD.halfWidth - 0.6);
  }
  state.ball = { ...spot, vx: 0, vz: 0, owner: taker.id, blocked: null, lock: 0 };
  state.selected[team] = taker.id;
  state.switchWait[team] = 1;
  state.foul.taker = taker.id;
  state.restartProtection = 1;
  state.phase = 'free-kick';
  state.phaseTime = 1.8;
  state.message = `Frispark · ${getMatchClubs(state)[team].name}`;
}

function preparePenalty(state: MatchState, team: Team) {
  const taker = nearestOutfielder(state, team);
  const direction = attackDirection(team);
  for (const player of state.players) {
    player.fallen = 0;
    player.cooldown = 0;
    player.kick = 0;
    player.stuck = 0;
    player.facingX = attackDirection(player.team);
    player.facingZ = 0;
    // Only the taker and defending keeper stand inside the penalty area.
    player.x = player.role === 0 ? -attackDirection(player.team) * (FIELD.halfLength - 1) : direction * (FIELD.penaltyAreaStart - 4);
    player.z = player.role === 0 ? 0 : (player.role - 2.5) * 8 + (player.team === team ? -2 : 2);
  }
  taker.x = direction * (FIELD.penaltySpot - 0.8);
  taker.z = 0;
  state.ball = { x: direction * FIELD.penaltySpot, z: 0, vx: 0, vz: 0, owner: taker.id, blocked: null, lock: 0 };
  state.selected[team] = taker.id;
  state.switchWait[team] = 1;
  if (state.foul) state.foul.taker = taker.id;
  state.phase = 'penalty';
  state.phaseTime = 1.8;
  state.message = `Straff · ${getMatchClubs(state)[team].name}`;
}

function stepPenalty(state: MatchState, inputs: [Controls, Controls], dt: number) {
  const foul = state.foul;
  if (!foul || foul.taker === null) return;
  state.phaseTime = Math.max(0, state.phaseTime - dt);
  const taker = state.players[foul.taker];
  const human = !state.watching && (foul.team === 0 || state.mode === 'versus');
  const input = inputs[foul.team];
  taker.facingZ = human ? clamp(taker.facingZ + input.z * dt * 1.5, -0.55, 0.55) : -0.48;
  taker.facingX = attackDirection(foul.team) * Math.sqrt(1 - taker.facingZ ** 2);
  if (!(human ? input.shoot : state.phaseTime === 0)) return;
  const targetZ = (taker.facingZ / 0.55) * (FIELD.goalHalfWidth - 0.7);
  kickBall(state, taker, attackDirection(foul.team) * (FIELD.halfLength - FIELD.penaltySpot), targetZ, 27);
  // The ball starts at the painted spot, regardless of the chosen aiming angle.
  state.ball.x = attackDirection(foul.team) * FIELD.penaltySpot;
  state.ball.z = 0;
  state.phase = 'playing';
  state.message = 'Straffskott!';
}

function advanceSlide(state: MatchState, player: Player, starts: { x: number; z: number }[], ballStart: { x: number; z: number }, dt: number) {
  const ball = state.ball;
  const owner = ball.owner === null ? null : state.players[ball.owner];
  // Feet first: use a small swept contact area, relative to the other body's motion.
  const start = { x: starts[player.id].x + player.slideX * 0.15, z: starts[player.id].z + player.slideZ * 0.15 };
  const end = { x: player.x + player.slideX * 0.15, z: player.z + player.slideZ * 0.15 };
  const sweptDistance = (before: { x: number; z: number }, after: { x: number; z: number }) =>
    segmentDistance({ x: 0, z: 0 }, { x: start.x - before.x, z: start.z - before.z }, { x: end.x - after.x, z: end.z - after.z });
  if (!player.slideHit && owner?.team !== player.team && sweptDistance(ballStart, ballPosition(state)) < 0.75) {
    player.slideHit = true;
    player.slideContact = null;
    player.cooldown = Math.min(player.cooldown, 0.55);
    if (owner) {
      owner.fallen = FALL_DURATION;
      owner.cooldown = FALL_DURATION;
      owner.slide = 0;
      owner.vx = 0;
      owner.vz = 0;
    }
    ball.owner = player.id;
    ball.blocked = owner?.id ?? null;
    ball.lock = 0.25;
    state.selected[player.team] = player.id;
    state.switchWait[player.team] = 0.6;
    state.message = 'Bollvinst!';
  }
  if (!player.slideHit && player.slideContact === null) {
    const victim = state.players.find((other) => other.team !== player.team && other.fallen <= 0 && sweptDistance(starts[other.id], other) < 0.62);
    if (victim) {
      player.slideContact = victim.id;
      victim.fallen = FALL_DURATION;
      victim.cooldown = FALL_DURATION;
      victim.slide = 0;
      victim.vx = 0;
      victim.vz = 0;
    }
  }
  player.slide = Math.max(0, player.slide - dt);
  if (player.slide === 0 && !player.slideHit && player.slideContact !== null) awardMissedTackle(state, player, state.players[player.slideContact]);
}

function aiControls(state: MatchState, player: Player, chaser: number): Controls {
  const input = neutralControls();
  const direction = attackDirection(player.team);
  const ball = state.ball;
  const owner = ball.owner === null ? null : state.players[ball.owner];
  const opponent = state.mode === 'solo' && (state.watching || player.team === 1);
  const settings = difficultySettings[state.difficulty];
  const canAct = !opponent || (state.duration - state.remaining + (state.cup?.extraElapsed ?? 0) + player.id * 0.11) % settings.reaction < 0.08;
  let targetX: number;
  let targetZ: number;
  if (player.role === 0) {
    targetX = -direction * (FIELD.halfLength - 2);
    targetZ = clamp(ball.z * 0.7, -FIELD.goalHalfWidth + 0.9, FIELD.goalHalfWidth - 0.9);
    if (ball.owner === player.id) {
      input.pass = true;
      targetX = player.x;
      targetZ = player.z;
    } else if (!owner && ball.x * direction < -FIELD.penaltyAreaStart && Math.abs(ball.z) < FIELD.goalHalfWidth + 1 && distance(player, ball) < 4) {
      targetX = clamp(ball.x, -FIELD.halfLength + 1, FIELD.halfLength - 1);
      targetZ = clamp(ball.z, -FIELD.goalHalfWidth - 0.7, FIELD.goalHalfWidth + 0.7);
    }
  } else if (ball.owner === player.id) {
    targetX = direction * (FIELD.halfLength - 4);
    targetZ = player.z * 0.5;
    input.sprint = !opponent || state.difficulty !== 'easy';
    input.shoot = player.x * direction > FIELD.halfLength - (opponent ? settings.shotDistance : 24) || player.stuck > 0.8;
    input.pass = !input.shoot && state.players.some((p) => p.team !== player.team && p.fallen <= 0 && distance(player, p) < 2.5);
  } else if (player.id === chaser && owner?.team !== player.team) {
    targetX = ball.x + ball.vx * 0.1;
    targetZ = ball.z + ball.vz * 0.1;
    input.shoot =
      (!opponent || settings.tackle) &&
      !!owner &&
      owner.fallen <= 0 &&
      distance(player, ball) < (opponent && state.difficulty === 'normal' ? 1.5 : 2) &&
      state.restartProtection <= 0;
  } else {
    const attacking = owner?.team === player.team;
    const baseX = player.role === 1 ? -20 : player.role === 4 ? 16 : 0;
    targetX = clamp(ball.x * 0.5 + direction * (baseX + (attacking ? 8 : -6)), -FIELD.penaltyAreaStart, FIELD.penaltyAreaStart);
    targetZ = (player.role === 2 ? -18 : player.role === 3 ? 18 : player.role === 4 ? -8 : 0) + ball.z * 0.18;
  }
  // Keep supporting attackers out of the goalmouth and route around bodies instead of pushing forever.
  if (player.role !== 0 && ball.owner !== player.id && player.x * direction > FIELD.halfLength - 4) {
    targetX = direction * FIELD.penaltyAreaStart;
    targetZ = player.role % 2 ? -12 : 12;
  }
  let dx = targetX - player.x;
  let dz = targetZ - player.z;
  const desiredLength = Math.hypot(dx, dz);
  if (desiredLength > 0.35 && player.role !== 0) {
    const forwardX = dx / desiredLength;
    const forwardZ = dz / desiredLength;
    for (const other of state.players) {
      if (other.id === player.id || other.fallen > 0 || other.slide > 0) continue;
      const ox = other.x - player.x;
      const oz = other.z - player.z;
      const d = Math.hypot(ox, oz);
      if (d > 2.3 || ox * forwardX + oz * forwardZ < 0) continue;
      const side = forwardX * oz - forwardZ * ox >= 0 ? -1 : 1;
      const strength = (2.3 - d) * 2.4;
      dx += -forwardZ * side * strength;
      dz += forwardX * side * strength;
    }
    if (player.stuck > 0.6) dz += (player.id % 2 ? 1 : -1) * 5;
  }
  const magnitude = Math.hypot(dx, dz);
  if (magnitude > 0.35) {
    input.x = dx / Math.max(magnitude, 1);
    input.z = dz / Math.max(magnitude, 1);
  }
  // A shot's target is chosen separately, so steering around a defender cannot skew it off target.
  if (input.shoot && ball.owner === player.id) {
    input.x = direction;
    input.z = 0;
  }
  if (!canAct) {
    input.shoot = false;
    input.pass = false;
  }
  return input;
}

export function stepMatch(state: MatchState, inputs: [Controls, Controls], dt: number) {
  if (
    state.watching === undefined ||
    state.league === undefined ||
    state.pitchScale === undefined ||
    state.randomState === undefined ||
    state.players[0]?.slideContact === undefined
  )
    ensureMatchRules(state);
  if (state.phase === 'finished') return;
  if (state.phase === 'penalty-ready') {
    stepPenalty(state, inputs, dt);
    return;
  }
  if (state.phase !== 'playing') {
    state.phaseTime -= dt;
    if (state.phaseTime <= 0) {
      if (state.phase === 'penalty') {
        state.phase = 'penalty-ready';
        state.phaseTime = 0.6;
        state.message = 'Sikta med rörelsekontrollen och tryck Skjut';
      } else if (state.phase === 'goal') {
        resetPositions(state);
        state.phase = 'kickoff';
        state.phaseTime = 1.5;
        state.message = 'Avspark!';
      } else {
        const freeKick = state.phase === 'free-kick';
        state.phase = 'playing';
        state.message = freeKick ? 'Frisparken är i spel!' : 'Spela!';
      }
    }
    return;
  }
  state.restartProtection = Math.max(0, state.restartProtection - dt);
  state.remaining = Math.max(0, state.remaining - dt);
  if (state.remaining === 0 && state.cup?.knockout && state.score[0] === state.score[1]) {
    state.cup.extraTime = true;
    state.message = 'Gyllene mål – nästa mål avgör!';
  } else if (state.remaining === 0) {
    state.phase = 'finished';
    state.message = state.score[0] === state.score[1] ? 'Oavgjort!' : `${getMatchClubs(state)[state.score[0] > state.score[1] ? 0 : 1].name} vinner!`;
    return;
  }
  if (state.cup?.extraTime) state.cup.extraElapsed = (state.cup.extraElapsed ?? 0) + dt;
  for (const team of [0, 1] as const) {
    state.switchWait[team] -= dt;
    if (inputs[team].switch) selectPlayer(state, team, true);
    else selectPlayer(state, team);
  }
  const starts = state.players.map((p) => ({ x: p.x, z: p.z }));
  const ballStart = { ...ballPosition(state) };
  const chasers = [nearestOutfielder(state, 0).id, nearestOutfielder(state, 1).id];
  for (const player of state.players) {
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.kick = Math.max(0, player.kick - dt);
    if (player.fallen > 0) {
      player.fallen = Math.max(0, player.fallen - dt);
      player.vx = 0;
      player.vz = 0;
      continue;
    }
    const human = !state.watching && player.id === state.selected[player.team] && (player.team === 0 || state.mode === 'versus');
    const input = human ? inputs[player.team] : aiControls(state, player, chasers[player.team]);
    if (player.slide <= 0) performAction(state, player, input);
    if (player.slide > 0) {
      const speed = 12 * (0.5 + (player.slide / SLIDE_DURATION) * 0.5);
      player.vx = player.slideX * speed;
      player.vz = player.slideZ * speed;
    } else {
      const magnitude = Math.max(1, Math.hypot(input.x, input.z));
      const settings = difficultySettings[state.difficulty];
      const aiSpeed = state.mode === 'solo' && (state.watching || player.team === 1) ? (player.role === 0 ? settings.keeperSpeed : settings.speed) : 1;
      const skills = footballer(player.athlete);
      const speed =
        (player.role === 0 ? 4.8 : input.sprint ? 9.6 : 7.4) * (human ? 1 : aiSpeed) * skillScale(player.role === 0 ? skills?.goalkeeping : skills?.pace);
      player.vx = (input.x / magnitude) * speed;
      player.vz = (input.z / magnitude) * speed;
      if (Math.hypot(player.vx, player.vz) > 0.1) {
        player.facingX = input.x / magnitude;
        player.facingZ = input.z / magnitude;
      }
    }
    player.x = clamp(player.x + player.vx * dt, -FIELD.halfLength + 0.6, FIELD.halfLength - 0.6);
    player.z = clamp(player.z + player.vz * dt, -FIELD.halfWidth + 0.6, FIELD.halfWidth - 0.6);
    if (player.role === 0) {
      player.x = -attackDirection(player.team) * clamp(-attackDirection(player.team) * player.x, FIELD.penaltyAreaStart + 1, FIELD.halfLength - 1);
      player.z = clamp(player.z, -FIELD.goalHalfWidth - 0.7, FIELD.goalHalfWidth + 0.7);
    }
  }
  for (const player of state.players) {
    if (player.slide <= 0) continue;
    advanceSlide(state, player, starts, ballStart, dt);
    if (state.phase !== 'playing') return;
  }
  for (let i = 0; i < state.players.length; i++) {
    for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i];
      const b = state.players[j];
      if (a.slide > 0 || b.slide > 0 || a.fallen > 0 || b.fallen > 0) continue;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      let d = Math.hypot(dx, dz);
      if (d >= 1.15) continue;
      if (d < 0.001) {
        dx = 0;
        dz = (i + j) % 2 ? 1 : -1;
        d = 1;
      }
      const push = (1.15 - Math.min(distance(a, b), 1.15)) * 0.5;
      a.x = clamp(a.x - (dx / d) * push, -FIELD.halfLength + 0.6, FIELD.halfLength - 0.6);
      a.z = clamp(a.z - (dz / d) * push, -FIELD.halfWidth + 0.6, FIELD.halfWidth - 0.6);
      b.x = clamp(b.x + (dx / d) * push, -FIELD.halfLength + 0.6, FIELD.halfLength - 0.6);
      b.z = clamp(b.z + (dz / d) * push, -FIELD.halfWidth + 0.6, FIELD.halfWidth - 0.6);
    }
  }
  for (const player of state.players) {
    if (player.role === 0) {
      player.x = -attackDirection(player.team) * clamp(-attackDirection(player.team) * player.x, FIELD.penaltyAreaStart + 1, FIELD.halfLength - 1);
      player.z = clamp(player.z, -FIELD.goalHalfWidth - 0.7, FIELD.goalHalfWidth + 0.7);
    }
    const expected = Math.hypot(player.vx, player.vz) * dt;
    const blocked = expected > 0.02 && distance(player, starts[player.id]) < expected * 0.4;
    player.stuck = clamp(player.stuck + (blocked ? dt : -dt * 2), 0, 2);
  }
  const ball = state.ball;
  ball.lock = Math.max(0, ball.lock - dt);
  if (ball.owner !== null) {
    const owner = state.players[ball.owner];
    const spot = ballPosition(state);
    ball.x = spot.x;
    ball.z = spot.z;
    ball.vx = owner.vx;
    ball.vz = owner.vz;
  } else {
    ball.x += ball.vx * dt;
    ball.z += ball.vz * dt;
    ball.vx *= Math.exp(-0.4 * dt);
    ball.vz *= Math.exp(-0.4 * dt);
    if (Math.abs(ball.z) > FIELD.halfWidth - 0.3) {
      ball.z = clamp(ball.z, -FIELD.halfWidth + 0.3, FIELD.halfWidth - 0.3);
      ball.vz *= -0.75;
    }
  }
  if (Math.abs(ball.x) > FIELD.halfLength) {
    if (Math.abs(ball.z) < FIELD.goalHalfWidth - 0.25) {
      const team: Team = ball.x > 0 ? 0 : 1;
      state.score[team]++;
      state.lastGoal = team;
      state.kickoffTeam = team === 0 ? 1 : 0;
      if (state.cup?.extraTime) {
        state.phase = 'finished';
        state.message = `${getMatchClubs(state)[team].name} vinner på gyllene mål!`;
        ball.owner = null;
        return;
      }
      state.phase = 'goal';
      state.phaseTime = 2.6;
      state.message = `MÅL! ${getMatchClubs(state)[team].name}`;
      ball.owner = null;
      return;
    }
    ball.x = clamp(ball.x, -FIELD.halfLength + 0.3, FIELD.halfLength - 0.3);
    ball.vx *= -0.75;
    ball.owner = null;
  }
  if (ball.owner === null) {
    const candidates = state.players.filter(
      (p) =>
        p.fallen <= 0 &&
        p.slide <= 0 &&
        !(p.id === ball.blocked && ball.lock > 0) &&
        p.cooldown < 0.2 &&
        distance(p, ball) < (p.role === 0 ? 1.05 * skillScale(footballer(p.athlete)?.goalkeeping) : 1.0),
    );
    candidates.sort((a, b) => distance(a, ball) - distance(b, ball));
    if (candidates[0]) {
      const player = candidates[0];
      ball.owner = player.id;
      if (player.role !== 0) state.selected[player.team] = player.id;
    }
  }
}

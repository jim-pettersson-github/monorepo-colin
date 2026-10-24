import {
  buyCar,
  buyUpgrade,
  type Career,
  type CupRun,
  type CupSummary,
  cupById,
  formatMoney,
  newCareer,
  type OwnedCar,
  POINTS,
  type RaceRecord,
  type Rival,
  rivalShopping,
  START_MONEY,
  setActiveCar,
  type UpgradePart,
} from './career';
import { type CarClass, carById, cars, classOrder, MAX_UPGRADE, type Upgrades } from './cars';
import type { ResultRow } from './race';

// A Wi-Fi career shared by several devices. The host's device keeps the session; each device is a member by its player id.

export type SessionMode = 'fresh' | 'own';

export type Member = { id: string; name: string; money: number; garage: OwnedCar[]; activeCarId: string; cupsWon: string[] };

export type Session = {
  version: 1;
  id: string;
  name: string;
  mode: SessionMode;
  updated: number;
  members: Member[];
  rivals: Rival[];
  run?: CupRun;
  lastCup?: CupSummary;
  news: string[];
};

// One grid place in a session race; player is the device's index in this race when a human drives it.
export type WireEntrant = { driverName: string; carId: string; upgrades: Upgrades; skill: number; player?: number };

export const GRID = 8;
// Grid places for players 1–8: humans start together mid-pack and AI fills the rest.
export const HUMAN_SLOTS = [5, 6, 4, 7, 3, 2, 1, 0];
const NAME_LIMIT = 16;

export function newSession(name: string, mode: SessionMode, seed = Date.now()): Session {
  return {
    version: 1,
    id: `s${seed.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim().slice(0, 24) || 'Wi-Fi-karriär',
    mode,
    updated: Date.now(),
    members: [],
    rivals: newCareer(seed).rivals,
    news: ['Ny Wi-Fi-karriär. Köp bilar och anmäl er till Klubbcupen.'],
  };
}

export function validUpgrades(value: unknown): value is Upgrades {
  if (!value || typeof value !== 'object') return false;
  const upgrades = value as Upgrades;
  return (['engine', 'tyres', 'brakes'] as const).every((part) => Number.isInteger(upgrades[part]) && upgrades[part] >= 0 && upgrades[part] <= MAX_UPGRADE);
}

export function validGarage(value: unknown): value is OwnedCar[] {
  return (
    Array.isArray(value) &&
    value.length <= cars.length &&
    value.every((entry) => entry && cars.some((car) => car.id === entry.carId) && validUpgrades(entry.upgrades)) &&
    new Set(value.map((entry) => entry.carId)).size === value.length
  );
}

export function cleanName(name: unknown) {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT) : '';
}

// Adds a new member or welcomes back a known one; names stay unique against members and AI rivals.
export function joinSession(session: Session, id: string, name: string, own?: { garage: OwnedCar[]; activeCarId: string }): Session {
  const known = session.members.find((member) => member.id === id);
  if (known) return session;
  const taken = new Set([...session.members.map((member) => member.name), ...session.rivals.map((rival) => rival.name)]);
  const base = cleanName(name) || `Förare ${session.members.length + 1}`;
  let unique = base;
  for (let n = 2; taken.has(unique); n++) unique = `${base.slice(0, NAME_LIMIT - 3)} ${n}`;
  const garage = session.mode === 'own' && own && validGarage(own.garage) ? own.garage.map((car) => ({ carId: car.carId, upgrades: { ...car.upgrades } })) : [];
  const activeCarId = garage.some((car) => car.carId === own?.activeCarId) ? (own?.activeCarId ?? '') : (garage[0]?.carId ?? '');
  const member: Member = { id, name: unique, money: START_MONEY, garage, activeCarId, cupsWon: [] };
  const late = session.run || session.members.some((other) => other.cupsWon.length);
  return {
    ...session,
    updated: Date.now(),
    members: [...session.members, member],
    news: [`${unique} gick med${late ? ' och börjar bakifrån' : ''}.`, ...session.news].slice(0, 12),
  };
}

// Runs a solo-career shop action on one member and copies the result back.
function shop(session: Session, id: string, action: (career: Career) => Career): Session {
  const member = session.members.find((entry) => entry.id === id);
  if (!member || session.run) return session;
  const before: Career = {
    version: 1,
    money: member.money,
    garage: member.garage,
    activeCarId: member.activeCarId,
    rivals: [],
    cupsWon: member.cupsWon,
    news: [],
  };
  const after = action(before);
  if (after === before) return session;
  const updated = { ...member, money: after.money, garage: after.garage, activeCarId: after.activeCarId };
  return { ...session, updated: Date.now(), members: session.members.map((entry) => (entry.id === id ? updated : entry)) };
}

export const memberBuy = (session: Session, id: string, carId: string) => shop(session, id, (career) => buyCar(career, carId));
export const memberUpgrade = (session: Session, id: string, carId: string, part: UpgradePart) => shop(session, id, (career) => buyUpgrade(career, carId, part));
export const memberSelect = (session: Session, id: string, carId: string) => shop(session, id, (career) => setActiveCar(career, carId));

// Why the present members cannot start a cup, as one line per problem.
export function cupProblems(session: Session, cupId: string, present: string[]) {
  const cup = cupById(cupId);
  const problems: string[] = [];
  if (cup.requires && !session.members.some((member) => member.cupsWon.includes(cup.requires ?? '')))
    problems.push(`Någon måste vinna ${cupById(cup.requires).name} först.`);
  for (const id of present) {
    const member = session.members.find((entry) => entry.id === id);
    if (!member) continue;
    const owned = member.garage.find((car) => car.carId === member.activeCarId);
    if (!owned) problems.push(`${member.name} behöver köpa en bil.`);
    else if (classOrder[carById(owned.carId).carClass] > classOrder[cup.carClass])
      problems.push(`${member.name} behöver en bil i klass ${cup.carClass} eller lägre.`);
  }
  return problems;
}

export function startSessionCup(session: Session, cupId: string, present: string[]): Session {
  if (session.run || cupProblems(session, cupId, present).length) return session;
  const names = [...session.members.filter((member) => present.includes(member.id)).map((member) => member.name), ...session.rivals.map((rival) => rival.name)];
  return { ...session, updated: Date.now(), lastCup: undefined, run: { cupId, race: 0, standings: Object.fromEntries(names.map((name) => [name, 0])) } };
}

export function abandonSessionCup(session: Session): Session {
  return { ...session, updated: Date.now(), run: undefined };
}

export function sessionTrack(session: Session) {
  return session.run ? cupById(session.run.cupId).tracks[session.run.race] : undefined;
}

// The eight grid places for the next race; present[0] is the host's member id.
export function sessionField(session: Session, present: string[]): WireEntrant[] {
  const cup = cupById(session.run?.cupId ?? '');
  const field: (WireEntrant | undefined)[] = Array(GRID).fill(undefined);
  const humans = present.map((id) => session.members.find((member) => member.id === id)).filter((member): member is Member => !!member);
  humans.slice(0, GRID).forEach((member, player) => {
    const owned = member.garage.find((car) => car.carId === member.activeCarId) ?? { carId: cars[0].id, upgrades: { engine: 0, tyres: 0, brakes: 0 } };
    field[HUMAN_SLOTS[player]] = { driverName: member.name, carId: owned.carId, upgrades: { ...owned.upgrades }, skill: 1, player };
  });
  let rival = 0;
  return field.map((entry) => {
    if (entry) return entry;
    const ai = session.rivals[rival++ % session.rivals.length];
    const carClass: CarClass = cup.carClass;
    return { driverName: ai.name, carId: ai.cars[carClass], upgrades: { ...ai.upgrades[carClass] }, skill: ai.skill };
  });
}

function finishSessionCup(session: Session, run: CupRun): Session {
  const cup = cupById(run.cupId);
  const memberNames = new Set(session.members.map((member) => member.name));
  const standings = Object.entries(run.standings)
    .map(([driverName, points]) => ({ driverName, points, isPlayer: memberNames.has(driverName) }))
    .sort((a, b) => b.points - a.points);
  const winner = standings[0].driverName;
  const news = [`${winner} vann ${cup.name}${memberNames.has(winner) ? ` och fick ${formatMoney(cup.bonus)} i bonus` : ''}!`];
  const members = session.members.map((member) =>
    member.name === winner
      ? { ...member, money: member.money + cup.bonus, cupsWon: member.cupsWon.includes(cup.id) ? member.cupsWon : [...member.cupsWon, cup.id] }
      : member,
  );
  const rivals = session.rivals
    .map((rival) => (rival.name === winner ? { ...rival, money: rival.money + cup.bonus, cupsWon: rival.cupsWon + 1 } : rival))
    .map((rival) => rivalShopping(rival, cup.carClass, news));
  return {
    ...session,
    updated: Date.now(),
    members,
    rivals,
    run: undefined,
    lastCup: { cupId: cup.id, standings, bonus: cup.bonus, winner },
    news: news.slice(0, 12),
  };
}

export function recordSessionRace(session: Session, rows: ResultRow[]): Session {
  const run = session.run;
  if (!run) return session;
  const cup = cupById(run.cupId);
  const records: RaceRecord[] = rows.map((row) => ({
    driverName: row.driverName,
    position: row.position,
    points: POINTS[row.position - 1] ?? 0,
    prize: cup.prizes[row.position - 1] ?? 0,
    isPlayer: session.members.some((member) => member.name === row.driverName),
  }));
  const standings = { ...run.standings };
  for (const record of records) standings[record.driverName] = (standings[record.driverName] ?? 0) + record.points;
  const prize = (name: string) => records.find((record) => record.driverName === name)?.prize ?? 0;
  const next: Session = {
    ...session,
    updated: Date.now(),
    members: session.members.map((member) => ({ ...member, money: member.money + prize(member.name) })),
    rivals: session.rivals.map((rival) => ({ ...rival, money: rival.money + prize(rival.name) })),
    run: { ...run, race: run.race + 1, standings, lastRace: records },
  };
  return run.race + 1 >= cup.tracks.length && next.run ? finishSessionCup(next, next.run) : next;
}

export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const session = value as Session;
  return (
    session.version === 1 &&
    typeof session.id === 'string' &&
    session.id.length <= 40 &&
    typeof session.name === 'string' &&
    session.name.length <= 24 &&
    (session.mode === 'fresh' || session.mode === 'own') &&
    Array.isArray(session.members) &&
    session.members.length <= 32 &&
    session.members.every(
      (member) =>
        typeof member.id === 'string' &&
        member.id.length <= 40 &&
        typeof member.name === 'string' &&
        member.name.length <= NAME_LIMIT &&
        Number.isFinite(member.money) &&
        validGarage(member.garage) &&
        typeof member.activeCarId === 'string' &&
        Array.isArray(member.cupsWon),
    ) &&
    Array.isArray(session.rivals) &&
    session.rivals.length === 7 &&
    Array.isArray(session.news)
  );
}

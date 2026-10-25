import { type ClubId, clubs, originalClubs } from './clubs';
import { nations } from './nations';
import { type Star, rosterSeed as stars } from './stars';

export interface Footballer {
  id: string;
  name: string;
  origin: ClubId;
  keeper: boolean;
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  goalkeeping: number;
  star?: Star;
}
const firstNames = [
  'Alex',
  'Charlie',
  'Alfred',
  'Colin',
  'Noah',
  'Leo',
  'Sam',
  'Robin',
  'Kim',
  'Max',
  'Elliot',
  'Milo',
  'Luca',
  'Jamie',
  'Rio',
  'Theo',
  'Amir',
  'Nico',
  'Omar',
  'Adrian',
];
const lastNames = [
  'Lind',
  'Berg',
  'Storm',
  'Dahl',
  'Ek',
  'Nord',
  'Silva',
  'Costa',
  'Vega',
  'Sato',
  'Park',
  'Rossi',
  'Lund',
  'Sund',
  'Falk',
  'Moreau',
  'Ali',
  'Kim',
  'Reed',
  'Vale',
];
const bounds = (n: number) => Math.max(0, Math.min(100, n));
// Every ten-player squad has one 90–98, two 80–89, three 70–79 and four 40–69 players.
// The same local seed, IDs and names are used on every device; transfers only change ownership.
const bands = [
  [40, 69],
  [40, 69],
  [90, 98],
  [80, 89],
  [80, 89],
  [70, 79],
  [70, 79],
  [70, 79],
  [40, 69],
  [40, 69],
];
let seed = 0xa1fced;
const roll = (low: number, high: number) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return low + (seed % (high - low + 1));
};
const legacyPlayers: Footballer[] = [...originalClubs, ...nations].flatMap((team, teamIndex) =>
  bands.map(([low, high], slot) => {
    const index = teamIndex * 10 + slot;
    const overall = roll(low, high);
    const keeper = slot === 0 || slot === (teamIndex % 4 === 0 ? 2 : teamIndex % 4 === 1 ? 3 : 9);
    return {
      id: `afc-player-${index}`,
      name: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length)]}`,
      origin: team.id,
      keeper,
      overall,
      pace: bounds(overall + roll(-8, 8)),
      shooting: bounds(overall + roll(-8, 8)),
      passing: bounds(overall + roll(-8, 8)),
      defending: bounds(overall + roll(-8, 8)),
      goalkeeping: bounds(keeper ? overall + roll(-3, 7) : Math.round(overall * 0.45)),
    };
  }),
);
// Existing IDs, keeper roles and national squads stay stable when an older save loads.
// New clubs use IDs after the original 360 slots, so no national player is reassigned.
const clubSlots = clubs.map((club, teamIndex) =>
  teamIndex < originalClubs.length
    ? legacyPlayers.filter((p) => p.origin === club.id)
    : Array.from({ length: 10 }, (_, slot) => ({
        id: `afc-player-${360 + (teamIndex - originalClubs.length) * 10 + slot}`,
        origin: club.id,
        keeper: slot === 0 || slot === 9,
      })),
);
const allocated: Footballer[][] = clubs.map(() => []);
const specialties: Record<string, Partial<Pick<Footballer, 'pace' | 'shooting' | 'passing' | 'defending'>>> = {
  Pelé: { pace: 98, shooting: 99, passing: 96 },
  Ronaldinho: { pace: 94, shooting: 95, passing: 99 },
  'Zlatan Ibrahimović': { pace: 87, shooting: 98, passing: 91 },
  'Lionel Messi': { pace: 96, shooting: 99, passing: 99 },
  'Cristiano Ronaldo': { pace: 98, shooting: 99, passing: 91 },
  'Kylian Mbappé': { pace: 100, shooting: 97, passing: 89 },
  'Erling Haaland': { pace: 95, shooting: 99, passing: 83 },
  'Kevin De Bruyne': { pace: 86, shooting: 94, passing: 99 },
  'Toni Kroos': { pace: 76, shooting: 88, passing: 99 },
  'Andrea Pirlo': { pace: 75, shooting: 87, passing: 99 },
  'N’Golo Kanté': { pace: 90, shooting: 72, passing: 87, defending: 98 },
  Rodri: { pace: 78, shooting: 88, passing: 96, defending: 97 },
  'Roberto Carlos': { pace: 98, shooting: 94, passing: 90, defending: 94 },
  'Virgil van Dijk': { pace: 88, shooting: 65, passing: 88, defending: 99 },
};
function assignStar(star: Star, team: number) {
  const position = star.position;
  const slot = clubSlots[team].find((p) => p.keeper === (position === 'GK') && !allocated[team].some((a) => a.id === p.id));
  if (!slot) throw new Error('Invalid star roster or club role allocation');
  const rating = star.overall;
  const variation = [...star.name].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const bound = (delta: number) => bounds(rating + delta);
  allocated[team].push({
    ...slot,
    name: star.name,
    overall: rating,
    pace: bound((position === 'GK' ? -24 : position === 'DEF' ? -9 : position === 'MID' ? -5 : 0) - (variation % 5)),
    shooting: bound((position === 'GK' ? -65 : position === 'DEF' ? -27 : position === 'MID' ? -7 : 0) - (variation % 3)),
    passing: bound((position === 'GK' ? -20 : position === 'DEF' ? -7 : position === 'MID' ? 1 : -7) - (variation % 4)),
    defending: bound((position === 'GK' ? -32 : position === 'DEF' ? 1 : position === 'MID' ? -13 : -43) - (variation % 3)),
    goalkeeping: position === 'GK' ? rating : 15,
    ...specialties[star.name],
    star,
  });
}
const total = (squad: Footballer[]) => squad.reduce((sum, p) => sum + p.overall, 0);
const quotas = { GK: 2, DEF: 2, MID: 3, FWD: 3 };
// Family assignments are fixed first; draft and rebalance the other stars around them.
for (const star of stars.filter((s) => s.familyClub))
  assignStar(
    star,
    clubs.findIndex((c) => c.id === star.familyClub),
  );
for (const position of ['GK', 'DEF', 'MID', 'FWD'] as const) {
  const ordered = stars
    .filter((s) => s.position === position && !s.familyClub)
    .sort((a, b) => b.overall - a.overall || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const star of ordered) {
    const candidate = allocated
      .map((squad, index) => ({ index, total: total(squad), count: squad.filter((p) => p.star?.position === position).length }))
      .filter((c) => c.count < quotas[position])
      .sort((a, b) => a.total - b.total || a.index - b.index)[0];
    if (!candidate) throw new Error('Too many players for the club role quotas');
    assignStar(star, candidate.index);
  }
}
// Role-for-role swaps reduce differences in squad totals without moving family players.
// Every accepted swap strictly lowers the sum of squared totals, so this settles quickly.
for (let attempt = 0; attempt < 200; attempt++) {
  const totals = allocated.map(total);
  let best: { a: number; b: number; i: number; j: number; gain: number } | null = null;
  for (let a = 0; a < allocated.length; a++)
    for (let b = a + 1; b < allocated.length; b++) {
      for (let i = 0; i < allocated[a].length; i++)
        for (let j = 0; j < allocated[b].length; j++) {
          const left = allocated[a][i],
            right = allocated[b][j];
          if (left.star?.familyClub || right.star?.familyClub || left.star?.position !== right.star?.position) continue;
          const delta = left.overall - right.overall;
          const gain = 2 * delta * (totals[a] - totals[b] - delta);
          if (gain > (best?.gain ?? 0)) best = { a, b, i, j, gain };
        }
    }
  if (!best) break;
  const { a, b, i, j } = best,
    left = allocated[a][i],
    right = allocated[b][j];
  allocated[a][i] = { ...right, id: left.id, origin: left.origin };
  allocated[b][j] = { ...left, id: right.id, origin: right.origin };
}
// Balance after the original draft so purchased players, roles and saved IDs keep their identities.
export const clubFootballers: readonly Footballer[] = allocated.flat().map((player) => {
  if (player.star?.era === 'family') return player;
  const lower = (value: number) => Math.max(0, Math.min(96, value - 3));
  const overall = lower(player.overall);
  return {
    ...player,
    overall,
    pace: lower(player.pace),
    shooting: lower(player.shooting),
    passing: lower(player.passing),
    defending: lower(player.defending),
    goalkeeping: lower(player.goalkeeping),
    star: player.star ? { ...player.star, overall } : undefined,
  };
});
export const footballers: readonly Footballer[] = [...clubFootballers, ...legacyPlayers.filter((p) => nations.some((n) => n.id === p.origin))];
const byId = new Map(footballers.map((player) => [player.id, player]));
export const footballer = (id: unknown) => (typeof id === 'string' ? byId.get(id) : undefined);
export const playerPrice = (player: Footballer) => 100 + Math.round(((player.overall / 100) ** 4 * 12000) / 50) * 50;
export const skillScale = (value = 70) => 0.72 + value / 250;
export function startingFive(squad: readonly Footballer[]): string[] {
  const keeper = [...squad].filter((p) => p.keeper).sort((a, b) => b.goalkeeping - a.goalkeeping || a.id.localeCompare(b.id))[0];
  if (!keeper || squad.filter((player) => !player.keeper).length < 4) throw new Error('A squad needs a goalkeeper and four outfield players');
  return [
    keeper.id,
    ...squad
      .filter((p) => !p.keeper)
      .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))
      .slice(0, 4)
      .reverse()
      .map((p) => p.id),
  ];
}

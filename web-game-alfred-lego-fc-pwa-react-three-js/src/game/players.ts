import { type ClubId, clubs } from './clubs';
import { nations } from './nations';

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
export const footballers: readonly Footballer[] = [...clubs, ...nations].flatMap((team, teamIndex) =>
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

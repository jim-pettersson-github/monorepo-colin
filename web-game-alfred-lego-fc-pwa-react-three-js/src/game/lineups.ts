import type { MatchState, Team } from './model';
import { type Footballer, footballer, startingFive } from './players';

export function validFive(ids: unknown, squad: readonly Footballer[]): ids is string[] {
  return (
    Array.isArray(ids) && ids.length === 5 && new Set(ids).size === 5 && ids.every((id, slot) => squad.some((p) => p.id === id && p.keeper === (slot === 0)))
  );
}

// Keep each surviving selection in its position when a transfer removes a starter.
export function preferredFive(squad: readonly Footballer[], preference?: readonly string[]): string[] {
  const best = startingFive(squad);
  if (!preference) return best;
  const result: string[] = [];
  for (let slot = 0; slot < 5; slot++) {
    const wanted = preference[slot];
    result.push(
      squad.some((p) => p.id === wanted && p.keeper === (slot === 0)) && !result.includes(wanted)
        ? wanted
        : (best.find((id) => footballer(id)?.keeper === (slot === 0) && !result.includes(id) && !preference.slice(slot + 1).includes(id)) ??
            (best.find((id) => footballer(id)?.keeper === (slot === 0) && !result.includes(id)) as string)),
    );
  }
  return result;
}

export function pickStarter(squad: readonly Footballer[], five: readonly string[], slot: number, id: string): string[] | null {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4 || !validFive(five, squad) || !squad.some((p) => p.id === id && p.keeper === (slot === 0))) return null;
  const next = [...five];
  const other = next.indexOf(id);
  if (other >= 0) next[other] = next[slot];
  next[slot] = id;
  return next;
}

export function familyFive(squad: readonly Footballer[]): string[] {
  const sorted = [...squad].sort(
    (a, b) => Number(b.star?.era === 'family') - Number(a.star?.era === 'family') || b.overall - a.overall || a.id.localeCompare(b.id),
  );
  return [
    sorted.find((p) => p.keeper)?.id ?? '',
    ...sorted
      .filter((p) => !p.keeper)
      .slice(0, 4)
      .map((p) => p.id),
  ];
}

export function substitutionError(state: MatchState, team: Team, slot: number, id: string): string | null {
  if (!['kickoff', 'playing', 'goal'].includes(state.phase)) return 'Byt efter frisparken eller straffen, innan matchen är slut.';
  if (!state.squads || !state.lineups) return 'Den här äldre matchen saknar en sparad avbytarbänk. Välj startfemma inför nästa match.';
  if (!Number.isInteger(slot) || slot < 0 || slot > 4 || ![0, 1].includes(team)) return 'Välj en spelare på planen.';
  if (!state.squads[team].includes(id) || state.lineups.flat().includes(id)) return 'Välj en avbytare i ditt lag.';
  if (footballer(id)?.keeper !== (slot === 0)) return 'Byt målvakt mot målvakt och utespelare mot utespelare.';
  const outgoing = state.players[team * 5 + slot];
  if (outgoing.slide > 0 || outgoing.fallen > 0) return 'Låt spelaren resa sig och avsluta glidtacklingen före bytet.';
  return null;
}

export function applySubstitution(state: MatchState, team: Team, slot: number, id: string): string | null {
  const error = substitutionError(state, team, slot, id);
  if (error || !state.lineups) return error;
  const player = state.players[team * 5 + slot];
  state.bookings ??= {};
  const outgoing = state.lineups[team][slot];
  state.bookings[outgoing] = player.yellowCards;
  state.lineups[team][slot] = id;
  player.athlete = id;
  player.yellowCards = state.bookings[id] ?? 0;
  return null;
}

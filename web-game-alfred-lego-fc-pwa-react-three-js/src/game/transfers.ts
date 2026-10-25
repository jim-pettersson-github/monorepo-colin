import { type ClubId, clubs, getClub, originalClubs, validClub } from './clubs';
import { preferredFive, validFive } from './lineups';
import type { MatchState } from './model';
import { type Footballer, footballer, footballers, playerPrice } from './players';

export type DomesticClub = (typeof clubs)[number]['id'];
export const domesticClub = (id: unknown): id is DomesticClub => clubs.some((club) => club.id === id);
const pool = footballers.filter((player) => domesticClub(player.origin));
export interface TransferSave {
  version: 1;
  activeClub: DomesticClub;
  owners: Record<string, DomesticClub>;
  money: Record<DomesticClub, number>;
  matches: number;
  protectedUntil: Record<string, number>;
  lastAiSale: number;
  pending: string | null;
  paid: string[];
  prizes: string[];
  news: { id: string; message: string }[];
  lastReward: { id: string; club: DomesticClub; game: number; prize: number } | null;
  lineups?: Partial<Record<ClubId, string[]>>;
}
const accounts = (value: number) => Object.fromEntries(clubs.map((club) => [club.id, value])) as Record<DomesticClub, number>;
export function createTransfers(): TransferSave {
  return {
    version: 1,
    activeClub: 'alfred',
    owners: Object.fromEntries(pool.map((p) => [p.id, p.origin])) as Record<string, DomesticClub>,
    money: accounts(6000),
    matches: 0,
    protectedUntil: {},
    lastAiSale: -5,
    pending: null,
    paid: [],
    prizes: [],
    news: [],
    lastReward: null,
  };
}
export const squadFor = (save: TransferSave, club: ClubId) =>
  domesticClub(club) ? pool.filter((player) => save.owners[player.id] === club) : footballers.filter((player) => player.origin === club);
export const lineupFor = (save: TransferSave, club: ClubId) => preferredFive(squadFor(save, club), save.lineups?.[club]);
export function setLineup(save: TransferSave, club: ClubId, five: string[] | null): TransferSave {
  if (!validClub(club) || save.pending || (five !== null && !validFive(five, squadFor(save, club)))) return save;
  const next = structuredClone(save);
  next.lineups ??= {};
  if (five) next.lineups[club] = [...five];
  else delete next.lineups[club];
  return next;
}
const playable = (squad: Footballer[]) => squad.length >= 5 && squad.some((player) => player.keeper) && squad.filter((player) => !player.keeper).length >= 4;
const notice = (save: TransferSave, message: string) => {
  save.news = [{ id: crypto.randomUUID(), message }, ...save.news].slice(0, 12);
};
type TransferResult = { save: TransferSave; error?: string };
function movePlayer(save: TransferSave, buyer: DomesticClub, id: string, offerId?: string, sale = false): TransferResult {
  const player = footballer(id),
    seller = save.owners[id],
    offer = footballer(offerId);
  if (save.pending) return { save, error: 'Transferfönstret öppnar efter matchen.' };
  if (!player || !seller || buyer === seller || (offerId && (!offer || save.owners[offerId] !== buyer || offerId === id)))
    return { save, error: 'Välj en spelare från en annan klubb.' };
  const outgoing = offer ? [offer.id] : [];
  const buyerSquad = squadFor(save, buyer)
    .filter((p) => !outgoing.includes(p.id))
    .concat(player);
  const sellerSquad = squadFor(save, seller)
    .filter((p) => p.id !== id)
    .concat(offer ? [offer] : []);
  if (!playable(buyerSquad) || !playable(sellerSquad)) return { save, error: 'Båda lagen måste ha minst fem spelare, en målvakt och fyra utespelare.' };
  const cost = (sale ? Math.floor((playerPrice(player) * 0.8) / 50) * 50 : playerPrice(player)) - (offer ? playerPrice(offer) : 0);
  if (save.money[buyer] < cost || save.money[seller] < -cost) return { save, error: 'Klubben har inte råd med övergången.' };
  const next = structuredClone(save);
  next.owners[id] = buyer;
  next.protectedUntil[id] = next.matches + 3;
  if (offer) {
    next.owners[offer.id] = seller;
    next.protectedUntil[offer.id] = next.matches + 3;
  }
  next.money[buyer] -= cost;
  next.money[seller] += cost;
  for (const club of [buyer, seller]) if (next.lineups?.[club]) next.lineups[club] = lineupFor(next, club);
  notice(
    next,
    offer
      ? `${getClub(buyer).name} byter ${offer.name} mot ${player.name}. Mellanskillnad: ${cost} mynt.`
      : `${getClub(buyer).name} köper ${player.name} för ${cost} mynt.`,
  );
  return { save: next };
}
export function buyPlayer(save: TransferSave, buyer: DomesticClub, id: string, offerId?: string): TransferResult {
  return movePlayer(save, buyer, id, offerId);
}
export function sellPlayer(save: TransferSave, seller: DomesticClub, id: string, buyer: DomesticClub): TransferResult {
  const player = footballer(id);
  if (!player || save.owners[id] !== seller || seller === buyer) return { save, error: 'Välj en spelare i ditt lag och en annan köpare.' };
  const price = Math.floor((playerPrice(player) * 0.8) / 50) * 50;
  const result = movePlayer(save, buyer, id, undefined, true);
  if (result.save === save) return result;
  result.save.news[0].message = `${getClub(seller).name} säljer ${player.name} till ${getClub(buyer).name} för ${price} mynt.`;
  return result;
}
export function withMatchSquads(save: TransferSave, state: MatchState): MatchState {
  const match = structuredClone(state);
  match.lineups ??= match.clubs.map((club) => lineupFor(save, club)) as [string[], string[]];
  for (const player of match.players) player.athlete = match.lineups[player.team][player.role];
  if (!match.squads && match.lineups) {
    const lineups = match.lineups;
    match.squads = match.clubs.map((club, team) => [...new Set([...squadFor(save, club).map((p) => p.id), ...lineups[team]])]) as [string[], string[]];
  }
  return match;
}
export function prepareTransferMatch(save: TransferSave, state: MatchState): { save: TransferSave; state: MatchState } {
  const match = withMatchSquads(save, state),
    next = structuredClone(save);
  match.career ??= { id: crypto.randomUUID(), club: domesticClub(match.clubs[0]) ? match.clubs[0] : save.activeClub };
  next.activeClub = domesticClub(match.career.club) ? match.career.club : save.activeClub;
  next.pending = match.career.id;
  return { save: next, state: match };
}
export function settleTransfers(save: TransferSave, match: MatchState, prize?: { id: string; amount: number }): TransferSave {
  if (
    match.phase !== 'finished' ||
    !match.career ||
    !domesticClub(match.career.club) ||
    save.pending !== match.career.id ||
    save.paid.includes(match.career.id)
  )
    return save;
  const next = structuredClone(save),
    club = match.career.club;
  const reward = match.score[0] > match.score[1] ? 400 : match.score[0] === match.score[1] ? 300 : 200;
  const bonus = prize && !next.prizes.includes(prize.id) ? prize.amount : 0;
  next.money[club] += reward + bonus;
  if (prize && bonus) next.prizes.push(prize.id);
  if (domesticClub(match.clubs[1])) next.money[match.clubs[1]] += match.score[1] > match.score[0] ? 400 : match.score[1] === match.score[0] ? 300 : 200;
  next.matches++;
  next.pending = null;
  next.paid.push(match.career.id);
  next.lastReward = { id: match.career.id, club, game: reward, prize: bonus };
  notice(next, `${getClub(club).name}: +${reward} mynt för matchen${bonus ? ` och +${bonus} i prispengar` : ''}. Transferfönstret är öppet.`);
  // At most one gentle AI attempt per completed match, with deterministic choices.
  let random = match.career.id.split('').reduce((hash, c) => (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0, 7);
  const roll = () => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return random / 0x100000000;
  };
  const chance = roll();
  const candidates = pool.filter(
    (p) => (next.protectedUntil[p.id] ?? 0) <= next.matches && (next.owners[p.id] !== club || (chance < 0.05 && next.matches - next.lastAiSale >= 5)),
  );
  if (chance < 0.2 && candidates.length) {
    const player = candidates[Math.floor(roll() * candidates.length)];
    const buyers = clubs.filter((c) => c.id !== club && c.id !== next.owners[player.id]);
    const buyer = buyers[Math.floor(roll() * buyers.length)].id;
    const result = buyPlayer(next, buyer, player.id);
    if (result.save !== next) {
      if (next.owners[player.id] === club) {
        result.save.lastAiSale = next.matches;
        const premium = Math.round((playerPrice(player) * 0.25) / 50) * 50;
        if (result.save.money[buyer] >= premium) {
          result.save.money[buyer] -= premium;
          result.save.money[club] += premium;
        }
        result.save.news[0].message += ' AI-köpet gav full ersättning; nya värvningar är skyddade i tre matcher.';
      }
      return result.save;
    }
  }
  return next;
}
const key = 'alfred-fc-transfers-v1';
export function validTransfers(value: unknown): value is TransferSave {
  if (!value || typeof value !== 'object') return false;
  const s = value as TransferSave;
  const strings = (values: unknown, limit: number) =>
    Array.isArray(values) && values.length <= limit && values.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 240);
  if (
    s.version !== 1 ||
    !domesticClub(s.activeClub) ||
    !Number.isSafeInteger(s.matches) ||
    s.matches < 0 ||
    !Number.isInteger(s.lastAiSale) ||
    s.lastAiSale < -5 ||
    s.lastAiSale > s.matches ||
    (s.pending !== null && (typeof s.pending !== 'string' || s.pending.length > 100)) ||
    !strings(s.paid, 100000) ||
    new Set(s.paid).size !== s.paid.length ||
    !strings(s.prizes, 100000) ||
    !Array.isArray(s.news) ||
    s.news.length > 12 ||
    !s.news.every((n) => !!n && typeof n.id === 'string' && typeof n.message === 'string' && n.message.length <= 240) ||
    !s.owners ||
    Object.keys(s.owners).length !== pool.length ||
    !pool.every((p) => domesticClub(s.owners[p.id])) ||
    !s.money ||
    !clubs.every((c) => Number.isSafeInteger(s.money[c.id]) && s.money[c.id] >= 0) ||
    !s.protectedUntil ||
    !Object.entries(s.protectedUntil).every(([id, n]) => pool.some((p) => p.id === id) && Number.isInteger(n) && n >= 0 && n <= s.matches + 3)
  )
    return false;
  if (
    s.lastReward &&
    (typeof s.lastReward.id !== 'string' ||
      !s.paid.includes(s.lastReward.id) ||
      !domesticClub(s.lastReward.club) ||
      ![200, 300, 400].includes(s.lastReward.game) ||
      !Number.isSafeInteger(s.lastReward.prize) ||
      s.lastReward.prize < 0)
  )
    return false;
  if (
    s.lineups !== undefined &&
    (!s.lineups ||
      typeof s.lineups !== 'object' ||
      Array.isArray(s.lineups) ||
      !Object.entries(s.lineups).every(([club, ids]) => validClub(club) && validFive(ids, squadFor(s, club))))
  )
    return false;
  return clubs.every((club) => playable(squadFor(s, club.id)));
}
export function loadTransfers(): TransferSave {
  for (const name of [key, `${key}-backup`])
    try {
      const saved = JSON.parse(localStorage.getItem(name) || 'null');
      if (validTransfers(saved)) return saved;
      const upgraded = migrateTransfers(saved);
      if (upgraded) return upgraded;
    } catch {
      /* Try the backup. */
    }
  return createTransfers();
}
export function migrateTransfers(value: unknown): TransferSave | null {
  if (!value || typeof value !== 'object') return null;
  const old = value as TransferSave;
  const previousCount = old.money ? Object.keys(old.money).length : 0;
  if (![originalClubs.length, 16].includes(previousCount)) return null;
  const previousClubs = clubs.slice(0, previousCount);
  const originalPool = pool.filter((p) => previousClubs.some((c) => c.id === p.origin));
  if (
    !old.owners ||
    !old.money ||
    !previousClubs.every((club) => Number.isSafeInteger(old.money[club.id]) && old.money[club.id] >= 0) ||
    Object.keys(old.owners).length !== originalPool.length ||
    !originalPool.every((p) => previousClubs.some((c) => c.id === old.owners[p.id]))
  )
    return null;
  const next = { ...old, owners: { ...createTransfers().owners, ...old.owners }, money: { ...accounts(6000), ...old.money } };
  // Retain purchases, balances, rewards, signing protection and in-progress matches.
  return validTransfers(next) ? next : null;
}
export function saveTransfers(save: TransferSave) {
  if (!validTransfers(save)) return;
  try {
    const old = localStorage.getItem(key);
    if (old)
      try {
        if (validTransfers(JSON.parse(old))) localStorage.setItem(`${key}-backup`, old);
      } catch {
        /* Preserve backup. */
      }
    localStorage.setItem(key, JSON.stringify(save));
  } catch {
    /* Keep the current in-memory club. */
  }
}

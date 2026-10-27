import type { Identity } from './career-session';
import { call, GAME, ServerError } from './room-server';

// The scoreboard on the room server: every finished race sends its best lap, and the lists rank each player's best.

export type Period = 'all' | 'month' | 'week';
// Quick races, alone or online, share one list; careers have their own, since career cars carry bought upgrades.
export type BoardKind = 'race' | 'career';
export type LapEntry = { name: string; car: string; transmission: 'auto' | 'manual' | null; online: boolean; time: number; at: number; me: boolean };
export type Placing = { rank: number; time: number; car: string; online: boolean };
export type TrackBoard = { board: LapEntry[]; me: Placing | null; drivers: number };
export type TrackRecord = LapEntry & { track: string; drivers: number; mine: Placing | null };
// time: the player's best laps on the tracks they have driven, added up (missing from servers before it was sent).
export type OverallEntry = { name: string; points: number; records: number; tracks: number; time?: number; me: boolean };
export type Overview = { tracks: TrackRecord[]; overall: OverallEntry[]; me: OverallEntry | null };

// A lap as it is sent: the time in milliseconds.
export type Lap = { track: string; car: string; transmission: 'auto' | 'manual'; time: number; kind: BoardKind; online: boolean };
export type LapResult =
  | { state: 'sent'; rank: number; best: number; drivers: number }
  // Kept on the device until the server can be reached.
  | { state: 'queued' }
  // Kept on the device until the player gives a name for the list.
  | { state: 'nameless' }
  | { state: 'refused'; message: string };

const PENDING_KEY = 'charlie-for-speed:pending-laps';
const MAX_PENDING = 50;

const validLap = (value: unknown): value is Lap => {
  const lap = value as Lap;
  return (
    !!lap &&
    typeof lap.track === 'string' &&
    typeof lap.car === 'string' &&
    (lap.transmission === 'auto' || lap.transmission === 'manual') &&
    Number.isInteger(lap.time) &&
    lap.time > 0
  );
};

// Laps saved before races had a kind were quick races on this device.
const withKind = (lap: Lap): Lap => ({ ...lap, kind: lap.kind === 'career' ? 'career' : 'race', online: lap.online === true });

function loadPending(): Lap[] {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as unknown;
    return Array.isArray(list) ? list.filter(validLap).map(withKind) : [];
  } catch {
    return [];
  }
}

function savePending(laps: Lap[]) {
  try {
    if (laps.length) localStorage.setItem(PENDING_KEY, JSON.stringify(laps.slice(-MAX_PENDING)));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Without storage an offline lap is lost, and the race still counts locally.
  }
}

export const pendingLaps = () => loadPending().length;

async function send(identity: Identity, lap: Lap) {
  const result = await call<{ rank: number; best: number; drivers: number }>('lap', {
    game: GAME,
    player: identity.id,
    name: identity.name.trim(),
    version: __APP_BUILD__,
    ...lap,
  });
  return { state: 'sent' as const, rank: result.rank, best: result.best, drivers: result.drivers };
}

// A refusal (a bad name, an impossible time) will not change by trying again; anything else might, including a server
// that does not know the scoreboard yet.
const refused = (error: unknown) => error instanceof ServerError && error.status === 400;

// Sends a race's best lap, after any that waited offline. Without a name the lap waits until one is given.
export async function submitLap(identity: Identity, lap: Lap): Promise<LapResult> {
  if (!identity.name.trim()) {
    savePending([...loadPending(), lap]);
    return { state: 'nameless' };
  }
  await flushLaps(identity);
  try {
    return await send(identity, lap);
  } catch (error) {
    if (refused(error)) return { state: 'refused', message: (error as Error).message };
    savePending([...loadPending(), lap]);
    return { state: 'queued' };
  }
}

// Sends the laps saved while offline or without a name, oldest first, and stops at the first one the server cannot
// take yet. Returns what happened to the newest, which is the race just finished when a name was only now given.
// One flush at a time, so a lap is never sent twice when the menu and a finished race both flush.
let flushing: Promise<LapResult | undefined> = Promise.resolve(undefined);
export function flushLaps(identity: Identity) {
  flushing = flushing.then(() => flushPending(identity));
  return flushing;
}

async function flushPending(identity: Identity): Promise<LapResult | undefined> {
  if (!identity.name.trim()) return undefined;
  let pending = loadPending();
  let last: LapResult | undefined;
  while (pending.length) {
    try {
      last = await send(identity, pending[0]);
    } catch (error) {
      if (!refused(error)) return { state: 'queued' };
      last = { state: 'refused', message: (error as Error).message };
    }
    pending = pending.slice(1);
    savePending(pending);
  }
  return last;
}

export function loadOverview(kind: BoardKind, period: Period, player: string) {
  return call<Overview>('laps', undefined, { game: GAME, kind, period, player });
}

export function loadTrackBoard(kind: BoardKind, track: string, period: Period, player: string) {
  return call<TrackBoard>('laps', undefined, { game: GAME, kind, period, player, track });
}

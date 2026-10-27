import { decodeSignal, PeerLink } from './peer-link';

// The room server only swaps pairing codes; matches still run directly between the devices.
// Tests point a page at a local server through localStorage; builds may set VITE_ROOM_SERVER.
const DEFAULT_ROOM_SERVER = 'https://games.charliecare.se/api.php';

export function roomServer() {
  try {
    const local = localStorage.getItem('alfred-fc:room-server');
    if (local) return local;
  } catch {
    /* Storage can be blocked; fall back to the built-in address. */
  }
  return (import.meta.env.VITE_ROOM_SERVER as string | undefined) || DEFAULT_ROOM_SERVER;
}

// STUN lets devices on different networks find each other's public address. Strict mobile networks may still need a relay.
export const ONLINE_ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
export const ONLINE_TIMEOUT = 30_000;

const GAME = 'alfred-fc';
// The host checks for an answer, and a waiting guest for a free place, this often; joins wait about half of it.
const POLL_MS = 750;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class ServerError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(action: string, body?: unknown, query: Record<string, string | number> = {}): Promise<T> {
  const base = roomServer();
  const params = new URLSearchParams({ a: action, ...Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])) });
  let response: Response;
  try {
    // Plain-text bodies keep these simple CORS requests, without a preflight round trip.
    response = await fetch(`${base}?${params}`, {
      method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'text/plain' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error('Spelservern svarar inte. Kolla att enheten är ansluten till internet.');
  }
  const value = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ServerError(value.error || 'Spelservern kunde inte svara.', response.status);
  return value;
}

// The server adds a TURN relay when it has one, for networks that block direct contact; credentials last a day.
let ice: { servers: Promise<RTCIceServer[]>; fetched: number } | undefined;
export function onlineIce() {
  if (!ice || Date.now() - ice.fetched > 3_600_000) {
    const servers = call<{ iceServers?: RTCIceServer[] }>('ice').then(
      (result) => (Array.isArray(result.iceServers) && result.iceServers.length ? result.iceServers : ONLINE_ICE),
      () => {
        ice = undefined;
        return ONLINE_ICE;
      },
    );
    ice = { servers, fetched: Date.now() };
  }
  return ice.servers;
}

// A hosted match as the open-game list shows it.
export type OpenGame = { code: string; title: string; info: string; players: number; capacity: number };

const validGame = (value: unknown): value is OpenGame => {
  const game = value as OpenGame;
  return (
    !!game &&
    typeof game.code === 'string' &&
    /^[A-Z0-9]{4}$/.test(game.code) &&
    typeof game.title === 'string' &&
    typeof game.info === 'string' &&
    Number.isInteger(game.players) &&
    Number.isInteger(game.capacity)
  );
};

export async function listGames() {
  const result = await call<{ games?: unknown[] }>('list', undefined, { game: GAME, version: __APP_BUILD__ });
  return Array.isArray(result.games) ? result.games.filter(validGame) : [];
}

export const normalizeRoomCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

export class Room {
  closed = false;
  private constructor(
    readonly code: string,
    private readonly host: string,
    readonly ice: RTCIceServer[],
  ) {}

  static async open() {
    const [{ code, host }, servers] = await Promise.all([call<{ code: string; host: string }>('create', { game: GAME, version: __APP_BUILD__ }), onlineIce()]);
    return new Room(code, host, servers);
  }

  // Keeps the room on the open-game list (or takes it off); the server drops rooms that stop announcing.
  announce(listing: { listed: boolean; title: string; info: string; players: number; capacity: number }) {
    if (this.closed) return Promise.resolve();
    return call('announce', { code: this.code, host: this.host, ...listing }).then(() => undefined);
  }

  // A host link for the next guest, using the room's STUN and relay servers.
  link() {
    return new PeerLink('host', this.ice, ONLINE_TIMEOUT);
  }

  // Publishes one host link's offer and resolves once a guest has answered it.
  async invite(link: PeerLink, cancelled: () => boolean) {
    const { id } = await call<{ id: number }>('offer', { code: this.code, host: this.host, offer: link.code });
    while (!cancelled() && !this.closed) {
      await wait(POLL_MS);
      if (cancelled() || this.closed) return;
      const result = await call<{ answer?: string }>('answer', undefined, { code: this.code, host: this.host, id });
      if (result.answer) return link.acceptAnswer(result.answer);
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    void call('close', { code: this.code, host: this.host }).catch(() => {});
  }
}

// Guest: waits for the host's open invitation in the room, answers it, and returns the link that will connect.
// Where a guest's join is, for its progress steps: finding the room, waiting for a free place, answering the host.
export type JoinPhase = 'finding' | 'waiting' | 'answering';

export async function joinRoom(code: string, cancelled: () => boolean, onPhase: (phase: JoinPhase) => void) {
  while (!cancelled()) {
    const claim = await call<{ offer?: string; claim?: string; game?: string; version?: string | null }>('claim', { code });
    if (claim.game && claim.game !== GAME) throw new Error('Rumskoden hör till ett annat spel.');
    if (!claim.offer || !claim.claim) {
      onPhase('waiting');
      await wait(POLL_MS);
      continue;
    }
    // Only a real invitation carries the host's version; a waiting answer has none.
    if (claim.version !== __APP_BUILD__)
      throw new Error(
        `Värden har en annan version av spelet (${claim.version ?? 'äldre'}) än du (${__APP_BUILD__}). Uppdatera spelet på båda enheterna med Sök efter uppdatering i startmenyn och försök igen.`,
      );
    onPhase('answering');
    const signal = await decodeSignal(claim.offer);
    if (signal.type !== 'offer') throw new Error('Rummet har ingen giltig inbjudan.');
    const link = new PeerLink('guest', await onlineIce(), ONLINE_TIMEOUT);
    try {
      await link.createAnswer(claim.offer);
      if (cancelled()) throw new Error('Avbrutet.');
      await call('reply', { code, claim: claim.claim, answer: link.code });
      return link;
    } catch (error) {
      link.close();
      // A claim that expired while this device was answering is retried with the host's next invitation.
      if (cancelled() || !(error instanceof ServerError && error.status === 409)) throw error;
    }
  }
  throw new Error('Avbrutet.');
}

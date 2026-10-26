type LinkStatus = 'new' | 'gathering' | 'waiting' | 'connecting' | 'connected' | 'closed' | 'error';
export type PeerRole = 'host' | 'guest';
interface Signal {
  v: 1;
  id: string;
  type: 'offer' | 'answer';
  sdp: string;
}

async function transform(bytes: Uint8Array, decompress: boolean) {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(decompress ? new DecompressionStream('deflate') : new CompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 16_000) throw new Error('Anslutningskoden är för stor.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Compact codes carry only what differs between connections (keys, fingerprint, candidates) and rebuild the
// data-channel SDP from a template, so the pairing codes the room server passes along stay small.
type Compact = { t: 'o' | 'a'; i: string; u: string; p: string; f: string; s: string; m: string; c: string[] };

const lineValue = (sdp: string, prefix: string) =>
  sdp
    .split(/\r?\n/)
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim() ?? '';

function compactSignal(signal: Signal): Compact | undefined {
  const sdp = signal.sdp;
  const fingerprint = lineValue(sdp, 'a=fingerprint:');
  const compact: Compact = {
    t: signal.type === 'offer' ? 'o' : 'a',
    i: signal.id.replace(/-/g, ''),
    u: lineValue(sdp, 'a=ice-ufrag:'),
    p: lineValue(sdp, 'a=ice-pwd:'),
    f: fingerprint.startsWith('sha-256 ') ? fingerprint.slice(8).replace(/:/g, '').toLowerCase() : '',
    s: lineValue(sdp, 'a=setup:'),
    m: lineValue(sdp, 'a=max-message-size:') || '262144',
    // Keep each candidate's essential fields and drop browser extras such as generation and network-cost.
    c: sdp
      .split(/\r?\n/)
      .filter((line) => line.startsWith('a=candidate:'))
      .map((line) => line.slice(12).split(' ').slice(0, 8).join(' ')),
  };
  const valid =
    /^[a-f0-9]{32}$/.test(compact.i) &&
    /^[a-f0-9]{64}$/.test(compact.f) &&
    /^[A-Za-z0-9+/]{4,256}$/.test(compact.u) &&
    /^[A-Za-z0-9+/]{22,256}$/.test(compact.p) &&
    ['actpass', 'active', 'passive'].includes(compact.s) &&
    sdp.includes('webrtc-datachannel');
  return valid ? compact : undefined;
}

function expandSignal(compact: Compact): Signal {
  const id = compact.i.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const fingerprint = compact.f.toUpperCase().match(/../g)?.join(':') ?? '';
  const lines = [
    'v=0',
    `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    ...compact.c.map((candidate) => `a=candidate:${candidate}`),
    `a=ice-ufrag:${compact.u}`,
    `a=ice-pwd:${compact.p}`,
    'a=ice-options:trickle',
    `a=fingerprint:sha-256 ${fingerprint}`,
    `a=setup:${compact.s}`,
    'a=mid:0',
    'a=sctp-port:5000',
    `a=max-message-size:${compact.m}`,
  ];
  return { v: 1, id, type: compact.t === 'o' ? 'offer' : 'answer', sdp: `${lines.join('\r\n')}\r\n` };
}

function validCompact(value: unknown): value is Compact {
  if (!value || typeof value !== 'object') return false;
  const c = value as Compact;
  return (
    (c.t === 'o' || c.t === 'a') &&
    /^[a-f0-9]{32}$/.test(c.i) &&
    /^[A-Za-z0-9+/]{4,256}$/.test(c.u) &&
    /^[A-Za-z0-9+/]{22,256}$/.test(c.p) &&
    /^[a-f0-9]{64}$/.test(c.f) &&
    ['actpass', 'active', 'passive'].includes(c.s) &&
    /^\d{1,10}$/.test(c.m) &&
    Array.isArray(c.c) &&
    c.c.length <= 40 &&
    c.c.every((candidate) => typeof candidate === 'string' && /^[\w.:\- ]{8,200}$/.test(candidate))
  );
}

async function pack(value: unknown, prefix: string) {
  let bytes = new TextEncoder().encode(JSON.stringify(value));
  const compressed = typeof CompressionStream !== 'undefined';
  if (compressed) bytes = new Uint8Array(await transform(bytes, false));
  return `${prefix}.${compressed ? 'Z' : 'P'}.${btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;
}

export async function encodeSignal(signal: Signal) {
  const compact = compactSignal(signal);
  if (compact) return pack(compact, 'CFS2');
  return encodeFullSignal(signal);
}

function encodeFullSignal(signal: Signal) {
  return pack(signal, 'CFS1');
}

export async function decodeSignal(code: string): Promise<Signal> {
  // Messaging apps may wrap long codes or add spaces; codes never contain whitespace.
  const text = code.replace(/\s+/g, '');
  if (/^CFS2\.[ZP]\.[A-Za-z0-9_-]+$/.test(text) && text.length <= 5000) {
    try {
      const bytes = Uint8Array.from(atob(text.slice(7).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      const decoded = text[5] === 'Z' ? await transform(bytes, true) : bytes;
      const value = JSON.parse(new TextDecoder().decode(decoded));
      if (!validCompact(value)) throw new Error();
      return expandSignal(value);
    } catch {
      throw new Error('Anslutningskoden kunde inte läsas. Försök igen.');
    }
  }
  if (text.length > 6000 || !/^CFS1\.[ZP]\.[A-Za-z0-9_-]+$/.test(text)) throw new Error('Det här är ingen anslutningskod från Charlie for Speed.');
  try {
    const bytes = Uint8Array.from(atob(text.slice(7).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const decoded = text[5] === 'Z' ? await transform(bytes, true) : bytes;
    const value = JSON.parse(new TextDecoder().decode(decoded));
    if (
      value?.v !== 1 ||
      typeof value.id !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(value.id) ||
      !['offer', 'answer'].includes(value.type) ||
      typeof value.sdp !== 'string' ||
      value.sdp.length > 12_000 ||
      !value.sdp.startsWith('v=0\r\n')
    )
      throw new Error();
    return value;
  } catch {
    throw new Error('Anslutningskoden kunde inte läsas. Försök igen.');
  }
}

const LABEL = 'charlie-speed-v1';
// Race snapshots replace each other, so they travel unordered without retransmits: a lost one never holds up the next.
const FAST_LABEL = `${LABEL}-fast`;

// Which ways a device offered to be reached: its local address, its internet address (STUN) or a relay (TURN).
function routes(sdp: string) {
  const types = new Set(sdp.split(/\r?\n/).flatMap((line) => (line.startsWith('a=candidate:') ? [line.split(' ')[7]] : [])));
  const names = [types.has('host') && 'lokalt nät', types.has('srflx') && 'via internet', types.has('relay') && 'relä'].filter(Boolean);
  return names.length ? names.join(', ') : 'inga';
}

export class PeerLink {
  status: LinkStatus = 'new';
  code = '';
  error = '';
  private id: string = crypto.randomUUID();
  private peer: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private fast?: RTCDataChannel;
  private listeners = new Set<() => void>();
  private messages = new Set<(message: unknown) => void>();
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private grace?: ReturnType<typeof setTimeout>;
  private localRoutes = '';
  private remoteRoutes = '';
  private readonly online: boolean;
  private disposed = false;
  // Online pairing passes the room's STUN and relay servers.
  constructor(
    public readonly role: PeerRole,
    iceServers: RTCIceServer[] = [],
    // Online pairing gives up sooner, so a blocked network gets a clear message instead of a long wait.
    private readonly timeout = 120_000,
  ) {
    this.online = iceServers.length > 0;
    this.peer = new RTCPeerConnection({ iceServers });
    // 'disconnected' is often a short network hiccup that recovers by itself, so it gets a grace period; 'failed' is final.
    this.peer.onconnectionstatechange = () => {
      const state = this.peer.connectionState;
      if (state === 'failed') this.fail('Anslutningen bröts. Koppla ihop enheterna igen för en ny tävling.');
      else if (state === 'disconnected') {
        clearTimeout(this.grace);
        this.grace = setTimeout(() => {
          if (this.peer.connectionState !== 'connected') this.fail('Anslutningen bröts. Koppla ihop enheterna igen för en ny tävling.');
        }, 10_000);
      } else if (state === 'connected') clearTimeout(this.grace);
    };
    if (role === 'host') {
      this.bind(this.peer.createDataChannel(LABEL, { ordered: true }));
      this.fast = this.peer.createDataChannel(FAST_LABEL, { ordered: false, maxRetransmits: 0 });
      this.listen(this.fast);
    } else
      this.peer.ondatachannel = (event) => {
        if (event.channel.label === FAST_LABEL && !this.fast) {
          this.fast = event.channel;
          return this.listen(this.fast);
        }
        if (event.channel.label !== LABEL || this.channel) return event.channel.close();
        this.bind(event.channel);
      };
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  onMessage(listener: (message: unknown) => void) {
    this.messages.add(listener);
    return () => {
      this.messages.delete(listener);
    };
  }
  private publish() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  private bind(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => {
      if (this.disposed) return;
      clearTimeout(this.timer);
      this.status = 'connected';
      this.publish();
    };
    const left =
      this.role === 'guest'
        ? 'Värden lämnade spelet: stängde det, laddade om eller gick ur lobbyn.'
        : 'Spelaren lämnade spelet: stängde det, laddade om eller gick ur lobbyn.';
    channel.onclose = () => {
      if (!this.disposed) this.fail(left);
    };
    // A device that closes its page, reloads or leaves the lobby aborts the connection, which arrives here as an error
    // (SCTP cause 12, user-initiated abort) rather than as a close.
    channel.onerror = (event) =>
      this.fail((event as RTCErrorEvent).error?.sctpCauseCode === 12 ? left : 'Det gick inte att överföra speldata. Skapa en ny anslutning.');
    this.listen(channel);
  }
  private listen(channel: RTCDataChannel) {
    channel.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data.length > 64_000 || this.disposed) return;
      try {
        const value: unknown = JSON.parse(event.data);
        for (const listener of this.messages) listener(value);
      } catch {
        /* Ignore incomplete or invalid peer messages. */
      }
    };
  }
  // For messages that the next one replaces, such as race snapshots; falls back to the ordered channel.
  sendFast(message: unknown) {
    if (this.status === 'connected' && this.fast?.readyState === 'open' && this.fast.bufferedAmount < 16_000) {
      try {
        this.fast.send(JSON.stringify(message));
        return true;
      } catch {
        /* Fall through to the ordered channel. */
      }
    }
    return this.send(message);
  }
  send(message: unknown) {
    if (this.status !== 'connected' || this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 64_000) return false;
    try {
      this.channel.send(JSON.stringify(message));
      return true;
    } catch {
      this.fail('Anslutningen kunde inte skicka speldata.');
      return false;
    }
  }
  private fail(message: string) {
    if (this.disposed) return;
    this.error =
      this.status === 'connected' || !this.remoteRoutes ? message : `${message} (Den här enheten: ${this.localRoutes}. Den andra: ${this.remoteRoutes}.)`;
    this.close();
    this.status = 'error';
    this.publish();
  }
  private async gather(description: RTCSessionDescriptionInit) {
    this.status = 'gathering';
    this.publish();
    const started = Date.now();
    await this.peer.setLocalDescription(description);
    if (this.peer.iceGatheringState !== 'complete')
      await new Promise<void>((resolve, reject) => {
        // Phones often never report gathering as complete, and used to wait the full ten seconds here. A relay
        // address is the last kind to arrive, so once one has and nothing new follows, the code is ready.
        let relay = false;
        let internet = false;
        let settle: ReturnType<typeof setTimeout> | undefined;
        const found = (event: RTCPeerConnectionIceEvent) => {
          if (event.candidate?.type === 'relay') relay = true;
          if (event.candidate?.type === 'srflx') internet = true;
          clearTimeout(settle);
          if (relay) settle = setTimeout(finish, 400);
          // Without a relay (no TURN server, or it is unreachable), an internet address is enough after a few seconds.
          else if (internet) settle = setTimeout(finish, Math.max(400, 3000 - (Date.now() - started)));
        };
        const finish = () => {
          done();
          resolve();
        };
        const done = () => {
          clearTimeout(timer);
          clearTimeout(settle);
          this.peer.removeEventListener('icecandidate', found);
          this.peer.removeEventListener('icegatheringstatechange', check);
          this.peer.removeEventListener('signalingstatechange', check);
        };
        const check = () => {
          if (this.disposed || this.peer.signalingState === 'closed') {
            done();
            reject(new Error('Anslutningen stängdes.'));
          } else if (this.peer.iceGatheringState === 'complete') {
            done();
            resolve();
          }
        };
        // An unreachable STUN server can stall gathering; the addresses found so far are often enough.
        const timer = setTimeout(() => {
          done();
          if (this.peer.localDescription?.sdp.includes('a=candidate:')) resolve();
          else reject(new Error('Nätverksadresserna kunde inte hämtas. Försök igen.'));
        }, 10_000);
        this.peer.addEventListener('icecandidate', found);
        this.peer.addEventListener('icegatheringstatechange', check);
        this.peer.addEventListener('signalingstatechange', check);
        check();
      });
    if (this.disposed || !this.peer.localDescription?.sdp) throw new Error('Anslutningen stängdes.');
    this.localRoutes = routes(this.peer.localDescription.sdp);
    this.code = await encodeSignal({ v: 1, id: this.id, type: description.type as Signal['type'], sdp: this.peer.localDescription.sdp });
    if (!this.disposed && (this.status as LinkStatus) !== 'connected') this.status = 'waiting';
    this.publish();
  }
  async createOffer() {
    if (this.role !== 'host' || this.status !== 'new') return;
    await this.gather(await this.peer.createOffer());
  }
  async createAnswer(code: string) {
    const offer = await decodeSignal(code);
    if (this.role !== 'guest' || this.status !== 'new' || offer.type !== 'offer') throw new Error('Skanna värdens matchkod först.');
    this.id = offer.id;
    this.remoteRoutes = routes(offer.sdp);
    await this.peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await this.gather(await this.peer.createAnswer());
    this.startTimer();
  }
  async acceptAnswer(code: string) {
    const answer = await decodeSignal(code);
    if (this.role !== 'host' || answer.type !== 'answer') throw new Error('Värden ska läsa gästens svarskod.');
    if (answer.id !== this.id) throw new Error('Svaret hör till en annan match. Läs in den aktuella matchkoden på nytt.');
    this.remoteRoutes = routes(answer.sdp);
    await this.peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    if (this.status !== 'connected') this.status = 'connecting';
    this.startTimer();
    this.publish();
  }
  private startTimer() {
    clearTimeout(this.timer);
    if (this.status === 'connected') return;
    const message = this.online
      ? 'Enheterna fick ingen kontakt via internet. Försök igen, eller byt nät, till exempel från mobildata till Wi-Fi.'
      : 'Enheterna fick ingen kontakt. Försök igen.';
    this.timer = setTimeout(() => this.fail(message), this.timeout);
  }
  close() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    clearTimeout(this.grace);
    this.channel?.close();
    this.fast?.close();
    this.peer.close();
    this.status = 'closed';
    this.publish();
  }
}

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
// data-channel SDP from a template, so they fit comfortably through the room server.
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
    c.c.length <= 16 &&
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
  if (compact) return pack(compact, 'CEX2');
  return encodeFullSignal(signal);
}

function encodeFullSignal(signal: Signal) {
  return pack(signal, 'CEX1');
}

export async function decodeSignal(code: string): Promise<Signal> {
  // Messaging apps may wrap long codes or add spaces; codes never contain whitespace.
  const text = code.replace(/\s+/g, '');
  if (/^CEX2\.[ZP]\.[A-Za-z0-9_-]+$/.test(text) && text.length <= 2000) {
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
  if (text.length > 6000 || !/^CEX1\.[ZP]\.[A-Za-z0-9_-]+$/.test(text)) throw new Error('Det här är ingen anslutningskod från Colins hissäventyr.');
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

export class PeerLink {
  status: LinkStatus = 'new';
  code = '';
  error = '';
  private id: string = crypto.randomUUID();
  private peer: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private listeners = new Set<() => void>();
  private messages = new Set<(message: unknown) => void>();
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  // Internet pairing passes STUN servers; devices on the same network need none.
  constructor(
    public readonly role: PeerRole,
    iceServers: RTCIceServer[] = [],
  ) {
    this.peer = new RTCPeerConnection({ iceServers });
    this.peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(this.peer.connectionState)) this.fail('Kontakten bröts. Ni kan koppla ihop er igen med rumskoden.');
    };
    if (role === 'host') this.bind(this.peer.createDataChannel('colin-elevator-v1', { ordered: true }));
    else
      this.peer.ondatachannel = (event) => {
        if (event.channel.label !== 'colin-elevator-v1' || this.channel) return event.channel.close();
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
    channel.onclose = () => {
      if (!this.disposed) this.fail('Den andra enheten lämnade spelet.');
    };
    channel.onerror = () => this.fail('Det gick inte att skicka speldata. Koppla ihop er igen med rumskoden.');
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
    this.error = message;
    this.close();
    this.status = 'error';
    this.publish();
  }
  private async gather(description: RTCSessionDescriptionInit) {
    this.status = 'gathering';
    this.publish();
    await this.peer.setLocalDescription(description);
    if (this.peer.iceGatheringState !== 'complete')
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
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
        this.peer.addEventListener('icegatheringstatechange', check);
        this.peer.addEventListener('signalingstatechange', check);
        check();
      });
    if (this.disposed || !this.peer.localDescription?.sdp) throw new Error('Anslutningen stängdes.');
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
    if (this.role !== 'guest' || this.status !== 'new' || offer.type !== 'offer') throw new Error('Värdens inbjudan behövs först.');
    this.id = offer.id;
    await this.peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await this.gather(await this.peer.createAnswer());
    this.startTimer();
  }
  async acceptAnswer(code: string) {
    const answer = await decodeSignal(code);
    if (this.role !== 'host' || answer.type !== 'answer') throw new Error('Värden behöver gästens svar.');
    if (answer.id !== this.id) throw new Error('Svaret hör till en annan inbjudan. Försök igen.');
    await this.peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    if (this.status !== 'connected') this.status = 'connecting';
    this.startTimer();
    this.publish();
  }
  private startTimer() {
    clearTimeout(this.timer);
    if (this.status === 'connected') return;
    this.timer = setTimeout(() => this.fail('Enheterna fick ingen kontakt. Kolla internet och försök igen med rumskoden.'), 120_000);
  }
  close() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.timer);
    this.channel?.close();
    this.peer.close();
    this.status = 'closed';
    this.publish();
  }
}

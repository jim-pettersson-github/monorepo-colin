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

export async function encodeSignal(signal: Signal) {
  let bytes = new TextEncoder().encode(JSON.stringify(signal));
  const compressed = typeof CompressionStream !== 'undefined';
  if (compressed) bytes = new Uint8Array(await transform(bytes, false));
  return `CFS1.${compressed ? 'Z' : 'P'}.${btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;
}

export async function decodeSignal(code: string): Promise<Signal> {
  const text = code.trim();
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
    throw new Error('Koden kunde inte läsas. Kopiera hela koden eller skanna QR-bilden igen.');
  }
}

export class PeerLink {
  status: LinkStatus = 'new';
  code = '';
  error = '';
  private id: string = crypto.randomUUID();
  private peer = new RTCPeerConnection({ iceServers: [] });
  private channel?: RTCDataChannel;
  private listeners = new Set<() => void>();
  private messages = new Set<(message: unknown) => void>();
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  constructor(public readonly role: PeerRole) {
    this.peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(this.peer.connectionState)) this.fail('Anslutningen bröts. Koppla ihop enheterna igen för en ny tävling.');
    };
    if (role === 'host') this.bind(this.peer.createDataChannel('charlie-speed-v1', { ordered: true }));
    else
      this.peer.ondatachannel = (event) => {
        if (event.channel.label !== 'charlie-speed-v1' || this.channel) return event.channel.close();
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
      if (!this.disposed) this.fail('Den andra spelaren kopplade från. Koppla ihop enheterna igen för en ny tävling.');
    };
    channel.onerror = () => this.fail('Det gick inte att överföra speldata. Skapa en ny anslutning.');
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
        const timer = setTimeout(() => {
          done();
          reject(new Error('Nätverksadresserna kunde inte hämtas. Försök igen.'));
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
    if (this.role !== 'guest' || this.status !== 'new' || offer.type !== 'offer') throw new Error('Skanna värdens matchkod först.');
    this.id = offer.id;
    await this.peer.setRemoteDescription({ type: 'offer', sdp: offer.sdp });
    await this.gather(await this.peer.createAnswer());
    this.startTimer();
  }
  async acceptAnswer(code: string) {
    const answer = await decodeSignal(code);
    if (this.role !== 'host' || answer.type !== 'answer') throw new Error('Värden ska läsa gästens svarskod.');
    if (answer.id !== this.id) throw new Error('Svaret hör till en annan match. Läs in den aktuella matchkoden på nytt.');
    await this.peer.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
    if (this.status !== 'connected') this.status = 'connecting';
    this.startTimer();
    this.publish();
  }
  private startTimer() {
    clearTimeout(this.timer);
    if (this.status === 'connected') return;
    this.timer = setTimeout(() => this.fail('Enheterna fick ingen kontakt. Använd samma vanliga Wi-Fi, undvik gästnätverk och skapa nya koder.'), 120_000);
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

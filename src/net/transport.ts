/** A way to reach other players. Trystero today; a central server later. */
export interface Transport {
  join(roomId: string, password?: string): void;
  leave(): void;
  /** Sends to every peer, or to one peer when target is given. */
  send(data: unknown, target?: string): void;
  /** True while the transport can discover peers (e.g. at least one relay is connected). */
  isConnected(): boolean;
  peerCount(): number;
  onMessage: (peerId: string, data: unknown) => void;
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
}

export type TransportFactory = () => Transport;

abstract class BaseTransport implements Transport {
  onMessage: Transport['onMessage'] = () => {};
  onPeerJoin: Transport['onPeerJoin'] = () => {};
  onPeerLeave: Transport['onPeerLeave'] = () => {};
  abstract join(roomId: string, password?: string): void;
  abstract leave(): void;
  abstract send(data: unknown, target?: string): void;
  abstract isConnected(): boolean;
  abstract peerCount(): number;
}

type LocalEnvelope = { from: string; to?: string; kind: 'hello' | 'bye' | 'msg'; data?: unknown };

/** Connects tabs of the same browser through BroadcastChannel. Used for local play and browser tests. */
export class LocalTransport extends BaseTransport {
  private channel: BroadcastChannel | null = null;
  private peers = new Set<string>();
  private readonly id = crypto.randomUUID();

  join(roomId: string): void {
    this.channel = new BroadcastChannel(`maple-local-${roomId}`);
    this.channel.onmessage = (e: MessageEvent<LocalEnvelope>) => this.receive(e.data);
    this.post({ kind: 'hello' });
    addEventListener('pagehide', this.bye);
  }

  private bye = () => this.post({ kind: 'bye' });

  private receive(env: LocalEnvelope): void {
    if (env.from === this.id || (env.to && env.to !== this.id)) return;
    if (env.kind === 'bye') {
      if (this.peers.delete(env.from)) this.onPeerLeave(env.from);
      return;
    }
    if (!this.peers.has(env.from)) {
      this.peers.add(env.from);
      if (env.kind === 'hello') this.post({ kind: 'hello', to: env.from });
      this.onPeerJoin(env.from);
    }
    if (env.kind === 'msg') this.onMessage(env.from, env.data);
  }

  private post(env: Omit<LocalEnvelope, 'from'>): void {
    this.channel?.postMessage({ ...env, from: this.id });
  }

  leave(): void {
    this.bye();
    removeEventListener('pagehide', this.bye);
    this.channel?.close();
    this.channel = null;
    this.peers.clear();
  }

  send(data: unknown, target?: string): void {
    this.post({ kind: 'msg', data, to: target });
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  peerCount(): number {
    return this.peers.size;
  }
}

/** A transport that never connects (`?net=down`), for testing the offline fallback. */
export class DownTransport extends BaseTransport {
  join(): void {}
  leave(): void {}
  send(): void {}
  isConnected(): boolean {
    return false;
  }
  peerCount(): number {
    return 0;
  }
}

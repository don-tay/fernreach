import type { Room } from 'trystero';
import type { Transport } from './transport';

/** Unique to this game, and separate for local development and the deployed site so test runs never mix with real players. */
const APP_ID = `don-tay.fernreach.${import.meta.env.PROD ? 'live' : 'dev'}`;

type TrysteroModule = typeof import('trystero');

/**
 * Peer-to-peer transport over WebRTC. Public Nostr relays only introduce peers;
 * game data then flows directly between browsers.
 */
export class TrysteroTransport implements Transport {
  onMessage: Transport['onMessage'] = () => {};
  onPeerJoin: Transport['onPeerJoin'] = () => {};
  onPeerLeave: Transport['onPeerLeave'] = () => {};
  private room: Room | null = null;
  private lib: TrysteroModule | null = null;
  private sendAction: ((data: unknown, target?: string) => void) | null = null;
  private left = false;

  join(roomId: string, password?: string): void {
    import('trystero').then((lib) => {
      if (this.left) return;
      this.lib = lib;
      const room = lib.joinRoom({ appId: APP_ID, password, relayConfig: { warnOnRelayFailure: false } }, roomId);
      const action = room.makeAction<string>('m');
      action.onMessage = (data, { peerId }) => {
        try {
          this.onMessage(peerId, JSON.parse(data));
        } catch {
          // Ignore malformed payloads.
        }
      };
      this.sendAction = (data, target) => void action.send(JSON.stringify(data), target ? { target } : undefined).catch(() => {});
      room.onPeerJoin = (id) => this.onPeerJoin(id);
      room.onPeerLeave = (id) => this.onPeerLeave(id);
      this.room = room;
    });
  }

  leave(): void {
    this.left = true;
    void this.room?.leave();
    this.room = null;
    this.sendAction = null;
  }

  send(data: unknown, target?: string): void {
    this.sendAction?.(data, target);
  }

  isConnected(): boolean {
    if (!this.lib || !this.room) return false;
    const sockets = Object.values(this.lib.getRelaySockets() ?? {}) as WebSocket[];
    return sockets.some((s) => s.readyState === WebSocket.OPEN);
  }

  peerCount(): number {
    return this.room ? Object.keys(this.room.getPeers()).length : 0;
  }
}

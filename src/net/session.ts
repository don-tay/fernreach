import type { Look, Outgoing, Pose, ProfileMsg, Sample } from './protocol';
import { cleanText, CHAT_MAX, interpolate, parseMessage, PROTOCOL_VERSION } from './protocol';
import { CHANNELS } from './settings';
import type { NetSettings } from './settings';
import type { Transport, TransportFactory } from './transport';

export const MAX_PLAYERS = 20;
export const CONNECT_TIMEOUT = 10_000;
export const RETRY_INTERVAL = 30_000;
export const STALE_TIMEOUT = 10_000;
export const STATE_INTERVAL = 100;
export const KEEPALIVE_INTERVAL = 2_000;
export const FULL_CHECK_DELAY = 5_000;
export const INTERP_DELAY = 100;
export const BUBBLE_TIME = 5_000;
export const CHAT_INTERVAL = 1_000;
const SNAP_DISTANCE = 300;

/** What the local player shares with others. */
export interface LocalPlayer {
  playerId: string;
  name: string;
  level: number;
  look: Look;
  map: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: Pose;
}

export interface Bubble {
  text: string;
  until: number;
}

export interface RemotePlayer {
  peerId: string;
  profile: ProfileMsg | null;
  map: string | null;
  facing: 1 | -1;
  pose: Pose;
  samples: Sample[];
  lastSeen: number;
  lastChat: number;
  bubble: Bubble | null;
}

/** disabled: the player chose offline. retrying: connection failed, retrying in the background. */
export type NetStatus = 'disabled' | 'connecting' | 'online' | 'retrying';

export type NetEvent =
  | { type: 'chat'; name: string; text: string; self: boolean; offline: boolean }
  | { type: 'notice'; text: string };

/** Owns the connection and the list of other players. Rendering and UI read from it. */
export class NetSession {
  status: NetStatus = 'disabled';
  retryAt = 0;
  remotes = new Map<string, RemotePlayer>();
  selfBubble: Bubble | null = null;
  /** Incremented when the player list changes. */
  version = 0;
  private transport: Transport | null = null;
  private connectStarted = 0;
  private joinedAt = 0;
  private fullChecked = false;
  private fullHops = 0;
  private lastStateSent = -Infinity;
  private lastStateKey = '';
  private lastProfileKey = '';
  private lastChatSent = -Infinity;
  private versionNoticeShown = false;
  private listeners: ((e: NetEvent) => void)[] = [];

  constructor(
    private factory: TransportFactory,
    readonly settings: NetSettings,
    private local: () => LocalPlayer,
    private persist: (s: NetSettings) => void,
    private now: () => number = () => performance.now(),
  ) {}

  on(listener: (e: NetEvent) => void): void {
    this.listeners.push(listener);
  }

  private emit(e: NetEvent): void {
    for (const l of this.listeners) l(e);
  }

  private notice(text: string): void {
    this.emit({ type: 'notice', text });
  }

  start(): void {
    if (this.settings.online) this.connect();
  }

  get roomLabel(): string {
    return this.settings.privateCode ? 'Private room' : `Ch ${this.settings.channel}`;
  }

  private get roomId(): string {
    return this.settings.privateCode ? `private-${this.settings.privateCode}` : `ch${this.settings.channel}`;
  }

  // ---------------------------------------------------------------- connection

  private connect(): void {
    this.disconnect();
    const t = this.factory();
    t.onMessage = (peer, data) => this.receive(peer, data);
    t.onPeerJoin = (peer) => this.sendSnapshot(peer);
    t.onPeerLeave = (peer) => this.removeRemote(peer);
    t.join(this.roomId, this.settings.privateCode ?? undefined);
    this.transport = t;
    this.status = 'connecting';
    this.connectStarted = this.now();
    this.fullChecked = false;
    this.version++;
  }

  private disconnect(): void {
    this.transport?.leave();
    this.transport = null;
    this.remotes.clear();
    this.lastProfileKey = '';
    this.lastStateKey = '';
    this.version++;
  }

  private fail(): void {
    this.disconnect();
    this.status = 'retrying';
    this.retryAt = this.now() + RETRY_INTERVAL;
  }

  setOnline(online: boolean): void {
    this.settings.online = online;
    this.persist(this.settings);
    if (online) {
      this.connect();
    } else {
      this.disconnect();
      this.status = 'disabled';
    }
  }

  setChannel(channel: number): void {
    this.settings.channel = channel;
    this.settings.privateCode = null;
    this.fullHops = 0;
    this.persist(this.settings);
    if (this.settings.online) this.connect();
  }

  joinPrivate(code: string): void {
    const clean = cleanText(code, 32);
    if (!clean) return;
    this.settings.privateCode = clean;
    this.persist(this.settings);
    if (this.settings.online) this.connect();
  }

  // ---------------------------------------------------------------- loop

  tick(): void {
    const t = this.now();
    const tr = this.transport;
    if (this.status === 'connecting' && tr) {
      if (tr.isConnected()) {
        this.status = 'online';
        this.joinedAt = t;
        this.version++;
      } else if (t - this.connectStarted > CONNECT_TIMEOUT) {
        this.fail();
      }
    } else if (this.status === 'online' && tr) {
      if (!tr.isConnected()) this.fail();
      else if (!this.fullChecked && t - this.joinedAt >= FULL_CHECK_DELAY) this.checkFull(tr);
    } else if (this.status === 'retrying' && t >= this.retryAt) {
      this.connect();
    }

    if (this.transport) this.sendUpdates(t);
    for (const r of this.remotes.values()) if (t - r.lastSeen > STALE_TIMEOUT) this.removeRemote(r.peerId);
  }

  private checkFull(tr: Transport): void {
    this.fullChecked = true;
    if (tr.peerCount() < MAX_PLAYERS) {
      this.fullHops = 0;
      return;
    }
    this.notice(`${this.roomLabel} is full.`);
    this.fullHops++;
    if (this.settings.privateCode || this.fullHops >= CHANNELS.length) {
      this.fullHops = 0;
      this.fail();
      return;
    }
    this.settings.channel = (this.settings.channel % CHANNELS.length) + 1;
    this.persist(this.settings);
    this.notice(`Trying ${this.roomLabel}…`);
    this.connect();
  }

  private send(msg: Outgoing, target?: string): void {
    this.transport?.send({ ...msg, v: PROTOCOL_VERSION }, target);
  }

  private profileMsg(me: LocalPlayer): Outgoing {
    return { t: 'profile', playerId: me.playerId, name: me.name, level: me.level, look: me.look };
  }

  private stateMsg(me: LocalPlayer): Outgoing {
    return { t: 'state', map: me.map, x: Math.round(me.x), y: Math.round(me.y), facing: me.facing, pose: me.pose };
  }

  private sendUpdates(t: number): void {
    const me = this.local();
    const profile = this.profileMsg(me);
    const profileKey = JSON.stringify(profile);
    if (profileKey !== this.lastProfileKey) {
      this.lastProfileKey = profileKey;
      this.send(profile);
    }
    const state = this.stateMsg(me);
    const stateKey = JSON.stringify(state);
    const elapsed = t - this.lastStateSent;
    if ((stateKey !== this.lastStateKey && elapsed >= STATE_INTERVAL) || elapsed >= KEEPALIVE_INTERVAL) {
      this.lastStateKey = stateKey;
      this.lastStateSent = t;
      this.send(state);
    }
  }

  /** Tell a newly-joined peer who and where we are. */
  private sendSnapshot(peerId: string): void {
    const me = this.local();
    this.send(this.profileMsg(me), peerId);
    this.send(this.stateMsg(me), peerId);
  }

  // ---------------------------------------------------------------- receiving

  receive(peerId: string, raw: unknown): void {
    const parsed = parseMessage(raw);
    if (!parsed.ok) {
      if (parsed.reason === 'version' && !this.versionNoticeShown) {
        this.versionNoticeShown = true;
        this.notice('Some players are on a different game version and are hidden.');
      }
      return;
    }
    const t = this.now();
    const myMap = this.local().map;
    let r = this.remotes.get(peerId);
    if (!r) {
      r = { peerId, profile: null, map: null, facing: 1, pose: 'stand', samples: [], lastSeen: t, lastChat: -Infinity, bubble: null };
      this.remotes.set(peerId, r);
    }
    r.lastSeen = t;
    const msg = parsed.msg;

    if (msg.t === 'profile') {
      const isNew = !r.profile;
      r.profile = msg;
      if (isNew && r.map === myMap) this.notice(`${msg.name} joined the map.`);
      this.version++;
    } else if (msg.t === 'state') {
      if (msg.map !== r.map) {
        if (r.profile && r.map === myMap) this.notice(`${r.profile.name} left the map.`);
        if (r.profile && msg.map === myMap) this.notice(`${r.profile.name} joined the map.`);
        r.map = msg.map;
        r.samples = [];
        this.version++;
      }
      const last = r.samples[r.samples.length - 1];
      if (last && Math.hypot(last.x - msg.x, last.y - msg.y) > SNAP_DISTANCE) r.samples = [];
      r.samples.push({ t, x: msg.x, y: msg.y });
      if (r.samples.length > 20) r.samples.shift();
      r.facing = msg.facing;
      r.pose = msg.pose;
    } else {
      if (!r.profile || msg.map !== myMap || t - r.lastChat < CHAT_INTERVAL * 0.9) return;
      r.lastChat = t;
      r.bubble = { text: msg.text, until: t + BUBBLE_TIME };
      this.emit({ type: 'chat', name: r.profile.name, text: msg.text, self: false, offline: false });
    }
  }

  private removeRemote(peerId: string): void {
    const r = this.remotes.get(peerId);
    if (!r) return;
    this.remotes.delete(peerId);
    if (r.profile && r.map === this.local().map) this.notice(`${r.profile.name} left the map.`);
    this.version++;
  }

  // ---------------------------------------------------------------- chat & queries

  /** Sends a chat line to players on this map. Returns an error message, or null. */
  sendChat(raw: string): string | null {
    const text = cleanText(raw, CHAT_MAX);
    if (!text) return null;
    const t = this.now();
    if (t - this.lastChatSent < CHAT_INTERVAL) return 'You are sending messages too fast.';
    this.lastChatSent = t;
    const me = this.local();
    this.selfBubble = { text, until: t + BUBBLE_TIME };
    const online = this.status === 'online';
    if (online) this.send({ t: 'chat', map: me.map, text });
    this.emit({ type: 'chat', name: me.name, text, self: true, offline: !online });
    return null;
  }

  /** Other players with a known profile on the given map. */
  visible(map: string): RemotePlayer[] {
    return [...this.remotes.values()].filter((r) => r.profile && r.map === map);
  }

  /** Everyone with a known profile in the room. */
  players(): RemotePlayer[] {
    return [...this.remotes.values()].filter((r) => r.profile);
  }

  position(r: RemotePlayer): { x: number; y: number } | null {
    return interpolate(r.samples, this.now() - INTERP_DELAY);
  }

  bubbleText(b: Bubble | null): string | null {
    return b && b.until > this.now() ? b.text : null;
  }

  statusText(): string {
    switch (this.status) {
      case 'online':
        return `● ${this.roomLabel} · ${this.visible(this.local().map).length} nearby`;
      case 'connecting':
        return `◌ Connecting to ${this.roomLabel}…`;
      case 'retrying': {
        const s = Math.max(0, Math.ceil((this.retryAt - this.now()) / 1000));
        return `○ Offline · retrying in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }
      default:
        return '○ Offline';
    }
  }
}

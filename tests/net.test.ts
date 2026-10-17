import { describe, expect, it } from 'vitest';
import { cleanText, interpolate, parseMessage, PROTOCOL_VERSION } from '../src/net/protocol';
import type { LocalPlayer, NetEvent } from '../src/net/session';
import { CONNECT_TIMEOUT, FULL_CHECK_DELAY, MAX_PLAYERS, NetSession, RETRY_INTERVAL, STALE_TIMEOUT } from '../src/net/session';
import type { NetSettings } from '../src/net/settings';
import { loadSettings, saveSettings } from '../src/net/settings';
import type { Transport } from '../src/net/transport';
import { createPlayer } from '../src/logic/player';
import { deserialize, serialize } from '../src/logic/save';

const v = PROTOCOL_VERSION;

describe('protocol', () => {
  it('accepts valid messages and ignores unknown fields', () => {
    const r = parseMessage({ v, t: 'state', map: 'shellgrass_meadow_1', x: 100, y: 640, facing: -1, pose: 'walk', hp: 50 });
    expect(r).toEqual({ ok: true, msg: { v, t: 'state', map: 'shellgrass_meadow_1', x: 100, y: 640, facing: -1, pose: 'walk' } });
  });

  it('rejects other versions and malformed messages', () => {
    expect(parseMessage({ v: v + 1, t: 'chat', map: 'capwood', text: 'hi' })).toEqual({ ok: false, reason: 'version' });
    for (const bad of [null, 'x', [], { v }, { v, t: 'nope' }, { v, t: 'state', map: 'moon', x: 1, y: 1 }, { v, t: 'state', map: 'capwood', x: NaN, y: 1 }, { v, t: 'chat', map: 'capwood', text: '   ' }, { v, t: 'profile', playerId: 'a', name: '', level: 1 }]) {
      expect(parseMessage(bad)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('sanitises profiles: name length, level range and unknown equipment', () => {
    const r = parseMessage({ v, t: 'profile', playerId: 'p1', name: 'A\u0000VeryVeryLongName', level: 99, look: { weapon: 'berry_tonic', hat: 'sky_headscarf' } });
    expect(r.ok && r.msg).toEqual({ v, t: 'profile', playerId: 'p1', name: 'A VeryVeryLo', level: 10, look: { weapon: null, hat: 'sky_headscarf' } });
  });

  it('clamps positions into the map and defaults bad poses', () => {
    const r = parseMessage({ v, t: 'state', map: 'capwood', x: -50, y: 99999, facing: 7, pose: 'moonwalk' });
    expect(r.ok && r.msg).toMatchObject({ x: 0, y: 720, facing: 1, pose: 'stand' });
  });

  it('cleans and truncates chat text', () => {
    expect(cleanText('  hi\n\tthere  ', 80)).toBe('hi there');
    expect(cleanText('x'.repeat(200), 80)).toHaveLength(80);
    const r = parseMessage({ v, t: 'chat', map: 'capwood', text: '<b>hi</b>' });
    expect(r.ok && r.msg.t === 'chat' && r.msg.text).toBe('<b>hi</b>'); // shown as plain text by the UI
  });

  it('interpolates between samples without extrapolating', () => {
    const s = [{ t: 0, x: 0, y: 0 }, { t: 100, x: 100, y: 50 }];
    expect(interpolate([], 10)).toBeNull();
    expect(interpolate(s, -5)).toEqual({ t: 0, x: 0, y: 0 });
    expect(interpolate(s, 50)).toEqual({ x: 50, y: 25 });
    expect(interpolate(s, 500)).toEqual({ t: 100, x: 100, y: 50 });
  });
});

describe('settings and identity', () => {
  it('defaults to online on channel 1 and round-trips', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: () => {} };
    expect(loadSettings(storage)).toEqual({ online: true, channel: 1, privateCode: null });
    saveSettings(storage, { online: false, channel: 3, privateCode: 'abc' });
    expect(loadSettings(storage)).toEqual({ online: false, channel: 3, privateCode: 'abc' });
    data.set('fernreach-net-settings-v1', '{"channel": 9, "online": "yes"}');
    expect(loadSettings(storage)).toEqual({ online: true, channel: 1, privateCode: null });
  });

  it('gives every character a permanent ID, including old saves', () => {
    const a = createPlayer('A');
    const b = createPlayer('B');
    expect(a.id).not.toBe(b.id);
    expect(deserialize(serialize(a))!.id).toBe(a.id);
    const old = JSON.parse(serialize(a));
    delete old.player.id;
    expect(deserialize(JSON.stringify(old))!.id).toMatch(/[0-9a-f-]{36}/);
  });
});

class FakeTransport implements Transport {
  onMessage: Transport['onMessage'] = () => {};
  onPeerJoin: Transport['onPeerJoin'] = () => {};
  onPeerLeave: Transport['onPeerLeave'] = () => {};
  connected = true;
  peers = 0;
  room = '';
  password?: string;
  sent: { data: Record<string, unknown>; target?: string }[] = [];
  left = false;
  join(roomId: string, password?: string) {
    this.room = roomId;
    this.password = password;
  }
  leave() {
    this.left = true;
  }
  send(data: unknown, target?: string) {
    this.sent.push({ data: data as Record<string, unknown>, target });
  }
  isConnected() {
    return this.connected;
  }
  peerCount() {
    return this.peers;
  }
}

function setup(settings: Partial<NetSettings> = {}, configure: (t: FakeTransport) => void = () => {}) {
  let now = 0;
  const transports: FakeTransport[] = [];
  const me: LocalPlayer = {
    playerId: 'me', name: 'Me', level: 3, look: { weapon: 'iron_shortsword', hat: null }, map: 'capwood', x: 100, y: 640, facing: 1, pose: 'stand',
  };
  const saved: NetSettings[] = [];
  const net = new NetSession(
    () => {
      const t = new FakeTransport();
      configure(t);
      transports.push(t);
      return t;
    },
    { online: true, channel: 1, privateCode: null, ...settings },
    () => me,
    (s) => saved.push({ ...s }),
    () => now,
  );
  const events: NetEvent[] = [];
  net.on((e) => events.push(e));
  const advance = (ms: number) => {
    for (let i = 0; i < ms; i += 50) {
      now += 50;
      net.tick();
    }
  };
  const tr = () => transports[transports.length - 1];
  const from = (peer: string, msg: Record<string, unknown>) => tr().onMessage(peer, { v, ...msg });
  const peer = (id: string, name: string, map = 'capwood', x = 200) => {
    from(id, { t: 'profile', playerId: `pid-${id}`, name, level: 2, look: {} });
    from(id, { t: 'state', map, x, y: 640, facing: 1, pose: 'stand' });
  };
  return { net, me, events, advance, tr, transports, from, peer, saved, now: () => now };
}

const notices = (events: NetEvent[]) => events.filter((e) => e.type === 'notice').map((e) => (e as { text: string }).text);

describe('net session: connection', () => {
  it('connects to channel 1 by default and goes online', () => {
    const { net, advance, tr } = setup();
    net.start();
    expect(net.status).toBe('connecting');
    expect(tr().room).toBe('ch1');
    advance(50);
    expect(net.status).toBe('online');
    expect(net.statusText()).toBe('● Ch 1 · 0 nearby');
  });

  it('stays offline when the player chose offline', () => {
    const { net, transports } = setup({ online: false });
    net.start();
    expect(net.status).toBe('disabled');
    expect(transports).toHaveLength(0);
    expect(net.statusText()).toBe('○ Offline');
  });

  it('falls back to offline after the connect timeout and retries every 30 seconds', () => {
    const { net, advance, transports } = setup({}, (t) => (t.connected = false));
    net.start();
    advance(CONNECT_TIMEOUT + 100);
    expect(net.status).toBe('retrying');
    expect(transports[0].left).toBe(true);
    expect(net.statusText()).toMatch(/○ Offline · retrying in 0:(29|30)/);
    advance(RETRY_INTERVAL);
    expect(net.status).toBe('connecting');
    expect(transports).toHaveLength(2);
  });

  it('goes offline when every relay drops', () => {
    const { net, advance, tr } = setup();
    net.start();
    advance(50);
    tr().connected = false;
    advance(50);
    expect(net.status).toBe('retrying');
  });

  it('moves to the next channel when full, and goes offline when all are full', () => {
    const { net, advance, transports, events, saved } = setup({}, (t) => (t.peers = MAX_PLAYERS));
    net.start();
    advance(50 + FULL_CHECK_DELAY);
    expect(transports[1].room).toBe('ch2');
    expect(notices(events)).toContain('Ch 1 is full.');
    expect(saved.at(-1)?.channel).toBe(2);
    advance(50 + FULL_CHECK_DELAY);
    expect(transports[2].room).toBe('ch3');
    advance(50 + FULL_CHECK_DELAY);
    expect(net.status).toBe('retrying');
  });

  it('switches channel, joins private rooms with the code as password, and goes offline on request', () => {
    const { net, tr, saved } = setup();
    net.start();
    net.setChannel(2);
    expect(tr().room).toBe('ch2');
    net.joinPrivate('  secret  ');
    expect(tr().room).toBe('private-secret');
    expect(tr().password).toBe('secret');
    expect(net.roomLabel).toBe('Private room');
    net.setOnline(false);
    expect(net.status).toBe('disabled');
    expect(tr().left).toBe(true);
    expect(saved.at(-1)).toEqual({ online: false, channel: 2, privateCode: 'secret' });
  });
});

describe('net session: players', () => {
  it('sends profile once and state when it changes, with keepalives', () => {
    const { net, me, advance, tr } = setup();
    net.start();
    advance(50);
    const types = () => tr().sent.map((s) => s.data.t);
    expect(types()).toEqual(['profile', 'state']);
    advance(500);
    expect(types()).toEqual(['profile', 'state']);
    me.x = 150;
    advance(100);
    expect(types()).toEqual(['profile', 'state', 'state']);
    advance(2100);
    expect(types().filter((t) => t === 'state').length).toBe(3); // one keepalive after 2s of no change
    expect(tr().sent.every((s) => s.data.v === v)).toBe(true);
  });

  it('greets new peers directly with a snapshot', () => {
    const { net, tr } = setup();
    net.start();
    tr().onPeerJoin('p9');
    expect(tr().sent.filter((s) => s.target === 'p9').map((s) => s.data.t)).toEqual(['profile', 'state']);
  });

  it('tracks players, shows only those on my map, and announces joins and leaves', () => {
    const { net, me, events, peer, from, tr } = setup();
    net.start();
    peer('a', 'Alice');
    peer('b', 'Bob', 'shellgrass_meadow_1');
    expect(net.players().map((r) => r.profile!.name)).toEqual(['Alice', 'Bob']);
    expect(net.visible(me.map).map((r) => r.profile!.name)).toEqual(['Alice']);
    expect(notices(events)).toEqual(['Alice joined the map.']);
    from('a', { t: 'state', map: 'shellgrass_meadow_1', x: 60, y: 640, facing: 1, pose: 'stand' });
    expect(notices(events)).toContain('Alice left the map.');
    from('b', { t: 'state', map: 'capwood', x: 60, y: 640, facing: 1, pose: 'stand' });
    expect(notices(events)).toContain('Bob joined the map.');
    tr().onPeerLeave('b');
    expect(notices(events)).toContain('Bob left the map.');
    expect(net.players()).toHaveLength(1);
  });

  it('removes players who go silent', () => {
    const { net, advance, peer } = setup();
    net.start();
    peer('a', 'Alice');
    advance(STALE_TIMEOUT + 100);
    expect(net.players()).toHaveLength(0);
  });

  it('interpolates remote movement about 100ms behind', () => {
    const { net, advance, from, peer } = setup();
    net.start();
    peer('a', 'Alice', 'capwood', 0);
    advance(100);
    from('a', { t: 'state', map: 'capwood', x: 100, y: 640, facing: 1, pose: 'walk' });
    advance(50);
    const r = net.visible('capwood')[0];
    expect(net.position(r)!.x).toBeCloseTo(50, 0);
    expect(r.pose).toBe('walk');
  });

  it('warns once about players on another version', () => {
    const { net, events, tr } = setup();
    net.start();
    tr().onMessage('x', { v: v + 1, t: 'profile' });
    tr().onMessage('y', { v: v + 1, t: 'profile' });
    expect(notices(events)).toEqual(['Some players are on a different game version and are hidden.']);
    expect(net.players()).toHaveLength(0);
  });
});

describe('net session: chat', () => {
  it('sends chat to the room, shows my bubble and rate-limits me', () => {
    const { net, advance, tr, events } = setup();
    net.start();
    advance(50);
    expect(net.sendChat('  hello  ')).toBeNull();
    expect(tr().sent.at(-1)?.data).toEqual({ v, t: 'chat', map: 'capwood', text: 'hello' });
    expect(net.bubbleText(net.selfBubble)).toBe('hello');
    expect(events.at(-1)).toEqual({ type: 'chat', name: 'Me', text: 'hello', self: true, offline: false });
    expect(net.sendChat('again')).toMatch(/too fast/);
    advance(1000);
    expect(net.sendChat('again')).toBeNull();
    advance(5000);
    expect(net.bubbleText(net.selfBubble)).toBeNull();
  });

  it('shows chat locally when offline', () => {
    const { net, events } = setup({ online: false });
    net.start();
    net.sendChat('anyone?');
    expect(events.at(-1)).toMatchObject({ type: 'chat', self: true, offline: true });
  });

  it('receives chat from players on my map only, rate-limited per player', () => {
    const { net, advance, events, peer, from } = setup();
    net.start();
    peer('a', 'Alice');
    peer('b', 'Bob', 'shellgrass_meadow_1');
    from('a', { t: 'chat', map: 'capwood', text: 'hi!' });
    from('a', { t: 'chat', map: 'capwood', text: 'spam' });
    from('b', { t: 'chat', map: 'shellgrass_meadow_1', text: 'far away' });
    const chats = events.filter((e) => e.type === 'chat');
    expect(chats).toEqual([{ type: 'chat', name: 'Alice', text: 'hi!', self: false, offline: false }]);
    expect(net.bubbleText(net.visible('capwood')[0].bubble)).toBe('hi!');
    advance(1000);
    from('a', { t: 'chat', map: 'capwood', text: 'later' });
    expect(events.filter((e) => e.type === 'chat')).toHaveLength(2);
  });
});

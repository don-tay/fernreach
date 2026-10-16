import { ITEMS } from '../data/items';
import type { EquipItem, EquipSlot } from '../data/items';
import { MAPS } from '../data/maps';
import { MAX_LEVEL } from '../logic/player';
import type { Pose } from '../logic/pose';
import { POSES } from '../logic/pose';

export type { Pose };

/** Bump when messages change incompatibly; peers on other versions are ignored. */
export const PROTOCOL_VERSION = 1;
export const CHAT_MAX = 80;
export const NAME_MAX = 12;

export interface Look {
  weapon: string | null;
  hat: string | null;
}

export interface ProfileMsg {
  v: number;
  t: 'profile';
  playerId: string;
  name: string;
  level: number;
  look: Look;
}

export interface StateMsg {
  v: number;
  t: 'state';
  map: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: Pose;
}

export interface ChatMsg {
  v: number;
  t: 'chat';
  map: string;
  text: string;
}

/**
 * Future fields (for example HP for party members) are added as optional fields
 * and sent only to the peers that should see them. Unknown fields are ignored.
 */
export type NetMessage = ProfileMsg | StateMsg | ChatMsg;
export type Outgoing = Omit<ProfileMsg, 'v'> | Omit<StateMsg, 'v'> | Omit<ChatMsg, 'v'>;

export type Parsed = { ok: true; msg: NetMessage } | { ok: false; reason: 'version' | 'invalid' };

/** Strips control characters, collapses whitespace and truncates. */
export function cleanText(raw: string, max: number): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function cleanLook(raw: unknown): Look {
  const r = isObj(raw) ? raw : {};
  const pick = (id: unknown, slot: EquipSlot) => {
    const item = typeof id === 'string' ? ITEMS[id] : undefined;
    return item?.tab === 'equip' && (item as EquipItem).slot === slot ? item.id : null;
  };
  return { weapon: pick(r.weapon, 'weapon'), hat: pick(r.hat, 'hat') };
}

/** Validates and normalises an incoming message. Never trusts the sender. */
export function parseMessage(raw: unknown): Parsed {
  if (!isObj(raw) || !isNum(raw.v)) return { ok: false, reason: 'invalid' };
  if (raw.v !== PROTOCOL_VERSION) return { ok: false, reason: 'version' };
  const invalid = { ok: false, reason: 'invalid' } as const;
  switch (raw.t) {
    case 'profile': {
      if (typeof raw.playerId !== 'string' || typeof raw.name !== 'string' || !isNum(raw.level)) return invalid;
      const name = cleanText(raw.name, NAME_MAX);
      if (!name) return invalid;
      return {
        ok: true,
        msg: {
          v: PROTOCOL_VERSION, t: 'profile', playerId: raw.playerId.slice(0, 64), name,
          level: Math.min(MAX_LEVEL, Math.max(1, Math.floor(raw.level))), look: cleanLook(raw.look),
        },
      };
    }
    case 'state': {
      if (typeof raw.map !== 'string' || !MAPS[raw.map] || !isNum(raw.x) || !isNum(raw.y)) return invalid;
      const map = MAPS[raw.map];
      const pose = POSES.includes(raw.pose as Pose) ? (raw.pose as Pose) : 'stand';
      return {
        ok: true,
        msg: {
          v: PROTOCOL_VERSION, t: 'state', map: map.id, pose, facing: raw.facing === -1 ? -1 : 1,
          x: Math.min(map.width, Math.max(0, raw.x)), y: Math.min(map.height, Math.max(0, raw.y)),
        },
      };
    }
    case 'chat': {
      if (typeof raw.map !== 'string' || !MAPS[raw.map] || typeof raw.text !== 'string') return invalid;
      const text = cleanText(raw.text, CHAT_MAX);
      if (!text) return invalid;
      return { ok: true, msg: { v: PROTOCOL_VERSION, t: 'chat', map: raw.map, text } };
    }
    default:
      return invalid;
  }
}

export interface Sample {
  t: number;
  x: number;
  y: number;
}

/** Position at time t, linearly interpolated between received samples (no extrapolation). */
export function interpolate(samples: Sample[], t: number): { x: number; y: number } | null {
  if (!samples.length) return null;
  if (t <= samples[0].t) return samples[0];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (t <= b.t) {
      const k = (t - a.t) / (b.t - a.t || 1);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return samples[samples.length - 1];
}

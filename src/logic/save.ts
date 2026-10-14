import { ITEMS } from '../data/items';
import { MAPS, TOWN_MAP } from '../data/maps';
import type { PlayerState } from './player';
import { createPlayer, MAX_LEVEL } from './player';

export const SAVE_KEY = 'maple-mvp-save-v1';
const VERSION = 1;

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(p: PlayerState): string {
  return JSON.stringify({ version: VERSION, player: p });
}

/** Parses a save, filling in defaults for missing fields. Returns null for corrupt or incompatible data. */
export function deserialize(raw: string | null): PlayerState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== VERSION || typeof data.player !== 'object') return null;
    const base = createPlayer(String(data.player.name ?? 'Mapler'));
    const p: PlayerState = { ...base, ...data.player };
    p.skills = { ...base.skills, ...data.player.skills };
    p.equipment = { ...base.equipment, ...data.player.equipment };
    if (!isValid(p)) return null;
    return p;
  } catch {
    return null;
  }
}

function isValid(p: PlayerState): boolean {
  const nums = [p.level, p.exp, p.hp, p.mp, p.maxHp, p.maxMp, p.str, p.dex, p.int, p.luk, p.ap, p.sp, p.mesos, p.x, p.y];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  if (p.level < 1 || p.level > MAX_LEVEL) return false;
  if (!MAPS[p.mapId]) p.mapId = TOWN_MAP;
  const tabs = ['equip', 'use', 'etc'] as const;
  if (!tabs.every((t) => Array.isArray(p.inventory?.[t]))) return false;
  const known = (id: string | null) => id === null || id in ITEMS;
  return tabs.every((t) => p.inventory[t].every((s) => known(s.itemId) && s.qty > 0)) && Object.values(p.equipment).every(known);
}

export function save(storage: Storage, p: PlayerState): void {
  storage.setItem(SAVE_KEY, serialize(p));
}

export function load(storage: Storage): PlayerState | null {
  return deserialize(storage.getItem(SAVE_KEY));
}

export function clearSave(storage: Storage): void {
  storage.removeItem(SAVE_KEY);
}

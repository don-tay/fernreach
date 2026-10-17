import { ITEMS } from '../data/items';
import { MAPS, TOWN_MAP } from '../data/maps';
import type { PlayerState } from './player';
import { createPlayer, MAX_LEVEL } from './player';

export const SAVE_KEY = 'fernreach-save-v1';
/** Key used before the game was renamed; read once and migrated. */
export const LEGACY_SAVE_KEY = 'maple-mvp-save-v1';
const VERSION = 2;

/** Version 1 saves used different IDs before the rename to Fernreach. */
const V1_IDS: Record<string, string> = {
  red_potion: 'berry_tonic', orange_potion: 'honey_tonic', blue_potion: 'dew_tonic',
  training_sword: 'practice_blade', sword: 'iron_shortsword', wooden_club: 'oak_cudgel', hand_axe: 'woodcutters_hatchet',
  blue_bandana: 'sky_headscarf', brown_cap: 'ranger_cap', white_undershirt: 'linen_tunic', orange_tshirt: 'tangerine_jersey',
  leather_sandals: 'rope_sandals', red_rubber_boots: 'puddle_boots',
  snail_shell: 'mossy_shell', blue_snail_shell: 'dewy_shell', red_snail_shell: 'ember_shell', spore_cap: 'puff_spore',
  orange_mushroom_cap: 'bouncy_cap',
  mushroom_town: 'capwood', snail_hunting_1: 'shellgrass_meadow_1', snail_hunting_2: 'shellgrass_meadow_2',
  amherst_outskirts: 'briarwood_trail',
  three_snails: 'shell_toss', recovery: 'second_wind', nimble_feet: 'quickstep',
  snail_shells: 'shell_garden', orange_mushrooms: 'bouncecap_trouble',
};

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(p: PlayerState): string {
  return JSON.stringify({ version: VERSION, player: p });
}

/** Renames v1 IDs and fields in place. */
function migrateV1(p: Record<string, any>): void {
  const id = (v: unknown) => (typeof v === 'string' ? (V1_IDS[v] ?? v) : v);
  const keys = (o: unknown) =>
    o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [id(k), v])) : o;
  p.acorns = p.mesos;
  delete p.mesos;
  p.mapId = id(p.mapId);
  p.skills = keys(p.skills);
  p.quests = keys(p.quests);
  if (p.equipment && typeof p.equipment === 'object') {
    for (const slot of Object.keys(p.equipment)) p.equipment[slot] = id(p.equipment[slot]);
  }
  for (const tab of Object.values(p.inventory ?? {})) {
    if (Array.isArray(tab)) for (const s of tab) if (s && typeof s === 'object') s.itemId = id(s.itemId);
  }
}

/** Parses a save, filling in defaults for missing fields. Returns null for corrupt or incompatible data. */
export function deserialize(raw: string | null): PlayerState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if ((data?.version !== VERSION && data?.version !== 1) || typeof data.player !== 'object' || !data.player) return null;
    if (data.version === 1) migrateV1(data.player);
    const base = createPlayer(String(data.player.name ?? 'Wanderer'));
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
  const nums = [p.level, p.exp, p.hp, p.mp, p.maxHp, p.maxMp, p.str, p.dex, p.int, p.luk, p.ap, p.sp, p.acorns, p.x, p.y];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  if (p.level < 1 || p.level > MAX_LEVEL) return false;
  if (!MAPS[p.mapId]) p.mapId = TOWN_MAP;
  if (typeof p.id !== 'string' || !p.id) p.id = crypto.randomUUID();
  const tabs = ['equip', 'use', 'etc'] as const;
  if (!tabs.every((t) => Array.isArray(p.inventory?.[t]))) return false;
  const known = (id: string | null) => id === null || id in ITEMS;
  return tabs.every((t) => p.inventory[t].every((s) => known(s.itemId) && s.qty > 0)) && Object.values(p.equipment).every(known);
}

export function save(storage: Storage, p: PlayerState): void {
  storage.setItem(SAVE_KEY, serialize(p));
  storage.removeItem(LEGACY_SAVE_KEY);
}

export function load(storage: Storage): PlayerState | null {
  return deserialize(storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_SAVE_KEY));
}

export function clearSave(storage: Storage): void {
  storage.removeItem(SAVE_KEY);
  storage.removeItem(LEGACY_SAVE_KEY);
}

const CODE_PREFIX = 'FERN1:';

/** A copyable text code holding the whole save, for backing up or moving between devices. */
export function exportCode(p: PlayerState): string {
  const bytes = new TextEncoder().encode(serialize(p));
  return CODE_PREFIX + btoa(String.fromCharCode(...bytes));
}

/** Reads a save code; returns null if it is not a valid Fernreach save. */
export function importCode(code: string): PlayerState | null {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith(CODE_PREFIX)) return null;
  try {
    const bin = atob(trimmed.slice(CODE_PREFIX.length));
    return deserialize(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

import type { EquipItem, EquipSlot } from '../data/items';
import { getItem } from '../data/items';
import type { QuestId } from '../data/quests';
import type { SkillId } from '../data/skills';
import { SKILLS } from '../data/skills';
import { GROUND_Y, TOWN_MAP } from '../data/maps';
import type { Equipment, Inventory } from './inventory';
import { addItem, emptyInventory, removeAt } from './inventory';
import type { Rng } from './rng';

export const MAX_LEVEL = 10;
export const AP_PER_LEVEL = 5;
/** Beginners earn 1 SP per level from 2 to 7 (6 SP total), as in the classic game. */
export const LAST_SP_LEVEL = 7;

/** Classic EXP needed to reach the next level, indexed by current level. */
export const EXP_TABLE: Record<number, number> = {
  1: 15, 2: 34, 3: 57, 4: 92, 5: 135, 6: 372, 7: 560, 8: 840, 9: 1242,
};

export type StatName = 'str' | 'dex' | 'int' | 'luk';

export interface QuestProgress {
  state: 'active' | 'done';
  kills: number;
}

/** Everything that persists in a save. */
export interface PlayerState {
  name: string;
  level: number;
  exp: number;
  hp: number;
  mp: number;
  maxHp: number;
  maxMp: number;
  str: number;
  dex: number;
  int: number;
  luk: number;
  ap: number;
  sp: number;
  mesos: number;
  skills: Record<SkillId, number>;
  inventory: Inventory;
  equipment: Equipment;
  quests: Partial<Record<QuestId, QuestProgress>>;
  mapId: string;
  x: number;
  y: number;
  /** Set once the player has sailed to Victoria Island (end of the MVP). */
  finished: boolean;
}

export function createPlayer(name: string): PlayerState {
  const inventory = emptyInventory();
  addItem(inventory, 'red_potion', 5);
  return {
    name,
    level: 1,
    exp: 0,
    hp: 50,
    mp: 5,
    maxHp: 50,
    maxMp: 5,
    str: 12,
    dex: 5,
    int: 4,
    luk: 4,
    ap: 0,
    sp: 0,
    mesos: 0,
    skills: { three_snails: 0, recovery: 0, nimble_feet: 0 },
    inventory,
    equipment: { weapon: 'training_sword', hat: null, top: 'white_undershirt', shoes: 'leather_sandals' },
    quests: {},
    mapId: TOWN_MAP,
    x: 120,
    y: GROUND_Y,
    finished: false,
  };
}

export function expToNext(level: number): number {
  return EXP_TABLE[level] ?? 0;
}

/** Adds EXP, applying level ups. Returns the number of levels gained. */
export function gainExp(p: PlayerState, amount: number, rng: Rng): number {
  if (p.level >= MAX_LEVEL) return 0;
  p.exp += amount;
  let levels = 0;
  while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level++;
    levels++;
    p.ap += AP_PER_LEVEL;
    if (p.level <= LAST_SP_LEVEL) p.sp += 1;
    p.maxHp += rng.int(12, 16);
    p.maxMp += rng.int(10, 12);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
  }
  if (p.level >= MAX_LEVEL) p.exp = 0;
  return levels;
}

export function addAp(p: PlayerState, stat: StatName): boolean {
  if (p.ap <= 0) return false;
  p[stat]++;
  p.ap--;
  return true;
}

export function addSp(p: PlayerState, skill: SkillId): boolean {
  if (p.sp <= 0 || p.skills[skill] >= SKILLS[skill].maxLevel) return false;
  p.skills[skill]++;
  p.sp--;
  return true;
}

export function equippedItems(p: PlayerState): EquipItem[] {
  return Object.values(p.equipment)
    .filter((id): id is string => id !== null)
    .map((id) => getItem(id) as EquipItem);
}

/** Equips the item at an equip-tab slot, swapping any currently worn item back into the inventory. */
export function equipFromInventory(p: PlayerState, index: number): string | null {
  const slot = p.inventory.equip[index];
  if (!slot) return 'No item there.';
  const item = getItem(slot.itemId) as EquipItem;
  if (p.level < item.reqLevel) return `You need to be level ${item.reqLevel} to equip that.`;
  removeAt(p.inventory, 'equip', index, 1);
  const current = p.equipment[item.slot];
  if (current) addItem(p.inventory, current, 1);
  p.equipment[item.slot] = item.id;
  return null;
}

export function unequip(p: PlayerState, slot: EquipSlot): string | null {
  const current = p.equipment[slot];
  if (!current) return 'Nothing equipped.';
  if (addItem(p.inventory, current, 1) === 0) return 'Your equip inventory is full.';
  p.equipment[slot] = null;
  return null;
}

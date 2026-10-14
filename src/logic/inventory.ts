import type { EquipSlot, InvTab } from '../data/items';
import { getItem } from '../data/items';

export const TAB_CAPACITY = 24;
export const STACK_MAX = 100;

export interface Slot {
  itemId: string;
  qty: number;
}

export type Inventory = Record<InvTab, Slot[]>;
export type Equipment = Record<EquipSlot, string | null>;

export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'hat', 'top', 'shoes'];

export function emptyInventory(): Inventory {
  return { equip: [], use: [], etc: [] };
}

const stackSize = (itemId: string) => (getItem(itemId).tab === 'equip' ? 1 : STACK_MAX);

/** Adds as many as fit; returns how many were added. */
export function addItem(inv: Inventory, itemId: string, qty: number): number {
  const tab = inv[getItem(itemId).tab];
  const max = stackSize(itemId);
  let left = qty;
  for (const slot of tab) {
    if (left === 0) break;
    if (slot.itemId !== itemId || slot.qty >= max) continue;
    const add = Math.min(max - slot.qty, left);
    slot.qty += add;
    left -= add;
  }
  while (left > 0 && tab.length < TAB_CAPACITY) {
    const add = Math.min(max, left);
    tab.push({ itemId, qty: add });
    left -= add;
  }
  return qty - left;
}

export function canAdd(inv: Inventory, itemId: string, qty: number): boolean {
  const copy = structuredClone(inv);
  return addItem(copy, itemId, qty) === qty;
}

export function countItem(inv: Inventory, itemId: string): number {
  return inv[getItem(itemId).tab].reduce((n, s) => (s.itemId === itemId ? n + s.qty : n), 0);
}

/** Removes qty of an item across stacks. Returns false (and changes nothing) if there are not enough. */
export function removeItem(inv: Inventory, itemId: string, qty: number): boolean {
  if (countItem(inv, itemId) < qty) return false;
  const tab = inv[getItem(itemId).tab];
  let left = qty;
  for (let i = tab.length - 1; i >= 0 && left > 0; i--) {
    const slot = tab[i];
    if (slot.itemId !== itemId) continue;
    const take = Math.min(slot.qty, left);
    slot.qty -= take;
    left -= take;
    if (slot.qty === 0) tab.splice(i, 1);
  }
  return true;
}

/** Removes up to qty from one slot. Returns the removed slot contents, or null if the index is invalid. */
export function removeAt(inv: Inventory, tab: InvTab, index: number, qty: number): Slot | null {
  const slot = inv[tab][index];
  if (!slot || qty <= 0) return null;
  const take = Math.min(qty, slot.qty);
  slot.qty -= take;
  if (slot.qty === 0) inv[tab].splice(index, 1);
  return { itemId: slot.itemId, qty: take };
}

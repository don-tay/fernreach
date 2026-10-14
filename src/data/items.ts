export type InvTab = 'equip' | 'use' | 'etc';
export type EquipSlot = 'weapon' | 'hat' | 'top' | 'shoes';

interface BaseItem {
  id: string;
  name: string;
  /** Sell price; buy price for shop items lives in the shop list. */
  sell: number;
  color: string;
}

export interface UseItem extends BaseItem {
  tab: 'use';
  hp?: number;
  mp?: number;
}

export interface EquipItem extends BaseItem {
  tab: 'equip';
  slot: EquipSlot;
  reqLevel: number;
  watk?: number;
  wdef?: number;
  /** Seconds between swings (weapons only). */
  attackDelay?: number;
}

export interface EtcItem extends BaseItem {
  tab: 'etc';
}

export type Item = UseItem | EquipItem | EtcItem;

const list: Item[] = [
  { id: 'red_potion', name: 'Red Potion', tab: 'use', hp: 50, sell: 12, color: '#e0393e' },
  { id: 'orange_potion', name: 'Orange Potion', tab: 'use', hp: 150, sell: 25, color: '#f28c28' },
  { id: 'blue_potion', name: 'Blue Potion', tab: 'use', mp: 100, sell: 40, color: '#3a74e0' },

  { id: 'training_sword', name: 'Training Sword', tab: 'equip', slot: 'weapon', reqLevel: 0, watk: 8, attackDelay: 0.6, sell: 1, color: '#b0b8c0' },
  { id: 'sword', name: 'Sword', tab: 'equip', slot: 'weapon', reqLevel: 1, watk: 15, attackDelay: 0.6, sell: 150, color: '#d8dee6' },
  { id: 'wooden_club', name: 'Wooden Club', tab: 'equip', slot: 'weapon', reqLevel: 5, watk: 18, attackDelay: 0.7, sell: 350, color: '#9a6a3a' },
  { id: 'hand_axe', name: 'Hand Axe', tab: 'equip', slot: 'weapon', reqLevel: 8, watk: 21, attackDelay: 0.75, sell: 550, color: '#8f9aa6' },

  { id: 'blue_bandana', name: 'Blue Bandana', tab: 'equip', slot: 'hat', reqLevel: 1, wdef: 3, sell: 60, color: '#3f7fd8' },
  { id: 'brown_cap', name: 'Brown Leather Cap', tab: 'equip', slot: 'hat', reqLevel: 7, wdef: 6, sell: 150, color: '#8a5a2b' },
  { id: 'white_undershirt', name: 'White Undershirt', tab: 'equip', slot: 'top', reqLevel: 0, wdef: 3, sell: 1, color: '#f4f4f4' },
  { id: 'orange_tshirt', name: 'Orange Sporty T', tab: 'equip', slot: 'top', reqLevel: 5, wdef: 6, sell: 150, color: '#f39a2e' },
  { id: 'leather_sandals', name: 'Leather Sandals', tab: 'equip', slot: 'shoes', reqLevel: 0, wdef: 2, sell: 1, color: '#a87a4a' },
  { id: 'red_rubber_boots', name: 'Red Rubber Boots', tab: 'equip', slot: 'shoes', reqLevel: 5, wdef: 4, sell: 120, color: '#d63c3c' },

  { id: 'snail_shell', name: 'Snail Shell', tab: 'etc', sell: 1, color: '#c08a4a' },
  { id: 'blue_snail_shell', name: 'Blue Snail Shell', tab: 'etc', sell: 2, color: '#4a8ad8' },
  { id: 'red_snail_shell', name: 'Red Snail Shell', tab: 'etc', sell: 3, color: '#d8443a' },
  { id: 'spore_cap', name: 'Spore Cap', tab: 'etc', sell: 3, color: '#b0743e' },
  { id: 'orange_mushroom_cap', name: 'Orange Mushroom Cap', tab: 'etc', sell: 6, color: '#f08a24' },
];

export const ITEMS: Record<string, Item> = Object.fromEntries(list.map((i) => [i.id, i]));

export function getItem(id: string): Item {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

/** Items sold by the Mushroom Town shop, with buy prices. */
export const SHOP: { itemId: string; price: number }[] = [
  { itemId: 'red_potion', price: 25 },
  { itemId: 'orange_potion', price: 50 },
  { itemId: 'blue_potion', price: 80 },
  { itemId: 'sword', price: 300 },
  { itemId: 'wooden_club', price: 700 },
  { itemId: 'hand_axe', price: 1100 },
  { itemId: 'blue_bandana', price: 120 },
  { itemId: 'brown_cap', price: 300 },
  { itemId: 'orange_tshirt', price: 300 },
  { itemId: 'red_rubber_boots', price: 250 },
];

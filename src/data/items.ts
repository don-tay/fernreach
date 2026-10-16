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
  { id: 'berry_tonic', name: 'Berry Tonic', tab: 'use', hp: 60, sell: 15, color: '#d8345a' },
  { id: 'honey_tonic', name: 'Honey Tonic', tab: 'use', hp: 175, sell: 30, color: '#e8a820' },
  { id: 'dew_tonic', name: 'Dew Tonic', tab: 'use', mp: 90, sell: 42, color: '#3aa0e0' },

  { id: 'practice_blade', name: 'Practice Blade', tab: 'equip', slot: 'weapon', reqLevel: 0, watk: 7, attackDelay: 0.6, sell: 1, color: '#b0b8c0' },
  { id: 'iron_shortsword', name: 'Iron Shortsword', tab: 'equip', slot: 'weapon', reqLevel: 1, watk: 14, attackDelay: 0.6, sell: 160, color: '#d8dee6' },
  { id: 'oak_cudgel', name: 'Oak Cudgel', tab: 'equip', slot: 'weapon', reqLevel: 5, watk: 18, attackDelay: 0.7, sell: 340, color: '#9a6a3a' },
  { id: 'woodcutters_hatchet', name: "Woodcutter's Hatchet", tab: 'equip', slot: 'weapon', reqLevel: 7, watk: 22, attackDelay: 0.75, sell: 560, color: '#8f9aa6' },

  { id: 'sky_headscarf', name: 'Sky Headscarf', tab: 'equip', slot: 'hat', reqLevel: 1, wdef: 3, sell: 65, color: '#4a9ae0' },
  { id: 'ranger_cap', name: 'Ranger Cap', tab: 'equip', slot: 'hat', reqLevel: 6, wdef: 6, sell: 160, color: '#5a7a3a' },
  { id: 'linen_tunic', name: 'Linen Tunic', tab: 'equip', slot: 'top', reqLevel: 0, wdef: 2, sell: 1, color: '#efe6d2' },
  { id: 'tangerine_jersey', name: 'Tangerine Jersey', tab: 'equip', slot: 'top', reqLevel: 5, wdef: 6, sell: 160, color: '#f39a2e' },
  { id: 'rope_sandals', name: 'Rope Sandals', tab: 'equip', slot: 'shoes', reqLevel: 0, wdef: 2, sell: 1, color: '#c8a46a' },
  { id: 'puddle_boots', name: 'Puddle Boots', tab: 'equip', slot: 'shoes', reqLevel: 5, wdef: 4, sell: 130, color: '#e6c22a' },

  { id: 'mossy_shell', name: 'Mossy Shell', tab: 'etc', sell: 1, color: '#6aa84f' },
  { id: 'dewy_shell', name: 'Dewy Shell', tab: 'etc', sell: 2, color: '#4a8ad8' },
  { id: 'ember_shell', name: 'Ember Shell', tab: 'etc', sell: 4, color: '#d8443a' },
  { id: 'puff_spore', name: 'Puff Spore', tab: 'etc', sell: 3, color: '#a07ad0' },
  { id: 'bouncy_cap', name: 'Bouncy Cap', tab: 'etc', sell: 7, color: '#2fb5a8' },
];

export const ITEMS: Record<string, Item> = Object.fromEntries(list.map((i) => [i.id, i]));

export function getItem(id: string): Item {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

/** Items sold by Tobin's shop in Capwood, with buy prices. */
export const SHOP: { itemId: string; price: number }[] = [
  { itemId: 'berry_tonic', price: 30 },
  { itemId: 'honey_tonic', price: 60 },
  { itemId: 'dew_tonic', price: 85 },
  { itemId: 'iron_shortsword', price: 320 },
  { itemId: 'oak_cudgel', price: 680 },
  { itemId: 'woodcutters_hatchet', price: 1150 },
  { itemId: 'sky_headscarf', price: 130 },
  { itemId: 'ranger_cap', price: 320 },
  { itemId: 'tangerine_jersey', price: 320 },
  { itemId: 'puddle_boots', price: 260 },
];

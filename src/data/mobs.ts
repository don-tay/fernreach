export interface Drop {
  itemId: string;
  chance: number;
}

export interface MobDef {
  id: string;
  name: string;
  level: number;
  hp: number;
  exp: number;
  /** Touch damage base. */
  atk: number;
  avoid: number;
  /** Walk speed in px/s. */
  speed: number;
  width: number;
  height: number;
  meso: [number, number];
  drops: Drop[];
}

const list: MobDef[] = [
  {
    id: 'snail', name: 'Snail', level: 1, hp: 8, exp: 3, atk: 3, avoid: 0, speed: 25, width: 36, height: 28,
    meso: [1, 5], drops: [{ itemId: 'snail_shell', chance: 0.6 }, { itemId: 'red_potion', chance: 0.05 }],
  },
  {
    id: 'blue_snail', name: 'Blue Snail', level: 2, hp: 15, exp: 4, atk: 5, avoid: 1, speed: 30, width: 36, height: 28,
    meso: [2, 7], drops: [{ itemId: 'blue_snail_shell', chance: 0.6 }, { itemId: 'red_potion', chance: 0.06 }],
  },
  {
    id: 'spore', name: 'Spore', level: 2, hp: 20, exp: 5, atk: 6, avoid: 1, speed: 40, width: 30, height: 30,
    meso: [3, 9], drops: [{ itemId: 'spore_cap', chance: 0.55 }, { itemId: 'blue_potion', chance: 0.05 }],
  },
  {
    id: 'red_snail', name: 'Red Snail', level: 4, hp: 45, exp: 8, atk: 10, avoid: 2, speed: 35, width: 38, height: 30,
    meso: [5, 15], drops: [
      { itemId: 'red_snail_shell', chance: 0.55 },
      { itemId: 'orange_potion', chance: 0.05 },
      { itemId: 'blue_bandana', chance: 0.02 },
    ],
  },
  {
    id: 'orange_mushroom', name: 'Orange Mushroom', level: 8, hp: 80, exp: 15, atk: 18, avoid: 4, speed: 50, width: 46, height: 46,
    meso: [10, 30], drops: [
      { itemId: 'orange_mushroom_cap', chance: 0.55 },
      { itemId: 'orange_potion', chance: 0.08 },
      { itemId: 'red_rubber_boots', chance: 0.02 },
      { itemId: 'hand_axe', chance: 0.01 },
    ],
  },
];

export const MOBS: Record<string, MobDef> = Object.fromEntries(list.map((m) => [m.id, m]));

export function getMob(id: string): MobDef {
  const mob = MOBS[id];
  if (!mob) throw new Error(`Unknown mob: ${id}`);
  return mob;
}

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
  /** Acorns dropped (min, max). */
  acorns: [number, number];
  drops: Drop[];
}

const list: MobDef[] = [
  {
    id: 'shellbug', name: 'Shellbug', level: 1, hp: 10, exp: 4, atk: 3, avoid: 0, speed: 28, width: 36, height: 28,
    acorns: [1, 4], drops: [{ itemId: 'mossy_shell', chance: 0.55 }, { itemId: 'berry_tonic', chance: 0.06 }],
  },
  {
    id: 'dewshell', name: 'Dewshell', level: 2, hp: 18, exp: 5, atk: 5, avoid: 1, speed: 32, width: 36, height: 28,
    acorns: [2, 6], drops: [{ itemId: 'dewy_shell', chance: 0.55 }, { itemId: 'berry_tonic', chance: 0.07 }],
  },
  {
    id: 'puffling', name: 'Puffling', level: 3, hp: 22, exp: 6, atk: 6, avoid: 1, speed: 42, width: 30, height: 30,
    acorns: [3, 8], drops: [{ itemId: 'puff_spore', chance: 0.5 }, { itemId: 'dew_tonic', chance: 0.06 }],
  },
  {
    id: 'embershell', name: 'Embershell', level: 5, hp: 52, exp: 10, atk: 11, avoid: 2, speed: 36, width: 38, height: 30,
    acorns: [6, 14], drops: [
      { itemId: 'ember_shell', chance: 0.5 },
      { itemId: 'honey_tonic', chance: 0.06 },
      { itemId: 'sky_headscarf', chance: 0.025 },
    ],
  },
  {
    id: 'bouncecap', name: 'Bouncecap', level: 7, hp: 95, exp: 18, atk: 17, avoid: 4, speed: 48, width: 46, height: 46,
    acorns: [12, 28], drops: [
      { itemId: 'bouncy_cap', chance: 0.5 },
      { itemId: 'honey_tonic', chance: 0.09 },
      { itemId: 'puddle_boots', chance: 0.025 },
      { itemId: 'woodcutters_hatchet', chance: 0.012 },
    ],
  },
];

export const MOBS: Record<string, MobDef> = Object.fromEntries(list.map((m) => [m.id, m]));

export function getMob(id: string): MobDef {
  const mob = MOBS[id];
  if (!mob) throw new Error(`Unknown mob: ${id}`);
  return mob;
}
